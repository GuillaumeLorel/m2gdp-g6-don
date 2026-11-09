/**
 * Genere les questions publiques de demonstration (EPIC 9) : des questions de
 * demandeurs sous les annonces, et la reponse de l'offrant pour la plupart.
 *
 *   node scripts/donnees/generer-commentaires-demo.mjs
 *
 * Sortie : specs/donnees/demo/commentaires.json, chargee par
 * charger-donnees-demo.mjs. Dates RELATIVES (« il y a N minutes »), ancrees
 * sur l'instant du chargement.
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

// mulberry32, comme generer-echanges-demo.mjs.
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
const hasard = generateur(20261109);
const entre = (min, max) => min + Math.floor(hasard() * (max - min + 1));
const parmi = (liste) => liste[Math.floor(hasard() * liste.length)];

/*
 * Textes : [question, reponse de l'offrant]. Formules neutres (« ça »,
 * « c'est ») : elles s'accordent avec n'importe quel objet de la categorie.
 */

const PAR_CATEGORIE = {
  mobilier: [
    ['Est-ce que ça se démonte pour le transport ?', 'Oui, en quelques vis. Je les garde dans un sachet pour vous.'],
    ['Quelles sont les dimensions exactes ?', 'Elles sont dans la description, mais je peux mesurer à nouveau si besoin.'],
    ['Y a-t-il des rayures ou des taches ?', 'Quelques traces d’usage sur le dessus, rien de gênant.'],
  ],
  electromenager: [
    ['Ça fonctionne toujours bien ?', 'Oui, ça marchait parfaitement jusqu’au déménagement.'],
    ['Vous avez encore la notice ?', 'Non, mais elle se trouve facilement en ligne avec la référence.'],
    ['Ça prend beaucoup de place ?', 'C’est assez compact, les dimensions sont dans l’annonce.'],
  ],
  cuisine: [
    ['Ça passe au lave-vaisselle ?', 'Oui, sans problème, je l’ai toujours lavé comme ça.'],
    ['C’est complet ?', 'Oui, rien ne manque.'],
    ['Y a-t-il des ébréchures ?', 'Aucune, tout a été manipulé avec soin.'],
  ],
  informatique: [
    ['Les câbles sont fournis ?', 'Oui, avec ceux d’origine.'],
    ['Ça fonctionne toujours bien ?', 'Oui, je m’en servais encore la semaine dernière.'],
    ['Y a-t-il des rayures ?', 'Une ou deux très légères, invisibles à l’usage.'],
  ],
  scolaire: [
    ['Ça conviendrait pour une première année ?', 'Oui, c’est exactement ce que j’utilisais en première année.'],
    ['C’est encore en bon état ?', 'Oui, ça n’a servi qu’une année.'],
    ['Vous avez d’autres affaires pour la fac ?', 'Regardez mes autres annonces, j’en ai mis plusieurs.'],
  ],
  culture: [
    ['C’est en bon état ?', 'Oui, très peu servi, tout est intact.'],
    ['Il ne manque rien ?', 'Non, tout est là, j’ai vérifié avant de publier.'],
    ['Vous en avez d’autres du même genre ?', 'Pas pour l’instant, mais j’en remettrai peut-être bientôt.'],
  ],
  vetements: [
    ['Ça taille grand ou petit ?', 'Plutôt normal, c’est fidèle à la taille indiquée.'],
    ['Ça a été porté souvent ?', 'Une saison seulement, c’est presque neuf.'],
    ['C’est confortable ?', 'Oui, très agréable à porter.'],
  ],
  enfance: [
    ['Ça a beaucoup servi ?', 'Assez peu, notre enfant a vite grandi.'],
    ['C’est adapté à partir de quel âge ?', 'C’est indiqué sur l’étiquette, et dans la description.'],
    ['C’est propre et complet ?', 'Oui, tout a été lavé et rien ne manque.'],
  ],
  sport: [
    ['C’est adapté à un débutant ?', 'Oui, c’est avec ça que j’ai commencé.'],
    ['Y a-t-il de l’usure ?', 'Un peu, mais rien qui gêne l’utilisation.'],
    ['Ça a beaucoup servi ?', 'Quelques sorties seulement.'],
  ],
  maison: [
    ['Reste-t-il des traces d’usage ?', 'Très peu, c’était dans une pièce peu utilisée.'],
    ['C’est en bon état ?', 'Oui, comme sur la photo.'],
    ['La couleur est fidèle à la photo ?', 'Oui, peut-être un peu plus claire en vrai.'],
  ],
  bricolage: [
    ['Ça fonctionne toujours bien ?', 'Oui, je m’en suis servi le mois dernier.'],
    ['Il reste des accessoires avec ?', 'Oui, je donne tout ce qui va avec.'],
    ['C’est assez solide pour un usage régulier ?', 'Oui, c’est du matériel costaud.'],
  ],
  animaux: [
    ['Ça a été bien nettoyé ?', 'Oui, tout a été lavé et désinfecté.'],
    ['Il reste des accessoires avec ?', 'Oui, je donne le petit matériel avec.'],
    ['Ça convient à quel animal ?', 'C’est précisé dans l’annonce, n’hésitez pas si vous avez un doute.'],
  ],
};

