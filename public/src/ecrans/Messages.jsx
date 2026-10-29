import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import ImageAnnonce from "@/components/ImageAnnonce.jsx";
import { EtatVide, ErreurChargement, ListeEnChargement } from "@/components/Etats.jsx";
import { chargerConversations } from "@/lib/api.js";
import { nomOffrant } from "@/lib/format.js";

const heure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const semaine = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** « 8:58 » aujourd'hui, « Hier », « lun. » cette semaine, « 12 oct. » au-dela. */
function quand(iso) {
  const d = new Date(iso);
  const jours = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  if (jours <= 0) return heure.format(d);
  if (jours === 1) return "Hier";
  if (jours < 7) return semaine.format(d);
  return date.format(d);
}

/** Ou en est la reservation, en une pastille. */
function etape(reservation, monRole) {
  if (!reservation) return null;
  const s = reservation.statut;
  if (s === "demandee") return monRole === "offrant" ? ["Demande à valider", "bg-citron"] : ["Demande envoyée", "bg-pervenche"];
  if (s === "proposee") return monRole === "demandeur" ? ["À payer", "bg-citron"] : ["Réservé", "bg-pervenche"];
  if (s === "confirmee") return ["Confirmé", "bg-menthe"];
  if (s === "remise") return ["Remis", "bg-menthe"];
  return null;
}

/**
 * Mes conversations (US-32, issue #65), d'apres l'ecran 11 de la maquette :
 * la plus active en premier, avec l'objet, l'interlocuteur, le dernier
 * message et, si une reservation est en cours, son etape.
 */
export default function Messages() {
  const [conversations, setConversations] = useState(null);
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(() => {
    setErreur(null);
    chargerConversations()
      .then(setConversations)
      .catch((e) => setErreur(e.message));
  }, []);
  useEffect(charger, [charger]);

  return (
    <section className="lg:mx-auto lg:max-w-2xl">
      <h1 className="doneo-titre text-[2rem] leading-tight lg:text-4xl">Messages</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Vos échanges avec les offrants et les demandeurs.</p>

      <div className="mt-6">
        {erreur && <ErreurChargement message={erreur} surReessayer={charger} />}
        {!erreur && !conversations && <ListeEnChargement />}
        {!erreur && conversations?.length === 0 && (
          <EtatVide
            illustration="/illustrations/expression-heureux.svg"
            titre="Aucune conversation pour le moment"
            action={
              <Button asChild variant="doneo" size="pilule" className="w-full">
                <Link to="/recherche">
                  <Search className="size-5" aria-hidden="true" />
                  Trouver un objet
                </Link>
              </Button>
            }>
            Contactez un offrant depuis une annonce : vos échanges apparaîtront ici.
          </EtatVide>
        )}
        {!erreur && conversations?.length > 0 && (
          <ul className="space-y-2.5">
            {conversations.map((c) => {
              const pastille = etape(c.reservation, c.monRole);
              const dernier = c.dernierMessage;
              return (
                <li key={c.id}>
                  <Link
                    to={`/messages/${c.id}`}
                    className="doneo-carte flex items-center gap-3 p-3 focus-visible:ring-4 focus-visible:ring-primary/25 focus-visible:outline-none">
                    {c.annonce ? (
                      <ImageAnnonce annonce={c.annonce} className="size-14 shrink-0 rounded-xl" />
                    ) : (
                      <span className="size-14 shrink-0 rounded-xl bg-lavande" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-semibold text-ardoise">{nomOffrant(c.interlocuteur)}</p>
                        {dernier && <span className="shrink-0 text-xs text-muted-foreground">{quand(dernier.creeLe)}</span>}
                      </div>
                      <p className="truncate text-xs font-semibold text-violet-fonce">{c.annonce?.titre}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {dernier ? dernier.contenu : "Aucun message"}
                        </p>
                        {pastille && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold text-ardoise ${pastille[1]}`}>
                            {pastille[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
