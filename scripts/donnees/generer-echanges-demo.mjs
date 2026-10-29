/**
 * Genere les echanges de demonstration (issue #75) : conversations,
 * reservations et messages, coherents avec le statut des annonces.
 *
 *   node scripts/donnees/generer-echanges-demo.mjs
 *
 * Sortie : specs/donnees/demo/echanges.json, chargee par
 * charger-donnees-demo.mjs. Les dates y sont RELATIVES (« il y a N minutes ») :
 * le chargement les ancre sur l'instant present, pour que la demo reste
 * vivante quel que soit le jour ou on la recharge.
 *
 * DETERMINISTE (graine fixe) : relancer produit le meme fichier.
 *
 * Les profils des tests automatises (tests/e2e/outils.js) et leurs annonces
 * restent a l'ecart : les tests comptent sur leur etat.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RACINE_DEPOT } from './chemins.mjs';

const lire = (f) => JSON.parse(readFileSync(path.join(RACINE_DEPOT, f), 'utf8'));
const annonces = lire('specs/donnees/demo/annonces.json');
const utilisateurs = lire('specs/donnees/demo/utilisateurs.json');

const PROFILS_DE_TEST = ['demo-u-001', 'demo-u-002', 'demo-u-005'];

// mulberry32, comme generer-donnees-demo.mjs.
function generateur(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hasard = generateur(20261029);
const entre = (min, max) => min + Math.floor(hasard() * (max - min + 1));
const parmi = (liste) => liste[Math.floor(hasard() * liste.length)];
const melanger = (liste) => liste.map((x) => [hasard(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

const euros = (m) => `${Number.isInteger(m) ? m : m.toFixed(2).replace('.', ',')} €`;
const prenomDe = (id) => utilisateurs.find((u) => u.id === id).prenom;

/* --- Textes ----------------------------------------------------------------- */

const QUESTIONS = [
  'Bonjour, est-ce que l’objet est toujours disponible ?',
  'Bonjour ! Il est bien en bon état comme indiqué ?',
  'Bonjour, je suis étudiante, est-ce que je peux passer au créneau prévu ?',
  'Bonsoir, l’objet est-il complet ?',
  'Bonjour, est-ce que ça rentre dans une petite voiture ?',
  'Bonjour, je suis intéressé. Vous êtes souple sur l’horaire ?',
  'Bonjour, c’est à quel étage ? Il y a un ascenseur ?',
  'Bonjour, il fonctionne bien ? Je viens d’emménager et il me manque justement ça.',
  'Hello ! Je peux venir avec un ami pour le porter ?',
  'Bonjour, quelles sont les dimensions exactes ?',
];
const REPONSES = [
  'Bonjour, oui il est toujours disponible !',
  'Oui, en très bon état, je l’ai très peu utilisé.',
  'Bien sûr, passez au créneau indiqué, je serai là.',
  'Oui, tout est complet, je vous montrerai sur place.',
  'Je peux décaler d’une demi-heure si besoin, dites-moi.',
  'Pas de souci, c’est au 2e avec ascenseur.',
  'Oui, il fonctionne parfaitement, je l’ai testé hier.',
  'Avec plaisir, venez à deux sans problème.',
];
const MOTS_DEMANDE = [
  'Je peux passer au créneau, merci beaucoup !',
  'Ce serait parfait pour mon studio, merci !',
  'Merci d’avance, ça m’aiderait vraiment.',
  '',
  '',
];
const APRES_PAIEMENT = [
  ['C’est réglé, à bientôt !', 'Parfait, sonnez à l’interphone en arrivant.'],
  ['Participation versée, merci !', 'Super, à tout à l’heure alors.'],
  ['Voilà, c’est fait. Je serai à l’heure.', 'Merci ! Je vous attends en bas de l’immeuble.'],
];
const APRES_REMISE = [
  ['Objet bien récupéré, merci beaucoup !', 'Avec plaisir, bonne continuation !'],
  ['Merci encore, il est parfait.', 'Ravi qu’il serve à nouveau. Bonne journée !'],
  ['Tout est nickel, merci pour le don à l’association !', 'Merci à vous, bonne installation !'],
];
const DECLINS = [
  'Désolé, je l’ai finalement promis à quelqu’un de mon entourage.',
  'Désolé, une autre personne l’avait demandé avant vous.',
  'Je préfère le garder encore un peu, désolé pour le dérangement.',
];
const RENONCEMENTS = ['Finalement je n’en ai plus besoin, désolé !', 'J’ai trouvé une autre solution entre-temps, merci quand même.'];

