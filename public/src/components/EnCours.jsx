import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { CalendarDays, Plus, Search } from "lucide-react";
import ImageAnnonce from "@/components/ImageAnnonce.jsx";
import { chercherAnnonces } from "@/lib/api.js";
import { creneauPasse, formaterCreneau, formaterParticipation } from "@/lib/format.js";

/** Pastille de statut d'un don, du point de vue de son offrant. */
function Statut({ annonce }) {
  const [libelle, couleur] = creneauPasse(annonce.creneauRetrait)
    ? ["Créneau passé", "bg-destructive/10 text-destructive"]
    : annonce.statut === "reserve"
      ? ["Réservé", "bg-citron"]
      : ["Disponible", "bg-menthe"];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold text-ardoise ${couleur}`}>
      {libelle}
    </span>
  );
}

/** Ligne compacte d'un don : vignette, titre, statut, participation et creneau. */
function CarteDon({ annonce }) {
  return (
    <Link
      to={`/annonces/${annonce.id}`}
      className="doneo-carte flex w-[min(18rem,82vw)] shrink-0 items-center gap-3 p-2.5 focus-visible:ring-4 focus-visible:ring-primary/25 focus-visible:outline-none lg:w-full">
      <ImageAnnonce annonce={annonce} className="size-16 shrink-0 rounded-xl" />
      {/* Le statut a sa propre ligne : a cote du titre, il le tronquait. */}
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-semibold text-ardoise">{annonce.titre}</h4>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formaterParticipation(annonce.participation)} · {annonce.association?.nom}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          {annonce.creneauRetrait && (
            <p className="flex min-w-0 items-center gap-1 text-xs text-ardoise">
              <CalendarDays className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">{formaterCreneau(annonce.creneauRetrait, { court: true })}</span>
            </p>
          )}
          <Statut annonce={annonce} />
        </div>
      </div>
    </Link>
  );
}

/** Encart d'une liste vide, avec l'action qui la remplira. */
function Vide({ children, lien, libelle, Icone }) {
  return (
    <div className="doneo-carte flex items-center gap-3 p-3.5">
      <p className="min-w-0 flex-1 text-sm text-muted-foreground text-pretty">{children}</p>
      <Link
        to={lien}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-lavande px-3.5 py-2 text-sm font-semibold text-violet-fonce">
        <Icone className="size-4" aria-hidden="true" />
        {libelle}
      </Link>
    </div>
  );
}

/**
 * « En cours » de l'accueil (US-5, issue #33) : les dons de l'offrant encore
 * en ligne, et les demandes du demandeur. Chaque bloc n'apparait que pour le
 * role correspondant ; un compte qui cumule les deux voit les deux.
 *
 * Les demandes (reservations) arrivent avec l’issue #52 : en attendant, le bloc
 * dit simplement qu'il n'y en a pas, et oriente vers la recherche.
 */
export default function EnCours({ profil }) {
  const offrant = profil.roles?.includes("offrant");
  const demandeur = profil.roles?.includes("demandeur");
  const [dons, setDons] = useState(null);
  const [erreur, setErreur] = useState(false);

  const charger = useCallback(() => {
    if (!offrant) return;
    setErreur(false);
    // Le creneau le plus proche d'abord : c'est le prochain rendez-vous.
    chercherAnnonces({ offrantId: profil.id, tri: "creneau", parPage: 50 })
      .then((page) => setDons(page.annonces))
      .catch(() => setErreur(true));
  }, [offrant, profil.id]);

  useEffect(charger, [charger]);

  if (!offrant && !demandeur) return null;

  return (
    <section aria-labelledby="titre-en-cours" className="mt-7 lg:mt-10">
      <h2 id="titre-en-cours" className="doneo-titre text-xl lg:text-3xl">
        En cours
      </h2>

      {offrant && (
        <div className="mt-3">
          <h3 className="doneo-etiquette">
            Mes dons{dons?.length ? ` (${dons.length})` : ""}
          </h3>
          <div className="mt-2">
            {erreur ? (
              <p className="text-sm text-muted-foreground">
                Vos dons n’ont pas pu être chargés.{" "}
                <button type="button" onClick={charger} className="font-semibold text-violet-fonce underline">
                  Recharger
                </button>
              </p>
            ) : dons === null ? (
              <div className="h-[5.25rem] w-[min(18rem,82vw)] animate-pulse rounded-3xl bg-lavande" aria-label="Chargement de vos dons" />
            ) : dons.length === 0 ? (
              <Vide lien="/creer" libelle="Donner" Icone={Plus}>
                Aucun objet en ligne pour le moment.
              </Vide>
            ) : (
              // Mobile : une rangee qui defile au doigt, pour rester compacte.
              // Grand ecran : une grille.
              <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pt-1 pb-3 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
                {dons.map((a) => (
                  <li key={a.id} className="flex">
                    <CarteDon annonce={a} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {demandeur && (
        <div className="mt-3">
          <h3 className="doneo-etiquette">Mes demandes</h3>
          <div className="mt-2">
            <Vide lien="/recherche" libelle="Chercher" Icone={Search}>
              Aucune demande en cours. Les objets que vous demanderez apparaîtront ici.
            </Vide>
          </div>
        </div>
      )}
    </section>
  );
}
