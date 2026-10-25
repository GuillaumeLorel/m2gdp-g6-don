/**
 * US-6 (issue #34) — Créer une annonce en deux étapes avec photos ;
 * US-7 (#35) — fixer la participation et le créneau ;
 * US-8 (#36) — préremplir l'adresse de retrait depuis le profil.
 *
 * Les annonces publiees ici partent dans la vraie base : elles sont
 * supprimees a la fin (supprimerAnnonces).
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PROFILS, attendrePasDeDefilementHorizontal, ouvrirConnecte, supprimerAnnonces } from './outils.js';

const bastien = JSON.parse(
  readFileSync(new URL('../../specs/donnees/demo/utilisateurs.json', import.meta.url), 'utf8'),
).find((u) => u.id === PROFILS.offrantEtDemandeur);

// Une vraie image (PNG de 1 pixel) : le navigateur doit pouvoir la decoder.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const photo = (nom = 'etagere.png') => ({ name: nom, mimeType: 'image/png', buffer: PNG });

const publiees = [];
test.afterAll(() => supprimerAnnonces(publiees));

const champ = (page, nom) => page.getByLabel(nom, { exact: true });
const ajouterPhotos = (page, fichiers) => page.locator('input[type="file"]').setInputFiles(fichiers);

async function remplirEtape1(page) {
  await champ(page, 'Titre de l’objet').fill('Étagère bois 3 niveaux');
  await champ(page, 'Catégorie').selectOption({ label: 'Mobilier' });
  await champ(page, 'Sous-catégorie').selectOption({ index: 1 });
  await champ(page, 'État').selectOption({ label: 'Très bon état' });
  await champ(page, 'Description').fill('En pin massif, 80 × 30 × 90 cm. Démontable pour le transport.');
}

test('Publier une annonce complète (cas nominal)', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Créer' }).click();
  await expect(page.getByText('Étape 1 sur 2')).toBeVisible();

  await ajouterPhotos(page, [photo()]);
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();
  await remplirEtape1(page);
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expect(page.getByText('Étape 2 sur 2')).toBeVisible();
  await page.getByRole('button', { name: '2 €' }).click();
  await champ(page, 'Association soutenue').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Publier l’annonce' }).click();

  await expect(page).toHaveURL(/\/annonces\/[0-9a-f-]{36}$/);
  publiees.push(page.url().split('/').pop());
  await expect(page.getByRole('status')).toContainText('Votre annonce est en ligne');
  await expect(page.getByRole('heading', { level: 1, name: 'Étagère bois 3 niveaux' })).toBeVisible();
  await expect(page.locator('img[src*="/api/medias/"]').first()).toBeVisible();
  // Disponible : ni bandeau « réservé », ni « trouvé preneur ».
  await expect(page.getByText(/déjà réservé|trouvé preneur/)).toHaveCount(0);
});

test('Titre manquant : message sous le champ, « Continuer » bloqué', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await remplirEtape1(page);
  await champ(page, 'Titre de l’objet').fill('');
  await champ(page, 'Titre de l’objet').blur();
  await expect(page.getByText('Le titre est obligatoire')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();
});

test('Seules les sous-catégories de la catégorie choisie sont proposées', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await expect(champ(page, 'Sous-catégorie')).toBeDisabled();
  await champ(page, 'Catégorie').selectOption({ label: 'Mobilier' });
  const sousCategories = await champ(page, 'Sous-catégorie').locator('option:not([disabled])').allTextContents();
  expect(sousCategories.length).toBeGreaterThan(0);
  expect(sousCategories).toContain('Tables et bureaux');
  expect(sousCategories).not.toContain('Vaisselle');
});

test('Ajouter et retirer une photo', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await ajouterPhotos(page, [photo()]);
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Retirer la photo 1' }).click();
  await expect(page.getByRole('img', { name: 'Photo 1' })).toHaveCount(0);
});

test('Photo refusée (format ou poids) : message clair, saisie conservée', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await champ(page, 'Titre de l’objet').fill('Lampe de bureau');

  await ajouterPhotos(page, [{ name: 'animation.gif', mimeType: 'image/gif', buffer: PNG }]);
  await expect(page.getByRole('alert')).toContainText('format non pris en charge');

  // 6 Mo qui ne se decodent pas : impossible a reduire, donc trop lourd.
  await ajouterPhotos(page, [{ name: 'enorme.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(6 * 1024 * 1024) }]);
  await expect(page.getByRole('alert')).toContainText('trop lourde');

  await expect(champ(page, 'Titre de l’objet')).toHaveValue('Lampe de bureau');
  await expect(page.getByRole('img', { name: /^Photo/ })).toHaveCount(0);
});

test('Au bout de 8 photos, le bouton d’ajout disparaît', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await ajouterPhotos(page, Array.from({ length: 8 }, (_, i) => photo(`photo-${i + 1}.png`)));
  await expect(page.getByRole('img', { name: /^Photo \d$/ })).toHaveCount(8);
  await expect(page.getByRole('button', { name: 'Ajouter des photos' })).toHaveCount(0);
});

test('Revenir de l’étape 2 conserve toute l’étape 1', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await ajouterPhotos(page, [photo()]);
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();
  await remplirEtape1(page);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Revenir à l’étape 1' }).click();

  await expect(champ(page, 'Titre de l’objet')).toHaveValue('Étagère bois 3 niveaux');
  await expect(champ(page, 'Catégorie')).toHaveValue('mobilier');
  await expect(champ(page, 'Sous-catégorie')).not.toHaveValue('');
  await expect(champ(page, 'État')).toHaveValue('tres_bon_etat');
  await expect(champ(page, 'Description')).toHaveValue(/pin massif/);
  await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();
});

test('Refus du serveur : toutes les erreurs en une fois, saisie conservée', async ({ page }) => {
  await page.route('**/api/annonces', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 422,
          json: { erreurs: ['Le titre est trop long (80 caractères au plus).', 'La ville est obligatoire.'] },
        })
      : route.continue(),
  );
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await remplirEtape1(page);
  await page.getByRole('button', { name: 'Continuer' }).click();
  await champ(page, 'Participation solidaire (€)').fill('3');
  await champ(page, 'Association soutenue').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Publier l’annonce' }).click();

  const alerte = page.getByRole('alert');
  await expect(alerte).toContainText('Le titre est trop long');
  await expect(alerte).toContainText('La ville est obligatoire');
  await expect(champ(page, 'Participation solidaire (€)')).toHaveValue('3');
});

