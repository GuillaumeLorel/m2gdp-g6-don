import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import { CalendarDays, ChevronDown, ChevronLeft, Heart, Loader2, Lock, MapPin, Sparkles } from "lucide-react";
import Badge from "@/components/Badge.jsx";
import { Button } from "@/components/ui/button.jsx";
import Champ, { CLASSES_CHAMP } from "@/components/Champ.jsx";
import ChampAdresse from "@/components/ChampAdresse.jsx";
import { EtatVide } from "@/components/Etats.jsx";
import ImageAnnonce from "@/components/ImageAnnonce.jsx";
import PhotosAnnonce from "@/components/PhotosAnnonce.jsx";
import {
  chargerAssociations,
  chargerCategories,
  enregistrerProfil,
  genererBrouillon,
  iaDisponible,
  modifierAnnonce,
  publierAnnonce,
} from "@/lib/api.js";
import { LIBELLES_ETAT, formaterCreneau, formaterParticipation } from "@/lib/format.js";
import { cn } from "@/lib/utils.js";

/** Champ du brouillon IA ou du formulaire -> zone mise en evidence quand elle est a verifier. */
const ZONES = {
  titre: "titre",
  description: "description",
  categorieId: "categorie",
  sousCategorieId: "categorie",
  etat: "etat",
  participation: "participation",
  participationConseillee: "participation",
  creneauRetrait: "creneau",
  date: "creneau",
  heureDebut: "creneau",
  heureFin: "creneau",
};

/** Montants proposes d'un geste : une participation se veut modeste. */
const MONTANTS_SUGGERES = [1, 2, 5];

/** Date du jour en heure locale, au format des champs date (AAAA-MM-JJ). */
function jourLocal(decalageJours = 0) {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Jour et heures locaux d'un creneau, pour les champs date et heure. */
function champsCreneau(creneau) {
  const debut = new Date(creneau.debut);
  const fin = new Date(creneau.fin);
  const hm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const j = `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, "0")}-${String(debut.getDate()).padStart(2, "0")}`;
  return { date: j, heureDebut: hm(debut), heureFin: hm(fin) };
}

/** « 2,50 » ou « 2.5 » -> 2.5 ; NaN si ce n'est pas un montant. */
const lireMontant = (saisie) => (/^\d+([.,]\d{1,2})?$/.test(saisie.trim()) ? Number(saisie.trim().replace(",", ".")) : NaN);

/** Champ prerempli par l'IA et a verifier : filet et halo citron-ocre. */
const CLASSES_INCERTAIN = "border-alerte ring-4 ring-citron";

/** Liste deroulante native : le selecteur du telephone est le plus pratique au pouce. */
function ChampListe({ id, etiquette, aide, erreur, incertain, children, ...props }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="doneo-etiquette">
        {etiquette}
      </label>
      <div className="relative">
        <select
          id={id}
          className={cn(CLASSES_CHAMP, "appearance-none pr-11 disabled:opacity-50", incertain && CLASSES_INCERTAIN)}
          aria-invalid={erreur ? "true" : undefined}
          {...props}>
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      {aide && <p className="text-xs leading-5 text-muted-foreground">{aide}</p>}
    </div>
  );
}

/** Message d'erreur sous un champ. */
const ErreurChamp = ({ children }) => (
  <p role="alert" className="text-sm text-destructive">
    {children}
  </p>
);

/**
 * Creer une annonce (US-6 a US-8, issues #34, #35, #36), d'apres l'ecran 09
 * de la maquette, en deux etapes :
 *  1. l'objet : photos, titre, categorie et sous-categorie, etat, description ;
 *  2. le retrait : participation, creneau, association, adresse (preremplie
 *     depuis le profil).
 *
 * La saisie vit dans cet ecran : revenir a l'etape 1 ne perd rien, quitter
 * l'ecran perd tout (pas de brouillon, hors perimetre). Le serveur revalide
 * tout et renvoie toutes ses objections d'un coup.
 *
 * Avec `edition` (la fiche complete de GET /api/annonces/{id}/edition), le
 * meme ecran sert a modifier une annonce (US-11, #39) : prerempli, avec les
 * champs figes par une reservation en cours grises.
 */
