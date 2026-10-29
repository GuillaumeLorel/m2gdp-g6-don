import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { CalendarDays, Check, ChevronLeft, CircleCheck, CreditCard, Info, Loader2, Lock, MapPin, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import ImageAnnonce from "@/components/ImageAnnonce.jsx";
import { ErreurChargement } from "@/components/Etats.jsx";
import {
  chargerConversation,
  confirmerPaiement,
  declinerDemande,
  demanderObjet,
  envoyerMessage,
  ouvrirPaiement,
  renoncerReservation,
  validerDemande,
} from "@/lib/api.js";
import { formaterCreneau, formaterParticipation, nomOffrant } from "@/lib/format.js";

const heure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const jour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Rafraichissement de la conversation : pas de temps reel, un simple relevé. */
const INTERVALLE = 8000;

const initiales = (membre) => `${membre?.prenom?.[0] || ""}${membre?.initialeNom?.[0] || ""}`.toUpperCase();

/** Texte d'une reservation close, selon la raison. */
const MOTIFS = {
  declinee: "L’offrant a décliné cette demande.",
  desistement: "La demande a été annulée.",
  refus: "Le demandeur a renoncé à l’objet.",
  annonce_retiree: "L’annonce a été retirée par son offrant.",
  sans_reponse: "L’offrant est passé au suivant, faute de réponse.",
  attribuee_a_autrui: "L’objet a été remis à quelqu’un d’autre.",
};

/**
 * Bandeau de la reservation, en haut de la conversation : ou l'on en est, et
 * les actions possibles a cette etape (US-24 a US-28). C'est la messagerie
 * « actionnable » des maquettes : on agit la ou l'on discute.
 */
function BandeauReservation({ conversation, surAction }) {
  const { reservation: r, monRole, annonce, interlocuteur } = conversation;
  const [action, setAction] = useState(null);
  const [erreur, setErreur] = useState(null);
  const montant = formaterParticipation(r?.participationDemandee ?? annonce?.participation);

  async function agir(nom, appel) {
    setAction(nom);
    setErreur(null);
    try {
      await appel();
      await surAction();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setAction(null);
    }
  }

  async function payer() {
    setAction("payer");
    setErreur(null);
    try {
      // Tunnel Stripe en mode test : on quitte l'app, le retour se fait ici.
      window.location.assign(await ouvrirPaiement(r.id));
    } catch (e) {
      setErreur(e.message);
      setAction(null);
    }
  }

  const bouton = (nom, libelle, appel, variante = "doneo", Icone = Check) => (
    <Button
      key={nom}
      variant={variante}
      size="pilule"
      className="flex-1"
      disabled={Boolean(action)}
      onClick={appel}>
      {action === nom ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Icone className="size-5" aria-hidden="true" />}
      {libelle}
    </Button>
  );

  let texte;
  let actions = [];
  let adresse = null;
  const objetDisponible = annonce && ["disponible", "reserve"].includes(annonce.statut);

  if (!r || r.statut === "annulee") {
    texte = r ? MOTIFS[r.motifAnnulation] || "Cette demande est close." : null;
    if (monRole === "demandeur" && objetDisponible) {
      actions = [bouton("demander", r ? "Refaire une demande" : `Réserver pour ${formaterParticipation(annonce.participation)}`,
        () => agir("demander", () => demanderObjet(annonce.id)))];
    }
  } else if (r.statut === "demandee") {
    if (monRole === "offrant") {
      texte = `${interlocuteur.prenom} souhaite récupérer cet objet. Validez pour le lui réserver : ${interlocuteur.prenom} versera alors ${montant} à l’association.`;
      actions = [
        bouton("valider", "Valider la demande", () => agir("valider", () => validerDemande(r.id))),
        bouton("decliner", "Décliner", () => agir("decliner", () => declinerDemande(r.id)), "doneoSecondaire", X),
      ];
    } else {
      texte = "Demande envoyée : l’offrant doit la valider. Vous verserez ensuite la participation.";
      actions = [bouton("renoncer", "Annuler ma demande", () => agir("renoncer", () => renoncerReservation(r.id)), "doneoSecondaire", X)];
    }
  } else if (r.statut === "proposee") {
    if (monRole === "demandeur") {
      texte = `L’objet vous est réservé ! Versez ${montant} à l’association pour confirmer et recevoir l’adresse exacte. Paiement de test : rien n’est débité.`;
      actions = [
        bouton("payer", `Verser ${montant}`, payer, "doneo", CreditCard),
        bouton("renoncer", "Renoncer", () => agir("renoncer", () => renoncerReservation(r.id)), "doneoSecondaire", X),
      ];
    } else {
      texte = `Objet réservé pour ${interlocuteur.prenom} : en attente de sa participation de ${montant}.`;
    }
  } else if (r.statut === "confirmee") {
    texte = monRole === "demandeur"
      ? `Réservation confirmée : ${montant} versés à l’association. Rendez-vous au créneau prévu.`
      : `Participation de ${montant} validée. ${interlocuteur.prenom} a reçu votre adresse et vient au créneau prévu.`;
    adresse = r.adresseRetrait;
  } else if (r.statut === "remise") {
    texte = "L’objet a été remis. Merci pour l’association !";
  }

  return (
    <div className="doneo-carte space-y-3 p-3.5">
      {annonce && (
        <Link to={`/annonces/${annonce.id}`} className="flex items-center gap-3">
          <ImageAnnonce annonce={annonce} className="size-14 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ardoise">{annonce.titre}</p>
            {annonce.creneauRetrait && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ardoise">
                <CalendarDays className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                {formaterCreneau(annonce.creneauRetrait, { court: true })}
              </p>
            )}
            <p className="text-xs font-semibold text-violet-fonce underline">Voir l’annonce</p>
          </div>
        </Link>
      )}
      {texte && (
        <p role="status" className={`flex gap-2 rounded-2xl p-3 text-sm leading-5 text-ardoise ${r?.statut === "confirmee" ? "bg-menthe" : "bg-lavande/60"}`}>
          {r?.statut === "confirmee" ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-succes" aria-hidden="true" />
          ) : (
            <Info className="mt-0.5 size-4 shrink-0 text-violet-fonce" aria-hidden="true" />
          )}
          <span>{texte}</span>
        </p>
      )}
      {adresse && (
        <div className="rounded-2xl border border-succes/30 bg-white p-3.5">
          <p className="doneo-etiquette flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden="true" /> Adresse exacte du retrait
          </p>
          <p className="mt-1.5 flex items-start gap-2 font-semibold text-ardoise">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {adresse.numeroRue} {adresse.rue}
              {adresse.complementAdresse && <><br />{adresse.complementAdresse}</>}
              <br />
              {adresse.codePostal} {adresse.ville}
            </span>
          </p>
          {r.referencePaiement && (
            <p className="mt-2 text-[0.7rem] text-muted-foreground">
              Référence du paiement de test : {r.referencePaiement}
            </p>
          )}
        </div>
      )}
      {/* Passe a la ligne quand la place manque (320 px, libelles longs). */}
      {actions.length > 0 && <div className="flex flex-wrap gap-2.5">{actions}</div>}
      {erreur && (
        <p role="alert" className="text-sm text-destructive">
          {erreur}
        </p>
      )}
    </div>
  );
}

