/**
 * Messagerie (US-30 a US-32, issues #63, #64, #65).
 *
 * Une conversation est privee, entre l'offrant d'une annonce et un demandeur,
 * et unique par couple (annonce, demandeur). Elle porte aussi les messages
 * systeme des reservations : « demande recue », « objet propose »... C'est la
 * messagerie actionnable des maquettes.
 *
 * Non lus (demande du 09/11/2026) : chaque participant retient quand il a lu
 * la conversation (luParOffrantLe, luParDemandeurLe). Compte comme non lu ce
 * qui est arrive apres : un message de l'autre, ou un message systeme qui
 * s'adresse a lui (« demande recue » pour l'offrant, « objet propose » pour le
 * demandeur...). Ses propres messages ne comptent jamais.
 */
import { chercherLignes, insererLigne, lireLigne, lireLignes, mettreAJour } from './base.js';
import { versAnnoncesPubliques, versProfilResume } from './annonces.js';
import { rangFile, versReservation } from './reservations.js';

export const LONGUEUR_MAX_MESSAGE = 1000;

/** A qui s'adresse chaque message systeme ; absent = aux deux. */
const DESTINATAIRE_SYSTEME = {
  demande_recue: 'offrant',
  demande_en_file: 'offrant',
  demande_annulee: 'offrant',
  paiement_valide: 'offrant',
  proposition_refusee: 'offrant',
  desistement: 'offrant',
  demande_declinee: 'demandeur',
  objet_propose: 'demandeur',
  sans_reponse: 'demandeur',
  objet_remis: 'demandeur',
  attribuee_a_autrui: 'demandeur',
  creneau_modifie: 'demandeur',
  annonce_retiree: 'demandeur',
};

const roleDans = (conversation, utilisateurId) => (conversation.offrantId === utilisateurId ? 'offrant' : 'demandeur');
const champLu = (role) => (role === 'offrant' ? 'luParOffrantLe' : 'luParDemandeurLe');

/** Nombre de messages de `conversation` que `utilisateurId` n'a pas encore lus. */
function nonLus(conversation, messages, utilisateurId) {
  const role = roleDans(conversation, utilisateurId);
  const lu = Date.parse(conversation[champLu(role)]) || 0;
  return messages.filter(
    (m) =>
      m.conversationId === conversation.id &&
      Date.parse(m.creeLe) > lu &&
      (m.type === 'systeme' ? (DESTINATAIRE_SYSTEME[m.evenement] ?? role) === role : m.auteurId !== utilisateurId),
  ).length;
}

/** Forme publique d'un message. */
export const versMessage = ({ id, conversationId, type, auteurId, reservationId, evenement, contenu, creeLe }) => ({
  id,
  conversationId,
  type,
  auteurId: auteurId || null,
  reservationId: reservationId || null,
  evenement: evenement || null,
  contenu,
  creeLe,
});

/** Ajoute un message et date l'activite de la conversation. */
export async function ajouterMessage(env, conversationId, champs) {
  const maintenant = new Date().toISOString();
  const message = await insererLigne(env, 'messages', {
    id: crypto.randomUUID(),
    conversationId,
    type: 'utilisateur',
    contenu: '',
    ...champs,
    creeLe: maintenant,
  });
  await mettreAJour(env, 'conversations', { id: conversationId }, { misAJourLe: maintenant });
  return message;
}

/**
 * La conversation (annonce, demandeur), creee si besoin. Renvoie
 * { conversation, creee }.
 */
export async function conversationPour(env, annonce, demandeurId) {
  const [existante] = await chercherLignes(env, 'conversations', { annonceId: annonce.id, demandeurId });
  if (existante) return { conversation: existante, creee: false };
  const maintenant = new Date().toISOString();
  try {
    const conversation = await insererLigne(env, 'conversations', {
      id: crypto.randomUUID(),
      annonceId: annonce.id,
      offrantId: annonce.offrantId,
      demandeurId,
      creeLe: maintenant,
      misAJourLe: maintenant,
    });
    return { conversation, creee: true };
  } catch (e) {
    // Deux ouvertures simultanees : la contrainte d'unicite a joue, on relit.
    if (!/Supabase 409/.test(e.message)) throw e;
    const [conversation] = await chercherLignes(env, 'conversations', { annonceId: annonce.id, demandeurId });
    return { conversation, creee: false };
  }
}

