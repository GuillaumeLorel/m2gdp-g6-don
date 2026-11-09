/**
 * Photo de profil, a l'inscription et dans « Modifier mon profil ».
 *
 * Fatou ajoute une photo, la retrouve sur son profil, puis la retire. Le
 * nettoyage d'apres-tests remet les profils de test sans photo.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, appelApi, ouvrirConnecte } from './outils.js';

test.describe.configure({ mode: 'serial' });

// Une vraie image (PNG de 1 pixel) : le navigateur doit pouvoir la decoder.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test('Ajouter une photo de profil, la retrouver sur le profil', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/profil/modifier');
  await page.getByRole('button', { name: 'Ajouter une photo de profil' }).waitFor();
  await page.locator('input[type="file"]').setInputFiles({ name: 'moi.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('img', { name: 'Votre photo de profil' })).toHaveAttribute('src', /\/storage\/v1\/object\/public\/medias\//);
  await expect(page.getByRole('button', { name: 'Changer la photo de profil' })).toBeVisible();

  await page.getByRole('button', { name: /Enregistrer/ }).click();
  await expect(page).toHaveURL(/\/profil$/);
  const { corps } = await appelApi(PROFILS.demandeurSeul, '/api/profil');
  expect(corps.photoUrl).toMatch(/\/storage\/v1\/object\/public\/medias\//);
  // L'en-tete du grand ecran porte aussi la photo, masque sur mobile : on prend celle visible.
  await expect(page.locator(`img[src="${corps.photoUrl}"]`).filter({ visible: true })).toBeVisible();
});

test('Retirer sa photo : les initiales reviennent', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/profil/modifier');
  await page.getByRole('button', { name: 'Retirer la photo' }).click();
  await expect(page.getByRole('button', { name: 'Ajouter une photo de profil' })).toBeVisible();
  await page.getByRole('button', { name: /Enregistrer/ }).click();
  await expect(page).toHaveURL(/\/profil$/);
  expect((await appelApi(PROFILS.demandeurSeul, '/api/profil')).corps.photoUrl).toBe('');
});

test('L’API refuse une photo de profil venue d’ailleurs', async () => {
  const { corps: profil } = await appelApi(PROFILS.demandeurSeul, '/api/profil');
  const { id, email, creeLe, misAJourLe, ...champs } = profil;
  const { statut, corps } = await appelApi(PROFILS.demandeurSeul, '/api/profil', {
    methode: 'PUT',
    corps: { ...champs, photoUrl: 'https://exemple.com/image.jpg' },
  });
  expect(statut).toBe(200);
  expect(corps.photoUrl).toBe('');
});
