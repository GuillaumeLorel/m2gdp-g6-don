/**
 * Reservations (US-24 a US-28, issues #52, #53, #55, #56).
 *
 * Parcours retenu le 29/10/2026 :
 *
 *   demandee --(l'offrant valide)--> proposee --(paiement de test)--> confirmee
 *       |                               |
 *       +--(l'offrant decline,          +--(le demandeur refuse) --> annulee
 *           le demandeur annule) --> annulee
 *
 * Plusieurs demandeurs peuvent demander le meme objet : l'offrant en choisit
 * un. Tant que l'objet est propose ou confirme, l'annonce est `reserve` et
 * l'offrant ne peut pas le proposer a un second. La liste d'attente ordonnee,
 * le desistement apres paiement et la remise viennent en J5.
 *
 * L'adresse exacte de retrait n'est donnee qu'au demandeur, et seulement une
 * fois la participation payee (statutPaiement = paye).
 */
import { chercherLignes, insererLigne, lireLigne, mettreAJour } from './base.js';
import { versAnnoncesPubliques } from './annonces.js';
import { ajouterMessage, conversationPour, erreurContenu } from './conversations.js';
import { associations } from './referentiels.js';
import { creerSessionPaiement, lireSessionPaiement, paiementDisponible } from './stripe.js';

/** Statuts d'une reservation encore en cours. */
const EN_COURS = ['demandee', 'liste_attente', 'proposee', 'confirmee'];
const MAX_EN_COURS = 3;

const maintenant = () => new Date().toISOString();
const euros = (montant) =>
  `${Number(montant).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(Number(montant)) ? 0 : 2, maximumFractionDigits: 2 })} €`;
const refus = (statut, erreur) => ({ statut, corps: { erreur } });

/**
 * Forme publique d'une reservation, vue par `lecteurId`. `adresseRetrait`
 * n'apparait que pour le demandeur d'une reservation confirmee et payee, et
 * seulement si l'annonce est fournie : jamais sur une route de liste.
 */
export function versReservation(r, lecteurId, annonce = null) {
  const adresseVisible =
    annonce && lecteurId === r.demandeurId && r.statut === 'confirmee' && r.statutPaiement === 'paye';
  return {
    id: r.id,
    annonceId: r.annonceId,
    conversationId: r.conversationId,
    demandeurId: r.demandeurId,
    offrantId: r.offrantId,
    statut: r.statut,
    motifAnnulation: r.motifAnnulation || null,
    proposeeLe: r.proposeeLe || null,
    participationDemandee: r.participationDemandee === null ? null : Number(r.participationDemandee),
    montantDebite: 0,
    statutPaiement: r.statutPaiement,
    referencePaiement: r.referencePaiement || null,
    environnementPaiement: 'test',
    ...(adresseVisible
      ? {
          adresseRetrait: {
            numeroRue: annonce.numeroRue,
            rue: annonce.rue,
            complementAdresse: annonce.complementAdresse || '',
            codePostal: annonce.codePostal,
            ville: annonce.ville,
          },
        }
      : {}),
    creeLe: r.creeLe,
    misAJourLe: r.misAJourLe,
  };
}

const messageSysteme = (env, r, evenement, contenu) =>
  ajouterMessage(env, r.conversationId, { type: 'systeme', reservationId: r.id, evenement, contenu });

/** Demander un objet a son offrant (#52). */
export async function demander(env, utilisateurId, annonceId, message) {
  const [profil, annonce] = await Promise.all([
    lireLigne(env, 'utilisateurs', utilisateurId),
    lireLigne(env, 'annonces', annonceId),
  ]);
  if (!profil?.roles?.includes('demandeur')) {
    return refus(403, 'Ajoutez le rôle demandeur à votre profil pour demander un objet.');
  }
  if (!annonce || annonce.statut === 'retiree') return refus(404, 'Cette annonce n’existe pas ou a été retirée.');
  if (annonce.offrantId === utilisateurId) return refus(403, 'Vous ne pouvez pas demander votre propre objet.');
  if (annonce.statut === 'remis') return refus(409, 'Cet objet a déjà trouvé preneur.');
  if (Date.parse(annonce.creneauRetrait?.fin) < Date.now()) {
    return refus(409, 'Le créneau de retrait est passé : écrivez à l’offrant pour qu’il en propose un autre.');
  }
  if (message) {
    const erreur = erreurContenu(message);
    if (erreur) return { statut: 422, corps: { erreurs: [erreur] } };
  }

  const enCours = await chercherLignes(env, 'reservations', { demandeurId: utilisateurId, statut: EN_COURS });
  if (enCours.some((r) => r.annonceId === annonceId)) return refus(409, 'Vous avez déjà une demande en cours pour cet objet.');
  if (enCours.length >= MAX_EN_COURS) {
    return refus(409, `Vous avez déjà ${MAX_EN_COURS} demandes en cours : attendez qu’une se termine.`);
  }

  const { conversation } = await conversationPour(env, annonce, utilisateurId);
  const reservation = await insererLigne(env, 'reservations', {
    id: crypto.randomUUID(),
    annonceId,
    demandeurId: utilisateurId,
    offrantId: annonce.offrantId,
    conversationId: conversation.id,
    statut: 'demandee',
    creeLe: maintenant(),
    misAJourLe: maintenant(),
  });
  await messageSysteme(env, reservation, 'demande_recue', `${profil.prenom} souhaite récupérer cet objet.`);
  if (message) await ajouterMessage(env, conversation.id, { auteurId: utilisateurId, contenu: message.trim() });
  return { statut: 201, corps: versReservation(reservation, utilisateurId) };
}

