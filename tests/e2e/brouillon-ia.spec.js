/**
 * EPIC 12 (#29) — Création d'annonce assistée par IA : « Remplir avec l'IA ».
 *
 * L'IA rédige un brouillon, elle ne publie jamais. Ces tests interceptent les
 * deux routes de l'assistant : aucun appel à Google, aucun quota consommé.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, appelApi, ouvrirConnecte } from './outils.js';

// Une vraie image (PNG de 1 pixel) : le navigateur doit pouvoir la decoder.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const BROUILLON = {
  titre: 'Vélo de ville bleu',
  description: 'Vélo de ville de couleur bleue, en bon état de fonctionnement.',
  categorieId: 'sport',
  sousCategorieId: 'sport-velos',
  etat: 'bon_etat',
  participationConseillee: 3,
  champsIncertains: ['etat', 'creneauRetrait'],
};

async function simuler(page, { actif = true, reponse = { status: 200, json: BROUILLON } } = {}) {
  await page.route('**/api/ia/statut', (r) => r.fulfill({ status: 200, json: { brouillonAnnonce: actif } }));
  await page.route('**/api/ia/brouillon-annonce', (r) => r.fulfill(reponse));
}

const champ = (page, nom) => page.getByLabel(nom, { exact: true });

test('Fonction coupée : le bouton « Remplir avec l’IA » n’apparaît pas', async ({ page }) => {
  await simuler(page, { actif: false });
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await expect(page.getByText('Étape 1 sur 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remplir avec l’IA' })).toHaveCount(0);
});

test('Le consentement est exigé avant l’envoi, puis le formulaire est prérempli', async ({ page }) => {
  await simuler(page);
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await page.getByRole('button', { name: 'Remplir avec l’IA' }).click();

  const generer = page.getByRole('button', { name: 'Générer un brouillon' });
  await page.getByLabel(/Décrivez l’objet en une phrase/).fill('vélo de ville bleu, bon état');
  await expect(generer).toBeDisabled();
  await expect(page.getByText(/envoyés à Google/)).toBeVisible();
  await page.getByLabel(/J’accepte que ce texte/).check();
  await expect(generer).toBeEnabled();
  await generer.click();

  await expect(champ(page, 'Titre de l’objet')).toHaveValue('Vélo de ville bleu');
  await expect(champ(page, 'Description')).toHaveValue(/Vélo de ville de couleur bleue/);
  await expect(champ(page, 'Sous-catégorie')).toHaveValue('sport-velos');
  // L'IA n'a pas su déduire l'état : le champ est signalé, pas deviné.
  await expect(champ(page, 'État')).toHaveClass(/border-alerte/);
  await expect(champ(page, 'Titre de l’objet')).not.toHaveClass(/border-alerte/);
  // Corriger le champ retire la mise en évidence.
  await champ(page, 'État').selectOption({ label: 'Très bon état' });
  await expect(champ(page, 'État')).not.toHaveClass(/border-alerte/);
  // Rien n'est publié : on reste sur le formulaire.
  await expect(page.getByText('Étape 1 sur 2')).toBeVisible();
});

test('Des photos suffisent : pas besoin de texte pour générer un brouillon', async ({ page }) => {
  await simuler(page);
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await page.getByRole('button', { name: 'Remplir avec l’IA' }).click();
  const generer = page.getByRole('button', { name: 'Générer un brouillon' });
  await page.getByLabel(/J’accepte que ce texte/).check();
  // Ni texte ni photo : rien à envoyer.
  await expect(generer).toBeDisabled();
  await page.getByRole('button', { name: 'Annuler' }).click();
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'objet.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Remplir avec l’IA' }).click();
  await page.getByLabel(/J’accepte que ce texte/).check();
  await expect(generer).toBeEnabled();
  await generer.click();
  await expect(champ(page, 'Titre de l’objet')).toHaveValue('Vélo de ville bleu');
});

