/**
 * US-9 (issue #37) — Consulter la fiche d'une annonce.
 * L'issue est en Draft : les scenarios couvrent le comportement retenu, en
 * insistant sur la regle de l'adresse a deux niveaux (AGENTS.md).
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PROFILS, attendrePasDeDefilementHorizontal, ouvrirConnecte } from './outils.js';

const annonces = JSON.parse(
  readFileSync(new URL('../../specs/donnees/demo/annonces.json', import.meta.url), 'utf8'),
);
const disponible = annonces.find((a) => a.statut === 'disponible' && a.offrantId !== PROFILS.demandeurSeul);
const reservee = annonces.find((a) => a.statut === 'reserve');
const remise = annonces.find((a) => a.statut === 'remis');
const mienne = annonces.find((a) => a.offrantId === PROFILS.offrantEtDemandeur);

test('Consulter une annonce (cas nominal)', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${disponible.id}`);
  await expect(page.getByRole('heading', { level: 1, name: disponible.titre })).toBeVisible();
  await expect(page.getByText(disponible.description)).toBeVisible();
  await expect(page.getByText('— participation')).toBeVisible();
  await expect(page.getByText(/^Reversée à /)).toBeVisible();
  await expect(page.getByText('Créneau de retrait')).toBeVisible();
  await expect(page.getByText(disponible.codePostal, { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Réserver pour/ })).toBeVisible();
});

test('L’adresse exacte n’apparaît jamais avant la participation', async ({ page }) => {
  const reponses = [];
  page.on('response', async (r) => {
    if (r.url().includes(`/api/annonces/${disponible.id}`)) reponses.push(await r.text());
  });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${disponible.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const texte = await page.locator('body').innerText();
  expect(texte).not.toContain(disponible.rue);
  expect(texte).toContain('L’adresse exacte vous est communiquée une fois votre participation validée.');

  // Ni dans la page, ni dans la reponse de l'API.
  expect(reponses.length).toBeGreaterThan(0);
  for (const corps of reponses) {
    expect(corps).not.toContain(disponible.rue);
    expect(corps).not.toContain('numeroRue');
    expect(corps).not.toContain('"latitude"');
  }
});

test('Ouvrir une fiche depuis l’accueil, puis revenir', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul);
  const carte = page.getByRole('main').getByRole('link').filter({ hasText: 'participation' }).first();
  const titre = await carte.getByRole('heading').innerText();
  await carte.click();
  await expect(page.getByRole('heading', { level: 1, name: titre })).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('heading', { name: 'Derniers objets ajoutés' })).toBeVisible();
});

test('Annonce réservée : signalée, mais la demande reste possible', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${reservee.id}`);
  await expect(page.getByText('Cet objet est déjà réservé.', { exact: false })).toBeVisible();
  // Si la personne renonce, l'offrant pourra proposer l'objet a quelqu'un d'autre.
  await expect(page.getByRole('button', { name: /Réserver pour/ })).toBeEnabled();
});

test('Annonce déjà remise', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${remise.id}`);
  await expect(page.getByText('Cet objet a déjà trouvé preneur.', { exact: false })).toBeVisible();
});

test('Sa propre annonce : pas de bouton de réservation', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, `/annonces/${mienne.id}`);
  await expect(page.getByText('C’est votre annonce')).toBeVisible();
  await expect(page.getByRole('button', { name: /Réserver/ })).toHaveCount(0);
});

test('Annonce introuvable (erreur gérée)', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/annonces/n-existe-pas');
  await expect(page.getByText('Annonce introuvable')).toBeVisible();
  await page.getByRole('link', { name: 'Retour à l’accueil' }).click();
  await expect(page.getByRole('heading', { name: 'Derniers objets ajoutés' })).toBeVisible();
});

test('Échec du chargement (erreur gérée)', async ({ page }) => {
  await page.route('**/api/annonces/demo-*', (route) => route.abort());
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${disponible.id}`);
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
});

test('Affichage sur mobile', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${disponible.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await attendrePasDeDefilementHorizontal(page);
});