/** Valide le texte d'un message ; renvoie l'erreur a afficher, ou null. */
export function erreurContenu(contenu) {
  const texte = typeof contenu === 'string' ? contenu.trim() : '';
  if (!texte) return 'Le message est vide.';
  if (texte.length > LONGUEUR_MAX_MESSAGE) return `Le message est trop long (${LONGUEUR_MAX_MESSAGE} caractères au plus).`;
  return null;
}

/**
 * Contacter l'offrant depuis une annonce (#63) : ouvre ou retrouve la
 * conversation, avec un premier message facultatif.
 */
export async function contacter(env, utilisateurId, annonceId, contenu) {
  const annonce = await lireLigne(env, 'annonces', annonceId);
  if (!annonce || annonce.statut === 'retiree') return { statut: 404, corps: { erreur: 'Cette annonce n’existe pas ou a été retirée.' } };
  if (annonce.offrantId === utilisateurId) {
    return { statut: 403, corps: { erreur: 'C’est votre annonce : les demandeurs vous écriront ici.' } };
  }
  if (contenu !== undefined && contenu !== '') {
    const erreur = erreurContenu(contenu);
    if (erreur) return { statut: 422, corps: { erreurs: [erreur] } };
  }
  const { conversation, creee } = await conversationPour(env, annonce, utilisateurId);
  if (contenu) await ajouterMessage(env, conversation.id, { auteurId: utilisateurId, contenu: contenu.trim() });
  return { statut: creee ? 201 : 200, corps: { id: conversation.id } };
}

/**
 * Forme publique de conversations, vues par `utilisateurId` : l'annonce, son
 * role, l'interlocuteur, le dernier message et la reservation la plus recente.
 */
async function versConversations(env, conversations, utilisateurId, deja = {}) {
  if (conversations.length === 0) return [];
  const ids = conversations.map((c) => c.id);
  // `deja` : messages et reservations deja lus par l'appelant, pour ne pas
  // les relire. L'ordre n'importe pas : on prend les plus recents ci-dessous.
  const [annoncesBrutes, membres, messages, reservations] = await Promise.all([
    lireLignes(env, 'annonces', conversations.map((c) => c.annonceId)),
    lireLignes(env, 'utilisateurs', conversations.flatMap((c) => [c.offrantId, c.demandeurId])),
    deja.messages || chercherLignes(env, 'messages', { conversationId: ids }, { ordre: 'creeLe.desc' }),
    deja.reservations || chercherLignes(env, 'reservations', { conversationId: ids }, { ordre: 'creeLe.desc' }),
  ]);
  const plusRecent = (liste, id) =>
    liste.filter((x) => x.conversationId === id).reduce((a, b) => (!a || b.creeLe > a.creeLe ? b : a), null);
  const annonces = new Map(
    (await versAnnoncesPubliques(env, [...annoncesBrutes.values()])).map((a) => [a.id, a]),
  );
  return conversations
    .map((c) => {
      const monRole = c.offrantId === utilisateurId ? 'offrant' : 'demandeur';
      const dernier = plusRecent(messages, c.id);
      const reservation = plusRecent(reservations, c.id);
      const annonce = annonces.get(c.annonceId);
      return {
        id: c.id,
        monRole,
        annonce: annonce && {
          id: annonce.id,
          titre: annonce.titre,
          statut: annonce.statut,
          participation: annonce.participation,
          creneauRetrait: annonce.creneauRetrait,
          medias: annonce.medias,
          illustrationUrl: annonce.illustrationUrl,
          ville: annonce.ville,
          quartier: annonce.quartier,
        },
        interlocuteur: versProfilResume(membres.get(monRole === 'offrant' ? c.demandeurId : c.offrantId)),
        nonLus: nonLus(c, messages, utilisateurId),
        // Absents plutot que null (contrat : allOf sans type, voir openapi.yaml).
        ...(dernier ? { dernierMessage: versMessage(dernier) } : {}),
        ...(reservation ? { reservation: versReservation(reservation, utilisateurId) } : {}),
        creeLe: c.creeLe,
        misAJourLe: c.misAJourLe,
      };
    })
    .sort((a, b) => (b.misAJourLe || '').localeCompare(a.misAJourLe || ''));
}