export default function CreerAnnonce({ profil, surProfil, edition = null }) {
  const naviguer = useNavigate();
  const id = useId();
  const [etape, setEtape] = useState(1);
  const [categories, setCategories] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [photos, setPhotos] = useState(() => (edition?.medias || []).map((m) => ({ id: m.id, url: m.url })));
  const figes = new Set(edition?.champsFiges || []);
  const [touches, setTouches] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const [erreurs, setErreurs] = useState(null);
  // Assistant de redaction : disponible ou non, zones a verifier, brouillon utilise.
  const [iaOk, setIaOk] = useState(false);
  const [incertains, setIncertains] = useState(() => new Set());
  const [assistee, setAssistee] = useState(false);
  const [champs, setChamps] = useState(() =>
    edition
      ? {
          titre: edition.titre,
          categorieId: edition.categorieId,
          sousCategorieId: edition.sousCategorieId,
          etat: edition.etat,
          description: edition.description || "",
          participation: String(edition.participation).replace(".", ","),
          associationId: edition.associationId,
          ...champsCreneau(edition.creneauRetrait),
          numeroRue: edition.numeroRue,
          rue: edition.rue,
          complementAdresse: edition.complementAdresse || "",
          codePostal: edition.codePostal,
          ville: edition.ville,
        }
      : {
          titre: "",
          categorieId: "",
          sousCategorieId: "",
          etat: "",
          description: "",
          participation: "",
          associationId: "",
          date: jourLocal(1),
          heureDebut: "18:00",
          heureFin: "20:00",
          // US-8 : le lieu de retrait part de l'adresse du profil, modifiable ici
          // sans toucher au profil.
          numeroRue: profil.numeroRue || "",
          rue: profil.rue || "",
          complementAdresse: profil.complementAdresse || "",
          codePostal: profil.codePostal || "",
          ville: profil.ville || "",
        },
  );

  useEffect(() => {
    chargerCategories().then(setCategories).catch(() => {});
    chargerAssociations().then(setAssociations).catch(() => {});
    if (!edition) iaDisponible().then(setIaOk);
  }, [edition]);

  // Chaque etape commence en haut de l'ecran.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [etape]);

  // Corriger un champ prerempli par l'IA lui retire sa mise en evidence.
  const valide = (cle) => setIncertains((s) => (s.has(ZONES[cle]) ? new Set([...s].filter((z) => z !== ZONES[cle])) : s));
  const modifier = (cle) => (e) => {
    setChamps((p) => ({ ...p, [cle]: e.target.value }));
    valide(cle);
  };

  /** Applique le brouillon de l'IA : il prerempli le formulaire, rien n'est publie. */
  function appliquerBrouillon(b) {
    setChamps((p) => ({
      ...p,
      ...(b.titre ? { titre: b.titre } : {}),
      ...(b.description ? { description: b.description } : {}),
      ...(b.sousCategorieId ? { categorieId: b.categorieId, sousCategorieId: b.sousCategorieId } : {}),
      ...(b.etat ? { etat: b.etat } : {}),
      ...(b.participationConseillee ? { participation: String(b.participationConseillee).replace(".", ",") } : {}),
      ...(b.creneauRetrait ? champsCreneau(b.creneauRetrait) : {}),
    }));
    setIncertains(new Set((b.champsIncertains || []).map((c) => ZONES[c]).filter(Boolean)));
    setAssistee(true);
  }
  const toucher = (cle) => () => setTouches((t) => ({ ...t, [cle]: true }));

  if (!profil.roles?.includes("offrant")) {
    return <RoleOffrantManquant profil={profil} surProfil={surProfil} />;
  }

  const categorie = categories.find((c) => c.id === champs.categorieId);
  const sousCategorie = categorie?.sousCategories.find((s) => s.id === champs.sousCategorieId);
  const titreManquant = !champs.titre.trim();
  const etape1Complete =
    !titreManquant && categorie && champs.sousCategorieId && champs.etat && champs.description.trim();

  const participation = lireMontant(champs.participation);
  const participationValide = participation > 0;
  const debut = new Date(`${champs.date}T${champs.heureDebut}`);
  const fin = new Date(`${champs.date}T${champs.heureFin}`);
  const creneauSaisi = champs.date && champs.heureDebut && champs.heureFin;
  // En modification, un creneau inchange n'a pas a etre dans le futur : on
  // corrige une description sans devoir reporter le rendez-vous.
  const creneauInchange =
    edition && debut.getTime() === Date.parse(edition.creneauRetrait.debut) && fin.getTime() === Date.parse(edition.creneauRetrait.fin);
  const erreurCreneau = !creneauSaisi
    ? null
    : debut <= new Date() && !creneauInchange
      ? "Le créneau doit commencer dans le futur."
      : fin <= debut
        ? "L’heure de fin doit suivre l’heure de début."
        : null;
  const adresseComplete =
    champs.numeroRue.trim() && champs.rue.trim().length >= 2 && /^\d{5}$/.test(champs.codePostal) && champs.ville.trim();
  const etape2Complete = participationValide && creneauSaisi && !erreurCreneau && champs.associationId && adresseComplete;

  async function publier(evenement) {
    evenement.preventDefault();
    setErreurs(null);
    setEnvoi(true);
    try {
      const envoyer = edition ? (champsAnnonce) => modifierAnnonce(edition.id, champsAnnonce) : publierAnnonce;
      const annonce = await envoyer({
        titre: champs.titre.trim(),
        description: champs.description.trim(),
        categorieId: champs.categorieId,
        sousCategorieId: champs.sousCategorieId,
        etat: champs.etat,
        participation,
        associationId: champs.associationId,
        creneauRetrait: { debut: debut.toISOString(), fin: fin.toISOString() },
        numeroRue: champs.numeroRue.trim(),
        rue: champs.rue.trim(),
        complementAdresse: champs.complementAdresse.trim(),
        codePostal: champs.codePostal.trim(),
        ville: champs.ville.trim(),
        mediaIds: photos.map((p) => p.id),
        ...(assistee && !edition ? { assisteeParIA: true } : {}),
      });
      // replace : « Retour » depuis la fiche ne rouvre pas le formulaire vide.
      naviguer(`/annonces/${annonce.id}`, { replace: true, state: edition ? { modifiee: true } : { publiee: true } });
    } catch (e) {
      setErreurs(e.erreurs || [e.message]);
      setEnvoi(false);
    }
  }

  const revenir = () => (etape === 2 ? setEtape(1) : window.history.state?.idx > 0 ? naviguer(-1) : naviguer("/"));

  return (
    // Grand ecran : le formulaire a gauche, l'apercu de l'annonce a droite,
    // qui reste a l'ecran pendant la saisie. Mobile : le formulaire seul.
    <section className="mx-auto w-full max-w-xl pb-4 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-14">
      <div>
      <header>
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={revenir}
            aria-label={etape === 2 ? "Revenir à l’étape 1" : "Retour"}
            className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/10 bg-white text-ardoise shadow-sm">
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15" role="presentation">
            <div className={`h-full rounded-full bg-primary transition-all ${etape === 1 ? "w-1/2" : "w-full"}`} />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">Étape {etape} sur 2</span>
        </div>
        <h1 className="doneo-titre mt-5 text-[2rem] leading-tight">{edition ? "Modifier l’annonce" : "Créer une annonce"}</h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground text-pretty">
          {etape === 1
            ? "Présentez l’objet que vous donnez."
            : "Fixez la participation, le créneau et le lieu de retrait."}
        </p>
      </header>

      {etape === 1 ? (
        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (etape1Complete) setEtape(2);
          }}>
          <PhotosAnnonce photos={photos} surChangement={setPhotos} publiees={(edition?.medias || []).map((m) => m.id)} />

          {iaOk && <AssistantIA photos={photos} surBrouillon={appliquerBrouillon} fait={assistee} />}

          <div className="space-y-2">
            <Champ
              id={`${id}-titre`}
              etiquette="Titre de l’objet"
              maxLength={80}
              placeholder="Étagère bois 3 niveaux"
              value={champs.titre}
              onChange={modifier("titre")}
              onBlur={toucher("titre")}
              className={incertains.has("titre") ? CLASSES_INCERTAIN : undefined}
              aria-invalid={touches.titre && titreManquant ? "true" : undefined}
            />
            {touches.titre && titreManquant && <ErreurChamp>Le titre est obligatoire</ErreurChamp>}
          </div>

          <ChampListe
            id={`${id}-categorie`}
            etiquette="Catégorie"
            value={champs.categorieId}
            incertain={incertains.has("categorie")}
            onChange={(e) => {
              setChamps((p) => ({ ...p, categorieId: e.target.value, sousCategorieId: "" }));
              valide("categorieId");
            }}>
            <option value="" disabled>
              Choisir une catégorie
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
              </option>
            ))}
          </ChampListe>

          {/* US-6 : seules les sous-categories de la categorie choisie. */}
          <ChampListe
            id={`${id}-sous-categorie`}
            etiquette="Sous-catégorie"
            disabled={!categorie}
            incertain={incertains.has("categorie")}
            value={champs.sousCategorieId}
            onChange={modifier("sousCategorieId")}>
            <option value="" disabled>
              {categorie ? "Choisir une sous-catégorie" : "Choisissez d’abord une catégorie"}
            </option>
            {categorie?.sousCategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.libelle}
              </option>
            ))}
          </ChampListe>

          <ChampListe id={`${id}-etat`} etiquette="État" incertain={incertains.has("etat")} value={champs.etat} onChange={modifier("etat")}>
            <option value="" disabled>
              Choisir l’état
            </option>
            {Object.entries(LIBELLES_ETAT).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </ChampListe>

          <div className="space-y-2">
            <label htmlFor={`${id}-description`} className="doneo-etiquette">
              Description
            </label>
            <textarea
              id={`${id}-description`}
              rows={4}
              maxLength={1000}
              placeholder="Décrivez l’objet, ses dimensions et son état…"
              className={cn(CLASSES_CHAMP, "h-auto min-h-28 resize-y py-3", incertains.has("description") && CLASSES_INCERTAIN)}
              value={champs.description}
              onChange={modifier("description")}
            />
          </div>

          <Button type="submit" variant="doneo" size="pilule" className="mt-2 w-full" disabled={!etape1Complete}>
            Continuer
          </Button>
        </form>
      ) : (
        <form className="mt-6 space-y-5" noValidate onSubmit={publier}>
          {figes.size > 0 && (
            <p className="flex gap-2.5 rounded-2xl bg-citron/60 p-3.5 text-xs leading-5 text-ardoise">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                Une demande est en cours : la participation et l’association ne changent plus
                {figes.has("numeroRue") ? ", ni l’adresse, déjà communiquée au demandeur" : ""}. Le créneau, lui,
                reste modifiable : le demandeur sera prévenu.
              </span>
            </p>
          )}
          {assistee && (
            <p className="flex gap-2.5 rounded-2xl bg-lavande/50 p-3.5 text-xs leading-5 text-ardoise">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-fonce" aria-hidden="true" />
              <span>
                La participation et le créneau viennent de l’assistant, à titre de suggestion : vous décidez.
                {incertains.has("participation") || incertains.has("creneau") ? " Les champs encadrés sont à vérifier." : ""}
              </span>
            </p>
          )}
          {/* US-7 : participation fixee par l'offrant, versee a l'association. */}
          <fieldset className="space-y-2" disabled={figes.has("participation")}>
            <Champ
              id={`${id}-participation`}
              etiquette="Participation solidaire (€)"
              inputMode="decimal"
              placeholder="2"
              value={champs.participation}
              onChange={modifier("participation")}
              onBlur={toucher("participation")}
              aria-invalid={touches.participation && !participationValide ? "true" : undefined}
              className={incertains.has("participation") ? CLASSES_INCERTAIN : undefined}
              aide="Montant modeste, versé en entier à l’association : vous ne touchez rien."
            />
            <div className="flex gap-2" role="group" aria-label="Montants suggérés">
              {MONTANTS_SUGGERES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={participation === m}
                  onClick={() => setChamps((p) => ({ ...p, participation: String(m) }))}
                  className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors ${
                    participation === m ? "bg-primary text-white" : "border border-primary/15 bg-white text-ardoise"
                  }`}>
                  {m} €
                </button>
              ))}
            </div>
            {touches.participation && !participationValide && (
              <ErreurChamp>Indiquez une participation supérieure à 0 €, par exemple 2.</ErreurChamp>
            )}
          </fieldset>

          {/* US-7 : un creneau ponctuel, a venir. */}
          <fieldset className="space-y-3">
            <legend className="doneo-etiquette">Créneau de retrait</legend>
            <Champ
              id={`${id}-date`}
              etiquette="Jour"
              type="date"
              min={jourLocal()}
              className={incertains.has("creneau") ? CLASSES_INCERTAIN : undefined}
              value={champs.date}
              onChange={modifier("date")}
            />
            <div className="grid grid-cols-2 gap-3">
              <Champ
                id={`${id}-debut`}
                etiquette="De"
                type="time"
                className={incertains.has("creneau") ? CLASSES_INCERTAIN : undefined}
                value={champs.heureDebut}
                onChange={modifier("heureDebut")}
              />
              <Champ
                id={`${id}-fin`}
                etiquette="À"
                type="time"
                className={incertains.has("creneau") ? CLASSES_INCERTAIN : undefined}
                value={champs.heureFin}
                onChange={modifier("heureFin")}
              />
            </div>
            {erreurCreneau && <ErreurChamp>{erreurCreneau}</ErreurChamp>}
          </fieldset>

          <ChampListe
            id={`${id}-association`}
            etiquette="Association soutenue"
            value={champs.associationId}
            disabled={figes.has("associationId")}
            onChange={modifier("associationId")}
            aide="C’est elle qui recevra la participation du demandeur.">
            <option value="" disabled>
              Choisir une association
            </option>
            {associations.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
              </option>
            ))}
          </ChampListe>

          {/* US-8 : adresse preremplie depuis le profil. */}
          <fieldset className="space-y-3" disabled={figes.has("numeroRue")}>
            <legend className="doneo-etiquette">Lieu de retrait</legend>
            <ChampAdresse
              id={`${id}-recherche-adresse`}
              surChoix={(adresse) => setChamps((p) => ({ ...p, ...adresse }))}
            />
            <div className="grid grid-cols-[6rem_1fr] gap-3">
              <Champ
                id={`${id}-numero`}
                etiquette="N°"
                maxLength={10}
                value={champs.numeroRue}
                onChange={modifier("numeroRue")}
              />
              <Champ id={`${id}-rue`} etiquette="Rue" value={champs.rue} onChange={modifier("rue")} />
            </div>
            <Champ
              id={`${id}-complement`}
              etiquette="Complément (facultatif)"
              maxLength={100}
              placeholder="Bât. B, digicode…"
              value={champs.complementAdresse}
              onChange={modifier("complementAdresse")}
            />
            <div className="grid grid-cols-[7rem_1fr] gap-3">
              <Champ
                id={`${id}-code-postal`}
                etiquette="Code postal"
                inputMode="numeric"
                maxLength={5}
                value={champs.codePostal}
                onChange={(e) => setChamps((p) => ({ ...p, codePostal: e.target.value.replace(/\D/g, "").slice(0, 5) }))}
              />
              <Champ id={`${id}-ville`} etiquette="Ville" value={champs.ville} onChange={modifier("ville")} />
            </div>
            <p className="flex gap-2.5 rounded-2xl bg-lavande/50 p-3.5 text-xs leading-5 text-ardoise">
              <Lock className="mt-0.5 size-4 shrink-0 text-violet-fonce" aria-hidden="true" />
              <span>
                L’adresse exacte n’est révélée qu’après le paiement de la participation.
              </span>
            </p>
          </fieldset>

          {erreurs && (
            <div role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-semibold">
                {edition ? "Vos modifications n’ont pas pu être enregistrées :" : "Votre annonce n’a pas pu être publiée :"}
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                {erreurs.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <Button type="submit" variant="doneo" size="pilule" className="w-full" disabled={envoi || !etape2Complete}>
            {envoi ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <Heart className="size-5 fill-current" aria-hidden="true" />
            )}
            {envoi ? "Enregistrement…" : edition ? "Enregistrer les modifications" : "Publier l’annonce"}
          </Button>
        </form>
      )}
      </div>

      <aside
        aria-label="Aperçu de votre annonce"
        className="hidden lg:sticky lg:top-[calc(var(--hauteur-entete)+2rem)] lg:block">
        <Apercu
          etape={etape}
          annonce={{
            titre: champs.titre.trim(),
            etat: champs.etat,
            sousCategorie,
            illustrationUrl: sousCategorie?.illustrationUrl || categorie?.illustrationUrl,
            medias: photos.map((p) => ({ type: "photo", url: p.url })),
            participation: participationValide ? participation : null,
            association: associations.find((a) => a.id === champs.associationId),
            creneauRetrait: creneauSaisi && !erreurCreneau ? { debut: debut.toISOString(), fin: fin.toISOString() } : null,
            ville: champs.ville.trim(),
          }}
        />
      </aside>
    </section>
  );
}

/**
 * « Remplir avec l'IA » (EPIC 12, #29) : l'offrant tape une phrase, l'assistant
 * prerempli le formulaire. L'IA ne publie jamais ; si elle echoue, le
 * formulaire manuel reste la. Le texte et les photos partent chez un tiers :
 * l'envoi est subordonne a un consentement explicite.
 */
function AssistantIA({ photos, surBrouillon, fait }) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [accord, setAccord] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  // Le texte, les photos, ou les deux.
  const pret = (texte.trim().length >= 3 || photos.length > 0) && accord && !envoi;

  async function generer() {
    setEnvoi(true);
    setErreur(null);
    try {
      surBrouillon(await genererBrouillon(texte.trim(), photos.slice(0, 3).map((p) => p.id)));
      setOuvert(false);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (!ouvert) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="doneoSecondaire" size="pilule" className="w-full" onClick={() => setOuvert(true)}>
          <Sparkles className="size-5" aria-hidden="true" />
          {fait ? "Refaire un brouillon avec l’IA" : "Remplir avec l’IA"}
        </Button>
        {fait && (
          <p className="text-xs leading-5 text-muted-foreground">
            Brouillon prêt : relisez-le. Les champs encadrés sont à vérifier.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="doneo-carte space-y-3 p-4" role="group" aria-labelledby={`${id}-titre`}>
      <p id={`${id}-titre`} className="doneo-etiquette flex items-center gap-2">
        <Sparkles className="size-4 text-violet-fonce" aria-hidden="true" />
        Remplir avec l’IA
      </p>
      <label htmlFor={`${id}-texte`} className="block text-sm leading-6 text-ardoise">
        Décrivez l’objet en une phrase, ou ajoutez des photos, ou les deux : l’assistant prépare un brouillon, que vous relisez avant de publier.
      </label>
      <textarea
        id={`${id}-texte`}
        rows={3}
        maxLength={1000}
        placeholder="Vélo de ville bleu, bon état, samedi entre 14 h et 16 h"
        className={cn(CLASSES_CHAMP, "h-auto min-h-24 resize-y py-3")}
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
      />
      <label htmlFor={`${id}-accord`} className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-ardoise">
        <input
          id={`${id}-accord`}
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-primary"
          checked={accord}
          onChange={(e) => setAccord(e.target.checked)}
        />
        <span>
          J’accepte que ce texte et les photos ajoutées ({Math.min(photos.length, 3)} sur 3 au plus ; les 3 premières sont lues) soient envoyés à Google
          (Gemini) pour rédiger le brouillon. Ils peuvent être traités hors de l’Union européenne. Rien n’est publié sans
          mon accord.
        </span>
      </label>
      {erreur && (
        <p role="alert" className="text-sm text-destructive">
          {erreur}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="doneo" size="pilule" className="flex-1" disabled={!pret} onClick={generer}>
          {envoi ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Sparkles className="size-5" aria-hidden="true" />}
          {envoi ? "Rédaction…" : "Générer un brouillon"}
        </Button>
        <Button type="button" variant="doneoSecondaire" size="pilule" disabled={envoi} onClick={() => setOuvert(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

/**
 * Apercu de l'annonce en cours de saisie (grand ecran), dans l'esprit de la
 * fiche : visuel, titre, caracteristiques, participation. Il se remplit au
 * fil de la saisie ; un conseil adapte a l'etape l'accompagne.
 */
function Apercu({ annonce, etape }) {
  return (
    <div className="space-y-4">
      <p className="doneo-etiquette">Aperçu de votre annonce</p>
      <div className="doneo-carte overflow-hidden p-0">
        <ImageAnnonce annonce={annonce} className="aspect-4/3 w-full" />
        <div className="space-y-3 p-5">
          <p className={`doneo-titre text-xl leading-tight ${annonce.titre ? "" : "text-muted-foreground"}`}>
            {annonce.titre || "Titre de l’objet"}
          </p>
          <ul className="flex flex-wrap gap-1.5 text-xs font-medium text-ardoise">
            {annonce.sousCategorie && (
              <li className="rounded-full bg-pervenche px-2.5 py-1">{annonce.sousCategorie.libelle}</li>
            )}
            {annonce.etat && <li><Badge famille="etat">{LIBELLES_ETAT[annonce.etat]}</Badge></li>}
            {annonce.ville && (
              <li className="flex items-center gap-1 rounded-full border border-primary/15 bg-white px-2.5 py-1">
                <MapPin className="size-3" aria-hidden="true" />
                {annonce.ville}
              </li>
            )}
          </ul>
          <div className="rounded-2xl bg-lavande p-3.5">
            <p className="font-titre text-lg leading-tight font-semibold text-ardoise">
              {annonce.participation ? formaterParticipation(annonce.participation) : "… €"}{" "}
              <span className="text-sm font-medium text-violet-fonce">— participation</span>
            </p>
            <p className="mt-0.5 text-xs text-ardoise">
              {annonce.association ? `Reversée à ${annonce.association.nom}` : "Association à choisir à l’étape 2"}
            </p>
          </div>
          {annonce.creneauRetrait && (
            <p className="flex items-center gap-1.5 text-xs text-ardoise">
              <CalendarDays className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              {formaterCreneau(annonce.creneauRetrait)}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-3xl bg-white/60 p-4">
        <img src="/illustrations/objet-etoile.svg" alt="" aria-hidden="true" className="size-9 shrink-0" />
        <p className="text-xs leading-5 text-muted-foreground text-pretty">
          {etape === 1
            ? "Une photo nette et les dimensions aident l’objet à trouver preneur."
            : "La participation soutient une association : ce n’est pas le prix de l’objet."}
        </p>
      </div>
    </div>
  );
}

/**
 * Un compte sans le role offrant ne peut pas publier (US-6). Plutot que de
 * l'envoyer chercher le reglage, on lui propose d'ajouter le role ici.
 */
function RoleOffrantManquant({ profil, surProfil }) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function ajouterRole() {
    setEnvoi(true);
    setErreur(null);
    try {
      surProfil(await enregistrerProfil({ ...profil, roles: [...(profil.roles || []), "offrant"] }));
    } catch (e) {
      setErreur(e.message);
      setEnvoi(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-xl pt-6">
      <h1 className="sr-only">Créer une annonce</h1>
      <EtatVide
        illustration="/illustrations/objet-cadeau.svg"
        titre="Devenez offrant pour donner un objet"
        action={
          <Button variant="doneo" size="pilule" className="w-full" disabled={envoi} onClick={ajouterRole}>
            {envoi ? (
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            ) : (
              <Heart className="size-5 fill-current" aria-hidden="true" />
            )}
            Ajouter le rôle offrant
          </Button>
        }>
        Ajoutez le rôle offrant à votre profil pour publier une annonce.
      </EtatVide>
      {erreur && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {erreur}
        </p>
      )}
    </section>
  );
}
