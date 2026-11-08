/**
 * US-20 (#48) — Filtrer les annonces autour d'une adresse.
 *
 * Côté Worker : filtre par rayon, tri par proximité, `distanceKm` arrondi à
 * 0,5 km et calculé sur la position approchée, erreurs 422. Côté écran :
 * « Ma ville » ou une autre adresse, puis un rayon.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, appelApi, attendrePasDeDefilementHorizontal, ouvrirConnecte } from './outils.js';

const LYON = 'latitude=45.76&longitude=4.84';
const chercher = (requete) => appelApi(PROFILS.demandeurSeul, `/api/annonces?${requete}`);

test.describe('API', () => {
  test('Le rayon filtre, chaque annonce porte sa distance arrondie à 0,5 km', async () => {
    const { statut, corps } = await chercher(`${LYON}&rayonKm=2&parPage=50`);
    expect(statut).toBe(200);
    expect(corps.annonces.length).toBeGreaterThan(0);
    for (const a of corps.annonces) {
      expect(a.distanceKm).toBeLessThanOrEqual(2);
      expect(a.distanceKm * 2).toBe(Math.round(a.distanceKm * 2)); // multiple de 0,5
    }
  });

  test('Un rayon plus petit ne renvoie pas plus d’annonces', async () => {
    const petit = (await chercher(`${LYON}&rayonKm=0.5`)).corps.total;
    const moyen = (await chercher(`${LYON}&rayonKm=2`)).corps.total;
    const grand = (await chercher(`${LYON}&rayonKm=50`)).corps.total;
    expect(petit).toBeLessThanOrEqual(moyen);
    expect(moyen).toBeLessThanOrEqual(grand);
  });

  test('Loin de tout : aucune annonce, sans erreur', async () => {
    const { statut, corps } = await chercher('latitude=43.30&longitude=5.37&rayonKm=5'); // Marseille
    expect(statut).toBe(200);
    expect(corps.total).toBe(0);
    expect(corps.annonces).toEqual([]);
  });

  test('Le tri par proximité range du plus près au plus loin', async () => {
    const { corps } = await chercher(`${LYON}&rayonKm=50&tri=proximite&parPage=50`);
    const distances = corps.annonces.map((a) => a.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  test('Sans position, pas de distance', async () => {
    const { corps } = await chercher('parPage=5');
    expect(corps.annonces.every((a) => a.distanceKm === undefined)).toBe(true);
  });

  test('L’adresse exacte ne sort jamais', async () => {
    const { corps } = await chercher(`${LYON}&rayonKm=50&parPage=50`);
    for (const a of corps.annonces) {
      for (const interdit of ['numeroRue', 'rue', 'complementAdresse', 'latitude', 'longitude']) {
        expect(a).not.toHaveProperty(interdit);
      }
    }
  });

  test('Erreurs : position incomplète, rayon hors bornes, tri sans position', async () => {
    for (const requete of [
      'latitude=45.76',
      `${LYON}&rayonKm=99`,
      `${LYON}&rayonKm=0.1`,
      'latitude=200&longitude=4.84',
      'tri=proximite',
    ]) {
      const { statut } = await chercher(requete);
      expect(statut, requete).toBe(422);
    }
  });
});

test.describe('Écran', () => {
  const feuille = (page) => page.getByRole('dialog', { name: 'Filtres' });
  const filtresActifs = (page) => page.getByRole('list', { name: 'Filtres actifs' });

  test('Autour de ma ville, avec un rayon, puis tri par proximité', async ({ page }) => {
    await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
    await page.getByRole('button', { name: /^Filtres/ }).click();
    const maVille = feuille(page).getByRole('button', { name: 'Ma ville' });
    await expect(maVille).toBeEnabled(); // le centre de la ville du profil est trouvé
    await maVille.click();
    await feuille(page).getByRole('button', { name: '2 km' }).click();
    await feuille(page).getByRole('button', { name: 'Appliquer' }).click();

    await expect(filtresActifs(page).getByRole('button', { name: /Ma ville · 2 km/ })).toBeVisible();
    await expect(page).toHaveURL(/rayonKm=2/);
    await expect(page).toHaveURL(/latitude=/);
    await expect(page.getByText(/\d+ pépites?/)).toBeVisible();

    // Le tri par proximité n'existe que quand on cherche autour d'un point.
    const proximite = page.getByRole('group', { name: 'Trier' }).getByRole('button', { name: 'Proximité' });
    await proximite.click();
    await expect(proximite).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/tri=proximite/);

    // Retirer la puce supprime le filtre et le tri qui en dépendait.
    await filtresActifs(page).getByRole('button', { name: /Ma ville/ }).click();
    await expect(page).not.toHaveURL(/latitude=/);
    await expect(page.getByRole('group', { name: 'Trier' }).getByRole('button', { name: 'Proximité' })).toHaveCount(0);
    await attendrePasDeDefilementHorizontal(page);
  });

  test('Autour d’une autre adresse', async ({ page }) => {
    await page.route('**/data.geopf.fr/geocodage/search**', (route) =>
      route.fulfill({
        json: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [4.8357, 45.7640] },
            properties: { label: '12 Rue de la République 69002 Lyon', housenumber: '12', street: 'Rue de la République', postcode: '69002', city: 'Lyon' },
          }],
        },
      }),
    );
    await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
    await page.getByRole('button', { name: /^Filtres/ }).click();
    await feuille(page).getByRole('combobox', { name: 'Une autre adresse' }).fill('12 rue de la rep');
    await page.getByRole('listbox', { name: 'Adresses suggérées' }).getByRole('option').first().click();
    await feuille(page).getByRole('button', { name: 'Appliquer' }).click();

    await expect(filtresActifs(page).getByRole('button', { name: /69002 Lyon · 5 km/ })).toBeVisible();
    // La position est arrondie (environ 1 km) : on cherche autour d'une zone, pas d'une porte.
    await expect(page).toHaveURL(/latitude=45\.76&/);
    await expect(page).toHaveURL(/longitude=4\.84&|longitude=4\.84$/);
  });

  test('Affichage à 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche?latitude=45.76&longitude=4.84&rayonKm=5&lieu=Ma+ville');
    await attendrePasDeDefilementHorizontal(page);
    await page.getByRole('button', { name: /^Filtres/ }).click();
    await expect(feuille(page).getByRole('button', { name: 'Appliquer' })).toBeInViewport();
    await attendrePasDeDefilementHorizontal(page);
  });
});
