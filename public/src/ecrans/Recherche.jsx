import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Camera, ListFilter, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import CarteAnnonce from "@/components/CarteAnnonce.jsx";
import { EtatVide, ErreurChargement, ListeEnChargement } from "@/components/Etats.jsx";
import EnTeteCollant from "@/components/EnTeteCollant.jsx";
import FeuilleFiltres, { FILTRES_VIDES } from "@/components/FeuilleFiltres.jsx";
import RechercheParPhoto from "@/components/RechercheParPhoto.jsx";
import { chargerCategories, chercherAnnonces, rechercheImageDisponible } from "@/lib/api.js";
import { useGrandEcran } from "@/lib/ecran.js";
import { LIBELLES_ETAT, formaterParticipation } from "@/lib/format.js";

// La carte et Leaflet (~150 ko) ne se chargent qu'a la premiere ouverture.
const CarteResultats = lazy(() => import("@/components/CarteResultats.jsx"));

const PAR_PAGE = 20;
/** Sur la carte, une seule page, la plus grande que l'API accepte. */
const PAR_PAGE_CARTE = 50;
/** Pause de frappe avant de lancer la recherche. */
const DELAI_SAISIE = 300;
const CLES_FILTRES = Object.keys(FILTRES_VIDES);

/** Tris proposes (US-15, issue #43). */
const TRIS = [
  { valeur: "recent", libelle: "Récents", titre: "Les plus récents d’abord" },
  { valeur: "participation", libelle: "Participation", titre: "La plus petite participation d’abord" },
  { valeur: "creneau", libelle: "Créneau", titre: "Le créneau le plus proche d’abord" },
];
/** Tri par proximite (#48) : seulement quand la recherche est centree sur un point. */
const TRI_PROXIMITE = { valeur: "proximite", libelle: "Proximité", titre: "Les plus proches d’abord" };

/** « 1 pépite », « 12 pépites ». */
const pepites = (n) => `${n} ${n > 1 ? "pépites" : "pépite"}`;

/**
 * Recherche en liste (US-13 et US-14, issues #41 et #42), d'apres les ecrans
 * 05 et 07 de la maquette.
 *
 * Mot-cle et filtres vivent dans l'URL : en revenant d'une fiche, on retrouve
 * exactement la meme recherche, et on peut la partager.
 */
