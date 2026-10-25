import { preparerComptesDeTest } from './e2e/outils.js';

/** Avant tous les tests, une seule fois : les comptes de connexion de test. */
export default async function () {
  // Repere pour global-teardown.js : seules les photos posterieures sont des
  // photos de test.
  process.env.DONEO_DEBUT_TESTS = new Date().toISOString();
  await preparerComptesDeTest();
}
