import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Heart, Search } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import CarteAnnonce from "@/components/CarteAnnonce.jsx";
import { EtatVide, ErreurChargement, ListeEnChargement } from "@/components/Etats.jsx";
import BandeauAccueil from "@/components/BandeauAccueil.jsx";
import CommentCaMarche from "@/components/CommentCaMarche.jsx";
import EnCours from "@/components/EnCours.jsx";
import EnTeteCollant from "@/components/EnTeteCollant.jsx";
import { Marque } from "@/components/Logo.jsx";
import { chargerCategories, chercherAnnonces } from "@/lib/api.js";
import { useGrandEcran } from "@/lib/ecran.js";

/**
 * Nombre d'objets de la section « Derniers objets ajoutes » : 10 en liste
 * sur mobile, 12 sur grand ecran pour remplir quatre rangees de trois.
 */
const NOMBRE_DERNIERS = 10;
const NOMBRE_DERNIERS_GRILLE = 12;

/**
 * Accueil (US-4, issue #32) : la barre de recherche, les puces de categories,
 * l'accroche, ce qui est en cours pour la personne (US-5, #33), puis les
 * derniers objets ajoutes.
 *
 * La barre de recherche ouvre l'ecran Recherche, elle ne filtre pas l'accueil ;
 * les puces, elles, filtrent la liste sur place. Pas de cloche de
 * notifications : les notifications sont hors perimetre (WON'T).
 */
