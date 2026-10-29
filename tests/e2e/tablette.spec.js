/**
 * Affichage tablette en portrait (820 x 1180) : la logique mobile — menu du
 * bas, bascule Carte / Liste —, sur une colonne elargie avec les annonces en
 * deux colonnes.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, attendrePasDeDefilementHorizontal, ouvrirConnecte } from './outils.js';

test.use({ viewport: { width: 820, height: 1180 } });

// Cartes d'annonce seulement : la section « En cours » de l'accueil a aussi
// des liens en liste (dons, demandes).
const cartes = (page) => page.getByRole('main').getByRole('listitem').getByRole('link').filter({ hasText: 'participation' });

async function deuxColonnes(page) {
  await expect(cartes(page).nth(2)).toBeVisible();
  const [a, b, c] = await Promise.all([0, 1, 2].map((i) => cartes(page).nth(i).boundingBox()));
  expect(Math.abs(a.y - b.y)).toBeLessThan(2); // cote a cote
  expect(b.x).toBeGreaterThan(a.x + a.width); // b a droite de a
  expect(c.y).toBeGreaterThan(a.y + 50); // la troisieme passe a la ligne
}

test('Accueil : annonces en deux colonnes, menu du bas', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul);
  await deuxColonnes(page);
  const menu = await page.getByRole('navigation', { name: 'Navigation principale' }).boundingBox();
  expect(menu.y).toBeGreaterThan(1000); // en bas de l'ecran
  await attendrePasDeDefilementHorizontal(page);
});

test('Recherche : deux colonnes en liste, bascule Carte / Liste conservée', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await deuxColonnes(page);
  await expect(page.getByRole('group', { name: 'Affichage' })).toBeVisible();
  await attendrePasDeDefilementHorizontal(page);
});

test('Fiche : l’illustration s’affiche entière', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await cartes(page).first().click();
  const visuel = await page.locator('article img').first().boundingBox();
  // Format 4:3 conserve : rien n'est rogne en haut ni en bas.
  expect(visuel.width / visuel.height).toBeCloseTo(4 / 3, 1);
  await attendrePasDeDefilementHorizontal(page);
});
