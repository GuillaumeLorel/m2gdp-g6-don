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

/** Choisit la photo, puis la valide telle quelle dans la fenêtre de recadrage. */
async function envoyerPhoto(page) {
  await page.getByLabel('Photo de l’objet à chercher').setInputFiles(photo);
  await page.getByRole('button', { name: 'Toute la photo' }).click();
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

  await envoyerPhoto(page);
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
  await envoyerPhoto(page);

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
  await envoyerPhoto(page);
  await expect(page.getByRole('alert')).toContainText('n’a pas abouti');
});

test('Le consentement de la recherche par photo n’est demandé qu’une fois', async ({ page }) => {
  await simuler(page);
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await page.getByRole('button', { name: 'Chercher avec une photo' }).click();
  await page.getByLabel(/J’accepte que cette photo/).check();
  await envoyerPhoto(page);
  await expect(page.getByRole('searchbox', { name: 'Rechercher un objet' })).toHaveValue('vélo');

  // Nouvelle recherche : vider le champ, rouvrir : plus de case, bouton actif.
  await page.getByRole('button', { name: 'Effacer la recherche' }).click();
  await page.getByRole('button', { name: 'Chercher avec une photo' }).click();
  await expect(page.getByLabel(/J’accepte que cette photo/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Prendre ou choisir une photo' })).toBeEnabled();

  await page.getByRole('button', { name: 'Retirer mon accord' }).click();
  await expect(page.getByLabel(/J’accepte que cette photo/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prendre ou choisir une photo' })).toBeDisabled();
});

/** Largeur et hauteur d'un JPEG, lues dans son en-tête (marqueur SOF). */
function dimensionsJpeg(octets) {
  for (let i = 0; i < octets.length - 9; i++) {
    if (octets[i] === 0xff && [0xc0, 0xc1, 0xc2].includes(octets[i + 1]) && octets[i + 4] === 8) {
      return { hauteur: (octets[i + 5] << 8) | octets[i + 6], largeur: (octets[i + 7] << 8) | octets[i + 8] };
    }
  }
  return null;
}

/** Une image de 400 × 200 px, moitié gauche rouge, moitié droite bleue. */
async function grandeImage(page) {
  const base64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = '#d33';
    g.fillRect(0, 0, 200, 200);
    g.fillStyle = '#33d';
    g.fillRect(200, 0, 200, 200);
    return c.toDataURL('image/png').split(',')[1];
  });
  return { name: 'objet.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

test('Recadrage : la fenêtre s’ouvre, « Annuler » n’envoie rien', async ({ page }) => {
  await simuler(page);
  let envois = 0;
  await page.route('**/api/annonces/recherche-par-image', (r) => {
    envois += 1;
    return r.fulfill({ status: 200, json: { nom: 'vélo', categorieId: 'sport', sousCategorieId: 'sport-velos' } });
  });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await page.getByRole('button', { name: 'Chercher avec une photo' }).click();
  await page.getByLabel(/J’accepte que cette photo/).check();
  await page.getByLabel('Photo de l’objet à chercher').setInputFiles(photo);

  const fenetre = page.getByRole('dialog', { name: 'Choisir la zone à chercher' });
  await expect(fenetre).toBeVisible();
  await expect(fenetre.getByTestId('cadre-recadrage')).toBeVisible();
  await fenetre.getByRole('button', { name: 'Annuler' }).click();
  await expect(fenetre).toHaveCount(0);
  expect(envois).toBe(0);
});

test('Recadrage : seule la zone choisie est envoyée, la photo entière sinon', async ({ page }) => {
  await simuler(page);
  const largeurs = [];
  await page.route('**/api/annonces/recherche-par-image', async (r) => {
    const octets = r.request().postDataBuffer();
    largeurs.push(dimensionsJpeg(octets));
    await r.fulfill({ status: 200, json: { nom: 'vélo', categorieId: 'sport', sousCategorieId: 'sport-velos' } });
  });
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  const image = await grandeImage(page);

  // Toute la photo : 400 × 200.
  await page.getByRole('button', { name: 'Chercher avec une photo' }).click();
  await page.getByLabel(/J’accepte que cette photo/).check();
  await page.getByLabel('Photo de l’objet à chercher').setInputFiles(image);
  await page.getByRole('button', { name: 'Toute la photo' }).click();
  await expect(page.getByRole('searchbox', { name: 'Rechercher un objet' })).toHaveValue('vélo');
  expect(largeurs[0]).toEqual({ largeur: 400, hauteur: 200 });

  // Une zone plus petite : on tire le coin bas droit vers le centre.
  await page.getByRole('button', { name: 'Effacer la recherche' }).click();
  await page.getByRole('button', { name: 'Chercher avec une photo' }).click();
  await page.getByLabel('Photo de l’objet à chercher').setInputFiles(image);
  const cadre = page.getByTestId('cadre-recadrage');
  await expect(cadre).toBeVisible();
  const coin = await page.locator('[data-coin="se"]').boundingBox();
  const depart = { x: coin.x + coin.width / 2, y: coin.y + coin.height / 2 };
  await page.mouse.move(depart.x, depart.y);
  await page.mouse.down();
  await page.mouse.move(depart.x - 60, depart.y - 25, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Chercher sur la sélection' }).click();
  await expect(page.getByRole('searchbox', { name: 'Rechercher un objet' })).toHaveValue('vélo');

  expect(largeurs).toHaveLength(2);
  // Cadre de départ : 80 % de l'image, soit 320 × 160 ; le coin tiré le réduit.
  expect(largeurs[1].largeur).toBeLessThan(320);
  expect(largeurs[1].hauteur).toBeLessThan(160);
  expect(largeurs[1].largeur / largeurs[1].hauteur).toBeGreaterThan(0.5);
});
