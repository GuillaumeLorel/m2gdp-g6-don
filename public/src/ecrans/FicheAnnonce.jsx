import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { CalendarDays, CircleCheck, ChevronLeft, Gift, Heart, Loader2, Lock, MapPin, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import ImageAnnonce from "@/components/ImageAnnonce.jsx";
import { EtatVide, ErreurChargement } from "@/components/Etats.jsx";
import { chargerAnnonce, chargerMesReservations, contacterOffrant, demanderObjet, retirerAnnonce } from "@/lib/api.js";
import { basculerFavori, useFavoris } from "@/lib/favoris.js";
import {
  LIBELLES_ETAT,
  creneauPasse,
  formaterCreneau,
  formaterParticipation,
  lieuAnnonce,
  nomOffrant,
} from "@/lib/format.js";

/** Bouton rond blanc pose sur la photo, comme sur la maquette. */
function BoutonSurPhoto({ children, ...props }) {
  return (
    <button
      type="button"
      className="grid size-11 place-items-center rounded-2xl bg-white/95 text-ardoise shadow-md backdrop-blur"
      {...props}>
      {children}
    </button>
  );
}

/**
 * Fiche d'une annonce (US-9, issue #37), d'apres l'ecran 08 de la maquette.
 *
 * Elle montre tout ce qu'il faut pour se decider AVANT de verser la
 * participation : l'objet, la participation et l'association, l'offrant, le
 * creneau et le lieu APPROXIMATIF. L'adresse exacte n'est revelee qu'apres la
 * participation : elle n'arrive d'ailleurs jamais dans cette page, l'API ne
 * la renvoie pas.
 *
 * Le demandeur y demande l'objet (US-24) ou contacte l'offrant (US-30) ; il
 * l'ajoute a ses favoris (US-21). L'offrant y modifie ou retire son annonce
 * (US-11). La suite de la reservation se joue dans la conversation.
 */
export default function FicheAnnonce({ profil }) {
  const { id } = useParams();
  const naviguer = useNavigate();
  // Arrivee depuis la creation (US-6) : on confirme la publication.
  const etatNavigation = useLocation().state;
  const publiee = etatNavigation?.publiee === true;
  const modifiee = etatNavigation?.modifiee === true;
  const [annonce, setAnnonce] = useState(undefined); // undefined = chargement, null = introuvable
  const [erreur, setErreur] = useState(null);
  const favoris = useFavoris();
  // Ma demande en cours sur cet objet, s'il y en a une (demandeur).
  const [maDemande, setMaDemande] = useState(undefined);
  const [panneau, setPanneau] = useState(null); // null | "demande" | "retrait"
  const [mot, setMot] = useState("");
  const [action, setAction] = useState(null);
  const [erreurAction, setErreurAction] = useState(null);

  useEffect(() => {
    if (!profil.roles?.includes("demandeur")) {
      setMaDemande(null);
      return;
    }
    chargerMesReservations("demandeur")
      .then((liste) => setMaDemande(liste.find((r) => r.annonceId === id && r.statut !== "annulee") || null))
      .catch(() => setMaDemande(null));
  }, [id, profil.roles]);

  async function agir(nom, appel) {
    setAction(nom);
    setErreurAction(null);
    try {
      await appel();
    } catch (e) {
      setErreurAction(e.message);
      setAction(null);
    }
  }
  // Demander l'objet (US-24) : on file dans la conversation, ou tout se suit.
  const demander = () =>
    agir("demande", async () => naviguer("/messages/" + (await demanderObjet(id, mot.trim())).conversationId));
  const contacter = () => agir("contact", async () => naviguer("/messages/" + (await contacterOffrant(id))));
  const retirer = () =>
    agir("retrait", async () => {
      await retirerAnnonce(id);
      naviguer("/profil", { replace: true, state: { annonceRetiree: annonce.titre } });
    });

  const charger = useCallback(() => {
    setErreur(null);
    setAnnonce(undefined);
    chargerAnnonce(id)
      .then(setAnnonce)
      .catch((e) => setErreur(e.message));
  }, [id]);

  useEffect(charger, [charger]);

  // Retour vers l'ecran d'ou l'on vient — liste, recherche filtree — tel qu'on
  // l'avait laisse. Sans historique (lien ouvert directement), vers l'accueil.
  const revenir = () => (window.history.state?.idx > 0 ? naviguer(-1) : naviguer("/"));

  if (erreur || annonce === null) {
    return (
      <div className="px-5 pt-5">
        <BoutonSurPhoto onClick={revenir} aria-label="Retour">
          <ChevronLeft className="size-5" aria-hidden="true" />
        </BoutonSurPhoto>
        <div className="mt-6">
          {erreur ? (
            <ErreurChargement message={erreur} surReessayer={charger} />
          ) : (
            <EtatVide
              illustration="/illustrations/objet-carton.svg"
              titre="Annonce introuvable"
              action={
                <Button asChild variant="doneo" size="pilule" className="w-full">
                  <Link to="/">Retour à l’accueil</Link>
                </Button>
              }>
              Cette annonce n’existe pas, ou son offrant l’a retirée.
            </EtatVide>
          )}
        </div>
      </div>
    );
  }

  if (annonce === undefined) {
    return (
      <div aria-busy="true" aria-label="Chargement de l’annonce" className="animate-pulse">
        <div className="h-72 bg-lavande" />
        <div className="space-y-3 px-5 pt-5">
          <div className="h-7 w-3/4 rounded-full bg-lavande" />
          <div className="h-5 w-1/2 rounded-full bg-muted" />
          <div className="h-20 rounded-3xl bg-lavande" />
        </div>
      </div>
    );
  }

  const estLaMienne = annonce.offrant?.id === profil.id;
  const remise = annonce.statut === "remis";
  const reservee = annonce.statut === "reserve";
  const termine = creneauPasse(annonce.creneauRetrait);
  const montant = formaterParticipation(annonce.participation);
  const estFavori = Boolean(favoris?.has(annonce.id));

  return (
    // Grand ecran : visuel a gauche, qui reste a l'ecran, informations a droite.
    <article className="pb-36 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-12 lg:pb-0">
      <div className="relative lg:sticky lg:top-[calc(var(--hauteur-entete)+2rem)]">
        <ImageAnnonce
          annonce={annonce}
          className="h-72 w-full md:aspect-4/3 md:h-auto lg:rounded-[2rem] lg:shadow-[0_24px_60px_-36px_rgb(155_77_219/45%)]"
        />
        {/* Fixe : le retour reste a portee quand on lit le bas de la fiche. */}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-20 mx-auto flex max-w-md justify-between p-4 md:max-w-3xl lg:absolute lg:max-w-none">
          <span className="pointer-events-auto">
            <BoutonSurPhoto onClick={revenir} aria-label="Retour">
              <ChevronLeft className="size-5" aria-hidden="true" />
            </BoutonSurPhoto>
          </span>
          {/* US-21 : ajouter ou retirer des favoris, d'un geste. */}
          {!estLaMienne && (
            <span className="pointer-events-auto">
              <BoutonSurPhoto
                onClick={() => basculerFavori(annonce.id).catch(() => {})}
                aria-label={estFavori ? "Retirer des favoris" : "Ajouter aux favoris"}
                aria-pressed={estFavori}>
                <Heart className={estFavori ? "size-5 fill-rose text-rose" : "size-5"} aria-hidden="true" />
              </BoutonSurPhoto>
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pt-5 lg:p-0">
        {(publiee || modifiee) && (
          <p role="status" className="mb-4 flex items-center gap-2.5 rounded-2xl bg-menthe p-3.5 text-sm font-medium text-ardoise">
            <CircleCheck className="size-5 shrink-0 text-succes" aria-hidden="true" />
            {modifiee ? "Modifications enregistrées." : "Votre annonce est en ligne : les demandeurs peuvent la voir dès maintenant."}
          </p>
        )}
        <h1 className="doneo-titre text-[1.75rem] leading-tight lg:text-[2.6rem]">{annonce.titre}</h1>

        <ul className="mt-3 flex flex-wrap gap-2 text-sm font-medium" aria-label="Caractéristiques">
          {annonce.sousCategorie && (
            <li className="rounded-full bg-pervenche px-3 py-1 text-ardoise">{annonce.sousCategorie.libelle}</li>
          )}
          <li className="rounded-full bg-menthe px-3 py-1 text-ardoise">{LIBELLES_ETAT[annonce.etat]}</li>
          <li className="flex items-center gap-1 rounded-full border border-primary/15 bg-white px-3 py-1 text-ardoise">
            <MapPin className="size-3.5" aria-hidden="true" />
            {lieuAnnonce(annonce)}
          </li>
        </ul>

        {(reservee || remise) && (
          <p className="mt-4 rounded-2xl bg-citron/70 p-3.5 text-sm text-ardoise">
            {remise
              ? "Cet objet a déjà trouvé preneur. Merci pour l’association !"
              : estLaMienne
                ? "Vous avez réservé cet objet à un demandeur : suivez l’échange dans vos messages."
                : "Cet objet est déjà réservé. Vous pouvez quand même le demander : si la personne renonce, l’offrant pourra vous le proposer."}
          </p>
        )}

        <div className="mt-5 flex items-center gap-4 rounded-3xl bg-lavande p-4">
          <img src="/illustrations/objet-coeur.svg" alt="" aria-hidden="true" className="size-12 shrink-0" />
          <div className="min-w-0">
            <p className="font-titre text-[1.35rem] leading-tight font-semibold text-ardoise">
              {montant} <span className="text-base font-medium text-violet-fonce">— participation</span>
            </p>
            {annonce.association && (
              <p className="mt-0.5 text-sm text-ardoise">Reversée à {annonce.association.nom}</p>
            )}
          </div>
        </div>

          {/* Barre d'action : fixe en bas sur mobile, a la place du menu ; sur grand
              ecran, carte juste sous la participation, la ou le regard se pose. */}
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md rounded-t-[1.75rem] border-t md:max-w-3xl border-primary/10 bg-white px-5 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-14px_rgb(155_77_219/30%)] lg:static lg:mt-5 lg:max-w-none lg:rounded-3xl lg:border lg:p-5 lg:shadow-[0_16px_40px_-28px_rgb(155_77_219/45%)]">
          {estLaMienne ? (
            /* US-11 : modifier ou retirer son annonce. */
            panneau === "retrait" ? (
              <div className="space-y-2.5">
                <p className="text-sm text-ardoise">
                  Retirer « {annonce.titre} » ? Les demandes en cours seront closes, et les demandeurs prévenus.
                </p>
                <div className="flex gap-2.5">
                  <Button variant="doneoSecondaire" size="pilule" className="flex-1" onClick={() => setPanneau(null)}>
                    Annuler
                  </Button>
                  <Button
                    size="pilule"
                    className="flex-1 bg-destructive text-white hover:bg-destructive/90"
                    disabled={Boolean(action)}
                    onClick={retirer}>
                    {action === "retrait" ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="size-5" aria-hidden="true" />
                    )}
                    Retirer l’annonce
                  </Button>
                </div>
              </div>
            ) : remise ? (
              <Button asChild variant="doneoSecondaire" size="pilule" className="w-full">
                <Link to="/profil">Voir mon profil</Link>
              </Button>
            ) : (
              <div className="flex gap-2.5">
                <Button asChild variant="doneo" size="pilule" className="flex-1">
                  <Link to={`/annonces/${annonce.id}/modifier`}>
                    <Pencil className="size-5" aria-hidden="true" />
                    Modifier
                  </Link>
                </Button>
                <Button variant="doneoSecondaire" size="pilule" className="flex-1" onClick={() => setPanneau("retrait")}>
                  <Trash2 className="size-5" aria-hidden="true" />
                  Retirer
                </Button>
              </div>
            )
          ) : maDemande ? (
            /* Une demande est deja en cours : on la suit dans la conversation. */
            <Button asChild variant="doneo" size="pilule" className="w-full">
              <Link to={`/messages/${maDemande.conversationId}`}>
                <MessageCircle className="size-5" aria-hidden="true" />
                {maDemande.statut === "proposee"
                  ? `Verser ${montant} pour confirmer`
                  : maDemande.statut === "confirmee"
                    ? "Voir l’adresse et le rendez-vous"
                    : "Suivre ma demande"}
              </Link>
            </Button>
          ) : panneau === "demande" ? (
            /* US-24 : la demande, avec un mot facultatif pour l'offrant. */
            <div className="space-y-2.5">
              <label htmlFor="mot-offrant" className="doneo-etiquette">
                Un mot pour {annonce.offrant?.prenom || "l’offrant"} (facultatif)
              </label>
              <textarea
                id="mot-offrant"
                rows={2}
                maxLength={1000}
                placeholder="Bonjour, je peux passer au créneau indiqué."
                value={mot}
                onChange={(e) => setMot(e.target.value)}
                className="w-full resize-none rounded-[1.25rem] border-[1.5px] border-primary/20 bg-white px-4 py-3 text-base outline-none focus-visible:border-primary"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                L’offrant valide votre demande, puis vous versez {montant} à l’association. L’adresse exacte vous est
                alors donnée.
              </p>
              <Button variant="doneo" size="pilule" className="w-full" disabled={Boolean(action)} onClick={demander}>
                {action === "demande" ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Heart className="size-5 fill-current" aria-hidden="true" />
                )}
                Envoyer la demande
              </Button>
              <button
                type="button"
                onClick={() => setPanneau(null)}
                className="block w-full py-1 text-center text-sm font-semibold text-violet-fonce">
                Annuler
              </button>
            </div>
          ) : (
            <div className="flex gap-2.5">
              <Button
                variant="doneo"
                size="pilule"
                className="flex-1"
                disabled={remise || termine || maDemande === undefined}
                onClick={() => setPanneau("demande")}>
                <Heart className="size-5 fill-current" aria-hidden="true" />
                {remise ? "Objet déjà remis" : termine ? "Créneau passé" : `Réserver pour ${montant}`}
              </Button>
              {/* US-30 : contacter l'offrant, sans s'engager. */}
              {!remise && (
                <Button
                  variant="doneoSecondaire"
                  size="pilule"
                  className="w-14 shrink-0 px-0"
                  aria-label={`Écrire à ${annonce.offrant?.prenom || "l’offrant"}`}
                  disabled={Boolean(action)}
                  onClick={contacter}>
                  {action === "contact" ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <MessageCircle className="size-5" aria-hidden="true" />
                  )}
                </Button>
              )}
            </div>
          )}
          {erreurAction && (
            <p role="alert" className="mt-2 text-center text-sm text-destructive">
              {erreurAction}
            </p>
          )}
        </div>

        {annonce.description && (
          <p className="mt-5 leading-7 text-ardoise whitespace-pre-line text-pretty">{annonce.description}</p>
        )}

        <div className="doneo-carte mt-5 flex items-center gap-3.5 p-4">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-lavande font-titre text-lg font-semibold text-violet-fonce">
            {`${annonce.offrant?.prenom?.[0] || ""}${annonce.offrant?.initialeNom?.[0] || ""}`.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ardoise">{nomOffrant(annonce.offrant)}</p>
            <p className="text-sm text-muted-foreground">
              {estLaMienne ? "C’est votre annonce" : "Propose cet objet"}
            </p>
          </div>
          <Gift className="size-6 text-ardoise" aria-hidden="true" />
        </div>

        <h2 className="doneo-etiquette mt-6">Créneau de retrait</h2>
        <p className="mt-2 flex items-center gap-2.5 font-medium text-ardoise">
          <CalendarDays className="size-5 text-primary" aria-hidden="true" />
          {formaterCreneau(annonce.creneauRetrait)}
        </p>
        {termine && !remise && (
          <p className="mt-1 text-sm text-muted-foreground">
            Ce créneau est passé : l’offrant doit en proposer un nouveau.
          </p>
        )}

        <h2 className="doneo-etiquette mt-6">Lieu de retrait</h2>
        <p className="mt-2 flex items-center gap-2.5 font-medium text-ardoise">
          <MapPin className="size-5 text-primary" aria-hidden="true" />
          {[annonce.quartier, annonce.codePostal].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1.5 flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          L’adresse exacte vous est communiquée une fois votre participation validée.
        </p>
      </div>

    </article>
  );
}