/* --- Generation ------------------------------------------------------------- */

const conversations = [];
const reservations = [];
const messages = [];
const actives = new Map(); // demandeur -> nombre de reservations en cours (plafond 3)
const prises = new Set(); // couples annonce|demandeur deja en conversation

const demandeurs = utilisateurs.filter((u) => u.roles.includes('demandeur') && !PROFILS_DE_TEST.includes(u.id));
const eligibles = annonces.filter((a) => !PROFILS_DE_TEST.includes(a.offrantId));

function choisirDemandeur(annonce, compteActif) {
  for (let essai = 0; essai < 50; essai++) {
    const d = parmi(demandeurs);
    if (d.id === annonce.offrantId || prises.has(`${annonce.id}|${d.id}`)) continue;
    if (compteActif && (actives.get(d.id) || 0) >= 3) continue;
    prises.add(`${annonce.id}|${d.id}`);
    if (compteActif) actives.set(d.id, (actives.get(d.id) || 0) + 1);
    return d.id;
  }
  throw new Error(`Aucun demandeur possible pour ${annonce.id}`);
}

/**
 * Ecrit une conversation : une suite d'etapes, chacune quelques minutes a
 * quelques heures apres la precedente, la premiere `ilYa` minutes avant le
 * chargement. Une etape : [auteur, contenu] ou [null, contenu, evenement].
 */
function conversation(annonce, demandeurId, ilYa, etapes, reservation) {
  const id = `demo-c-${String(conversations.length + 1).padStart(3, '0')}`;
  conversations.push({ id, annonceId: annonce.id, demandeurId, ilYaMinutes: ilYa });
  let t = ilYa;
  for (const [auteur, contenu, evenement] of etapes) {
    if (!contenu) continue;
    messages.push({
      id: `demo-m-${String(messages.length + 1).padStart(4, '0')}`,
      conversationId: id,
      type: auteur ? 'utilisateur' : 'systeme',
      auteur: auteur || null,
      reservationId: evenement && reservation ? reservation.id : null,
      evenement: evenement || null,
      contenu,
      ilYaMinutes: Math.max(t, 1),
    });
    t -= entre(4, Math.max(5, Math.min(600, Math.floor(ilYa / (etapes.length + 1)))));
  }
  if (reservation) reservations.push({ ...reservation, conversationId: id });
  return id;
}

let numeroReservation = 0;
const nouvelleReservation = (annonce, demandeurId, champs) => ({
  id: `demo-r-${String(++numeroReservation).padStart(3, '0')}`,
  annonceId: annonce.id,
  demandeurId,
  ...champs,
});
const reference = () => `pi_3Demo${Array.from({ length: 20 }, () => '0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[entre(0, 57)]).join('')}`;

/** Le debut commun : une question et sa reponse, puis (parfois) la demande. */
const ouverture = (avecQuestion = hasard() < 0.7) =>
  avecQuestion ? [['demandeur', parmi(QUESTIONS)], ['offrant', parmi(REPONSES)]] : [];
const demande = (demandeurId) => [
  [null, `${prenomDe(demandeurId)} souhaite récupérer cet objet.`, 'demande_recue'],
  ['demandeur', parmi(MOTS_DEMANDE)],
];
const proposition = (a) => [
  [null, `Demande acceptée : l’objet vous est réservé. Versez la participation de ${euros(a.participation)} pour confirmer et recevoir l’adresse exacte.`, 'objet_propose'],
];
const paiement = (a) => [
  [null, `Participation de ${euros(a.participation)} validée (paiement de test : rien n’a été débité). La réservation est confirmée et l’adresse exacte a été communiquée au demandeur.`, 'paiement_valide'],
];

// 1. Objets remis : une reservation menee a son terme.
for (const a of eligibles.filter((x) => x.statut === 'remis')) {
  const d = choisirDemandeur(a, false);
  const [merci, reponse] = parmi(APRES_REMISE);
  const r = nouvelleReservation(a, d, { statut: 'remise', statutPaiement: 'paye', referencePaiement: reference(), participationDemandee: a.participation });
  conversation(a, d, entre(8, 30) * 1440, [
    ...ouverture(), ...demande(d), ...proposition(a), ...paiement(a), ...[parmi(APRES_PAIEMENT)].flatMap(([x, y]) => [['demandeur', x], ['offrant', y]]),
    [null, 'L’objet a été remis. Merci pour l’association !', 'objet_remis'], ['demandeur', merci], ['offrant', reponse],
  ], r);
}

