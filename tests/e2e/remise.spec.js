/**
 * US-32 (issue #62) — Confirmer la remise de l'objet ;
 * US-29 et US-31 (#58, #60) — se désister, passer au suivant faute de réponse.
 *
 * Les tickets n'ont pas de critères Gherkin : les scénarios suivent
 * specs/data-model.md et specs/openapi.yaml (`POST /api/reservations/{id}/remise`).
 * Le paiement réel (Stripe) est couvert par echanges.spec.js ; ici, l'état
 * « confirmée » est simulé à l'affichage, et les refus sont vérifiés sur le
 * vrai Worker. Fatou demande l'objet, Bastien (offrant) le confirme.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PROFILS, appelApi, ouvrirConnecte } from './outils.js';

test.describe.configure({ mode: 'serial' });

const LAMPADAIRE = JSON.parse(
  readFileSync(new URL('../../specs/donnees/demo/annonces.json', import.meta.url), 'utf8'),
).find((a) => a.id === 'demo-a-051');

let demande;

test.beforeAll(async () => {
  const { corps } = await appelApi(PROFILS.demandeurSeul, `/api/annonces/${LAMPADAIRE.id}/reservations`, { methode: 'POST' });
  demande = corps;
});

test.afterAll(async () => {
  await appelApi(PROFILS.demandeurSeul, `/api/reservations/${demande.id}/renonciation`, { methode: 'POST' });
});

/** Fait afficher la conversation avec une réservation donnée, sans paiement réel. */
async function simulerReservation(page, statut) {
  await page.route(`**/api/conversations/${demande.conversationId}/messages`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const reponse = await route.fetch();
    const c = await reponse.json();
    c.reservation = { ...c.reservation, statut: statut(), statutPaiement: 'paye', participationDemandee: LAMPADAIRE.participation };
    await route.fulfill({ response: reponse, json: c });
  });
}

test('L’offrant confirme la remise (cas nominal)', async ({ page }) => {
  let statut = 'confirmee';
  let envoyee = false;
  await simulerReservation(page, () => statut);
  await page.route(`**/api/reservations/${demande.id}/remise`, (route) => {
    envoyee = true;
    statut = 'remise';
    return route.fulfill({ json: { id: demande.id, statut: 'remise' } });
  });

  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, `/messages/${demande.conversationId}`);
  await expect(page.getByText('confirmez la remise une fois l’objet donné')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer la remise' }).click();

  await expect(page.getByText('L’objet a été remis. Merci pour l’association !')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmer la remise' })).toHaveCount(0);
  expect(envoyee).toBe(true);
});

test('Le demandeur ne peut pas confirmer la remise', async ({ page }) => {
  await simulerReservation(page, () => 'confirmee');
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/messages/${demande.conversationId}`);
  await expect(page.getByText('Réservation confirmée')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmer la remise' })).toHaveCount(0);

  // Le Worker refuse aussi : seul l'offrant confirme.
  const refus = await appelApi(PROFILS.demandeurSeul, `/api/reservations/${demande.id}/remise`, { methode: 'POST' });
  expect(refus.statut).toBe(403);
});

test('Pas de remise avant la participation (erreur gérée)', async ({ page }) => {
  // La demande n'est ni validée ni payée : le Worker répond 409, sans rien changer.
  const refus = await appelApi(PROFILS.offrantEtDemandeur, `/api/reservations/${demande.id}/remise`, { methode: 'POST' });
  expect(refus.statut).toBe(409);
  const { corps } = await appelApi(PROFILS.offrantEtDemandeur, `/api/reservations/${demande.id}`);
  expect(corps.statut).toBe('demandee');

  // L'écran, lui, affiche l'erreur sans planter quand la confirmation échoue.
  await simulerReservation(page, () => 'confirmee');
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, `/messages/${demande.conversationId}`);
  await page.getByRole('button', { name: 'Confirmer la remise' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmer la remise' })).toBeEnabled();
});

test('Se désister de la liste d’attente : place affichée, bouton de désistement', async ({ page }) => {
  let envoyee = false;
  await page.route(`**/api/conversations/${demande.conversationId}/messages`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const reponse = await route.fetch();
    const c = await reponse.json();
    c.reservation = { ...c.reservation, statut: 'liste_attente', position: 2 };
    await route.fulfill({ response: reponse, json: c });
  });
  await page.route(`**/api/reservations/${demande.id}/desistement`, (route) => {
    envoyee = true;
    return route.fulfill({ json: { id: demande.id, statut: 'annulee' } });
  });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/messages/${demande.conversationId}`);
  await expect(page.getByText('Vous êtes en liste d’attente (place 2)')).toBeVisible();
  await page.getByRole('button', { name: 'Me désister' }).click();
  expect(envoyee).toBe(true);
});

test('L’offrant passe au suivant faute de réponse, l’objet redevient disponible', async () => {
  // Sans personne derrière dans la file, l'annonce redevient disponible.
  const refus = await appelApi(PROFILS.offrantEtDemandeur, `/api/reservations/${demande.id}/sans-reponse`, { methode: 'POST' });
  expect(refus.statut).toBe(409); // pas encore proposée

  await appelApi(PROFILS.offrantEtDemandeur, `/api/reservations/${demande.id}/validation`, { methode: 'POST' });
  const interdit = await appelApi(PROFILS.demandeurSeul, `/api/reservations/${demande.id}/sans-reponse`, { methode: 'POST' });
  expect(interdit.statut).toBe(403); // seul l'offrant passe au suivant

  const { statut, corps } = await appelApi(PROFILS.offrantEtDemandeur, `/api/reservations/${demande.id}/sans-reponse`, { methode: 'POST' });
  expect(statut).toBe(200);
  expect(corps.statut).toBe('annulee');
  expect(corps.motifAnnulation).toBe('sans_reponse');
  expect((await appelApi(PROFILS.demandeurSeul, `/api/annonces/${LAMPADAIRE.id}`)).corps.statut).toBe('disponible');
});

test('Se désister d’un objet proposé : il redevient disponible', async () => {
  const { corps: nouvelle } = await appelApi(PROFILS.demandeurSeul, `/api/annonces/${LAMPADAIRE.id}/reservations`, { methode: 'POST' });
  // Une demande que l'offrant n'a pas encore validée n'est pas un désistement.
  expect((await appelApi(PROFILS.demandeurSeul, `/api/reservations/${nouvelle.id}/desistement`, { methode: 'POST' })).statut).toBe(409);

  await appelApi(PROFILS.offrantEtDemandeur, `/api/reservations/${nouvelle.id}/validation`, { methode: 'POST' });
  expect((await appelApi(PROFILS.offrantEtDemandeur, `/api/reservations/${nouvelle.id}/desistement`, { methode: 'POST' })).statut).toBe(403);

  const { statut, corps } = await appelApi(PROFILS.demandeurSeul, `/api/reservations/${nouvelle.id}/desistement`, { methode: 'POST' });
  expect(statut).toBe(200);
  expect(corps.motifAnnulation).toBe('desistement');
  expect((await appelApi(PROFILS.demandeurSeul, `/api/annonces/${LAMPADAIRE.id}`)).corps.statut).toBe('disponible');
});