/** Un message : bulle a droite pour soi, a gauche pour l'autre, au centre pour le systeme. */
function Bulle({ message, moi }) {
  if (message.type === "systeme") {
    return (
      <li className="mx-auto max-w-[90%] rounded-2xl bg-lavande/70 px-3.5 py-2 text-center text-xs leading-5 text-ardoise">
        {message.contenu}
        <span className="mt-0.5 block text-[0.65rem] text-muted-foreground">{heure.format(new Date(message.creeLe))}</span>
      </li>
    );
  }
  const deMoi = message.auteurId === moi;
  return (
    <li className={`flex ${deMoi ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[80%] rounded-[1.25rem] px-4 py-2.5 text-[0.95rem] leading-6 whitespace-pre-line shadow-sm ${
          deMoi ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-white text-ardoise"
        }`}>
        {message.contenu}
        <span className={`mt-1 block text-right text-[0.65rem] ${deMoi ? "text-white/80" : "text-muted-foreground"}`}>
          {heure.format(new Date(message.creeLe))}
        </span>
      </p>
    </li>
  );
}

/**
 * Une conversation (US-31, issue #64), d'apres l'ecran 12 de la maquette :
 * l'interlocuteur et l'objet en tete, la reservation et ses actions, les
 * messages, puis la saisie en bas.
 */