export default function Accueil({ profil }) {
  const [categories, setCategories] = useState([]);
  const [categorieId, setCategorieId] = useState("");
  const grandEcran = useGrandEcran();
  const [annonces, setAnnonces] = useState(null);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const titreListe = useRef(null);

  useEffect(() => {
    // Sans categories, on garde la puce « Tout » : la liste reste utilisable.
    chargerCategories().then(setCategories).catch(() => {});
  }, []);

  const [tentative, setTentative] = useState(0);
  const reessayer = useCallback(() => setTentative((n) => n + 1), []);

  useEffect(() => {
    // Deux puces touchees vite : seule la reponse de la derniere compte, meme
    // si celle de la premiere arrive apres.
    //
    // Pendant le chargement, la liste precedente reste affichee, attenuee :
    // la remplacer par des squelettes changerait la hauteur de la page et
    // ferait sauter l'ecran.
    let derniere = true;
    setErreur(null);
    setChargement(true);
    chercherAnnonces({ tri: "recent", parPage: grandEcran ? NOMBRE_DERNIERS_GRILLE : NOMBRE_DERNIERS, categorieId })
      .then((page) => {
        if (!derniere) return;
        setAnnonces(page.annonces);
        if (!categorieId) setTotal(page.total);
        // Si on avait defile plus bas, on remonte au debut de la nouvelle liste.
        const titre = titreListe.current;
        if (titre && titre.getBoundingClientRect().top < 0) titre.scrollIntoView({ block: "start" });
      })
      .catch((e) => derniere && setErreur(e.message))
      .finally(() => derniere && setChargement(false));
    return () => {
      derniere = false;
    };
  }, [categorieId, tentative, grandEcran]);

  const puces = [{ id: "", libelle: "Tout" }, ...categories];

  return (
    // Grand ecran : bandeau, titre, categories, grille, puis « Comment ca
    // marche ». Les classes lg:order-* reordonnent sans dupliquer le contenu.
    <section className="flex flex-col">
      <h1 className="sr-only lg:hidden">Accueil</h1>
      <div className="lg:order-1">
        <BandeauAccueil total={total} />
      </div>

      <EnTeteCollant className="lg:order-3">
        <header className="flex items-center gap-3 lg:hidden">
          <Link to="/" aria-label="Donéo — accueil">
            <Marque className="size-10" />
          </Link>
          <Link
            to="/recherche"
            className="flex h-12 flex-1 items-center gap-2.5 rounded-2xl border border-primary/10 bg-white px-4 text-[0.95rem] text-muted-foreground shadow-[0_6px_18px_-12px_rgb(155_77_219/35%)]">
            <Search className="size-5 text-ardoise" aria-hidden="true" />
            Chercher une pépite…
          </Link>
        </header>

        {/* Puces de categories, defilement horizontal jusqu'aux bords. */}
        <div
          role="group"
          aria-label="Filtrer par catégorie"
          className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:mt-0 lg:px-0">
          {puces.map((c) => {
            const active = c.id === categorieId;
            return (
              <button
                key={c.id || "tout"}
                type="button"
                aria-pressed={active}
                onClick={() => setCategorieId(c.id)}
                className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors ${
                  active
                    ? "bg-primary text-white shadow-md shadow-primary/30"
                    : "border border-primary/10 bg-white text-ardoise"
                }`}>
                {c.libelle}
              </button>
            );
          })}
        </div>
      </EnTeteCollant>

      {/* Accroche. Elle ne promet pas que « la totalite » de la participation
          va a l'association : la formulation reste a valider par l'UX. */}
      <div className="mt-2 flex items-center gap-4 rounded-[1.75rem] lg:hidden bg-gradient-to-br from-primary to-[#b066e6] p-5 text-white shadow-lg shadow-primary/25">
        <div className="min-w-0 flex-1">
          <p className="font-titre text-[1.45rem] leading-tight font-semibold">1 objet, 1 don.</p>
          <p className="mt-1.5 text-[0.8rem] leading-5 text-white/90 text-pretty">
            Votre participation soutient l’association choisie par l’offrant.
          </p>
        </div>
        <div className="relative grid size-24 shrink-0 place-items-center rounded-[1.6rem] bg-white">
          <img src="/illustrations/expression-heureux.svg" alt="" aria-hidden="true" className="size-14" />
          <img
            src="/illustrations/objet-coeur.svg"
            alt=""
            aria-hidden="true"
            className="absolute -top-3 -right-2 size-9 rotate-12"
          />
        </div>
      </div>

      {/* Grand ecran : juste sous le bandeau (meme ordre, mais apres lui). */}
      <div className="lg:order-1">
        <EnCours profil={profil} />
      </div>

      {/* scroll-mt : le titre reste visible sous l'en-tete collant. */}
      <div ref={titreListe} className="mt-7 flex scroll-mt-36 items-baseline justify-between gap-3 lg:order-2 lg:mt-14 lg:mb-4 lg:scroll-mt-28">
        <h2 className="doneo-titre text-xl lg:text-3xl">Derniers objets ajoutés</h2>
        <Link to="/recherche" className="text-sm font-semibold text-violet-fonce">
          Tout voir
        </Link>
      </div>

      <div className="mt-3 lg:order-4 lg:mt-2">
        {erreur && <ErreurChargement message={erreur} surReessayer={reessayer} />}
        {!erreur && !annonces && chargement && <ListeEnChargement />}
        {!erreur && annonces?.length === 0 && (
          <EtatVide
            illustration="/illustrations/objet-cadeau.svg"
            titre={categorieId ? "Rien dans cette catégorie" : "Aucun objet pour le moment"}
            action={
              <Button asChild variant="doneo" size="pilule" className="w-full">
                <Link to="/creer">
                  <Heart className="size-5 fill-current" aria-hidden="true" />
                  Créer une annonce
                </Link>
              </Button>
            }>
            Soyez le premier à donner un objet : il trouvera vite preneur.
          </EtatVide>
        )}
        {!erreur && annonces?.length > 0 && (
          <ul
            aria-busy={chargement}
            className={`space-y-3 transition-opacity duration-200 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3 lg:gap-6 ${chargement ? "opacity-50" : ""}`}>
            {annonces.map((a) => (
              <li key={a.id}>
                <CarteAnnonce annonce={a} grille />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lg:order-5">
        <CommentCaMarche />
      </div>
    </section>
  );
}
