/**
 * Ergonomie mobile : ce qui doit rester a l'ecran quand on fait defiler, et
 * pas de saut quand la liste se met a jour.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, ouvrirConnecte } from './outils.js';

// Cartes d'annonce seulement : la section « En cours » de l'accueil a aussi
// des liens en liste (dons, demandes).
const cartes = (page) => page.getByRole('main').getByRole('listitem').getByRole('link').filter({ hasText: 'participation' });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

test('Accueil : la recherche et les catégories restent en haut', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul);
  await expect(cartes(page).first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect(page.getByRole('link', { name: 'Chercher une pépite…' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Mobilier' })).toBeInViewport();
});

test('Recherche : le champ, les filtres et la bascule restent en haut', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await expect(cartes(page).first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 2000));
  await expect(page.getByRole('searchbox')).toBeInViewport();
  await expect(page.getByRole('button', { name: /^Filtres/ })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Carte' })).toBeInViewport();
});

test('Changer le tri ne vide pas la liste, puis remonte en haut', async ({ page }) => {
  await page.route('**/api/annonces?*tri=participation*', async (route) => {
    await pause(1200);
    await route.continue();
  });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await expect(cartes(page)).toHaveCount(20);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.getByRole('group', { name: 'Trier' }).getByRole('button', { name: 'Participation', exact: true }).click();

  // Pendant le chargement : les anciens resultats restent, attenues — pas
  // de squelettes, donc pas de changement de hauteur.
  await expect(page.locator('main ul[aria-busy]')).toHaveAttribute('aria-busy', 'true');
  await expect(cartes(page)).toHaveCount(20);
  await expect(page.getByLabel('Chargement en cours')).toHaveCount(0);

  // Une fois les nouveaux resultats la, on repart du haut.
  await expect(page.locator('main ul[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('Fiche : le bouton retour reste accessible en bas de page', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await cartes(page).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByRole('button', { name: 'Retour' })).toBeInViewport();
});