test('La participation est une suggestion que l’offrant garde la main sur', async ({ page }) => {
  await simuler(page);
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await page.getByRole('button', { name: 'Remplir avec l’IA' }).click();
  await page.getByLabel(/Décrivez l’objet en une phrase/).fill('vélo de ville bleu, bon état');
  await page.getByLabel(/J’accepte que ce texte/).check();
  await page.getByRole('button', { name: 'Générer un brouillon' }).click();
  await champ(page, 'État').selectOption({ label: 'Bon état' });
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expect(page.getByText(/viennent de l’assistant, à titre de suggestion/)).toBeVisible();
  await expect(champ(page, 'Participation solidaire (€)')).toHaveValue('3');
  await champ(page, 'Participation solidaire (€)').fill('2');
  await expect(champ(page, 'Participation solidaire (€)')).toHaveValue('2');
});

test('Service IA en panne : message clair, formulaire manuel toujours disponible', async ({ page }) => {
  await simuler(page, { reponse: { status: 502, json: { erreur: 'L’assistant ne répond pas. Remplissez le formulaire à la main.' } } });
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await page.getByRole('button', { name: 'Remplir avec l’IA' }).click();
  await page.getByLabel(/Décrivez l’objet en une phrase/).fill('vélo de ville bleu');
  await page.getByLabel(/J’accepte que ce texte/).check();
  await page.getByRole('button', { name: 'Générer un brouillon' }).click();

  await expect(page.getByRole('alert')).toContainText('Remplissez le formulaire à la main');
  await page.getByRole('button', { name: 'Annuler' }).click();
  await champ(page, 'Titre de l’objet').fill('Étagère');
  await expect(champ(page, 'Titre de l’objet')).toHaveValue('Étagère');
});

test('Route du Worker : refusée sans connexion, texte trop court refusé', async ({ request }) => {
  const sansJeton = await request.post(`${process.env.DONEO_API || 'http://localhost:8787'}/api/ia/brouillon-annonce`, {
    data: { texte: 'vélo' },
  });
  expect(sansJeton.status()).toBe(401);

  const court = await appelApi(PROFILS.offrantEtDemandeur, '/api/ia/brouillon-annonce', { methode: 'POST', corps: { texte: 'a' } });
  // 422 si la fonction est active, 503 si l'interrupteur la coupe : jamais d'appel à Google ici.
  expect([422, 503]).toContain(court.statut);
});

test('Le consentement n’est demandé qu’une fois, et peut être retiré', async ({ page }) => {
  await simuler(page);
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await page.getByRole('button', { name: 'Remplir avec l’IA' }).click();
  await page.getByLabel(/Décrivez l’objet en une phrase/).fill('vélo de ville bleu');
  await page.getByLabel(/J’accepte que ce texte/).check();
  await page.getByRole('button', { name: 'Générer un brouillon' }).click();
  await expect(champ(page, 'Titre de l’objet')).toHaveValue('Vélo de ville bleu');

  // Deuxième usage : plus de case à cocher, le bouton est actif d'emblée.
  await page.getByRole('button', { name: 'Refaire un brouillon avec l’IA' }).click();
  await page.getByLabel(/Décrivez l’objet en une phrase/).fill('lampe de bureau');
  await expect(page.getByLabel(/J’accepte que ce texte/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Générer un brouillon' })).toBeEnabled();

  // Même après rechargement de la page : l'accord est retenu.
  await page.reload();
  await page.getByRole('button', { name: 'Remplir avec l’IA' }).click();
  await expect(page.getByLabel(/J’accepte que ce texte/)).toHaveCount(0);

  // Le retirer ramène la case.
  await page.getByRole('button', { name: 'Retirer mon accord' }).click();
  await expect(page.getByLabel(/J’accepte que ce texte/)).toBeVisible();
  await page.getByLabel(/Décrivez l’objet en une phrase/).fill('lampe de bureau');
  await expect(page.getByRole('button', { name: 'Générer un brouillon' })).toBeDisabled();
});
