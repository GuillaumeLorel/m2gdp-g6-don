/**
 * #143 — Recherche par image : « Chercher avec une photo ».
 *
 * La photo est décrite par l'IA, puis la recherche existante prend le relais ;
 * rien n'est enregistré. Les deux routes de l'IA sont interceptées : aucun
 * appel à Google, aucun quota consommé.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, ouvrirConnecte } from './outils.js';

// Une vraie image (PNG de 1 pixel).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const photo = { name: 'objet.png', mimeType: 'image/png', buffer: PNG };

async function simuler(page, { actif = true, reponse = { status: 200, json: { nom: 'vélo', categorieId: 'sport', sousCategorieId: 'sport-velos' } } } = {}) {
  await page.route('**/api/ia/statut', (r) => r.fulfill({ status: 200, json: { brouillonAnnonce: actif, rechercheImage: actif } }));
  await page.route('**/api/annonces/recherche-par-image', (r) => r.fulfill(reponse));
}

test('Fonction coupée : le bouton photo n’apparaît pas', async ({ page }) => {
  await simuler(page, { actif: false });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await expect(page.getByRole('searchbox', { name: 'Rechercher un objet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chercher avec une photo' })).toHaveCount(0);
});

test('Photo reconnue : consentement exigé, puis la recherche existante est lancée', async ({ page }) => {
  await simuler(page);
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await page.getByRole('button', { name: 'Chercher avec une photo' }).click();

  const choisir = page.getByRole('button', { name: 'Prendre ou choisir une photo' });
  await expect(choisir).toBeDisabled();
  await expect(page.getByText(/envoyée à Google/)).toBeVisible();
  await page.getByLabel(/J’accepte que cette photo/).check();
  await expect(choisir).toBeEnabled();

  await page.getByLabel('Photo de l’objet à chercher').setInputFiles(photo);
  await expect(page.getByRole('searchbox', { name: 'Rechercher un objet' })).toHaveValue('vélo');
  // Le mot seul : aucun filtre de catégorie ne vient restreindre la recherche.
  await expect(page).toHaveURL(/q=v%C3%A9lo|q=vélo/);
  await expect(page).not.toHaveURL(/categorieId|sousCategorieId/);
  await expect(page.getByRole('group', { name: 'Chercher avec une photo' })).toHaveCount(0);
});

test('Photo non reconnue : message clair, recherche par mots toujours disponible', async ({ page }) => {
  await simuler(page, { reponse: { status: 422, json: { erreur: 'Cette photo n’a pas permis d’identifier un objet. Essayez une photo plus nette, ou cherchez par mots.' } } });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await page.getByRole('button', { name: 'Chercher avec une photo' }).click();
  await page.getByLabel(/J’accepte que cette photo/).check();
  await page.getByLabel('Photo de l’objet à chercher').setInputFiles(photo);

  await expect(page.getByRole('alert')).toContainText('cherchez par mots');
  await page.getByRole('button', { name: 'Fermer la recherche par photo' }).click();
  const champ = page.getByRole('searchbox', { name: 'Rechercher un objet' });
  await champ.fill('étagère');
  await expect(champ).toHaveValue('étagère');
});

test('Service IA en panne : la recherche par mots reste utilisable', async ({ page }) => {
  await simuler(page, { reponse: { status: 502, json: { erreur: 'L’analyse de la photo n’a pas abouti. La recherche par mots reste disponible.' } } });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await page.getByRole('button', { name: 'Chercher avec une photo' }).click();
  await page.getByLabel(/J’accepte que cette photo/).check();
  await page.getByLabel('Photo de l’objet à chercher').setInputFiles(photo);
  await expect(page.getByRole('alert')).toContainText('n’a pas abouti');
});
