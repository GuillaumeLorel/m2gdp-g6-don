/**
 * Charge les associations et les donnees de demonstration dans Supabase.
 *
 *   node scripts/donnees/charger-donnees-demo.mjs --simulation   # n'ecrit rien
 *   node scripts/donnees/charger-donnees-demo.mjs                # (re)charge
 *   node scripts/donnees/charger-donnees-demo.mjs --supprimer    # retire la demo
 *
 * Sources : specs/donnees/associations.json et specs/donnees/demo/*.json
 * (produits par generer-donnees-demo.mjs). Une partie des annonces a une
 * photo : specs/donnees/demo/photos.json et photos/, envoyees dans le bucket
 * `medias` de Supabase Storage. Les autres gardent l'illustration de leur
 * categorie, comme une vraie annonce publiee sans photo. Les profils et annonces de
 * demonstration portent `fictif: true` : on les distingue des vrais comptes,
 * et --supprimer ne retire qu'eux. Les associations sont un referentiel reel,
 * elles restent.
 *
 * Un profil de demo n'a pas de compte de connexion : il apparait dans
 * l'annuaire et comme offrant, mais personne ne s'y connecte (sauf les tests,
 * qui se creent un compte au meme identifiant).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { idPhotoDemo, idUtilisateurDemo } from './identifiants.mjs';
import {
  RACINE_DEPOT,
  deposerFichier,
  ecrireLot,
  requete,
  retirerFichiers,
  simulation,
  supprimerFictifs,
  supprimerLot,
} from './supabase-admin.mjs';

const lire = (fichier) => JSON.parse(readFileSync(path.join(RACINE_DEPOT, fichier), 'utf8'));

const { associations } = lire('specs/donnees/associations.json');
const utilisateurs = lire('specs/donnees/demo/utilisateurs.json').map((u) => ({
  ...u,
  id: idUtilisateurDemo(u.id),
  fictif: true,
}));
const photos = lire('specs/donnees/demo/photos.json');
const photoDe = new Map(photos.map((p) => [p.annonceId, p]));

/**
 * Les creneaux du JSON vieillissent : une demo presentee un mois plus tard
 * n'aurait plus que des creneaux passes, donc plus rien a reserver. Au
 * chargement, le creneau d'une annonce encore en ligne avance de semaines
 * entieres — meme jour, meme heure — jusqu'a commencer au moins 2 jours plus
 * tard. Un objet deja remis garde son creneau, passe par nature.
 */
const SEMAINE = 7 * 24 * 3600 * 1000;

/** Ecart (en ms) entre l'heure de Paris et l'heure UTC, a un instant donne. */
function ecartParis(instant) {
  const v = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant).map((p) => [p.type, p.value]),
  );
  return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - instant.getTime();
}

/**
 * Avance de `semaines` en gardant la meme heure A PARIS : ajouter 7 x 24 h
 * en UTC decalerait d'une heure tout creneau qui franchit un changement
 * d'heure (18 h en septembre deviendrait 17 h en novembre).
 */
function plusSemaines(iso, semaines) {
  const instant = new Date(iso);
  const murale = new Date(instant.getTime() + ecartParis(instant)); // l'heure de Paris, lue en UTC
  murale.setUTCDate(murale.getUTCDate() + 7 * semaines);
  const essai = murale.getTime() - ecartParis(new Date(murale.getTime()));
  return new Date(murale.getTime() - ecartParis(new Date(essai))).toISOString();
}

function creneauAVenir(annonce) {
  if (annonce.statut === 'remis') return annonce.creneauRetrait;
  const debut = Date.parse(annonce.creneauRetrait.debut);
  const semaines = Math.max(0, Math.ceil((Date.now() + 2 * 24 * 3600 * 1000 - debut) / SEMAINE));
  return {
    debut: plusSemaines(annonce.creneauRetrait.debut, semaines),
    fin: plusSemaines(annonce.creneauRetrait.fin, semaines),
  };
}

const annonces = lire('specs/donnees/demo/annonces.json').map((a) => ({
  ...a,
  offrantId: idUtilisateurDemo(a.offrantId),
  creneauRetrait: creneauAVenir(a),
  mediaIds: photoDe.has(a.id) ? [idPhotoDemo(a.id)] : [],
  fictif: true,
}));
// Une photo appartient a l'offrant de son annonce, comme une vraie.
const medias = photos.map((p) => {
  const annonce = annonces.find((a) => a.id === p.annonceId);
  const fichier = path.join(RACINE_DEPOT, 'specs/donnees/demo/photos', p.fichier);
  return {
    id: idPhotoDemo(p.annonceId),
    proprietaireId: annonce.offrantId,
    typeMime: 'image/jpeg',
    tailleOctets: readFileSync(fichier).length,
    fichier,
  };
});

/* --- Echanges (#75) : dates relatives ancrees sur l'instant du chargement -- */

const echanges = lire('specs/donnees/demo/echanges.json');
const ilYa = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
const annonceDe = new Map(annonces.map((a) => [a.id, a]));
const conversationDe = new Map(echanges.conversations.map((c) => [c.id, c]));
const messagesDe = (conversationId) => echanges.messages.filter((m) => m.conversationId === conversationId);

