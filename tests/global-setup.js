import { preparerComptesDeTest } from './e2e/outils.js';

/** Avant tous les tests, une seule fois : les comptes de connexion de test. */
export default async function () {
  await preparerComptesDeTest();
}