export default function Conversation({ profil }) {
  const { id } = useParams();
  const naviguer = useNavigate();
  const [parametres, setParametres] = useSearchParams();
  const [conversation, setConversation] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState(null);
  const [retourPaiement, setRetourPaiement] = useState(null);
  const fin = useRef(null);
  const nombreMessages = useRef(0);

  const charger = useCallback(
    () =>
      chargerConversation(id)
        .then((c) => {
          setConversation(c);
          setErreur(null);
        })
        .catch((e) => setErreur(e.message)),
    [id],
  );

  // Retour du tunnel de paiement : on fait confirmer par le serveur, qui
  // verifie aupres de Stripe, puis on nettoie l'adresse.
  useEffect(() => {
    const reservation = parametres.get("reservation");
    const paiement = parametres.get("paiement");
    if (!reservation || !paiement) {
      charger();
      return;
    }
    setParametres({}, { replace: true });
    if (paiement === "annule") {
      setRetourPaiement({ ok: false, texte: "Paiement interrompu : vous pouvez le reprendre quand vous voulez." });
      charger();
      return;
    }
    confirmerPaiement(reservation)
      .then(() => setRetourPaiement({ ok: true, texte: "Participation validée ! Voici l’adresse exacte du retrait." }))
      .catch((e) => setRetourPaiement({ ok: false, texte: e.message }))
      .finally(charger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const minuterie = setInterval(charger, INTERVALLE);
    return () => clearInterval(minuterie);
  }, [charger]);

  // Nouveau message : on descend en bas de la conversation.
  useEffect(() => {
    const n = conversation?.messages.length || 0;
    if (n > nombreMessages.current) fin.current?.scrollIntoView({ block: "end" });
    nombreMessages.current = n;
  }, [conversation]);

  async function envoyer(evenement) {
    evenement.preventDefault();
    if (!texte.trim()) return;
    setEnvoi(true);
    setErreurEnvoi(null);
    try {
      await envoyerMessage(id, texte.trim());
      setTexte("");
      await charger();
    } catch (e) {
      setErreurEnvoi(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  const revenir = () => (window.history.state?.idx > 0 ? naviguer(-1) : naviguer("/messages"));

  if (erreur && !conversation) {
    return (
      <div className="px-5 pt-5">
        <ErreurChargement message={erreur} surReessayer={charger} />
      </div>
    );
  }

  // Les messages sont groupes par jour, comme dans toute messagerie.
  const parJour = [];
  for (const m of conversation?.messages || []) {
    const cle = jour.format(new Date(m.creeLe));
    if (parJour.at(-1)?.cle !== cle) parJour.push({ cle, messages: [] });
    parJour.at(-1).messages.push(m);
  }

  return (
    <section className="mx-auto flex min-h-dvh max-w-2xl flex-col lg:min-h-[calc(100dvh-var(--hauteur-entete)-6rem)]">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-3 backdrop-blur lg:top-(--hauteur-entete)">
        <button
          type="button"
          onClick={revenir}
          aria-label="Retour aux messages"
          className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/10 bg-white text-ardoise shadow-sm">
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        {conversation ? (
          <>
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-lavande font-titre font-semibold text-violet-fonce">
              {initiales(conversation.interlocuteur)}
            </span>
            <div className="min-w-0">
              <h1 className="doneo-titre truncate text-xl leading-tight">{nomOffrant(conversation.interlocuteur)}</h1>
              <p className="truncate text-xs text-muted-foreground">
                {conversation.monRole === "offrant" ? "Intéressé·e par votre objet" : "Offrant"} · {conversation.annonce?.titre}
              </p>
            </div>
          </>
        ) : (
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Chargement" />
        )}
      </header>

      {conversation && (
        <div className="flex flex-1 flex-col gap-4 px-4 pb-28">
          {retourPaiement && (
            <p role="status" className={`rounded-2xl p-3 text-sm font-medium ${retourPaiement.ok ? "bg-menthe text-ardoise" : "bg-citron/70 text-ardoise"}`}>
              {retourPaiement.texte}
            </p>
          )}
          <BandeauReservation conversation={conversation} surAction={charger} />

          <ol className="flex flex-col gap-2.5" aria-label="Messages">
            {parJour.map(({ cle, messages }) => (
              <li key={cle}>
                <p className="my-2 text-center text-xs font-medium text-muted-foreground first-letter:uppercase">{cle}</p>
                <ol className="flex flex-col gap-2.5">
                  {messages.map((m) => (
                    <Bulle key={m.id} message={m} moi={profil.id} />
                  ))}
                </ol>
              </li>
            ))}
          </ol>
          {conversation.messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Posez votre question : {conversation.interlocuteur.prenom} vous répondra ici.
            </p>
          )}
          <div ref={fin} />
        </div>
      )}

      <form
        onSubmit={envoyer}
        className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-2xl items-end gap-2.5 border-t border-primary/10 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:sticky lg:w-full lg:rounded-t-3xl">
        <label htmlFor="message" className="sr-only">
          Votre message
        </label>
        <textarea
          id="message"
          rows={1}
          maxLength={1000}
          placeholder="Écrire un message…"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) envoyer(e);
          }}
          className="max-h-32 min-h-12 flex-1 resize-none rounded-[1.25rem] border-[1.5px] border-primary/20 bg-white px-4 py-3 text-base leading-6 outline-none focus-visible:border-primary"
        />
        <Button type="submit" variant="doneo" className="size-12 shrink-0 rounded-full p-0" disabled={envoi || !texte.trim()} aria-label="Envoyer">
          {envoi ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
        </Button>
        {erreurEnvoi && (
          <p role="alert" className="absolute -top-8 left-4 rounded-full bg-white px-3 py-1 text-xs text-destructive shadow">
            {erreurEnvoi}
          </p>
        )}
      </form>
    </section>
  );
}
