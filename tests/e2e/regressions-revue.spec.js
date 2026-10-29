/**
 * Non-regression des defauts releves par la revue de code du J4. Chaque test
 * reproduit le scenario d'echec decrit par la revue.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PROFILS, ouvrirConnecte } from './outils.js';

const annoncesDemo = JSON.parse(
  readFileSync(new URL('../../specs/donnees/demo/annonces.json', import.meta.url), 'utf8'),
);
const API = process.env.DONEO_API || 'http://localhost:8787';
// Cartes d'annonce seulement (la section « En cours » de l'accueil a aussi des liens en liste).
const cartes = (page) => page.getByRole('main').getByRole('listitem').getByRole('link').filter({ hasText: 'participation' });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Toute erreur JavaScript non rattrapee fait echouer le test.
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

test('Vie privée : une seule position publique par adresse', async ({ request }) => {
  const parAdresse = new Map();
  for (const a of annoncesDemo.filter((x) => x.statut !== 'retiree')) {
    const cle = `${a.numeroRue}|${a.rue}|${a.codePostal}`;
    parAdresse.set(cle, [...(parAdresse.get(cle) || []), a.id]);
  }
  // Les adresses qui portent plusieurs annonces : c'est la que la moyenne
  // des positions trahissait le domicile.
  const multiples = [...parAdresse.values()].filter((ids) => ids.length > 1).slice(0, 5);
  expect(multiples.length).toBeGreaterThan(0);
  for (const ids of multiples) {
    const points = new Set();
    for (const id of ids) {
      const a = await (await request.get(`${API}/api/annonces/${id}`)).json();
      points.add(`${a.latitudeApprochee},${a.longitudeApprochee}`);
    }
    expect(points.size).toBe(1);
  }
});

test('« Voir plus » puis changement de tri : ni plantage, ni mélange', async ({ page }) => {
  await page.route('**/api/annonces?*page=2*', async (route) => {
    await pause(1500); // la page 2 arrive APRES le changement de tri
    await route.continue();
  });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await expect(cartes(page)).toHaveCount(20);
  await page.getByRole('button', { name: 'Voir plus' }).click();

  const triee = page.waitForResponse((r) => r.url().includes('tri=participation'));
  await page.getByRole('group', { name: 'Trier' }).getByRole('button', { name: 'Participation', exact: true }).click();
  const { annonces } = await (await triee).json();
  await page.waitForTimeout(2000); // laisse arriver la page 2 de l'ancienne recherche

  await expect(cartes(page)).toHaveCount(20);
  await expect(cartes(page).first().getByRole('heading')).toHaveText(annonces[0].titre);
});

test('L’onglet « Recherche » vide vraiment la recherche', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche?q=lampe');
  await expect(page.getByRole('searchbox')).toHaveValue('lampe');
  await page.getByRole('link', { name: 'Recherche' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await page.waitForTimeout(800); // au-dela de la pause de frappe
  await expect(page).not.toHaveURL(/q=lampe/);
  await expect(page.getByRole('searchbox')).toHaveValue('');
});

test('Échec de « Voir plus » : les résultats déjà chargés restent', async ({ page }) => {
  await page.route('**/api/annonces?*page=2*', (route) => route.abort());
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await expect(cartes(page)).toHaveCount(20);
  await page.getByRole('button', { name: 'Voir plus' }).click();
  await expect(page.getByRole('alert')).toContainText('Vos résultats sont conservés');
  await expect(cartes(page)).toHaveCount(20);

  await page.unroute('**/api/annonces?*page=2*');
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(cartes(page)).toHaveCount(40);
});

test('Accueil : une réponse lente n’écrase pas la catégorie choisie', async ({ page }) => {
  await page.route('**/api/annonces?*categorieId=mobilier*', async (route) => {
    await pause(1500);
    await route.continue();
  });
  await ouvrirConnecte(page, PROFILS.demandeurSeul);
  await expect(cartes(page).first()).toBeVisible();

  const sport = page.waitForResponse((r) => r.url().includes('categorieId=sport'));
  await page.getByRole('button', { name: 'Mobilier' }).click();
  await page.getByRole('button', { name: 'Sport et loisirs' }).click();
  const { annonces } = await (await sport).json();
  await page.waitForTimeout(2000); // la reponse Mobilier arrive ensuite

  await expect(page.getByRole('button', { name: 'Sport et loisirs' })).toHaveAttribute('aria-pressed', 'true');
  await expect(cartes(page).first().getByRole('heading')).toHaveText(annonces[0].titre);
});

test('Catégories : une coupure réseau n’est pas mise en cache', async ({ page }) => {
  let echecs = 0;
  await page.route('**/api/categories', (route) => {
    if (echecs++ === 0) return route.abort(); // la premiere fois seulement
    return route.continue();
  });
  await ouvrirConnecte(page, PROFILS.demandeurSeul);
  await expect(page.getByRole('button', { name: 'Mobilier' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Recherche' }).click();
  await page.getByRole('button', { name: /^Filtres/ }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Mobilier' })).toBeVisible();
});

test('Créneau sans heure de fin : la fiche s’affiche', async ({ page }) => {
  const annonce = annoncesDemo.find((a) => a.statut === 'disponible');
  await page.route(`**/api/annonces/${annonce.id}`, async (route) => {
    const corps = await (await route.fetch()).json();
    await route.fulfill({ json: { ...corps, creneauRetrait: { debut: corps.creneauRetrait.debut } } });
  });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${annonce.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/à partir de \d+ h/)).toBeVisible();
});

test('Carte : l’épingle de l’aperçu est mise en évidence', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) }),
  );
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche?vue=carte&categorieId=animaux');
  const epingle = page.locator('.leaflet-marker-icon').last();
  // Des epingles voisines se recouvrent a ce zoom : on vise celle-ci directement.
  await epingle.dispatchEvent('click');
  await expect(page.locator('.leaflet-marker-icon.epingle-choisie')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fermer l’aperçu' }).click();
  await expect(page.locator('.leaflet-marker-icon.epingle-choisie')).toHaveCount(0);
});
