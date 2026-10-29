/**
 * Affichage grand ecran (1440 x 900) : navigation en haut, accueil en grille,
 * recherche avec liste et carte cote a cote, fiche en deux colonnes.
 * Le reste des tests tourne en vue mobile (375 px).
 */
import { expect, test } from '@playwright/test';
import { PROFILS, ouvrirConnecte } from './outils.js';

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  // Tuiles de la carte simulees : pas de sollicitation d'OpenStreetMap.
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) }),
  );
});

// Cartes d'annonce seulement : la section « En cours » de l'accueil a aussi
// des liens en liste (dons, demandes).
const cartes = (page) => page.getByRole('main').getByRole('listitem').getByRole('link').filter({ hasText: 'participation' });

test('Connexion : panneau de la marque à côté du formulaire', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Donnez vos objets, soutenez une association.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
});

test('Navigation en haut, sans menu du bas', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(nav).toHaveCount(1);
  const boite = await nav.boundingBox();
  expect(boite.y).toBeLessThan(80); // en haut de l'ecran
  await expect(page.getByRole('link', { name: 'Créer une annonce' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Profil' }).click();
  await expect(page).toHaveURL(/\/profil$/);
});

test('Accueil : bandeau, objets en grille de trois, étapes', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul);
  await expect(page.getByRole('heading', { name: '1 objet, 1 don.' })).toBeVisible();
  await expect(page.getByText(/\d+ pépites à donner en ce moment/)).toBeVisible();

  await expect(cartes(page)).toHaveCount(12);
  const [a, b, c, d] = await Promise.all([0, 1, 2, 3].map((i) => cartes(page).nth(i).boundingBox()));
  expect(Math.abs(a.y - b.y)).toBeLessThan(2); // meme rangee
  expect(Math.abs(b.y - c.y)).toBeLessThan(2);
  expect(d.y).toBeGreaterThan(a.y + 50); // la quatrieme passe a la ligne

  await expect(page.getByRole('heading', { name: 'Comment ça marche' })).toBeVisible();
});

test('Recherche : liste et carte côte à côte, la carte suit le défilement', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  const carte = page.getByRole('region', { name: 'Carte des objets' });
  await expect(cartes(page).first()).toBeVisible();
  await expect(carte).toBeVisible();
  await expect(page.getByRole('group', { name: 'Affichage' })).toBeHidden();

  const liste = await cartes(page).first().boundingBox();
  const zone = await carte.boundingBox();
  expect(zone.x).toBeGreaterThan(liste.x + liste.width); // carte a droite de la liste

  await page.evaluate(() => window.scrollTo(0, 1500));
  await expect(carte).toBeInViewport();
});

test('Recherche : survoler une annonce met son épingle en évidence', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon.epingle-choisie')).toHaveCount(0);
  await cartes(page).nth(2).hover();
  await expect(page.locator('.leaflet-marker-icon.epingle-choisie')).toHaveCount(1);
  await page.mouse.move(5, 5);
  await expect(page.locator('.leaflet-marker-icon.epingle-choisie')).toHaveCount(0);
});

test('Filtres : fenêtre centrée plutôt que feuille du bas', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await page.getByRole('button', { name: /^Filtres/ }).click();
  const fenetre = await page.getByRole('dialog', { name: 'Filtres' }).boundingBox();
  // Centree verticalement : elle ne touche pas le bas de l'ecran.
  expect(fenetre.y + fenetre.height).toBeLessThan(900 - 20);
  expect(fenetre.width).toBeLessThan(700);
});

test('Fiche : visuel à gauche, informations et réservation à droite', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await cartes(page).first().click();
  const titre = page.getByRole('heading', { level: 1 });
  await expect(titre).toBeVisible();
  const visuel = await page.locator('article img').first().boundingBox();
  const boiteTitre = await titre.boundingBox();
  expect(boiteTitre.x).toBeGreaterThan(visuel.x + visuel.width); // deux colonnes
  // Le bouton de reservation est visible sans faire defiler.
  await expect(page.getByRole('button', { name: /Réserver|liste d’attente|déjà remis/ })).toBeInViewport();
});