/** Objets qu'on ne porte pas d'une main : la question du transport a un sens. */
const encombrant = (a) =>
  a.categorieId === 'mobilier' || /lavage|froid|chauffage|lits|poussettes|velos|aquariums|rangement/.test(a.sousCategorieId);

const GENERIQUES = [
  { si: () => true, paire: ['Est-ce que le créneau peut être décalé d’une heure ?', 'Oui, écrivez-moi en message privé pour qu’on s’arrange.'] },
  { si: (a) => a.statut === 'disponible', paire: ['C’est toujours disponible ?', 'Oui, vous pouvez le demander directement depuis l’annonce.'] },
  { si: encombrant, paire: ['C’est lourd à transporter ?', 'Ça se porte à deux sans difficulté.'] },
  { si: encombrant, paire: ['Il y a un ascenseur dans l’immeuble ?', 'Oui, et je peux aider à descendre l’objet.'] },
];

/* --- Generation ---------------------------------------------------------------- */

const demandeurs = utilisateurs.filter((u) => u.roles.includes('demandeur') && !PROFILS_DE_TEST.includes(u.id));
const candidates = annonces.filter((a) => !PROFILS_DE_TEST.includes(a.offrantId) && a.statut !== 'retiree');

const commentaires = [];
for (const annonce of candidates) {
  // Environ une annonce sur trois a des questions, une ou deux.
  if (hasard() > 0.36) continue;
  // Deux fois plus de chances de tomber sur une question propre a la categorie.
  const propres = PAR_CATEGORIE[annonce.categorieId] || [];
  const banque = [...propres, ...propres, ...GENERIQUES.filter((g) => g.si(annonce)).map((g) => g.paire)];
  const nombre = hasard() < 0.3 ? 2 : 1;
  const dejaPosees = new Set();
  const auteursDeja = new Set();
  for (let i = 0; i < nombre; i++) {
    let paire = parmi(banque);
    while (dejaPosees.has(paire[0])) paire = parmi(banque);
    dejaPosees.add(paire[0]);
    let auteur = parmi(demandeurs);
    while (auteur.id === annonce.offrantId || auteursDeja.has(auteur.id)) auteur = parmi(demandeurs);
    auteursDeja.add(auteur.id);
    const ilYaMinutes = entre(90, 12 * 24 * 60);
    // Trois questions sur quatre ont deja leur reponse, de quelques minutes a une journee apres.
    const repondue = hasard() < 0.75;
    commentaires.push({
      id: `demo-q-${String(commentaires.length + 1).padStart(3, '0')}`,
      annonceId: annonce.id,
      auteurId: auteur.id,
      contenu: paire[0],
      ilYaMinutes,
      ...(repondue ? { reponse: paire[1], reponseIlYaMinutes: Math.max(5, ilYaMinutes - entre(10, 24 * 60)) } : {}),
    });
  }
}

writeFileSync(
  path.join(RACINE_DEPOT, 'specs/donnees/demo/commentaires.json'),
  `${JSON.stringify(commentaires, null, 2)}\n`,
);
const annoncesTouchees = new Set(commentaires.map((c) => c.annonceId)).size;
console.log(
  `${commentaires.length} questions sur ${annoncesTouchees} annonces, ` +
    `${commentaires.filter((c) => c.reponse).length} avec reponse`,
);
