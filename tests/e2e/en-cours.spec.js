/**
 * US-5 (issue #33) — Retrouver ses dons et ses demandes en cours depuis
 * l'accueil.
 *
 * Bastien (offrant et demandeur) a 8 annonces de demonstration : 5
 * disponibles, 2 reservees — dont une au creneau passe — et 1 remise.
 * Pas de compte exact : creer-annonce.spec.js publie en parallele pour lui.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, attendrePasDeDefilementHorizontal, ouvrirConnecte } from './outils.js';

const enCours = (page) => page.getByRole('region', { name: 'En cours' });

test('L’offrant retrouve ses dons en cours, du plus proche au plus lointain', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  const section = enCours(page);
  await expect(section.getByRole('heading', { name: /Mes dons \(\d+\)/ })).toBeVisible();

  const titres = section.getByRole('listitem').getByRole('heading');
  await expect(titres.first()).toHaveText('Lampadaire arc métal');
  await expect(section.getByText('Jeu de société coopératif')).toBeVisible();
  // Un objet remis n'est plus « en cours ».
  await expect(section.getByText('Tablette 10 pouces')).toHaveCount(0);
  // Un creneau depasse le signale a l'offrant.
  await expect(
    section.getByRole('listitem').filter({ hasText: 'Balance de cuisine électronique' }).getByText('Créneau passé'),
  ).toBeVisible();
  await attendrePasDeDefilementHorizontal(page);
});

test('Un don mène à sa fiche', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  await enCours(page).getByRole('link', { name: /Lampadaire arc métal/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Lampadaire arc métal' })).toBeVisible();
});

test('Un compte qui cumule les rôles voit aussi ses demandes', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  await expect(enCours(page).getByRole('heading', { name: 'Mes demandes' })).toBeVisible();
  await expect(enCours(page).getByText('Aucune demande en cours')).toBeVisible();
});

test('Un demandeur seul ne voit que ses demandes, avec un accès à la recherche', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul);
  const section = enCours(page);
  await expect(section.getByRole('heading', { name: 'Mes demandes' })).toBeVisible();
  await expect(section.getByRole('heading', { name: /Mes dons/ })).toHaveCount(0);
  await section.getByRole('link', { name: 'Chercher' }).click();
  await expect(page).toHaveURL(/\/recherche$/);
});

test('Sans don en ligne, l’accueil invite à donner', async ({ page }) => {
  await page.route('**/api/annonces?*offrantId=*', (route) =>
    route.fulfill({ json: { total: 0, page: 1, parPage: 50, annonces: [] } }),
  );
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  const section = enCours(page);
  await expect(section.getByText('Aucun objet en ligne pour le moment.')).toBeVisible();
  await section.getByRole('link', { name: 'Donner' }).click();
  await expect(page).toHaveURL(/\/creer$/);
});
