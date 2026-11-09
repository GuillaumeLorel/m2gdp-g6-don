/**
 * US-19 (issue #47) — Afficher la distance approximative d'une annonce.
 *
 * Le ticket n'a pas de critères Gherkin : les scénarios suivent
 * specs/openapi.yaml (distance arrondie à 0,5 km, calculée sur la position
 * approchée). Le service d'adresses de l'IGN est simulé : on choisit le point
 * de départ, ici le centre de Lyon. Rien n'est écrit en base.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, attendrePasDeDefilementHorizontal, ouvrirConnecte } from './outils.js';

const SERVICE = '**/data.geopf.fr/geocodage/search**';
const DISTANCE = /À (moins de 500 m|\d+(,5)? km)/;
const FICHE = '/annonces/demo-a-131';

const centreDeLyon = (route) =>
  route.fulfill({
    json: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [4.835, 45.764] } }] },
  });

test('Distance sur les cartes d’annonce (cas nominal)', async ({ page }) => {
  let requete;
  await page.route(SERVICE, (route) => {
    requete = new URL(route.request().url());
    return centreDeLyon(route);
  });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');

  const cartes = page.getByRole('main').getByRole('link').filter({ hasText: 'participation' });
  await expect(cartes.first()).toBeVisible();
  await expect(cartes.first().getByText(DISTANCE)).toBeVisible();
  // Seuls le code postal et la ville du profil partent vers le service : jamais l'adresse exacte.
  expect(requete.searchParams.get('type')).toBe('municipality');
  expect(requete.searchParams.get('q')).toMatch(/^\d{5} \S/);
});

test('Distance sur la fiche', async ({ page }) => {
  await page.route(SERVICE, centreDeLyon);
  await ouvrirConnecte(page, PROFILS.demandeurSeul, FICHE);
  await expect(page.getByRole('list', { name: 'Caractéristiques' }).getByText(DISTANCE)).toBeVisible();
});

test('Distance arrondie à 0,5 km', async ({ page }) => {
  await page.route(SERVICE, centreDeLyon);
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  const texte = await page.getByRole('main').getByText(DISTANCE).first().textContent();
  const km = Number(texte.match(/À ([\d,]+) km/)?.[1].replace(',', '.') ?? 0);
  expect((km * 2) % 1).toBe(0);
});

test('Service d’adresses indisponible : aucune distance, aucune erreur', async ({ page }) => {
  await page.route(SERVICE, (route) => route.abort());
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');

  const cartes = page.getByRole('main').getByRole('link').filter({ hasText: 'participation' });
  await expect(cartes.first()).toBeVisible();
  await expect(page.getByText(DISTANCE)).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test.describe('Petit écran', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test('Distance lisible, sans débordement (320 px)', async ({ page }) => {
    await page.route(SERVICE, centreDeLyon);
    await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
    await expect(page.getByRole('main').getByText(DISTANCE).first()).toBeVisible();
    await attendrePasDeDefilementHorizontal(page);
  });
});
