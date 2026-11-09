import { Link } from "react-router";
import { CalendarDays, Heart } from "lucide-react";
import Badge from "@/components/Badge.jsx";
import ImageAnnonce from "@/components/ImageAnnonce.jsx";
import { useDistance } from "@/lib/distance.js";
import {
  LIBELLES_ETAT,
  formaterCreneau,
  formaterParticipation,
  lieuAnnonce,
  nomOffrant,
} from "@/lib/format.js";

/**
 * Carte d'annonce, reutilisee par l'accueil, la recherche, les favoris et
 * l'historique. Toute la carte mene a la fiche.
 *
 * Elle affiche ce dont le demandeur a besoin pour decider d'ouvrir la fiche :
 * l'objet, qui le propose, la participation et l'association qui en profite,
 * l'etat et le quartier — jamais l'adresse exacte, qui n'arrive d'ailleurs pas
 * jusqu'au front.
 */
export default function CarteAnnonce({ annonce, variante = "accueil", grille = false, surSurvol }) {
  const reservee = annonce.statut === "reserve";
  const distance = useDistance(annonce);
  // Variante « recherche » (ecran 05) : l'etat devient une pastille menthe,
  // plus lisible quand on compare des resultats.
  const enPastille = variante === "recherche";
  // `grille` : sur grand ecran, la carte passe a la verticale, image en haut,
  // pour se ranger en colonnes. Sur mobile, rien ne change.
  const signaler = (actif) => surSurvol?.(actif ? annonce.id : null);

  return (
    <Link
      to={`/annonces/${annonce.id}`}
      onMouseEnter={() => signaler(true)}
      onMouseLeave={() => signaler(false)}
      onFocus={() => signaler(true)}
      onBlur={() => signaler(false)}
      className={`doneo-carte flex gap-3.5 p-3 transition md:h-full focus-visible:ring-4 focus-visible:ring-primary/25 focus-visible:outline-none active:scale-[0.99] lg:hover:-translate-y-0.5 lg:hover:shadow-[0_16px_32px_-16px_rgb(155_77_219/35%)] ${
        grille ? "lg:h-full lg:flex-col lg:gap-0 lg:overflow-hidden lg:p-0" : ""
      }`}>
      <ImageAnnonce
        annonce={annonce}
        className={`size-28 shrink-0 rounded-2xl ${grille ? "lg:aspect-16/10 lg:h-auto lg:w-full lg:rounded-none" : ""}`}
      />

      <div className={`flex min-w-0 flex-1 flex-col ${grille ? "lg:p-4" : ""}`}>
        {/* Inter et non Fredoka : sur la maquette, le titre d'une carte est du
            texte courant, pas un titre d'ecran. */}
        <h3 className="line-clamp-2 font-sans text-[0.975rem] leading-snug font-semibold tracking-normal text-ardoise">
          {annonce.titre}
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          Proposé par {nomOffrant(annonce.offrant)}
        </p>

        <p className="mt-1.5 flex items-baseline gap-1.5">
          <span className="font-titre text-xl leading-none font-semibold text-primary">
            {formaterParticipation(annonce.participation)}
          </span>
          <span className="text-xs text-muted-foreground">participation</span>
        </p>

        {annonce.association && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ardoise">
            <Heart className="size-3.5 shrink-0 fill-primary text-primary" aria-hidden="true" />
            <span className="truncate">Reversé à {annonce.association.nom}</span>
          </p>
        )}

        {enPastille && annonce.creneauRetrait && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ardoise">
            <CalendarDays className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{formaterCreneau(annonce.creneauRetrait, { court: true })}</span>
          </p>
        )}

        <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-xs text-muted-foreground">
          {enPastille ? (
            <>
              <Badge famille="etat">{LIBELLES_ETAT[annonce.etat]}</Badge>
              <span>{[lieuAnnonce(annonce), distance].filter(Boolean).join(" · ")}</span>
            </>
          ) : (
            <span>
              {[LIBELLES_ETAT[annonce.etat], lieuAnnonce(annonce), distance].filter(Boolean).join(" · ")}
            </span>
          )}
          {reservee && (
            <Badge famille="annonce" ton="reserve">
              Liste d’attente
            </Badge>
          )}
        </p>
      </div>
    </Link>
  );
}