/** Charge une reservation et verifie que `utilisateurId` en est la partie attendue. */
async function chargerPour(env, id, utilisateurId, role) {
  const r = await lireLigne(env, 'reservations', id);
  if (!r) return { erreur: refus(404, 'Réservation introuvable.') };
  const partie = role === 'offrant' ? r.offrantId : role === 'demandeur' ? r.demandeurId : null;
  const autorise = partie ? partie === utilisateurId : [r.offrantId, r.demandeurId].includes(utilisateurId);
  if (!autorise) return { erreur: refus(403, 'Cette réservation ne vous concerne pas.') };
  return { r };
}

/** L'offrant valide une demande : l'objet est propose au demandeur (#53). */
export async function valider(env, utilisateurId, id) {
  const { r, erreur } = await chargerPour(env, id, utilisateurId, 'offrant');
  if (erreur) return erreur;
  if (r.statut !== 'demandee') return refus(409, 'Cette demande a déjà reçu une réponse.');
  const annonce = await lireLigne(env, 'annonces', r.annonceId);
  if (Date.parse(annonce.creneauRetrait?.fin) < Date.now()) {
    return refus(409, 'Le créneau de retrait est passé : modifiez d’abord votre annonce.');
  }

  // L'annonce passe a `reserve` SI elle est encore disponible : une seule
  // personne tient l'objet a la fois.
  const [reservee] = await mettreAJour(env, 'annonces', { id: annonce.id, statut: 'disponible' }, { statut: 'reserve', misAJourLe: maintenant() });
  if (!reservee) return refus(409, 'Vous avez déjà proposé cet objet à quelqu’un : attendez sa réponse.');
  const [proposee] = await mettreAJour(env, 'reservations', { id, statut: 'demandee' }, {
    statut: 'proposee',
    proposeeLe: maintenant(),
    participationDemandee: annonce.participation,
    misAJourLe: maintenant(),
  });
  if (!proposee) {
    await mettreAJour(env, 'annonces', { id: annonce.id }, { statut: 'disponible' });
    return refus(409, 'Cette demande a déjà reçu une réponse.');
  }
  await messageSysteme(env, proposee, 'objet_propose',
    `Demande acceptée : l’objet vous est réservé. Versez la participation de ${euros(annonce.participation)} pour confirmer et recevoir l’adresse exacte.`);
  return { statut: 200, corps: versReservation(proposee, utilisateurId) };
}

/** L'offrant decline une demande (#53). */
export async function decliner(env, utilisateurId, id) {
  const { r, erreur } = await chargerPour(env, id, utilisateurId, 'offrant');
  if (erreur) return erreur;
  const [declinee] = await mettreAJour(env, 'reservations', { id, statut: 'demandee' }, {
    statut: 'annulee', motifAnnulation: 'declinee', misAJourLe: maintenant(),
  });
  if (!declinee) return refus(409, r.statut === 'annulee' ? 'Cette demande est déjà close.' : 'Cette demande a déjà reçu une réponse.');
  await messageSysteme(env, declinee, 'demande_declinee', 'L’offrant a décliné cette demande.');
  return { statut: 200, corps: versReservation(declinee, utilisateurId) };
}

/**
 * Le demandeur renonce : il annule sa demande, ou refuse l'objet qui lui est
 * propose. Dans le second cas, l'annonce redevient disponible.
 */
export async function renoncer(env, utilisateurId, id) {
  const { r, erreur } = await chargerPour(env, id, utilisateurId, 'demandeur');
  if (erreur) return erreur;
  if (!['demandee', 'proposee'].includes(r.statut)) {
    return refus(409, r.statut === 'confirmee' ? 'La participation est déjà versée : écrivez à l’offrant.' : 'Cette réservation est déjà close.');
  }
  const motif = r.statut === 'proposee' ? 'refus' : 'desistement';
  const [close] = await mettreAJour(env, 'reservations', { id, statut: r.statut }, {
    statut: 'annulee', motifAnnulation: motif, misAJourLe: maintenant(),
  });
  if (!close) return refus(409, 'Cette réservation vient de changer : rechargez la page.');
  if (motif === 'refus') {
    await mettreAJour(env, 'annonces', { id: r.annonceId, statut: 'reserve' }, { statut: 'disponible', misAJourLe: maintenant() });
  }
  await messageSysteme(env, close, motif === 'refus' ? 'proposition_refusee' : 'demande_annulee',
    motif === 'refus' ? 'Le demandeur a renoncé à l’objet : il est de nouveau disponible.' : 'Le demandeur a annulé sa demande.');
  return { statut: 200, corps: versReservation(close, utilisateurId) };
}

