/**
 * US-10 (issue #38) — Afficher la météo du créneau sur la fiche.
 *
 * Le ticket n'a pas de critères Gherkin : les scénarios suivent
 * specs/openapi.yaml (météo pendant le créneau, `null` au-delà de l'horizon
 * de prévision). Le service Open-Meteo est simulé : pas d'appel réel, et on
 * choisit ce qu'il répond. Rien n'est écrit en base.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, attendrePasDeDefilementHorizontal, ouvrirConnecte } from './outils.js';

const SERVICE = '**/api.open-meteo.com/v1/forecast**';
const FICHE = '/annonces/demo-a-131';

/** Une réponse Open-Meteo : toutes les heures des jours demandés, au même temps. */
function prevision(route, { temperature = 11, pluie = 70, code = 80 } = {}) {
  const url = new URL(route.request().url());
  const heures = [];
  const fin = new Date(`${url.searchParams.get('end_date')}T23:00:00Z`);
  for (let h = new Date(`${url.searchParams.get('start_date')}T00:00:00Z`); h <= fin; h = new Date(h.getTime() + 3600_000)) {
    heures.push(h.toISOString().slice(0, 16));
  }
  return route.fulfill({
    json: {
      hourly: {
        time: heures,
        temperature_2m: heures.map(() => temperature),
        precipitation_probability: heures.map(() => pluie),
        weathercode: heures.map(() => code),
      },
    },
  });
}

test('Météo du créneau sur la fiche (cas nominal)', async ({ page }) => {
  let requete;
  await page.route(SERVICE, (route) => {
    requete = new URL(route.request().url());
    return prevision(route);
  });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, FICHE);

  await expect(page.getByText('Averses · 11 °C · pluie 70 %')).toBeVisible();
  // Seule la position approchée est envoyée, arrondie : jamais l'adresse exacte.
  expect(requete.searchParams.get('latitude')).toMatch(/^\d+\.\d{2}$/);
  expect(requete.searchParams.get('timezone')).toBe('UTC');
});

test('Service de météo indisponible : la fiche reste lisible, sans erreur', async ({ page }) => {
  await page.route(SERVICE, (route) => route.abort());
  await ouvrirConnecte(page, PROFILS.demandeurSeul, FICHE);

  await expect(page.getByRole('heading', { name: 'Créneau de retrait' })).toBeVisible();
  await expect(page.getByText(/°C/)).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Créneau trop lointain pour les prévisions : pas de météo', async ({ page }) => {
  // Open-Meteo répond 400 au-delà de son horizon de prévision.
  await page.route(SERVICE, (route) => route.fulfill({ status: 400, json: { error: true } }));
  await ouvrirConnecte(page, PROFILS.demandeurSeul, FICHE);

  await expect(page.getByRole('heading', { name: 'Créneau de retrait' })).toBeVisible();
  await expect(page.getByText(/°C/)).toHaveCount(0);
});

test('Créneau passé : aucune météo demandée', async ({ page }) => {
  let appels = 0;
  await page.route(SERVICE, (route) => {
    appels += 1;
    return prevision(route);
  });
  await page.route('**/api/annonces/demo-a-131', async (route) => {
    const reponse = await route.fetch();
    const annonce = await reponse.json();
    annonce.creneauRetrait = { debut: '2020-01-15T14:00:00.000Z', fin: '2020-01-15T16:00:00.000Z' };
    await route.fulfill({ response: reponse, json: annonce });
  });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, FICHE);

  await expect(page.getByText('Ce créneau est passé')).toBeVisible();
  await expect(page.getByText(/°C/)).toHaveCount(0);
  expect(appels).toBe(0);
});

test.describe('Petit écran', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test('Météo lisible, sans débordement (320 px)', async ({ page }) => {
    await page.route(SERVICE, (route) => prevision(route));
    await ouvrirConnecte(page, PROFILS.demandeurSeul, FICHE);
    await expect(page.getByText('Averses · 11 °C · pluie 70 %')).toBeVisible();
    await attendrePasDeDefilementHorizontal(page);
  });
});
