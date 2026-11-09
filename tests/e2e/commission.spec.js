/**
 * US-25 (#54) — Afficher la commission et la part reversée avant paiement.
 *
 * Doneo preleve 5 % de la participation ; l'association recoit le reste.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { repartition as repartitionApi, TAUX_COMMISSION as TAUX_API } from '../../workers/src/commission.js';
import { repartition as repartitionApp, TAUX_COMMISSION as TAUX_APP } from '../../public/src/lib/commission.js';
import { PROFILS, ouvrirConnecte } from './outils.js';

const annonces = JSON.parse(readFileSync(new URL('../../specs/donnees/demo/annonces.json', import.meta.url), 'utf8'));
const disponible = annonces.find((a) => a.statut === 'disponible' && a.participation === 2 && a.offrantId !== PROFILS.offrantEtDemandeur);

test('5 % de commission, calculés au centime', () => {
  expect(repartitionApi(2)).toEqual({ participation: 2, commission: 0.1, partAssociation: 1.9 });
  expect(repartitionApi(1)).toEqual({ participation: 1, commission: 0.05, partAssociation: 0.95 });
  expect(repartitionApi(5)).toEqual({ participation: 5, commission: 0.25, partAssociation: 4.75 });
  // 0,50 € : 2,5 centimes arrondis a 3.
  expect(repartitionApi(0.5)).toEqual({ participation: 0.5, commission: 0.03, partAssociation: 0.47 });
});

test('L’API et l’app appliquent exactement la même règle', () => {
  expect(TAUX_API).toBe(TAUX_APP);
  for (let centimes = 1; centimes <= 3000; centimes++) {
    const montant = centimes / 100;
    const api = repartitionApi(montant);
    expect(repartitionApp(montant), `${montant} €`).toEqual(api);
    // Rien ne se perd : commission et part de l'association font la participation.
    expect(Math.round((api.commission + api.partAssociation) * 100)).toBe(centimes);
  }
});

test('Fiche : la part de l’association et la commission, avant de demander l’objet', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${disponible.id}`);
  await expect(page.getByText('1,90 € reversés à', { exact: false })).toBeVisible();
  await expect(page.getByText('dont 0,10 € de commission Donéo (5 %)')).toBeVisible();

  await page.getByRole('button', { name: /Réserver pour/ }).click();
  await expect(page.getByText('vous versez 2 €, dont 1,90 € pour l’association', { exact: false })).toBeVisible();
});

test('Création : l’offrant voit ce que recevra l’association', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await page.getByLabel('Titre de l’objet', { exact: true }).fill('Étagère bois 3 niveaux');
  await page.getByLabel('Catégorie', { exact: true }).selectOption({ label: 'Mobilier' });
  await page.getByLabel('Sous-catégorie', { exact: true }).selectOption({ index: 1 });
  await page.getByLabel('État', { exact: true }).selectOption({ label: 'Très bon état' });
  await page.getByLabel('Description', { exact: true }).fill('En pin massif, 80 × 30 × 90 cm.');
  await page.getByRole('button', { name: 'Continuer' }).click();

  await page.getByRole('button', { name: '2 €' }).click();
  await expect(page.getByText('L’association recevra 1,90 € (Donéo garde 5 %). Vous ne touchez rien.')).toBeVisible();
  await page.getByRole('button', { name: '5 €' }).click();
  await expect(page.getByText('L’association recevra 4,75 € (Donéo garde 5 %)', { exact: false })).toBeVisible();
});
