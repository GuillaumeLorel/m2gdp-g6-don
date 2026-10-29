import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { ChevronRight, CircleCheck, Heart, MessageCircle, Pencil, Users } from "lucide-react";
import ImageAnnonce from "@/components/ImageAnnonce.jsx";
import { ErreurChargement } from "@/components/Etats.jsx";
import { chargerMesReservations, chargerResumeProfil } from "@/lib/api.js";
import { seDeconnecter } from "@/lib/auth.js";
import { creneauPasse, formaterCreneau, formaterParticipation } from "@/lib/format.js";
import { libelleRoles } from "@/lib/membres.js";

const mois = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

/** Pastille de statut d'une annonce, du point de vue de son offrant. */
function statutAnnonce(a) {
  if (a.statut === "remis") return ["Remis", "bg-menthe"];
  if (a.statut === "reserve") return ["Réservé", "bg-citron"];
  if (creneauPasse(a.creneauRetrait)) return ["Créneau passé", "bg-destructive/10 text-destructive"];
  return ["En ligne", "bg-pervenche"];
}

/** Pastille de statut d'une reservation, du point de vue du demandeur. */
const STATUTS_RESERVATION = {
  demandee: ["Demande envoyée", "bg-pervenche"],
  proposee: ["À payer", "bg-citron"],
  confirmee: ["Confirmée", "bg-menthe"],
  remise: ["Reçu", "bg-menthe"],
  annulee: ["Close", "bg-muted text-muted-foreground"],
};

