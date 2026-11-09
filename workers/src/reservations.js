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
import { chercherLignes, insererLigne, lireLigne, lireLignes, mettreAJour } from './base.js';
import { versAnnoncesPubliques } from './annonces.js';
import { ajouterMessage, conversationPour, erreurContenu } from './conversations.js';
import { prevenir } from './email.js';
import { repartition } from './commission.js';
import { associations } from './referentiels.js';
import { creerSessionPaiement, lireSessionPaiement, paiementDisponible } from './stripe.js';

/** Statuts d'une reservation encore en cours (partages avec edition.js). */
export const EN_COURS = ['demandee', 'liste_attente', 'proposee', 'confirmee'];
/**
 * Plafond de demandes simultanees. Il ne compte que ce qui attend une
 * reponse (demande, objet propose) : une reservation payee attend la remise,
 * qui n'existe qu'en J5 — la compter bloquerait pour de bon un demandeur qui
 * a deja paye trois objets.
 */
const EN_ATTENTE = ['demandee', 'liste_attente', 'proposee'];
const MAX_EN_COURS = 3;
/** Personnes au plus dans la liste d'attente d'une annonce (proposition de la spec, a valider avec le PO). */
const MAX_FILE = 5;

const maintenant = () => new Date().toISOString();
const euros = (montant) =>
  `${Number(montant).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(Number(montant)) ? 0 : 2, maximumFractionDigits: 2 })} €`;
const refus = (statut, erreur) => ({ statut, corps: { erreur } });
/** « 2 €, dont 1,90 € pour l'association » : la commission de 5 % est prelevee dessus (#54). */
const montantEtPart = (participation) =>
  `${euros(participation)}, dont ${euros(repartition(participation).partAssociation)} pour l’association`;

/**
 * Forme publique d'une reservation, vue par `lecteurId`. `adresseRetrait`
 * n'apparait que pour le demandeur d'une reservation confirmee et payee, et
 * seulement si l'annonce est fournie : jamais sur une route de liste.
 */