const conversations = echanges.conversations.map((c) => {
  const derniers = messagesDe(c.id);
  return {
    id: c.id,
    annonceId: c.annonceId,
    offrantId: annonceDe.get(c.annonceId).offrantId,
    demandeurId: idUtilisateurDemo(c.demandeurId),
    fictif: true,
    creeLe: ilYa(c.ilYaMinutes),
    misAJourLe: ilYa(Math.min(...derniers.map((m) => m.ilYaMinutes), c.ilYaMinutes)),
  };
});
const reservations = echanges.reservations.map((r) => {
  const evenements = echanges.messages.filter((m) => m.reservationId === r.id);
  const quand = (evenement) => evenements.find((m) => m.evenement === evenement)?.ilYaMinutes;
  const debut = quand('demande_recue') ?? conversationDe.get(r.conversationId).ilYaMinutes;
  return {
    id: r.id,
    annonceId: r.annonceId,
    demandeurId: idUtilisateurDemo(r.demandeurId),
    offrantId: annonceDe.get(r.annonceId).offrantId,
    conversationId: r.conversationId,
    statut: r.statut,
    motifAnnulation: r.motifAnnulation || null,
    proposeeLe: quand('objet_propose') ? ilYa(quand('objet_propose')) : null,
    participationDemandee: r.participationDemandee ?? null,
    statutPaiement: r.statutPaiement,
    referencePaiement: r.referencePaiement || null,
    fictif: true,
    creeLe: ilYa(debut),
    misAJourLe: ilYa(Math.min(debut, ...evenements.map((m) => m.ilYaMinutes))),
  };
});
const messages = echanges.messages.map((m) => {
  const c = conversations.find((x) => x.id === m.conversationId);
  return {
    id: m.id,
    conversationId: m.conversationId,
    type: m.type,
    auteurId: m.auteur === 'offrant' ? c.offrantId : m.auteur === 'demandeur' ? c.demandeurId : null,
    reservationId: m.reservationId,
    evenement: m.evenement,
    contenu: m.contenu,
    fictif: true,
    creeLe: ilYa(m.ilYaMinutes),
  };
});

console.log(
  `${associations.length} associations, ${utilisateurs.length} profils, ${annonces.length} annonces, ${medias.length} photos, ` +
    `${conversations.length} conversations, ${reservations.length} reservations, ${messages.length} messages`,
);

if (simulation) {
  console.log('(simulation) rien n\'est ecrit');
} else if (process.argv.includes('--supprimer')) {
  // Les annonces d'abord (elles referencent les profils) : la cascade emporte
  // conversations, reservations, messages et favoris qui s'y rattachent.
  await supprimerFictifs('annonces');
  await retirerFichiers('medias', medias.map((m) => m.id));
  await supprimerLot('medias', medias.map((m) => m.id));
  await supprimerFictifs('utilisateurs');
  console.log('demonstration retiree');
} else {
  /*
   * Rechargement SANS supprimer les annonces : de vrais membres (le prof, les
   * etudiants) ont pu mettre une annonce de demo en favori, la demander, ou en
   * discuter. Supprimer puis recreer emporterait tout cela en cascade. On met
   * donc a jour sur place, et on ne remplace que les echanges de demo.
   *
   * Une annonce que tient un VRAI membre (demande en cours, proposee ou
   * confirmee) garde son statut en base.
   */
  const tenues = await requete(
    'reservations?fictif=is.false&statut=in.(demandee,proposee,confirmee)&select=annonceId',
  );
  const statutsEnBase = new Map(
    (await requete('annonces?fictif=is.true&select=id,statut')).map((a) => [a.id, a.statut]),
  );
  const aGarder = new Set(tenues.map((r) => r.annonceId));
  const annoncesAEcrire = annonces.map((a) =>
    aGarder.has(a.id) && statutsEnBase.has(a.id) ? { ...a, statut: statutsEnBase.get(a.id) } : a,
  );

  // Pas d'echange de demo sur une annonce tenue par un vrai membre : elle
  // aurait deux detenteurs.
  const libres = (x) => !aGarder.has(x.annonceId);
  const conversationsLibres = conversations.filter(libres);
  const gardees = new Set(conversationsLibres.map((c) => c.id));

  await requete('conversations?fictif=is.true', { method: 'DELETE' });
  await ecrireLot('associations', associations);
  await ecrireLot('utilisateurs', utilisateurs);
  for (const { fichier, ...media } of medias) {
    await deposerFichier('medias', media.id, readFileSync(fichier), media.typeMime);
    await ecrireLot('medias', [media]);
  }
  await ecrireLot('annonces', annoncesAEcrire);
  await ecrireLot('conversations', conversationsLibres);
  await ecrireLot('reservations', reservations.filter(libres));
  await ecrireLot('messages', messages.filter((m) => gardees.has(m.conversationId)));

  // Ce qui n'est plus dans les JSON disparait (annonces, puis profils).
  const liste = (ids) => encodeURIComponent(ids.map((id) => `"${id}"`).join(','));
  await requete(`annonces?fictif=is.true&id=not.in.(${liste(annonces.map((a) => a.id))})`, { method: 'DELETE' });
  await requete(`utilisateurs?fictif=is.true&id=not.in.(${liste(utilisateurs.map((u) => u.id))})`, { method: 'DELETE' });
  console.log(`charge${aGarder.size ? ` (${aGarder.size} annonce(s) tenue(s) par un vrai membre : statut conserve)` : ''}`);
}
