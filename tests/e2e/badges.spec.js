/**
 * Ticket #132 — Revoir les couleurs et le système de badges.
 *
 * Les réservations de Fatou sont simulées à l'affichage (« À payer » et
 * « Confirmée ») : aucune écriture en base. L'annonce, elle, vient du vrai
 * Worker. Le PO a fixé la couleur de « À payer » : #8538C6, texte blanc gras.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, appelApi, attendrePasDeDefilementHorizontal, ouvrirConnecte } from './outils.js';

const ANNONCE = 'demo-a-087';

/** Style calculé d'un badge : tout ce qui fait son aspect. */
const aspect = (locator) =>
  locator.first().evaluate((e) => {
    const s = getComputedStyle(e);
    return {
      fond: s.backgroundColor, texte: s.color, rayon: s.borderRadius, graisse: s.fontWeight,
      taille: s.fontSize, contour: s.borderTopWidth,
    };
  });

/** Contraste WCAG entre deux couleurs « rgb(r, g, b) » opaques. */
function contraste(a, b) {
  const lum = (c) => {
    const [r, g, bl] = c.match(/\d+/g).slice(0, 3).map((v) => {
      const x = Number(v) / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

async function simulerReservations(page) {
  const { corps: annonce } = await appelApi(PROFILS.demandeurSeul, `/api/annonces/${ANNONCE}`);
  const base = { annonceId: annonce.id, conversationId: 'c-test', offrantId: 'o', demandeurId: 'd', annonce };
  const reservations = [
    { ...base, id: 'r-1', statut: 'proposee' },
    { ...base, id: 'r-2', statut: 'confirmee' },
  ];
  await page.route('**/api/reservations?role=demandeur', (route) => route.fulfill({ json: { reservations } }));
  return annonce;
}

test('Un même statut a le même aspect partout, et « À payer » ressort', async ({ page }) => {
  await simulerReservations(page);
  await ouvrirConnecte(page, PROFILS.demandeurSeul);
  const accueil = page.getByRole('region', { name: 'En cours' });
  const surAccueil = accueil.getByText('À payer', { exact: true });
  await expect(surAccueil).toBeVisible();
  const aspectAccueil = await aspect(surAccueil);

  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/profil');
  const surProfil = page.getByText('À payer', { exact: true });
  await expect(surProfil.first()).toBeVisible();
  expect(await aspect(surProfil)).toEqual(aspectAccueil);

  // Couleur du PO : #8538C6, texte blanc gras.
  expect(aspectAccueil.fond).toBe('rgb(133, 56, 198)');
  expect(aspectAccueil.texte).toBe('rgb(255, 255, 255)');
  expect(Number(aspectAccueil.graisse)).toBeGreaterThanOrEqual(700);
  expect(contraste(aspectAccueil.texte, aspectAccueil.fond)).toBeGreaterThanOrEqual(4.5);

  // Une action attendue ressort par rapport à un statut sans action.
  const confirmee = await aspect(page.getByText('Confirmée', { exact: true }));
  expect(confirmee.fond).not.toBe(aspectAccueil.fond);
  expect(Number(confirmee.graisse)).toBeLessThan(Number(aspectAccueil.graisse));
  expect(contraste(confirmee.texte, confirmee.fond)).toBeGreaterThanOrEqual(4.5);
});

test('L’état de l’objet ne se confond pas avec un statut', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${ANNONCE}`);
  const { corps: annonce } = await appelApi(PROFILS.demandeurSeul, `/api/annonces/${ANNONCE}`);
  const etat = page.getByRole('list', { name: 'Caractéristiques' }).getByText(
    { neuf: 'Neuf', tres_bon_etat: 'Très bon état', bon_etat: 'Bon état', usage: 'Usagé' }[annonce.etat],
    { exact: true },
  );
  await expect(etat).toBeVisible();
  const a = await aspect(etat);
  // Neutre, à contour, angles peu arrondis : ni pastille ni couleur de statut.
  expect(a.fond).toBe('rgb(255, 255, 255)');
  expect(a.contour).toBe('1px');
  expect(parseFloat(a.rayon)).toBeLessThan(12);
  expect(contraste(a.texte, a.fond)).toBeGreaterThanOrEqual(4.5);
  await attendrePasDeDefilementHorizontal(page);
});

test('Les statuts d’annonce : texte lisible, avec un point', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.offrantEtDemandeur);
  const badge = page.getByRole('region', { name: 'En cours' }).getByText('Disponible', { exact: true }).first();
  await expect(badge).toBeVisible();
  const a = await aspect(badge);
  expect(contraste(a.texte, a.fond)).toBeGreaterThanOrEqual(4.5);
  // Le point précède le libellé : le statut ne dépend pas de la couleur.
  expect(await badge.locator('span[aria-hidden="true"]').count()).toBe(1);
});