export function versReservation(r, lecteurId, annonce = null, position = null) {
  const adresseVisible =
    annonce && lecteurId === r.demandeurId && r.statut === 'confirmee' && r.statutPaiement === 'paye';
  return {
    id: r.id,
    annonceId: r.annonceId,
    conversationId: r.conversationId,
    demandeurId: r.demandeurId,
    offrantId: r.offrantId,
    statut: r.statut,
    position,
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

/** Rang (1 = premier) d'une reservation en liste d'attente ; `null` sinon. */
export async function rangFile(env, r) {
  if (r.statut !== 'liste_attente') return null;
  const file = await chercherLignes(env, 'reservations', { annonceId: r.annonceId, statut: 'liste_attente' }, { ordre: 'creeLe.asc' });
  const rang = file.findIndex((x) => x.id === r.id);
  return rang === -1 ? null : rang + 1;
}

/**
 * L'objet est libere (desistement, refus, sans reponse) : on le propose au
 * premier de la liste d'attente, qui en est prevenu par un message systeme.
 * Sans file, l'annonce redevient disponible. Renvoie la reservation promue,
 * ou `null`.
 */
async function proposerAuSuivant(env, annonceId) {
  const annonce = await lireLigne(env, 'annonces', annonceId);
  const file = await chercherLignes(env, 'reservations', { annonceId, statut: 'liste_attente' }, { ordre: 'creeLe.asc' });
  for (const suivant of file) {
    // `participationDemandee` est figee ici, a la proposition, pas a l'inscription.
    const [proposee] = await mettreAJour(env, 'reservations', { id: suivant.id, statut: 'liste_attente' }, {
      statut: 'proposee',
      proposeeLe: maintenant(),
      participationDemandee: annonce.participation,
      misAJourLe: maintenant(),
    });
    if (!proposee) continue; // elle vient de se desister : on passe a la suivante
    await messageSysteme(env, proposee, 'objet_propose',
      `L’objet est libre et vous est proposé : versez la participation de ${montantEtPart(annonce.participation)}, pour le réserver, ou refusez.`);
    prevenir(env, 'objet_propose', proposee, annonce);
    return proposee;
  }
  await mettreAJour(env, 'annonces', { id: annonceId, statut: 'reserve' }, { statut: 'disponible', misAJourLe: maintenant() });
  return null;
}

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
  if (enCours.filter((r) => EN_ATTENTE.includes(r.statut)).length >= MAX_EN_COURS) {
    return refus(409, `Vous avez déjà ${MAX_EN_COURS} demandes en cours : attendez qu’une se termine.`);
  }

  // Objet deja tenu (propose ou confirme) : on s'inscrit en liste d'attente.
  const enFile = annonce.statut === 'reserve';
  if (enFile) {
    const file = await chercherLignes(env, 'reservations', { annonceId, statut: 'liste_attente' });
    if (file.length >= MAX_FILE) return refus(409, `La liste d’attente est pleine (${MAX_FILE} personnes).`);
  }

  const { conversation } = await conversationPour(env, annonce, utilisateurId);
  const reservation = await insererLigne(env, 'reservations', {
    id: crypto.randomUUID(),
    annonceId,
    demandeurId: utilisateurId,
    offrantId: annonce.offrantId,
    conversationId: conversation.id,
    statut: enFile ? 'liste_attente' : 'demandee',
    creeLe: maintenant(),
    misAJourLe: maintenant(),
  });
  if (enFile) {
    await messageSysteme(env, reservation, 'demande_en_file', `${profil.prenom} s’est inscrit·e en liste d’attente.`);
  } else {
    await messageSysteme(env, reservation, 'demande_recue', `${profil.prenom} souhaite récupérer cet objet.`);
    prevenir(env, 'demande_recue', reservation, annonce);
  }
  if (message) await ajouterMessage(env, conversation.id, { auteurId: utilisateurId, contenu: message.trim() });
  return { statut: 201, corps: versReservation(reservation, utilisateurId, null, await rangFile(env, reservation)) };
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
    `Demande acceptée : l’objet vous est réservé. Versez la participation de ${montantEtPart(annonce.participation)}, pour confirmer et recevoir l’adresse exacte.`);
  prevenir(env, 'objet_propose', proposee, annonce);
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
  prevenir(env, 'demande_declinee', declinee);
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
  // Un refus libere l'objet : il passe au premier de la file, sinon il redevient disponible.
  const suivant = motif === 'refus' ? await proposerAuSuivant(env, r.annonceId) : null;
  await messageSysteme(env, close, motif === 'refus' ? 'proposition_refusee' : 'demande_annulee',
    motif === 'refus'
      ? `Le demandeur a renoncé à l’objet : ${suivant ? 'il est proposé au suivant.' : 'il est de nouveau disponible.'}`
      : 'Le demandeur a annulé sa demande.');
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
  // Une session deja ouverte (second clic, second onglet) est reprise : en
  // creer une nouvelle ferait ignorer un paiement fait dans la premiere.
  if (r.sessionPaiement) {
    const existante = await lireSessionPaiement(env, r.sessionPaiement).catch(() => null);
    if (existante?.payment_status === 'paid') return confirmerPaiement(env, utilisateurId, id);
    if (existante?.status === 'open' && existante.url) return { statut: 200, corps: { urlPaiement: existante.url } };
  }
  const annonce = await lireLigne(env, 'annonces', r.annonceId);
  const association = (await associations(env)).find((a) => a.id === annonce.associationId);
  const retour = `${origineFront}/messages/${r.conversationId}?reservation=${r.id}`;
  // Le demandeur voit sur la page de paiement ce que recoit l'association (#54).
  const { commission, partAssociation } = repartition(r.participationDemandee);
  const session = await creerSessionPaiement(env, {
    montant: Number(r.participationDemandee),
    libelle: `Participation solidaire — ${annonce.titre}`,
    description: `${euros(partAssociation)} reversés à ${association?.nom || 'l’association choisie'}, ${euros(commission)} de commission Donéo. Paiement de test : aucun montant n’est débité.`,
    reservationId: r.id,
    urlSucces: `${retour}&paiement=ok`,
    urlAnnulation: `${retour}&paiement=annule`,
  }).catch((e) => {
    console.error(e);
    return null;
  });
  if (!session) return refus(502, 'Le service de paiement ne répond pas. Réessayez dans un instant.');
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

  const session = await lireSessionPaiement(env, r.sessionPaiement).catch((e) => {
    console.error(e);
    return null;
  });
  if (!session) return refus(502, 'Le service de paiement ne répond pas. Réessayez dans un instant.');
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
  prevenir(env, 'paiement_valide', confirmee, annonce);
  // L'objet est attribue : les demandes que l'offrant n'avait pas tranchees sont
  // closes. La liste d'attente, elle, reste : si le detenteur se desiste, le
  // premier de la file reprend l'objet. Seule la remise la clot.
  const autres = await mettreAJour(env, 'reservations', { annonceId: r.annonceId, statut: ['demandee'] }, {
    statut: 'annulee', motifAnnulation: 'attribuee_a_autrui', misAJourLe: maintenant(),
  });
  for (const autre of autres) {
    await messageSysteme(env, autre, 'attribuee_a_autrui', 'L’objet a été attribué à une autre personne : votre demande est close.');
  }
  return { statut: 200, corps: versReservation(confirmee, utilisateurId, annonce) };
}

/**
 * Le demandeur se desiste (#58), depuis la liste d'attente, l'objet propose ou
 * la reservation payee (remboursement fictif, comme le paiement). S'il tenait
 * l'objet, il passe au premier de la file.
 */
