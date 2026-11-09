/**
 * EPIC 9 — Questions publiques :
 *  - US-53 poser une question sous une annonce ;
 *  - US-54 repondre a une question (offrant) ;
 *  - US-55 supprimer sa question, masquer ou retablir (offrant).
 *
 * Fatou pose des questions sous des annonces de Bastien que les autres
 * fichiers n'utilisent pas. Ses questions sont supprimees a la fin, et
 * global-teardown.js les retire de toute facon.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, appelApi, attendrePasDeDefilementHorizontal, ouvrirConnecte } from './outils.js';

test.describe.configure({ mode: 'serial' });

const ANNONCE = 'demo-a-032'; // Jeu de societe cooperatif
const REMISE = 'demo-a-115'; // Tablette 10 pouces, deja remise
const API = process.env.DONEO_API || 'http://localhost:8787';

async function supprimerQuestionsDeFatou() {
  for (const id of [ANNONCE, REMISE]) {
    const { corps } = await appelApi(PROFILS.offrantEtDemandeur, `/api/annonces/${id}/commentaires`);
    for (const q of corps?.commentaires ?? []) {
      if (q.auteur.prenom === 'Fatou') await appelApi(PROFILS.demandeurSeul, `/api/commentaires/${q.id}`, { methode: 'DELETE' });
    }
  }
}
test.beforeAll(supprimerQuestionsDeFatou);
test.afterAll(supprimerQuestionsDeFatou);

const QUESTION = 'Est-ce qu’il se joue à partir de 8 ans ?';
const zoneQuestions = (page) => page.getByRole('region', { name: /Questions publiques/ });

test('Poser une question (cas nominal)', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${ANNONCE}`);
  const zone = zoneQuestions(page);
  await expect(zone.getByText('Aucune question pour l’instant')).toBeVisible();
  await expect(zone.getByRole('button', { name: 'Publier la question' })).toBeDisabled();

  await zone.getByLabel('Poser une question').fill(QUESTION);
  await zone.getByRole('button', { name: 'Publier la question' }).click();

  await expect(zone.getByText(QUESTION)).toBeVisible();
  await expect(zone.getByText('Fatou', { exact: false })).toBeVisible();
  await expect(zone.getByLabel('Poser une question')).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Questions publiques (1)' })).toBeVisible();
});

test('L’offrant répond : la réponse est visible de tous', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, `/annonces/${ANNONCE}`);
  const zone = zoneQuestions(page);
  await zone.getByRole('button', { name: 'Répondre' }).click();
  await expect(zone.getByText('Publique : n’y écrivez pas votre adresse.')).toBeVisible();
  await zone.getByLabel('Votre réponse').fill('Oui, dès 7 ans même.');
  await zone.getByRole('button', { name: 'Publier la réponse' }).click();
  await expect(zone.getByText('Votre réponse', { exact: true })).toBeVisible();

  // La reponse se corrige, sans en creer une seconde.
  await zone.getByRole('button', { name: 'Modifier la réponse' }).click();
  await zone.getByLabel('Votre réponse').fill('Oui, dès 7 ans.');
  await zone.getByRole('button', { name: 'Publier la réponse' }).click();
  // Le formulaire se referme une fois la reponse enregistree.
  await expect(zone.getByLabel('Votre réponse')).toHaveCount(0);
  await expect(zone.getByText('Oui, dès 7 ans.', { exact: true })).toBeVisible();

  const publique = await (await fetch(`${API}/api/annonces/${ANNONCE}/commentaires`)).json();
  expect(publique.commentaires.map((q) => q.reponse?.contenu)).toEqual(['Oui, dès 7 ans.']);
});

test('L’offrant masque une question, puis la rétablit', async ({ page, browser, baseURL }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, `/annonces/${ANNONCE}`);
  const zone = zoneQuestions(page);
  await zone.getByRole('button', { name: 'Masquer' }).click();
  await expect(zone.getByText('Masquée : visible de vous seul')).toBeVisible();

  // Ni un visiteur, ni Fatou ne la voient plus.
  const publique = await (await fetch(`${API}/api/annonces/${ANNONCE}/commentaires`)).json();
  expect(publique.total).toBe(0);
  const contexte = await browser.newContext({ baseURL, viewport: { width: 375, height: 812 }, locale: 'fr-FR' });
  const pageFatou = await contexte.newPage();
  await ouvrirConnecte(pageFatou, PROFILS.demandeurSeul, `/annonces/${ANNONCE}`);
  await expect(zoneQuestions(pageFatou).getByText('Aucune question pour l’instant')).toBeVisible();
  await contexte.close();

  await zone.getByRole('button', { name: 'Rétablir' }).click();
  await expect(zone.getByText('Masquée : visible de vous seul')).toHaveCount(0);
});

test('L’offrant ne pose pas de question sur sa propre annonce', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, `/annonces/${ANNONCE}`);
  await expect(zoneQuestions(page).getByLabel('Poser une question')).toHaveCount(0);
  const { statut } = await appelApi(PROFILS.offrantEtDemandeur, `/api/annonces/${ANNONCE}/commentaires`, {
    methode: 'POST',
    corps: { contenu: 'Une question à moi-même' },
  });
  expect(statut).toBe(403);
});

test('Seul l’auteur supprime sa question', async ({ page }) => {
  const { corps } = await appelApi(PROFILS.demandeurSeul, `/api/annonces/${ANNONCE}/commentaires`);
  const id = corps.commentaires[0].id;
  expect((await appelApi(PROFILS.offrantEtDemandeur, `/api/commentaires/${id}`, { methode: 'DELETE' })).statut).toBe(403);

  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${ANNONCE}`);
  const zone = zoneQuestions(page);
  await zone.getByRole('button', { name: 'Supprimer ma question' }).click();
  await expect(zone.getByText(QUESTION)).toHaveCount(0);
  await expect(zone.getByText('Aucune question pour l’instant')).toBeVisible();
});

test('Question vide ou trop longue : refusée', async () => {
  for (const contenu of ['   ', 'a'.repeat(501)]) {
    const { statut } = await appelApi(PROFILS.demandeurSeul, `/api/annonces/${ANNONCE}/commentaires`, { methode: 'POST', corps: { contenu } });
    expect(statut).toBe(422);
  }
});

test('Objet déjà remis : les questions sont closes', async ({ page }) => {
  const { statut } = await appelApi(PROFILS.demandeurSeul, `/api/annonces/${REMISE}/commentaires`, {
    methode: 'POST',
    corps: { contenu: 'Toujours disponible ?' },
  });
  expect(statut).toBe(409);
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${REMISE}`);
  await expect(zoneQuestions(page)).toBeVisible();
  await expect(zoneQuestions(page).getByLabel('Poser une question')).toHaveCount(0);
});

test('Affichage sur mobile (320 px)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${ANNONCE}`);
  await expect(zoneQuestions(page).getByLabel('Poser une question')).toBeVisible();
  await attendrePasDeDefilementHorizontal(page);
});
