/**
 * Charge les associations et les donnees de demonstration dans Supabase.
 *
 *   node scripts/donnees/charger-donnees-demo.mjs --simulation   # n'ecrit rien
 *   node scripts/donnees/charger-donnees-demo.mjs                # charge
 *   node scripts/donnees/charger-donnees-demo.mjs --supprimer    # retire la demo
 *
 * Sources : specs/donnees/associations.json et specs/donnees/demo/*.json
 * (produits par generer-donnees-demo.mjs). Les profils et annonces de
 * demonstration ont un identifiant en `demo-` et portent `fictif: true` : on
 * les distingue des vrais comptes, et --supprimer ne retire qu'eux. Les
 * associations sont un referentiel reel, elles restent.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RACINE_DEPOT, ecrireLot, listerIds, simulation, supprimerLot } from './supabase-admin.mjs';

const lire = (fichier) => JSON.parse(readFileSync(path.join(RACINE_DEPOT, fichier), 'utf8'));

const { associations } = lire('specs/donnees/associations.json');
const utilisateurs = lire('specs/donnees/demo/utilisateurs.json').map((u) => ({ ...u, fictif: true }));
const annonces = lire('specs/donnees/demo/annonces.json').map((a) => ({ ...a, fictif: true }));

if (process.argv.includes('--supprimer')) {
  for (const collection of ['annonces', 'utilisateurs']) {
    const ids = (await listerIds(collection)).filter((id) => id.startsWith('demo-'));
    if (simulation) console.log(`(simulation) ${collection} : ${ids.length} a supprimer`);
    else {
      await supprimerLot(collection, ids);
      console.log(`${collection} : ${ids.length} supprimes`);
    }
  }
  process.exit(0);
}

console.log(
  `${associations.length} associations, ${utilisateurs.length} profils, ${annonces.length} annonces`,
);
if (simulation) {
  console.log('(simulation) rien n\'est ecrit');
} else {
  await ecrireLot('associations', associations);
  await ecrireLot('utilisateurs', utilisateurs);
  await ecrireLot('annonces', annonces);
  console.log('charge');
}
