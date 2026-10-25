import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router";
import { CalendarDays, ChevronDown, ChevronLeft, Heart, Loader2, Lock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import Champ, { CLASSES_CHAMP } from "@/components/Champ.jsx";
import { EtatVide } from "@/components/Etats.jsx";
import ImageAnnonce from "@/components/ImageAnnonce.jsx";
import PhotosAnnonce from "@/components/PhotosAnnonce.jsx";
import { chargerAssociations, chargerCategories, enregistrerProfil, publierAnnonce } from "@/lib/api.js";
import { LIBELLES_ETAT, formaterCreneau, formaterParticipation } from "@/lib/format.js";
import { cn } from "@/lib/utils.js";

/** Montants proposes d'un geste : une participation se veut modeste. */
const MONTANTS_SUGGERES = [1, 2, 5];

/** Date du jour en heure locale, au format des champs date (AAAA-MM-JJ). */
function jourLocal(decalageJours = 0) {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** « 2,50 » ou « 2.5 » -> 2.5 ; NaN si ce n'est pas un montant. */
const lireMontant = (saisie) => (/^\d+([.,]\d{1,2})?$/.test(saisie.trim()) ? Number(saisie.trim().replace(",", ".")) : NaN);

/** Liste deroulante native : le selecteur du telephone est le plus pratique au pouce. */
function ChampListe({ id, etiquette, aide, erreur, children, ...props }) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="doneo-etiquette">
        {etiquette}
      </label>
      <div className="relative">
        <select
          id={id}
          className={cn(CLASSES_CHAMP, "appearance-none pr-11 disabled:opacity-50")}
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
 */
export default function CreerAnnonce({ profil, surProfil }) {
  const naviguer = useNavigate();
  const id = useId();
  const [etape, setEtape] = useState(1);
  const [categories, setCategories] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [touches, setTouches] = useState({});
  const [envoi, setEnvoi] = useState(false);
  const [erreurs, setErreurs] = useState(null);
  const [champs, setChamps] = useState({
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
  });

  useEffect(() => {
    chargerCategories().then(setCategories).catch(() => {});
    chargerAssociations().then(setAssociations).catch(() => {});
  }, []);

  // Chaque etape commence en haut de l'ecran.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [etape]);

  const modifier = (cle) => (e) => setChamps((p) => ({ ...p, [cle]: e.target.value }));
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
  const erreurCreneau = !creneauSaisi
    ? null
    : debut <= new Date()
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
      const annonce = await publierAnnonce({
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
      });
      // replace : « Retour » depuis la fiche ne rouvre pas le formulaire vide.
      naviguer(`/annonces/${annonce.id}`, { replace: true, state: { publiee: true } });
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
        <h1 className="doneo-titre mt-5 text-[2rem] leading-tight">Créer une annonce</h1>
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
          <PhotosAnnonce photos={photos} surChangement={setPhotos} />

          <div className="space-y-2">
            <Champ
              id={`${id}-titre`}
              etiquette="Titre de l’objet"
              maxLength={80}
              placeholder="Étagère bois 3 niveaux"
              value={champs.titre}
              onChange={modifier("titre")}
              onBlur={toucher("titre")}
              aria-invalid={touches.titre && titreManquant ? "true" : undefined}
            />
            {touches.titre && titreManquant && <ErreurChamp>Le titre est obligatoire</ErreurChamp>}
          </div>

          <ChampListe
            id={`${id}-categorie`}
            etiquette="Catégorie"
            value={champs.categorieId}
            onChange={(e) => setChamps((p) => ({ ...p, categorieId: e.target.value, sousCategorieId: "" }))}>
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

          <ChampListe id={`${id}-etat`} etiquette="État" value={champs.etat} onChange={modifier("etat")}>
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
              className={cn(CLASSES_CHAMP, "h-auto min-h-28 resize-y py-3")}
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
          {/* US-7 : participation fixee par l'offrant, versee a l'association. */}
          <div className="space-y-2">
            <Champ
              id={`${id}-participation`}
              etiquette="Participation solidaire (€)"
              inputMode="decimal"
              placeholder="2"
              value={champs.participation}
              onChange={modifier("participation")}
              onBlur={toucher("participation")}
              aria-invalid={touches.participation && !participationValide ? "true" : undefined}
              aide="Un montant modeste, versé intégralement à l’association que vous choisissez. Vous ne touchez rien : c’est ce qui fait de l’objet un don."
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
          </div>

          {/* US-7 : un creneau ponctuel, a venir. */}
          <fieldset className="space-y-3">
            <legend className="doneo-etiquette">Créneau de retrait</legend>
            <Champ
              id={`${id}-date`}
              etiquette="Jour"
              type="date"
              min={jourLocal()}
              value={champs.date}
              onChange={modifier("date")}
            />
            <div className="grid grid-cols-2 gap-3">
              <Champ
                id={`${id}-debut`}
                etiquette="De"
                type="time"
                value={champs.heureDebut}
                onChange={modifier("heureDebut")}
              />
              <Champ id={`${id}-fin`} etiquette="À" type="time" value={champs.heureFin} onChange={modifier("heureFin")} />
            </div>
            {erreurCreneau && <ErreurChamp>{erreurCreneau}</ErreurChamp>}
          </fieldset>

          <ChampListe
            id={`${id}-association`}
            etiquette="Association soutenue"
            value={champs.associationId}
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
          <fieldset className="space-y-3">
            <legend className="doneo-etiquette">Lieu de retrait</legend>
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
                Avant de verser sa participation, le demandeur ne voit que le code postal et la ville. L’adresse
                exacte ne lui est donnée qu’une fois sa participation validée. Modifier l’adresse ici ne change pas
                votre profil.
              </span>
            </p>
          </fieldset>

          {erreurs && (
            <div role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-semibold">Votre annonce n’a pas pu être publiée :</p>
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
            {envoi ? "Publication…" : "Publier l’annonce"}
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
            {annonce.etat && <li className="rounded-full bg-menthe px-2.5 py-1">{LIBELLES_ETAT[annonce.etat]}</li>}
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
            ? "Une photo nette, prise à la lumière du jour, et les dimensions dans la description : l’objet trouve preneur plus vite."
            : "Restez modeste : la participation soutient une association, ce n’est pas le prix de l’objet."}
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
        Votre profil a seulement le rôle demandeur. Ajoutez le rôle offrant à votre profil pour publier une annonce :
        vous garderez aussi la possibilité de demander des objets.
      </EtatVide>
      {erreur && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {erreur}
        </p>
      )}
    </section>
  );
}