/**
 * Ouvre le tunnel de paiement de test (#55). Renvoie l'adresse de la page de
 * paiement Stripe ; le retour se fait sur `origineFront`.
 */
export async function payer(env, utilisateurId, id, origineFront) {
  const { r, erreur } = await chargerPour(env, id, utilisateurId, 'demandeur');
  if (erreur) return erreur;
  if (r.statut !== 'proposee') return refus(409, 'Cet objet ne vous est pas (ou plus) proposé.');
  if (!paiementDisponible(env)) return refus(503, 'Le paiement de test n’est pas encore configuré.');
  const annonce = await lireLigne(env, 'annonces', r.annonceId);
  const association = (await associations(env)).find((a) => a.id === annonce.associationId);
  const retour = `${origineFront}/messages/${r.conversationId}?reservation=${r.id}`;
  const session = await creerSessionPaiement(env, {
    montant: Number(r.participationDemandee),
    libelle: `Participation solidaire — ${annonce.titre}`,
    description: `Reversée à ${association?.nom || 'l’association choisie'}. Paiement de test : aucun montant n’est débité.`,
    reservationId: r.id,
    urlSucces: `${retour}&paiement=ok`,
    urlAnnulation: `${retour}&paiement=annule`,
  });
  await mettreAJour(env, 'reservations', { id }, { sessionPaiement: session.id, misAJourLe: maintenant() });
  return { statut: 200, corps: { urlPaiement: session.url } };
}

/**
 * Au retour du tunnel : verifie aupres de Stripe que la session est payee,
 * puis confirme la reservation et revele l'adresse exacte (#55, #56).
 * Idempotent : un rechargement de la page ne double rien.
 */
export async function confirmerPaiement(env, utilisateurId, id) {
  const { r, erreur } = await chargerPour(env, id, utilisateurId, 'demandeur');
  if (erreur) return erreur;
  const annonce = await lireLigne(env, 'annonces', r.annonceId);
  if (r.statut === 'confirmee') return { statut: 200, corps: versReservation(r, utilisateurId, annonce) };
  if (r.statut !== 'proposee' || !r.sessionPaiement) return refus(409, 'Aucun paiement en cours pour cette réservation.');

  const session = await lireSessionPaiement(env, r.sessionPaiement);
  if (session.payment_status !== 'paid') return refus(402, 'Le paiement n’a pas abouti. Vous pouvez réessayer.');
  const [confirmee] = await mettreAJour(env, 'reservations', { id, statut: 'proposee' }, {
    statut: 'confirmee',
    statutPaiement: 'paye',
    referencePaiement: session.payment_intent || session.id,
    misAJourLe: maintenant(),
  });
  if (!confirmee) {
    const relue = await lireLigne(env, 'reservations', id);
    return { statut: 200, corps: versReservation(relue, utilisateurId, annonce) };
  }
  await messageSysteme(env, confirmee, 'paiement_valide',
    `Participation de ${euros(confirmee.participationDemandee)} validée (paiement de test : rien n’a été débité). La réservation est confirmée et l’adresse exacte a été communiquée au demandeur.`);
  return { statut: 200, corps: versReservation(confirmee, utilisateurId, annonce) };
}

/** Une reservation, pour ses deux parties ; avec l'adresse pour le demandeur payant (#56). */
export async function lireReservation(env, utilisateurId, id) {
  const { r, erreur } = await chargerPour(env, id, utilisateurId);
  if (erreur) return erreur;
  const annonce = r.statut === 'confirmee' ? await lireLigne(env, 'annonces', r.annonceId) : null;
  return { statut: 200, corps: versReservation(r, utilisateurId, annonce) };
}

/**
 * Mes reservations, comme demandeur ou comme offrant, avec un resume de
 * l'annonce. Jamais d'adresse exacte ici : c'est une liste.
 */
export async function listerReservations(env, utilisateurId, role) {
  const champ = role === 'offrant' ? 'offrantId' : 'demandeurId';
  const reservations = await chercherLignes(env, 'reservations', { [champ]: utilisateurId }, { ordre: 'creeLe.desc' });
  const annonces = new Map(
    (await versAnnoncesPubliques(env, await lireAnnonces(env, reservations))).map((a) => [a.id, a]),
  );
  return reservations.map((r) => ({ ...versReservation(r, utilisateurId), annonce: annonces.get(r.annonceId) || null }));
}

async function lireAnnonces(env, reservations) {
  const ids = [...new Set(reservations.map((r) => r.annonceId))];
  if (ids.length === 0) return [];
  return chercherLignes(env, 'annonces', { id: ids });
}