function Pastille({ valeur }) {
  const [libelle, couleur] = valeur;
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold text-ardoise ${couleur}`}>{libelle}</span>;
}

/** Une ligne compacte : vignette, titre, detail, pastille. */
function Ligne({ vers, annonce, detail, pastille }) {
  return (
    <li>
      <Link to={vers} className="flex items-center gap-3 px-3.5 py-3">
        <ImageAnnonce annonce={annonce} className="size-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ardoise">{annonce.titre}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
        <Pastille valeur={pastille} />
      </Link>
    </li>
  );
}

/**
 * Profil (US-35, issue #67), d'apres l'ecran 13 de la maquette : identite,
 * statistiques, mes annonces, mes reservations, puis le menu. La
 * modification du profil (US-36, #68) — roles compris — est sur
 * /profil/modifier.
 */
export default function Profil({ profil }) {
  const initiales = `${profil.prenom?.[0] || ""}${profil.nom?.[0] || ""}`.toUpperCase();
  const etat = useLocation().state;
  const [resume, setResume] = useState(null);
  const [reservations, setReservations] = useState(null);
  const [erreur, setErreur] = useState(null);
  const offrant = profil.roles?.includes("offrant");
  const demandeur = profil.roles?.includes("demandeur");

  const charger = useCallback(() => {
    setErreur(null);
    chargerResumeProfil()
      .then(setResume)
      .catch((e) => setErreur(e.message));
    if (demandeur) {
      chargerMesReservations("demandeur")
        .then(setReservations)
        .catch(() => setReservations([]));
    }
  }, [demandeur]);
  useEffect(charger, [charger]);

  const stats = resume?.statistiques;
  const tuiles = [
    { valeur: stats?.objetsDonnes, libelle: "objets donnés" },
    { valeur: stats?.objetsRecus, libelle: "objets reçus" },
    { valeur: stats && formaterParticipation(stats.montantReverse), libelle: "reversés", accent: true },
  ];

  return (
    <section className="lg:mx-auto lg:max-w-2xl">
      <header className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-18 shrink-0 place-items-center rounded-full border-4 border-white bg-lavande font-titre text-2xl font-semibold text-violet-fonce shadow-sm">
          {initiales}
        </span>
        <div className="min-w-0">
          <h1 className="doneo-titre truncate text-2xl">
            {profil.prenom} {profil.nom}
          </h1>
          <p className="text-sm text-muted-foreground">
            {libelleRoles(profil.roles)}
            {profil.creeLe && ` · membre depuis ${mois.format(new Date(profil.creeLe))}`}
          </p>
        </div>
      </header>

      {(etat?.annonceRetiree || etat?.profilModifie) && (
        <p role="status" className="mt-4 flex items-center gap-2.5 rounded-2xl bg-menthe p-3.5 text-sm font-medium text-ardoise">
          <CircleCheck className="size-5 shrink-0 text-succes" aria-hidden="true" />
          {etat.annonceRetiree ? `« ${etat.annonceRetiree} » a été retirée.` : "Profil enregistré."}
        </p>
      )}

      {/* Statistiques : trois tuiles, la derniere en vert comme sur la maquette. */}
      <ul className="mt-5 grid grid-cols-3 gap-2.5" aria-label="Statistiques">
        {tuiles.map((t) => (
          <li key={t.libelle} className={`rounded-2xl p-3 text-center ${t.accent ? "bg-menthe" : "doneo-carte"}`}>
            <p className="font-titre text-xl font-semibold text-ardoise">{t.valeur ?? "…"}</p>
            <p className="text-[0.7rem] leading-4 text-muted-foreground">{t.libelle}</p>
          </li>
        ))}
      </ul>

      {erreur && (
        <div className="mt-5">
          <ErreurChargement message={erreur} surReessayer={charger} />
        </div>
      )}

      {offrant && resume && (
        <>
          <h2 className="doneo-etiquette mt-6">Mes annonces ({resume.annonces.length})</h2>
          {resume.annonces.length === 0 ? (
            <p className="doneo-carte mt-2 p-4 text-sm text-muted-foreground">
              Aucune annonce pour le moment. <Link to="/creer" className="font-semibold text-violet-fonce underline">Donner un objet</Link>
            </p>
          ) : (
            <ul className="doneo-carte mt-2 divide-y divide-primary/10 overflow-hidden">
              {resume.annonces.map((a) => (
                <Ligne
                  key={a.id}
                  vers={`/annonces/${a.id}`}
                  annonce={a}
                  detail={`${formaterParticipation(a.participation)} · ${a.association?.nom || ""}`}
                  pastille={statutAnnonce(a)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {demandeur && reservations && (
        <>
          <h2 className="doneo-etiquette mt-6">Mes réservations ({reservations.length})</h2>
          {reservations.length === 0 ? (
            <p className="doneo-carte mt-2 p-4 text-sm text-muted-foreground">
              Aucune réservation pour le moment. <Link to="/recherche" className="font-semibold text-violet-fonce underline">Trouver un objet</Link>
            </p>
          ) : (
            <ul className="doneo-carte mt-2 divide-y divide-primary/10 overflow-hidden">
              {reservations.filter((r) => r.annonce).map((r) => (
                <Ligne
                  key={r.id}
                  vers={`/messages/${r.conversationId}`}
                  annonce={r.annonce}
                  detail={formaterCreneau(r.annonce.creneauRetrait, { court: true })}
                  pastille={STATUTS_RESERVATION[r.statut] || STATUTS_RESERVATION.annulee}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <ul className="doneo-carte mt-6 divide-y divide-primary/10 overflow-hidden">
        {[
          { vers: "/messages", libelle: "Mes messages", Icone: MessageCircle },
          { vers: "/favoris", libelle: "Mes favoris", Icone: Heart },
          { vers: "/profil/modifier", libelle: "Modifier mon profil et mes rôles", Icone: Pencil },
          { vers: "/membres", libelle: "Membres de la communauté", Icone: Users },
        ].map(({ vers, libelle, Icone }) => (
          <li key={vers}>
            <Link to={vers} className="flex items-center gap-3 px-4 py-4 font-medium text-ardoise">
              <Icone className="size-5 text-primary" aria-hidden="true" />
              <span className="flex-1">{libelle}</span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
        <li>
          {/* Rose, comme sur la maquette : la deconnexion n'est pas une erreur,
              mais elle doit se distinguer des autres entrees. */}
          <button
            type="button"
            onClick={seDeconnecter}
            className="flex w-full items-center gap-3 px-4 py-4 text-left font-medium text-rose">
            <span className="flex-1">Se déconnecter</span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>
  );
}
