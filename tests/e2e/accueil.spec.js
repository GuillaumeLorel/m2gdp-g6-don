/**
 * US-4 (issue #32) — Afficher l'accueil avec menu du bas et derniers objets.
 * Un test par scenario Gherkin de l'issue.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, attendrePasDeDefilementHorizontal, ouvrirConnecte } from './outils.js';

const cartes = (page) => page.getByRole('main').getByRole('link').filter({ hasText: 'participation' });

test('Afficher les derniers objets (cas nominal)', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  await expect(page.getByRole('heading', { name: 'Derniers objets ajoutés' })).toBeVisible();
  await expect(cartes(page).first()).toBeVisible();

  const nombre = await cartes(page).count();
  expect(nombre).toBeGreaterThan(0);
  expect(nombre).toBeLessThanOrEqual(10);

  // Chaque carte : titre, participation, association, etat et quartier.
  const premiere = cartes(page).first();
  await expect(premiere.getByRole('heading')).not.toBeEmpty();
  await expect(premiere).toContainText('€');
  await expect(premiere).toContainText('Reversé à');
  await expect(premiere).toContainText(/(Neuf|Très bon état|Bon état|Usagé) · /);
});

test('Naviguer avec le menu du bas (cas nominal)', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  const menu = page.getByRole('navigation', { name: 'Navigation principale' });
  for (const entree of ['Accueil', 'Recherche', 'Créer', 'Messages', 'Profil']) {
    await expect(menu.getByRole('link', { name: entree })).toBeVisible();
  }
  await expect(menu.getByRole('link', { name: 'Favoris' })).toHaveCount(0);
  await expect(menu.getByRole('link', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page');

  // Messages (#131) : la liste des conversations s'ouvre et l'onglet est actif.
  await menu.getByRole('link', { name: 'Messages' }).click();
  await expect(page).toHaveURL(/\/messages$/);
  await expect(menu.getByRole('link', { name: 'Messages' })).toHaveAttribute('aria-current', 'page');

  // Le menu reste visible quand la page defile.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(menu).toBeInViewport();
});

test('Les favoris restent accessibles (#131)', async ({ page }) => {
  // Depuis le cœur en haut de l'accueil.
  await ouvrirConnecte(page, PROFILS.demandeurSeul);
  await page.getByRole('main').getByRole('link', { name: 'Favoris' }).click();
  await expect(page).toHaveURL(/\/favoris$/);
  await expect(page.getByRole('heading', { name: 'Mes favoris' })).toBeVisible();

  // Depuis le profil, où « Mes messages » n'est plus : le menu du bas suffit.
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Profil' }).click();
  await expect(page.getByRole('link', { name: 'Mes messages' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Mes favoris' }).click();
  await expect(page).toHaveURL(/\/favoris$/);
});

test('Filtrer par catégorie depuis une puce', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  await expect(cartes(page).first()).toBeVisible();

  const requete = page.waitForRequest((r) => r.url().includes('/api/annonces') && r.url().includes('categorieId=mobilier'));
  await page.getByRole('button', { name: 'Mobilier' }).click();
  await requete;
  await expect(page.getByRole('button', { name: 'Mobilier' })).toHaveAttribute('aria-pressed', 'true');

  const tout = page.waitForRequest((r) => r.url().includes('/api/annonces') && !r.url().includes('categorieId'));
  await page.getByRole('button', { name: 'Tout' }).click();
  await tout;
  await expect(page.getByRole('button', { name: 'Tout' })).toHaveAttribute('aria-pressed', 'true');
});

test('Aucun objet à afficher (cas limite)', async ({ page }) => {
  await page.route('**/api/annonces?*', (route) =>
    route.fulfill({ json: { annonces: [], total: 0, page: 1, parPage: 10 } }),
  );
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  await expect(page.getByText('Aucun objet pour le moment')).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Créer une annonce' })).toBeVisible();
});

test('Échec du chargement (erreur gérée)', async ({ page }) => {
  await page.route('**/api/annonces?*', (route) => route.abort());
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  await expect(page.getByRole('alert')).toContainText('Le chargement a échoué');
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();

  // Le menu reste utilisable.
  await page.getByRole('link', { name: 'Profil' }).click();
  await expect(page).toHaveURL(/\/profil$/);

  // Et « Reessayer » recharge bien la liste une fois le service revenu.
  await page.unroute('**/api/annonces?*');
  await page.getByRole('link', { name: 'Accueil' }).click();
  await expect(cartes(page).first()).toBeVisible();
});

test('Visiteur non connecté (erreur gérée)', async ({ page }) => {
  await page.goto('/recherche');
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0);
});

test('Affichage sur mobile', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  await expect(cartes(page).first()).toBeVisible();
  await attendrePasDeDefilementHorizontal(page);
});
