/**
 * Charge les associations et les donnees de demonstration dans Supabase.
 *
 *   node scripts/donnees/charger-donnees-demo.mjs --simulation   # n'ecrit rien
 *   node scripts/donnees/charger-donnees-demo.mjs                # (re)charge
 *   node scripts/donnees/charger-donnees-demo.mjs --supprimer    # retire la demo
 *
 * Sources : specs/donnees/associations.json et specs/donnees/demo/*.json
 * (produits par generer-donnees-demo.mjs). Les profils et annonces de
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
import { idUtilisateurDemo } from './identifiants.mjs';
import { RACINE_DEPOT, ecrireLot, simulation, supprimerFictifs } from './supabase-admin.mjs';

const lire = (fichier) => JSON.parse(readFileSync(path.join(RACINE_DEPOT, fichier), 'utf8'));

const { associations } = lire('specs/donnees/associations.json');
const utilisateurs = lire('specs/donnees/demo/utilisateurs.json').map((u) => ({
  ...u,
  id: idUtilisateurDemo(u.id),
  fictif: true,
}));
const annonces = lire('specs/donnees/demo/annonces.json').map((a) => ({
  ...a,
  offrantId: idUtilisateurDemo(a.offrantId),
  fictif: true,
}));

console.log(
  `${associations.length} associations, ${utilisateurs.length} profils, ${annonces.length} annonces`,
);
if (simulation) {
  console.log('(simulation) rien n\'est ecrit');
} else {
  // On repart de zero pour la demo : les annonces d'abord (elles referencent
  // les profils), puis les profils.
  await supprimerFictifs('annonces');
  await supprimerFictifs('utilisateurs');
  if (!process.argv.includes('--supprimer')) {
    await ecrireLot('associations', associations);
    await ecrireLot('utilisateurs', utilisateurs);
    await ecrireLot('annonces', annonces);
  }
  console.log(process.argv.includes('--supprimer') ? 'demonstration retiree' : 'charge');
}