test('Compte sans rôle offrant : invitation à ajouter le rôle', async ({ page }) => {
  // Le profil est presente comme « demandeur » seul ; l'ajout du role, lui,
  // part vraiment au serveur (le profil de test a deja les deux roles).
  await page.route('**/api/profil', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const reponse = await route.fetch();
    return route.fulfill({ response: reponse, json: { ...(await reponse.json()), roles: ['demandeur'] } });
  });
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
  await expect(page.getByText('Devenez offrant pour donner un objet')).toBeVisible();
  await expect(page.getByText('Ajoutez le rôle offrant à votre profil')).toBeVisible();

  await page.getByRole('button', { name: 'Ajouter le rôle offrant' }).click();
  await expect(page.getByText('Étape 1 sur 2')).toBeVisible();
});

test.describe('US-7 — Participation et créneau', () => {
  test.beforeEach(async ({ page }) => {
    await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/creer');
    await remplirEtape1(page);
    await page.getByRole('button', { name: 'Continuer' }).click();
  });

  test('Participation nulle refusée ; un montant suggéré se choisit d’un geste', async ({ page }) => {
    const participation = champ(page, 'Participation solidaire (€)');
    await participation.fill('0');
    await participation.blur();
    await expect(page.getByText('Indiquez une participation supérieure à 0 €')).toBeVisible();
    await page.getByRole('button', { name: '5 €' }).click();
    await expect(participation).toHaveValue('5');
    await expect(page.getByText('Indiquez une participation supérieure à 0 €')).toHaveCount(0);
  });

  test('Créneau incohérent : message et publication bloquée', async ({ page }) => {
    await champ(page, 'Participation solidaire (€)').fill('2');
    await champ(page, 'Association soutenue').selectOption({ index: 1 });
    await expect(page.getByRole('button', { name: 'Publier l’annonce' })).toBeEnabled();

    await champ(page, 'À').fill('17:00');
    await expect(page.getByText('L’heure de fin doit suivre l’heure de début.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publier l’annonce' })).toBeDisabled();

    await champ(page, 'À').fill('20:00');
    await champ(page, 'Jour').fill('2020-01-15');
    await expect(page.getByText('Le créneau doit commencer dans le futur.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publier l’annonce' })).toBeDisabled();
  });

  test('US-8 — L’adresse de retrait est préremplie depuis le profil', async ({ page }) => {
    await expect(champ(page, 'N°')).toHaveValue(bastien.numeroRue);
    await expect(champ(page, 'Rue')).toHaveValue(bastien.rue);
    await expect(champ(page, 'Complément (facultatif)')).toHaveValue(bastien.complementAdresse);
    await expect(champ(page, 'Code postal')).toHaveValue(bastien.codePostal);
    await expect(champ(page, 'Ville')).toHaveValue(bastien.ville);
    await expect(page.getByText('ne voit que le code postal et la ville')).toBeVisible();
    await attendrePasDeDefilementHorizontal(page);
  });
});