export default function Recherche() {
  const [parametres, setParametres] = useSearchParams();
  const q = parametres.get("q") || "";
  // Grand ecran : liste et carte cote a cote, plus de bascule. La vue
  // « carte » de l'URL ne concerne que le mobile.
  const grandEcran = useGrandEcran();
  const surCarte = !grandEcran && parametres.get("vue") === "carte";
  const [survolee, setSurvolee] = useState(null);
  const centree = Boolean(parametres.get("latitude") && parametres.get("longitude"));
  const tris = centree ? [...TRIS, TRI_PROXIMITE] : TRIS;
  const tri = tris.some((t) => t.valeur === parametres.get("tri")) ? parametres.get("tri") : "recent";
  const cleFiltres = CLES_FILTRES.map((c) => parametres.get(c) || "").join("|");
  const filtres = useMemo(
    () => Object.fromEntries(CLES_FILTRES.map((c, i) => [c, cleFiltres.split("|")[i]])),
    [cleFiltres],
  );

  const [saisie, setSaisie] = useState(q);
  // Les resultats gardent les criteres qui les ont produits : le compteur ne
  // doit jamais associer un nouveau mot a l'ancien total.
  const [resultat, setResultat] = useState(null); // { q, annonces, total }
  const [tentative, setTentative] = useState(0);
  const [page, setPage] = useState(1);
  const [suiteEnCours, setSuiteEnCours] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  // Echec de « Voir plus » : distinct de l'erreur de chargement, pour ne pas
  // effacer les resultats deja affiches.
  const [erreurSuite, setErreurSuite] = useState(null);
  const [categories, setCategories] = useState([]);
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const champ = useRef(null);
  const repereCarte = useRef(null);
  const [hautCarte, setHautCarte] = useState(null);

  // Recherche par photo (#143) : proposee seulement si l'IA est activee.
  const [photoDispo, setPhotoDispo] = useState(false);
  const [photoOuverte, setPhotoOuverte] = useState(false);

  useEffect(() => {
    chargerCategories().then(setCategories).catch(() => {});
    rechercheImageDisponible().then(setPhotoDispo);
  }, []);

  /** Remplace des criteres dans l'URL ; une valeur vide retire le critere. */
  const modifierCriteres = useCallback(
    (changements) =>
      setParametres(
        (actuels) => {
          const suivants = new URLSearchParams(actuels);
          for (const [cle, valeur] of Object.entries(changements)) {
            if (valeur === "" || valeur === null || valeur === undefined) suivants.delete(cle);
            else suivants.set(cle, String(valeur));
          }
          return suivants;
        },
        { replace: true },
      ),
    [setParametres],
  );

  // Dernier mot-cle que la saisie a ecrit dans l'URL. Il permet de distinguer
  // nos propres mises a jour d'un changement venu d'ailleurs.
  const qEcrit = useRef(q);

  // La saisie part dans l'URL apres une courte pause, sans recharger la page.
  useEffect(() => {
    if (saisie.trim() === q) return undefined;
    const minuteur = setTimeout(() => {
      qEcrit.current = saisie.trim();
      modifierCriteres({ q: saisie.trim() });
    }, DELAI_SAISIE);
    return () => clearTimeout(minuteur);
  }, [saisie, q, modifierCriteres]);

  // Le mot-cle a change sans passer par la saisie — onglet « Recherche » du
  // menu, retour arriere : le champ suit l'URL. Sans cela, la saisie restee a
  // l'ancien mot le reecrirait dans l'URL a la pause suivante.
  useEffect(() => {
    if (q !== qEcrit.current) {
      qEcrit.current = q;
      setSaisie(q);
    }
  }, [q]);

  const criteres = useMemo(
    // `lieu` n'est que le libelle de la puce : l'API ne le connait pas.
    () => ({ q, ...filtres, lieu: undefined, tri, parPage: surCarte ? PAR_PAGE_CARTE : PAR_PAGE }),
    [q, filtres, tri, surCarte],
  );
  // Criteres en vigueur, lus par « Voir plus » une fois sa reponse arrivee.
  const criteresCourants = useRef(criteres);
  criteresCourants.current = criteres;

  useEffect(() => {
    // Une frappe rapide lance plusieurs recherches : seule la derniere compte,
    // meme si une reponse plus ancienne arrive apres elle.
    //
    // Pendant le chargement, les resultats precedents restent affiches,
    // attenues : les remplacer par des squelettes changerait la hauteur de la
    // page et ferait sauter l'ecran a chaque tri ou filtre.
    let derniere = true;
    setErreur(null);
    setErreurSuite(null);
    setChargement(true);
    chercherAnnonces({ ...criteres, page: 1 })
      .then((r) => {
        if (!derniere) return;
        setResultat({ q: criteres.q, annonces: r.annonces, total: r.total });
        setPage(1);
        // Nouveaux criteres : on repart du haut de la liste, une seule fois,
        // quand les nouveaux resultats sont la.
        if (window.scrollY > 0) window.scrollTo({ top: 0 });
      })
      .catch((e) => derniere && setErreur(e.message))
      .finally(() => derniere && setChargement(false));
    return () => {
      derniere = false;
    };
  }, [criteres, tentative]);

  const reessayer = useCallback(() => setTentative((n) => n + 1), []);
  const fermerFeuille = useCallback(() => setFeuilleOuverte(false), []);
  const annonces = resultat?.annonces ?? null;
  const total = resultat?.total ?? 0;

  async function voirPlus() {
    const demandes = criteres;
    const suivante = page + 1;
    setSuiteEnCours(true);
    setErreurSuite(null);
    try {
      const suite = await chercherAnnonces({ ...demandes, page: suivante });
      // Les criteres ont change pendant l'attente (tri, filtre, mot-cle) :
      // cette page appartient a l'ancienne recherche, on l'ignore.
      if (criteresCourants.current !== demandes) return;
      setResultat((r) => (r ? { ...r, annonces: [...r.annonces, ...suite.annonces] } : r));
      setPage(suivante);
    } catch (e) {
      if (criteresCourants.current === demandes) setErreurSuite(e.message);
    } finally {
      setSuiteEnCours(false);
    }
  }

  // Position de depart de la carte, mesuree : elle suit la hauteur de
  // l'en-tete, qui grandit quand des filtres sont actifs.
  useLayoutEffect(() => {
    if (!surCarte) {
      setHautCarte(null);
      return undefined;
    }
    const mesurer = () => {
      const repere = repereCarte.current;
      if (repere) setHautCarte(Math.round(repere.getBoundingClientRect().top));
    };
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(document.body);
    window.addEventListener("resize", mesurer);
    window.addEventListener("scroll", mesurer, { passive: true });
    return () => {
      observateur.disconnect();
      window.removeEventListener("resize", mesurer);
      window.removeEventListener("scroll", mesurer);
    };
  }, [surCarte, erreur]);

  /** L'IA a reconnu l'objet : sa description alimente la recherche existante. */
  function appliquerPhoto({ nom }) {
    qEcrit.current = nom;
    setSaisie(nom);
    // Le mot seul : la sous-categorie devinee par l'IA ne correspond pas
    // toujours au rangement choisi par l'offrant, et un filtre de trop
    // viderait la liste. Les anciens filtres sont retires pour la meme raison.
    modifierCriteres({ q: nom, categorieId: "", sousCategorieId: "" });
    setPhotoOuverte(false);
  }

  function effacer() {
    setSaisie("");
    champ.current?.focus();
  }

  // Puces des filtres actifs, chacune avec sa croix.
  const categorie = categories.find((c) => c.id === filtres.categorieId);
  const sousCategorie = categorie?.sousCategories.find((s) => s.id === filtres.sousCategorieId);
  const actifs = [
    filtres.categorieId && { cle: "categorieId", libelle: categorie?.libelle || "Catégorie", retirer: { categorieId: "", sousCategorieId: "" } },
    filtres.sousCategorieId && { cle: "sousCategorieId", libelle: sousCategorie?.libelle || "Sous-catégorie", retirer: { sousCategorieId: "" } },
    filtres.etat && { cle: "etat", libelle: LIBELLES_ETAT[filtres.etat] || filtres.etat, retirer: { etat: "" } },
    filtres.lieu && {
      cle: "lieu",
      libelle: `${filtres.lieu} · ${filtres.rayonKm || 5} km`,
      retirer: { latitude: "", longitude: "", lieu: "", rayonKm: "", ...(tri === "proximite" ? { tri: "" } : {}) },
    },
    filtres.participationMax && {
      cle: "participationMax",
      libelle: `≤ ${formaterParticipation(Number(filtres.participationMax))}`,
      retirer: { participationMax: "" },
    },
  ].filter(Boolean);

  return (
    <section>
      <h1 className="sr-only">Recherche</h1>

      {/* Recherche, filtres et bascule restent en haut quand la liste defile. */}
      <EnTeteCollant>
        <div className="flex gap-3">
          <div role="search" className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ardoise"
              aria-hidden="true"
            />
            <input
              ref={champ}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              aria-label="Rechercher un objet"
              placeholder="Chercher une pépite…"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              maxLength={100}
              className="h-13 w-full rounded-2xl border border-primary/10 bg-white pr-12 pl-12 text-base text-ardoise shadow-[0_6px_18px_-12px_rgb(155_77_219/35%)] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
            />
            {!saisie && photoDispo && (
              <button
                type="button"
                onClick={() => setPhotoOuverte((o) => !o)}
                aria-label="Chercher avec une photo"
                aria-expanded={photoOuverte}
                className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-lavande text-violet-fonce">
                <Camera className="size-4" aria-hidden="true" />
              </button>
            )}
            {saisie && (
              <button
                type="button"
                onClick={effacer}
                aria-label="Effacer la recherche"
                className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-lavande text-violet-fonce">
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFeuilleOuverte(true)}
            aria-label={actifs.length ? `Filtres, ${actifs.length} actifs` : "Filtres"}
            className="relative grid size-13 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30">
            <ListFilter className="size-5.5" aria-hidden="true" />
            {actifs.length > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-1.5 -right-1.5 grid size-5.5 place-items-center rounded-full border-2 border-lilas bg-rose text-[0.6875rem] font-bold">
                {actifs.length}
              </span>
            )}
          </button>
        </div>

        {photoOuverte && <RechercheParPhoto surResultat={appliquerPhoto} surFermer={() => setPhotoOuverte(false)} />}

        {actifs.length > 0 && (
          <ul
            className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]"
            aria-label="Filtres actifs">
            {actifs.map((f) => (
              <li key={f.cle} className="shrink-0">
                <button
                  type="button"
                  onClick={() => modifierCriteres(f.retirer)}
                  aria-label={`Retirer le filtre ${f.libelle}`}
                  className="flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-primary/40 bg-white pr-2.5 pl-3.5 text-sm font-medium whitespace-nowrap text-violet-fonce">
                  {f.libelle}
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Bascule Carte / Liste, d'apres les ecrans 05 et 06 de la maquette. */}
        <div role="group" aria-label="Affichage" className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-lavande p-1 lg:hidden">
          {[
            { carte: true, libelle: "Carte" },
            { carte: false, libelle: "Liste" },
          ].map((v) => (
            <button
              key={v.libelle}
              type="button"
              aria-pressed={surCarte === v.carte}
              onClick={() => modifierCriteres({ vue: v.carte ? "carte" : "" })}
              className={`h-10 rounded-xl text-sm font-semibold transition-colors ${
                surCarte === v.carte ? "bg-white text-ardoise shadow-sm" : "text-violet-fonce"
              }`}>
              {v.libelle}
            </button>
          ))}
        </div>
      </EnTeteCollant>

      <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-8">
      <div>
        <p className="flex min-h-8 items-center gap-2 font-semibold text-ardoise" aria-live="polite">
          <img src="/illustrations/objet-etoile.svg" alt="" aria-hidden="true" className="size-7" />
          {resultat && !erreur
            ? resultat.q
              ? `${pepites(total)} pour « ${resultat.q} »`
              : `${pepites(total)} à donner`
            : "Recherche en cours…"}
          {chargement && resultat && (
            <Loader2 className="size-4 animate-spin text-primary" aria-label="Mise à jour en cours" />
          )}
        </p>

        {/* Tri en puces, comme les categories : un toucher suffit, et rien ne
            jure avec la charte. Pas de tri sur la carte, ou l'ordre n'a pas
            de sens. */}
        {!surCarte && (
          <div
            role="group"
            aria-label="Trier"
            className="-mx-5 mt-2 flex items-center gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            <span className="shrink-0 text-sm text-muted-foreground">Trier</span>
            {tris.map((t) => (
              <button
                key={t.valeur}
                type="button"
                aria-pressed={tri === t.valeur}
                title={t.titre}
                onClick={() => modifierCriteres({ tri: t.valeur === "recent" ? "" : t.valeur })}
                className={`h-8 shrink-0 rounded-full px-3.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors ${
                  tri === t.valeur
                    ? "bg-ardoise text-white"
                    : "border border-primary/15 bg-white text-ardoise"
                }`}>
                {t.libelle}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3">
          {erreur && <ErreurChargement message={erreur} surReessayer={reessayer} />}
          {!erreur && !resultat && !surCarte && <ListeEnChargement />}

          {/* La carte occupe tout l'espace jusqu'au menu du bas, et passe sous
              ses coins arrondis : pas de bande vide entre les deux. Le repere
              donne la hauteur ou elle commence. */}
          {surCarte && !erreur && (
            <>
              <div ref={repereCarte} aria-hidden="true" />
              {hautCarte !== null && (
                <div
                  className="fixed inset-x-0 z-10 mx-auto max-w-md md:max-w-3xl"
                  style={{ top: hautCarte, bottom: "calc(var(--hauteur-menu) - 1.75rem)" }}>
                  <Suspense fallback={<div className="h-full animate-pulse bg-menthe/40" />}>
                    <CarteResultats annonces={annonces} />
                  </Suspense>
                  {annonces && total > annonces.length && (
                    <p className="pointer-events-none absolute top-3 left-3 z-[600] max-w-[70%] rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-ardoise shadow-md">
                      {annonces.length} pépites sur {total} : précisez la recherche
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {!surCarte && !erreur && annonces?.length === 0 &&
            (actifs.length > 0 ? (
              <EtatVide
                illustration="/illustrations/objet-carton.svg"
                titre="Aucun objet avec ces filtres"
                action={
                  <Button
                    variant="doneoSecondaire"
                    size="pilule"
                    className="w-full"
                    onClick={() => modifierCriteres(FILTRES_VIDES)}>
                    Réinitialiser les filtres
                  </Button>
                }>
                Élargissez vos critères pour voir plus d’objets.
              </EtatVide>
            ) : (
              <EtatVide
                illustration="/illustrations/objet-carton.svg"
                titre="Aucun objet ne correspond à votre recherche"
                action={
                  <Button variant="doneoSecondaire" size="pilule" className="w-full" onClick={effacer}>
                    <X className="size-5" aria-hidden="true" />
                    Effacer la recherche
                  </Button>
                }>
                Essayez un autre mot, plus court ou plus général.
              </EtatVide>
            ))}

          {!surCarte && !erreur && annonces?.length > 0 && (
            <>
              <ul
                aria-busy={chargement}
                className={`space-y-3 transition-opacity duration-200 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:block lg:space-y-3 ${chargement ? "opacity-50" : ""}`}>
                {annonces.map((a) => (
                  <li key={a.id}>
                    <CarteAnnonce annonce={a} variante="recherche" surSurvol={grandEcran ? setSurvolee : undefined} />
                  </li>
                ))}
              </ul>
              {erreurSuite && (
                <p role="alert" className="mt-4 text-center text-sm text-destructive">
                  La suite n’a pas pu être chargée. Vos résultats sont conservés : réessayez.
                </p>
              )}
              {annonces.length < total && (
                <Button
                  variant="doneoSecondaire"
                  size="pilule"
                  className="mt-4 w-full"
                  onClick={voirPlus}
                  disabled={suiteEnCours || chargement}>
                  {suiteEnCours && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
                  {erreurSuite ? "Réessayer" : "Voir plus"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Grand ecran : la carte reste a l'ecran pendant que la liste defile,
          et montre les annonces deja chargees dans la liste. */}
      {grandEcran && (
        <div className="sticky top-[calc(var(--hauteur-entete)+1.5rem)] h-[calc(100dvh-var(--hauteur-entete)-3rem)] overflow-hidden rounded-[2rem] shadow-[0_24px_60px_-36px_rgb(155_77_219/45%)]">
          <Suspense fallback={<div className="h-full animate-pulse bg-menthe/40" />}>
            <CarteResultats annonces={annonces} surbrillance={survolee} />
          </Suspense>
        </div>
      )}
      </div>

      <FeuilleFiltres
        ouverte={feuilleOuverte}
        categories={categories}
        filtres={filtres}
        surFermer={fermerFeuille}
        surAppliquer={(nouveaux) => {
          modifierCriteres(nouveaux);
          setFeuilleOuverte(false);
        }}
      />
    </section>
  );
}
