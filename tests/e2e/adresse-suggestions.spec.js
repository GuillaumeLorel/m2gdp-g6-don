/**
 * US-49 (issue #129) — Compléter automatiquement l'adresse à la saisie.
 * Un test par scénario Gherkin de l'issue.
 *
 * Le service d'adresses de l'IGN est simulé : pas d'appel réel, et on choisit
 * ce qu'il répond. Rien n'est enregistré : les formulaires ne sont pas envoyés.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, attendrePasDeDefilementHorizontal, ouvrirConnecte } from './outils.js';

const SERVICE = '**/data.geopf.fr/geocodage/search**';

const feature = (label, housenumber, street, postcode, city) => ({
  type: 'Feature',
  properties: { label, housenumber, street, name: `${housenumber} ${street}`, postcode, city, type: 'housenumber' },
});

const SUGGESTIONS = {
  type: 'FeatureCollection',
  features: [
    feature('12 Rue de la République 69002 Lyon', '12', 'Rue de la République', '69002', 'Lyon'),
    feature('12 Rue de la République 69330 Meyzieu', '12', 'Rue de la République', '69330', 'Meyzieu'),
  ],
};

const champ = (page, nom) => page.getByLabel(nom, { exact: true });
const recherche = (page) => page.getByRole('combobox', { name: 'Chercher mon adresse' });

async function ouvrirEtape2(page) {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await champ(page, 'Titre de l’objet').fill('Étagère bois 3 niveaux');
  await champ(page, 'Catégorie').selectOption({ label: 'Mobilier' });
  await champ(page, 'Sous-catégorie').selectOption({ index: 1 });
  await champ(page, 'État').selectOption({ label: 'Très bon état' });
  await champ(page, 'Description').fill('En pin massif, 80 × 30 × 90 cm. Démontable pour le transport.');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByText('Étape 2 sur 2')).toBeVisible();
}

async function taper(page, texte) {
  await recherche(page).click();
  await recherche(page).fill(texte);
}

test('Choisir une suggestion (cas nominal)', async ({ page }) => {
  let requete;
  await page.route(SERVICE, (route) => {
    requete = new URL(route.request().url());
    return route.fulfill({ json: SUGGESTIONS });
  });
  await ouvrirEtape2(page);
  await taper(page, '12 rue de la rep');

  const options = page.getByRole('listbox', { name: 'Adresses suggérées' }).getByRole('option');
  await expect(options).toHaveCount(2);
  await expect(options.first()).toHaveText('12 Rue de la République 69002 Lyon');
  // La recherche est centrée sur Lyon : sans cela, la première suggestion est à Toulouse.
  expect(requete.searchParams.get('lat')).toBe('45.76');
  expect(requete.searchParams.get('lon')).toBe('4.84');
  expect(requete.searchParams.get('autocomplete')).toBe('1');

  // Le complément (prérempli depuis le profil) n'est jamais écrasé par une suggestion.
  const complement = await champ(page, 'Complément (facultatif)').inputValue();
  await options.first().click();
  await expect(champ(page, 'N°')).toHaveValue('12');
  await expect(champ(page, 'Rue')).toHaveValue('Rue de la République');
  await expect(champ(page, 'Code postal')).toHaveValue('69002');
  await expect(champ(page, 'Ville')).toHaveValue('Lyon');
  await expect(champ(page, 'Complément (facultatif)')).toHaveValue(complement);
  await expect(page.getByRole('listbox', { name: 'Adresses suggérées' }).getByRole('option')).toHaveCount(0);
});

test('Mêmes suggestions à l’inscription et à la modification du profil', async ({ page }) => {
  await page.route(SERVICE, (route) => route.fulfill({ json: SUGGESTIONS }));
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/profil/modifier');
  await taper(page, '12 rue de la rep');
  await expect(page.getByRole('listbox', { name: 'Adresses suggérées' }).getByRole('option')).toHaveCount(2);

  await page.getByRole('listbox', { name: 'Adresses suggérées' }).getByRole('option').nth(1).click();
  await expect(champ(page, 'N°')).toHaveValue('12');
  await expect(champ(page, 'Rue')).toHaveValue('Rue de la République');
  await expect(champ(page, 'Code postal')).toHaveValue('69330');
  await expect(champ(page, 'Ville')).toHaveValue('Meyzieu');
});

test('Adresse introuvable : les champs se remplissent à la main', async ({ page }) => {
  await page.route(SERVICE, (route) => route.fulfill({ json: { type: 'FeatureCollection', features: [] } }));
  await ouvrirEtape2(page);
  const demande = page.waitForRequest(SERVICE);
  await taper(page, 'Chemin des Lutins 99');
  await demande;
  await expect(page.getByRole('listbox', { name: 'Adresses suggérées' }).getByRole('option')).toHaveCount(0);

  await champ(page, 'N°').fill('99');
  await champ(page, 'Rue').fill('Chemin des Lutins');
  await champ(page, 'Code postal').fill('69100');
  await champ(page, 'Ville').fill('Villeurbanne');
  await expect(champ(page, 'Ville')).toHaveValue('Villeurbanne');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Service indisponible : saisie à la main, sans erreur bloquante', async ({ page }) => {
  await page.route(SERVICE, (route) => route.abort());
  await ouvrirEtape2(page);
  await taper(page, '12 rue de la rep');
  await expect(page.getByRole('listbox', { name: 'Adresses suggérées' }).getByRole('option')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);

  await champ(page, 'N°').fill('12');
  await champ(page, 'Rue').fill('Rue de la République');
  await expect(champ(page, 'Rue')).toHaveValue('Rue de la République');
});

test.describe('Petit écran', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test('Suggestions lisibles, sans débordement (320 px)', async ({ page }) => {
    await page.route(SERVICE, (route) => route.fulfill({ json: SUGGESTIONS }));
    await ouvrirEtape2(page);
    await taper(page, '12 rue de la rep');
    await expect(page.getByRole('listbox', { name: 'Adresses suggérées' }).getByRole('option')).toHaveCount(2);
    await expect(page.getByRole('listbox', { name: 'Adresses suggérées' }).getByRole('option').first()).toBeVisible();
    await attendrePasDeDefilementHorizontal(page);
  });
});
