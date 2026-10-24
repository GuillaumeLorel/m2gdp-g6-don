/**
 * Connexion par e-mail : le lien pointe sur l'app (?token_hash=…), sans
 * adresse supabase.co que les filtres anti-spam rejettent, et un code a
 * 6 chiffres sert de repli. Les tests s'enchainent : chaque nouvel e-mail
 * invalide le precedent.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, contenuEmailDeConnexion, emailDe } from './outils.js';

test.describe.configure({ mode: 'serial' });

const navigation = (page) => page.getByRole('navigation', { name: 'Navigation principale' });

/** Remplit l'ecran de connexion sans envoyer de vrai e-mail. */
async function demanderUnLien(page) {
  await page.route('**/auth/v1/otp**', (route) => route.fulfill({ status: 200, json: {} }));
  await page.goto('/');
  await page.getByLabel('Adresse e-mail').fill(emailDe(PROFILS.connexion));
  await page.getByRole('button', { name: 'Recevoir le lien magique' }).click();
  await expect(page.getByRole('heading', { name: 'Consultez vos e-mails' })).toBeVisible();
}

test('Le lien de l’e-mail ouvre la session', async ({ page }) => {
  const { jeton } = await contenuEmailDeConnexion(PROFILS.connexion);
  await page.goto(`/?token_hash=${jeton}&type=email`);
  await expect(navigation(page)).toBeVisible();
  // Le jeton ne reste pas dans l'adresse.
  expect(page.url()).not.toContain('token_hash');
});

test('Un lien déjà utilisé mène à l’écran dédié', async ({ page, browser, baseURL }) => {
  const { jeton } = await contenuEmailDeConnexion(PROFILS.connexion);
  await page.goto(`/?token_hash=${jeton}&type=email`);
  await expect(navigation(page)).toBeVisible();

  // Second clic sur le meme lien, depuis un autre navigateur.
  const autreNavigateur = await browser.newContext({ baseURL });
  const autre = await autreNavigateur.newPage();
  await autre.goto(`/?token_hash=${jeton}&type=email`);
  await expect(autre.getByRole('heading', { name: /Ce lien/ })).toBeVisible();
  await autreNavigateur.close();
});

test('Le code à 6 chiffres ouvre la session', async ({ page }) => {
  await demanderUnLien(page);
  const { code } = await contenuEmailDeConnexion(PROFILS.connexion);
  await page.getByLabel('Ou saisissez le code reçu').fill(code);
  await page.getByRole('button', { name: 'Valider le code' }).click();
  await expect(navigation(page)).toBeVisible();
});

test('Un code faux est refusé avec un message clair', async ({ page }) => {
  await demanderUnLien(page);
  await contenuEmailDeConnexion(PROFILS.connexion);
  await page.getByLabel('Ou saisissez le code reçu').fill('000000');
  await page.getByRole('button', { name: 'Valider le code' }).click();
  await expect(page.getByRole('alert')).toHaveText(/incorrect ou a expiré/);
  await expect(navigation(page)).toHaveCount(0);
});