export async function seDesister(env, utilisateurId, id) {
  const { r, erreur } = await chargerPour(env, id, utilisateurId, 'demandeur');
  if (erreur) return erreur;
  if (!['liste_attente', 'proposee', 'confirmee'].includes(r.statut)) {
    return refus(409, r.statut === 'remise' ? 'L’objet a déjà été remis.' : 'Cette réservation est déjà close, ou pas encore proposée.');
  }
  const payee = r.statut === 'confirmee';
  const [close] = await mettreAJour(env, 'reservations', { id, statut: r.statut }, {
    statut: 'annulee',
    motifAnnulation: 'desistement',
    ...(payee ? { statutPaiement: 'rembourse' } : {}),
    misAJourLe: maintenant(),
  });
  if (!close) return refus(409, 'Cette réservation vient de changer : rechargez la page.');
  const tenait = r.statut !== 'liste_attente';
  const suivant = tenait ? await proposerAuSuivant(env, r.annonceId) : null;
  const apres = tenait ? ` : ${suivant ? 'l’objet est proposé au suivant.' : 'l’objet est de nouveau disponible.'}` : '.';
  await messageSysteme(env, close, 'desistement',
    `Le demandeur s’est désisté${payee ? ' (participation remboursée, paiement de test)' : ''}${apres}`);
  if (tenait) prevenir(env, 'desistement', close);
  return { statut: 200, corps: versReservation(close, utilisateurId) };
}

/**
 * L'offrant passe au suivant faute de reponse (#60). Il n'y a pas de delai
 * automatique : c'est lui qui juge, depuis quand l'objet est propose.
 */
export async function passerAuSuivant(env, utilisateurId, id) {
  const { r, erreur } = await chargerPour(env, id, utilisateurId, 'offrant');
  if (erreur) return erreur;
  const [close] = await mettreAJour(env, 'reservations', { id, statut: 'proposee' }, {
    statut: 'annulee', motifAnnulation: 'sans_reponse', misAJourLe: maintenant(),
  });
  if (!close) return refus(409, 'Cet objet n’est pas en attente d’une réponse.');
  const suivant = await proposerAuSuivant(env, r.annonceId);
  await messageSysteme(env, close, 'sans_reponse',
    `L’offrant est passé au suivant, faute de réponse : ${suivant ? 'l’objet est proposé à la personne suivante.' : 'l’objet est de nouveau disponible.'}`);
  return { statut: 200, corps: versReservation(close, utilisateurId) };
}

/**
 * L'offrant confirme la remise (#62) : la reservation payee passe a `remise`,
 * l'annonce a `remis`, et ce qui attendait encore l'objet est close.
 */
export async function remettre(env, utilisateurId, id) {
  const { r, erreur } = await chargerPour(env, id, utilisateurId, 'offrant');
  if (erreur) return erreur;
  const [remise] = await mettreAJour(env, 'reservations', { id, statut: 'confirmee' }, {
    statut: 'remise', misAJourLe: maintenant(),
  });
  if (!remise) {
    return refus(409, r.statut === 'remise'
      ? 'La remise est déjà confirmée.'
      : 'La participation n’est pas versée : la remise ne peut pas être confirmée.');
  }
  await mettreAJour(env, 'annonces', { id: r.annonceId }, { statut: 'remis', misAJourLe: maintenant() });
  await messageSysteme(env, remise, 'objet_remis', 'L’objet a été remis. Merci pour l’association !');
  // La remise clot la file : ces demandes ne peuvent plus aboutir.
  const autres = await mettreAJour(env, 'reservations', { annonceId: r.annonceId, statut: ['demandee', 'liste_attente', 'proposee'] }, {
    statut: 'annulee', motifAnnulation: 'attribuee_a_autrui', misAJourLe: maintenant(),
  });
  for (const autre of autres) {
    await messageSysteme(env, autre, 'attribuee_a_autrui', 'L’objet a été remis à une autre personne : votre demande est close.');
  }
  return { statut: 200, corps: versReservation(remise, utilisateurId) };
}

/** Une reservation, pour ses deux parties ; avec l'adresse pour le demandeur payant (#56). */
export async function lireReservation(env, utilisateurId, id) {
  const { r, erreur } = await chargerPour(env, id, utilisateurId);
  if (erreur) return erreur;
  const annonce = r.statut === 'confirmee' ? await lireLigne(env, 'annonces', r.annonceId) : null;
  return { statut: 200, corps: versReservation(r, utilisateurId, annonce, await rangFile(env, r)) };
}

/**
 * Mes reservations, comme demandeur ou comme offrant, avec un resume de
 * l'annonce. Jamais d'adresse exacte ici : c'est une liste.
 */
export async function listerReservations(env, utilisateurId, role) {
  const champ = role === 'offrant' ? 'offrantId' : 'demandeurId';
  const reservations = await chercherLignes(env, 'reservations', { [champ]: utilisateurId }, { ordre: 'creeLe.desc' });
  const brutes = await lireLignes(env, 'annonces', reservations.map((r) => r.annonceId));
  const annonces = new Map((await versAnnoncesPubliques(env, [...brutes.values()])).map((a) => [a.id, a]));
  const rangs = await Promise.all(reservations.map((r) => rangFile(env, r)));
  return reservations.map((r, i) => ({ ...versReservation(r, utilisateurId, null, rangs[i]), annonce: annonces.get(r.annonceId) || null }));
}