// 2. Objets reserves : confirmes (adresse donnee) ou proposes (paiement attendu).
for (const [i, a] of eligibles.filter((x) => x.statut === 'reserve').entries()) {
  const d = choisirDemandeur(a, true);
  if (i % 2 === 0) {
    const [x, y] = parmi(APRES_PAIEMENT);
    const r = nouvelleReservation(a, d, { statut: 'confirmee', statutPaiement: 'paye', referencePaiement: reference(), participationDemandee: a.participation });
    conversation(a, d, entre(1, 6) * 1440, [...ouverture(), ...demande(d), ...proposition(a), ...paiement(a), ['demandeur', x], ['offrant', y]], r);
  } else {
    const r = nouvelleReservation(a, d, { statut: 'proposee', statutPaiement: 'en_attente', participationDemandee: a.participation });
    conversation(a, d, entre(3, 40) * 60, [...ouverture(), ...demande(d), ...proposition(a)], r);
  }
  // Parfois, une seconde personne attend, au cas ou.
  if (i % 3 === 0) {
    const d2 = choisirDemandeur(a, true);
    conversation(a, d2, entre(1, 20) * 60, [...ouverture(true), ...demande(d2)], nouvelleReservation(a, d2, { statut: 'demandee', statutPaiement: 'en_attente' }));
  }
}

// 3. Objets disponibles : demandes en attente, closes, ou simples questions.
const disponibles = melanger(eligibles.filter((x) => x.statut === 'disponible'));
const scenarios = [
  ...Array(14).fill('attente'),
  ...Array(6).fill('declinee'),
  ...Array(4).fill('refus'),
  ...Array(3).fill('desistement'),
  ...Array(18).fill('question'),
];
for (const [i, scenario] of scenarios.entries()) {
  const a = disponibles[i];
  const enCours = scenario === 'attente';
  const d = choisirDemandeur(a, enCours);
  if (scenario === 'question') {
    const etapes = [['demandeur', parmi(QUESTIONS)]];
    if (hasard() < 0.75) etapes.push(['offrant', parmi(REPONSES)]);
    conversation(a, d, entre(30, 9 * 1440), etapes);
  } else if (scenario === 'attente') {
    conversation(a, d, entre(20, 3 * 1440), [...ouverture(), ...demande(d)],
      nouvelleReservation(a, d, { statut: 'demandee', statutPaiement: 'en_attente' }));
  } else if (scenario === 'declinee') {
    conversation(a, d, entre(2, 12) * 1440, [...ouverture(), ...demande(d), ['offrant', parmi(DECLINS)], [null, 'L’offrant a décliné cette demande.', 'demande_declinee']],
      nouvelleReservation(a, d, { statut: 'annulee', motifAnnulation: 'declinee', statutPaiement: 'en_attente' }));
  } else if (scenario === 'refus') {
    conversation(a, d, entre(2, 12) * 1440, [...ouverture(), ...demande(d), ...proposition(a), ['demandeur', parmi(RENONCEMENTS)],
      [null, 'Le demandeur a renoncé à l’objet : il est de nouveau disponible.', 'proposition_refusee']],
      nouvelleReservation(a, d, { statut: 'annulee', motifAnnulation: 'refus', statutPaiement: 'en_attente', participationDemandee: a.participation }));
  } else {
    conversation(a, d, entre(2, 12) * 1440, [...ouverture(), ...demande(d), [null, 'Le demandeur a annulé sa demande.', 'demande_annulee']],
      nouvelleReservation(a, d, { statut: 'annulee', motifAnnulation: 'desistement', statutPaiement: 'en_attente' }));
  }
}

writeFileSync(
  path.join(RACINE_DEPOT, 'specs/donnees/demo/echanges.json'),
  `${JSON.stringify({ conversations, reservations, messages }, null, 1)}\n`,
);
const parStatut = reservations.reduce((t, r) => ({ ...t, [r.statut]: (t[r.statut] || 0) + 1 }), {});
console.log(`${conversations.length} conversations, ${reservations.length} reservations ${JSON.stringify(parStatut)}, ${messages.length} messages`);
