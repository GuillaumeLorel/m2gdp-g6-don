/**
 * US-13 (issue #41) — Rechercher des annonces par mot-cle en liste.
 * Un test par scenario Gherkin de l'issue.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, attendrePasDeDefilementHorizontal, ouvrirConnecte } from './outils.js';

// Cartes d'annonce seulement (la section « En cours » de l'accueil a aussi des liens en liste).
const cartes = (page) => page.getByRole('main').getByRole('listitem').getByRole('link').filter({ hasText: 'participation' });
const champ = (page) => page.getByRole('searchbox', { name: 'Rechercher un objet' });
const compteur = (page) => page.getByText(/\d+ pépites? (pour|à donner)/);

test('Trouver des annonces par mot-clé (cas nominal)', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await champ(page).fill('étagère');
  await expect(compteur(page)).toHaveText(/pépites? pour « étagère »/);

  const nombre = await cartes(page).count();
  expect(nombre).toBeGreaterThan(0);
  expect(await compteur(page).innerText()).toContain(`${nombre} pépite`);
  for (const carte of await cartes(page).all()) {
    await carte.click();
    const texte = await page.locator('article').innerText();
    expect(texte.toLowerCase()).toMatch(/étagère/);
    await page.getByRole('button', { name: 'Retour' }).click();
  }
});

test('Casse et accents ignorés', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await champ(page).fill('ÉTAGÈRE');
  await expect(compteur(page)).toContainText('« ÉTAGÈRE »');
  const avecAccents = await compteur(page).innerText();

  await champ(page).fill('etagere');
  await expect(compteur(page)).toContainText('« etagere »');
  expect((await compteur(page).innerText()).split(' ')[0]).toBe(avecAccents.split(' ')[0]);
  await expect(cartes(page).filter({ hasText: 'Étagère' }).first()).toBeVisible();
});

test('Aucun résultat (cas limite)', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await champ(page).fill('zxqwvb');
  await expect(page.getByText('Aucun objet ne correspond à votre recherche')).toBeVisible();
  await page.getByRole('button', { name: 'Effacer la recherche' }).last().click();
  await expect(champ(page)).toHaveValue('');
  await expect(cartes(page).first()).toBeVisible();
});

test('Saisie effacée', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await expect(compteur(page)).toBeVisible();
  const totalInitial = await compteur(page).innerText();

  await champ(page).fill('vélo');
  await expect(compteur(page)).toContainText('« vélo »');
  await page.getByRole('button', { name: 'Effacer la recherche' }).click();
  await expect(compteur(page)).toHaveText(totalInitial);
  await expect(page).not.toHaveURL(/q=/);
});

test('Annonces affichées selon leur statut', async ({ page }) => {
  const statuts = new Set();
  page.on('response', async (r) => {
    if (r.url().includes('/api/annonces?')) for (const a of (await r.json()).annonces) statuts.add(a.statut);
  });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await expect(cartes(page).first()).toBeVisible();
  // Charger toutes les pages : aucun objet remis ou retire ne doit apparaitre.
  while (await page.getByRole('button', { name: 'Voir plus' }).isVisible()) {
    await page.getByRole('button', { name: 'Voir plus' }).click();
    await page.waitForTimeout(400);
  }
  expect([...statuts].sort()).toEqual(['disponible', 'reserve']);
  await expect(page.getByText('Liste d’attente ouverte').first()).toBeVisible();
});

test('Recherche sans rechargement de page', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await expect(compteur(page)).toBeVisible();
  await page.evaluate(() => {
    window.__memeDocument = true;
  });
  await champ(page).pressSequentially('lampe', { delay: 40 });
  await expect(compteur(page)).toContainText('« lampe »');
  expect(await page.evaluate(() => window.__memeDocument)).toBe(true);
  await expect(page).toHaveURL(/q=lampe/);
});

test('Échec du chargement (erreur gérée)', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await expect(compteur(page)).toBeVisible();
  await page.route('**/api/annonces?*', (route) => route.abort());
  await champ(page).fill('chaise');
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  await expect(champ(page)).toHaveValue('chaise');

  await page.unroute('**/api/annonces?*');
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(compteur(page)).toContainText('« chaise »');
});

test('Pagination', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await expect(cartes(page)).toHaveCount(20);
  await page.getByRole('button', { name: 'Voir plus' }).click();
  await expect(cartes(page)).toHaveCount(40);
});

test('La recherche est retrouvée au retour d’une fiche', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await champ(page).fill('lampe');
  await expect(compteur(page)).toContainText('« lampe »');
  await cartes(page).first().click();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(champ(page)).toHaveValue('lampe');
  await expect(compteur(page)).toContainText('« lampe »');
});

test('Affichage sur mobile', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await expect(cartes(page).first()).toBeVisible();
  await attendrePasDeDefilementHorizontal(page);
});
