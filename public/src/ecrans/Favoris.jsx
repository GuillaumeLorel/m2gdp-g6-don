import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Heart, Search } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import CarteAnnonce from "@/components/CarteAnnonce.jsx";
import { EtatVide, ErreurChargement, ListeEnChargement } from "@/components/Etats.jsx";
import { chargerFavoris } from "@/lib/api.js";
import { basculerFavori, useFavoris } from "@/lib/favoris.js";

/**
 * Mes favoris (US-22, issue #50), la plus recemment ajoutee d'abord. Une
 * annonce remise depuis reste dans la liste, signalee comme telle : on
 * comprend pourquoi on ne peut plus la demander.
 */
export default function Favoris() {
  const [annonces, setAnnonces] = useState(null);
  const [erreur, setErreur] = useState(null);
  const favoris = useFavoris();

  const charger = useCallback(() => {
    setErreur(null);
    chargerFavoris()
      .then(setAnnonces)
      .catch((e) => setErreur(e.message));
  }, []);
  useEffect(charger, [charger]);

  // Retirer depuis cette liste (ou depuis une fiche) la fait disparaitre ici.
  const visibles = annonces?.filter((a) => !favoris || favoris.has(a.id));

  return (
    <section>
      <h1 className="doneo-titre text-[2rem] leading-tight lg:text-4xl">Mes favoris</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Les objets que vous gardez de côté, le dernier ajouté en premier.
      </p>

      <div className="mt-6">
        {erreur && <ErreurChargement message={erreur} surReessayer={charger} />}
        {!erreur && !visibles && <ListeEnChargement />}
        {!erreur && visibles?.length === 0 && (
          <EtatVide
            illustration="/illustrations/objet-coeur.svg"
            titre="Aucun favori pour le moment"
            action={
              <Button asChild variant="doneo" size="pilule" className="w-full">
                <Link to="/recherche">
                  <Search className="size-5" aria-hidden="true" />
                  Chercher une pépite
                </Link>
              </Button>
            }>
            Touchez le cœur d’une annonce pour la retrouver ici.
          </EtatVide>
        )}
        {!erreur && visibles?.length > 0 && (
          <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3 lg:gap-6">
            {visibles.map((a) => (
              <li key={a.id} className="relative">
                <CarteAnnonce annonce={a} grille />
                {a.statut === "remis" && (
                  <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-citron px-2 py-0.5 text-[0.6875rem] font-semibold text-ardoise">
                    Déjà remis
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => basculerFavori(a.id).catch(() => {})}
                  aria-label={`Retirer « ${a.titre} » des favoris`}
                  /* Sur la photo (a gauche sur mobile, en haut sur grand ecran) :
                     sur le titre, il le masquait. */
                  className="absolute top-5 left-5 grid size-9 place-items-center rounded-full bg-white/95 text-rose shadow-md lg:top-3 lg:left-3">
                  <Heart className="size-4.5 fill-current" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