/** Mes conversations, la plus active d'abord (#65). */
async function mesConversations(env, utilisateurId) {
  const [commeOffrant, commeDemandeur] = await Promise.all([
    chercherLignes(env, 'conversations', { offrantId: utilisateurId }),
    chercherLignes(env, 'conversations', { demandeurId: utilisateurId }),
  ]);
  return [...commeOffrant, ...commeDemandeur];
}

export async function listerConversations(env, utilisateurId) {
  return versConversations(env, await mesConversations(env, utilisateurId), utilisateurId);
}

/**
 * Le compteur de l'onglet Messages : conversations et messages non lus. Appele
 * souvent, il ne lit que les messages arrives depuis la plus ancienne lecture.
 */
export async function compterNonLus(env, utilisateurId) {
  const conversations = await mesConversations(env, utilisateurId);
  if (conversations.length === 0) return { conversationsNonLues: 0, messagesNonLus: 0 };
  const depuis = conversations
    .map((c) => c[champLu(roleDans(c, utilisateurId))])
    .reduce((a, b) => (a < b ? a : b));
  const messages = await chercherLignes(env, 'messages', {
    conversationId: conversations.map((c) => c.id),
    creeLe: { apres: depuis },
  });
  const parConversation = conversations.map((c) => nonLus(c, messages, utilisateurId));
  return {
    conversationsNonLues: parConversation.filter((n) => n > 0).length,
    messagesNonLus: parConversation.reduce((a, b) => a + b, 0),
  };
}

/** Une conversation et ses messages, pour ses deux participants seulement (#64). */
export async function lireConversation(env, utilisateurId, conversationId) {
  const conversation = await lireLigne(env, 'conversations', conversationId);
  if (!conversation) return { statut: 404, corps: { erreur: 'Conversation introuvable.' } };
  if (![conversation.offrantId, conversation.demandeurId].includes(utilisateurId)) {
    return { statut: 403, corps: { erreur: 'Cette conversation ne vous concerne pas.' } };
  }
  const [messages, reservations] = await Promise.all([
    chercherLignes(env, 'messages', { conversationId }, { ordre: 'creeLe.asc' }),
    chercherLignes(env, 'reservations', { conversationId }, { ordre: 'creeLe.desc' }),
  ]);
  await mettreAJour(env, 'conversations', { id: conversationId }, {
    [champLu(roleDans(conversation, utilisateurId))]: new Date().toISOString(),
  });
  const [resume] = await versConversations(env, [conversation], utilisateurId, { messages, reservations });
  // La reservation qui commande les actions : celle en cours, sinon la derniere.
  const enCours = reservations.find((r) => r.statut !== 'annulee') || reservations[0];
  const annonce = enCours && enCours.statut === 'confirmee' ? await lireLigne(env, 'annonces', enCours.annonceId) : null;
  return {
    statut: 200,
    corps: {
      ...resume,
      nonLus: 0,
      ...(enCours ? { reservation: versReservation(enCours, utilisateurId, annonce, await rangFile(env, enCours)) } : {}),
      messages: messages.map(versMessage),
    },
  };
}

/** Envoyer un message dans une conversation dont on fait partie (#64). */
export async function envoyerMessage(env, utilisateurId, conversationId, contenu) {
  const conversation = await lireLigne(env, 'conversations', conversationId);
  if (!conversation) return { statut: 404, corps: { erreur: 'Conversation introuvable.' } };
  if (![conversation.offrantId, conversation.demandeurId].includes(utilisateurId)) {
    return { statut: 403, corps: { erreur: 'Cette conversation ne vous concerne pas.' } };
  }
  const erreur = erreurContenu(contenu);
  if (erreur) return { statut: 422, corps: { erreurs: [erreur] } };
  const message = await ajouterMessage(env, conversationId, { auteurId: utilisateurId, contenu: contenu.trim() });
  return { statut: 201, corps: versMessage(message) };
}

