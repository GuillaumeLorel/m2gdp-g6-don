/**
 * Messages non lus (demande du 09/11/2026) : un compteur sur l'onglet
 * Messages, et le nombre de non lus de chaque conversation.
 *
 * D'autres fichiers font echanger Fatou et Bastien en parallele : le comptage
 * se verifie donc conversation par conversation, et l'affichage de la
 * pastille avec un compteur fixe par le test.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, appelApi, ouvrirConnecte } from './outils.js';

test.describe.configure({ mode: 'serial' });

const ANNONCE = 'demo-a-008'; // Balance de cuisine, a Bastien, inutilisee ailleurs
const F = PROFILS.demandeurSeul;
const B = PROFILS.offrantEtDemandeur;

const nonLusDe = async (profil, conversationId) =>
  (await appelApi(profil, '/api/conversations')).corps.conversations.find((c) => c.id === conversationId)?.nonLus;
const lire = (profil, conversationId) => appelApi(profil, `/api/conversations/${conversationId}/messages`);

let conversation;
test.beforeAll(async () => {
  const { corps } = await appelApi(F, `/api/annonces/${ANNONCE}/conversation`, { methode: 'POST' });
  conversation = corps.id;
  await lire(F, conversation);
  await lire(B, conversation);
});

test('Un message reçu compte comme non lu, jusqu’à l’ouverture de la conversation', async () => {
  await appelApi(F, `/api/conversations/${conversation}/messages`, { methode: 'POST', corps: { contenu: 'Elle pèse jusqu’à combien ?' } });
  await appelApi(F, `/api/conversations/${conversation}/messages`, { methode: 'POST', corps: { contenu: 'Et elle a des piles ?' } });
  expect(await nonLusDe(B, conversation)).toBe(2);
  // Ses propres messages ne comptent jamais.
  expect(await nonLusDe(F, conversation)).toBe(0);

  await lire(B, conversation);
  expect(await nonLusDe(B, conversation)).toBe(0);
});

test('Un message système compte pour celui qu’il concerne', async () => {
  // La demande s'adresse a l'offrant : Bastien la voit, pas Fatou.
  const { statut, corps } = await appelApi(F, `/api/annonces/${ANNONCE}/reservations`, { methode: 'POST' });
  expect([201, 409]).toContain(statut);
  expect(await nonLusDe(B, conversation)).toBe(statut === 201 ? 1 : 0);
  expect(await nonLusDe(F, conversation)).toBe(0);
  if (statut === 201) await appelApi(F, `/api/reservations/${corps.id}/renonciation`, { methode: 'POST' });
  await lire(B, conversation);
});

test('Le compteur du serveur reprend les conversations non lues', async () => {
  await appelApi(F, `/api/conversations/${conversation}/messages`, { methode: 'POST', corps: { contenu: 'Merci !' } });
  const { corps } = await appelApi(B, '/api/notifications');
  expect(corps.conversationsNonLues).toBeGreaterThanOrEqual(1);
  expect(corps.messagesNonLus).toBeGreaterThanOrEqual(1);
  await lire(B, conversation);
});

const compteur = (page, n) =>
  page.route('**/api/notifications', (r) => r.fulfill({ json: { conversationsNonLues: n, messagesNonLus: n } }));

test('Pastille sur l’onglet Messages du menu du bas', async ({ page }) => {
  await compteur(page, 3);
  await ouvrirConnecte(page, B);
  const menu = page.getByRole('navigation', { name: 'Navigation principale' });
  const lien = menu.getByRole('link', { name: 'Messages, 3 conversations non lues' });
  await expect(lien).toBeVisible();
  await expect(lien.getByTestId('pastille-non-lus')).toHaveText('3');
});

test('Au-delà de 9 : « 9+ » ; sans non lu : pas de pastille', async ({ page }) => {
  await compteur(page, 12);
  await ouvrirConnecte(page, B);
  // Le menu visible : l'en-tete du grand ecran est masque sur mobile.
  const menu = page.getByRole('navigation', { name: 'Navigation principale' });
  await expect(menu.getByTestId('pastille-non-lus')).toHaveText('9+');

  await page.unroute('**/api/notifications');
  await compteur(page, 0);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Messages', exact: true })).toBeVisible();
  await expect(page.getByTestId('pastille-non-lus')).toHaveCount(0);
});

test('Liste des conversations : les non lues ressortent, avec leur nombre', async ({ page }) => {
  await appelApi(F, `/api/conversations/${conversation}/messages`, { methode: 'POST', corps: { contenu: 'Je passe samedi ?' } });
  await ouvrirConnecte(page, B, '/messages');
  const carte = page.getByRole('link').filter({ hasText: 'Je passe samedi ?' });
  await expect(carte.getByText('1 message non lu')).toBeAttached();

  await carte.click();
  await expect(page.getByText('Je passe samedi ?')).toBeVisible();
  await expect.poll(() => nonLusDe(B, conversation)).toBe(0);
});

test('Grand écran : la pastille est aussi dans l’en-tête', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await compteur(page, 2);
  await ouvrirConnecte(page, B);
  const lien = page.getByRole('link', { name: 'Messages, 2 conversations non lues' });
  await expect(lien).toBeVisible();
  await expect(lien.getByTestId('pastille-non-lus')).toHaveText('2');
});
