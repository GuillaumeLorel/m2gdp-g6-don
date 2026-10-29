/**
 * US-5 (issue #33) — Retrouver ses dons et ses demandes en cours depuis
 * l'accueil.
 *
 * Bastien (offrant et demandeur) a 8 annonces de demonstration : 5
 * disponibles, 2 reservees et 1 remise. Pas de compte exact :
 * creer-annonce.spec.js publie en parallele pour lui. Les creneaux avancent
 * a chaque chargement de la demo : l'ordre attendu se lit dans l'API.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, attendrePasDeDefilementHorizontal, ouvrirConnecte } from './outils.js';

const enCours = (page) => page.getByRole('region', { name: 'En cours' });

test('L’offrant retrouve ses dons en cours, du plus proche au plus lointain', async ({ page }) => {
  // L'ordre attendu : celui du tri « creneau » de l'API, que l'accueil reprend.
  const reponse = page.waitForResponse((r) => r.url().includes('offrantId='));
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  const { annonces } = await (await reponse).json();
  const section = enCours(page);
  await expect(section.getByRole('heading', { name: /Mes dons \(\d+\)/ })).toBeVisible();

  const titres = section.getByRole('listitem').getByRole('heading');
  await expect(titres.first()).toHaveText(annonces[0].titre);
  await expect(section.getByText('Jeu de société coopératif')).toBeVisible();
  // Un objet remis n'est plus « en cours ».
  await expect(section.getByText('Tablette 10 pouces')).toHaveCount(0);
  await attendrePasDeDefilementHorizontal(page);
});

test('Un créneau dépassé est signalé à l’offrant', async ({ page }) => {
  // Le chargement de la demo avance les creneaux : on en fait passer un.
  await page.route('**/api/annonces?*offrantId=*', async (route) => {
    const reponse = await route.fetch();
    const page1 = await reponse.json();
    page1.annonces[0] = { ...page1.annonces[0], creneauRetrait: { debut: '2026-01-10T13:00:00Z', fin: '2026-01-10T15:00:00Z' } };
    await route.fulfill({ response: reponse, json: page1 });
  });
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  await expect(enCours(page).getByRole('listitem').first().getByText('Créneau passé')).toBeVisible();
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
