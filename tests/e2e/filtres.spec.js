/**
 * US-14 (issue #42) — Filtrer les annonces par categorie, etat et
 * participation. Un test par scenario Gherkin de l'issue.
 */
import { expect, test } from '@playwright/test';
import { PROFILS, ouvrirConnecte } from './outils.js';

// Cartes d'annonce seulement (la section « En cours » de l'accueil a aussi des liens en liste).
const cartes = (page) => page.getByRole('main').getByRole('listitem').getByRole('link').filter({ hasText: 'participation' });
const feuille = (page) => page.getByRole('dialog', { name: 'Filtres' });
const compteur = (page) => page.getByText(/\d+ pépites? (pour|à donner)/);

async function ouvrirFeuille(page) {
  await page.getByRole('button', { name: /^Filtres/ }).click();
  await expect(feuille(page)).toBeVisible();
}

/**
 * Annonces de la derniere reponse dont l'URL contient `marque`. Filtrer sur
 * l'URL est necessaire : en developpement, React monte l'ecran deux fois, et
 * une requete initiale peut arriver apres celle qu'on verifie.
 */
function suivreReponses(page, marque) {
  const derniere = { annonces: [] };
  page.on('response', async (r) => {
    if (r.url().includes('/api/annonces?') && r.url().includes(marque) && r.ok()) {
      derniere.annonces = (await r.json()).annonces;
    }
  });
  return derniere;
}

test('Combiner plusieurs filtres (cas nominal)', async ({ page }) => {
  const reponse = suivreReponses(page, 'participationMax=5');
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await ouvrirFeuille(page);
  await feuille(page).getByRole('button', { name: 'Mobilier' }).click();
  await feuille(page).getByRole('button', { name: 'Très bon état' }).click();
  await feuille(page).getByLabel('Participation maximale').fill('5');
  await feuille(page).getByRole('button', { name: 'Appliquer' }).click();

  await expect(feuille(page)).toBeHidden();
  const puces = page.getByRole('list', { name: 'Filtres actifs' }).getByRole('button');
  await expect(puces).toHaveCount(3);
  await expect(compteur(page)).toBeVisible();
  await expect(cartes(page).first()).toBeVisible();
  await expect.poll(() => reponse.annonces.length).toBeGreaterThan(0);
  for (const a of reponse.annonces) {
    expect(a.categorie.id).toBe('mobilier');
    expect(a.etat).toBe('tres_bon_etat');
    expect(a.participation).toBeLessThanOrEqual(5);
  }
  await expect(page).toHaveURL(/categorieId=mobilier/);
});

test('Filtres et mot-clé ensemble', async ({ page }) => {
  const reponse = suivreReponses(page, 'etat=bon_etat');
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await page.getByRole('searchbox').fill('étagère');
  await expect(compteur(page)).toContainText('« étagère »');
  await ouvrirFeuille(page);
  await feuille(page).getByRole('button', { name: 'Bon état', exact: true }).click();
  await feuille(page).getByRole('button', { name: 'Appliquer' }).click();

  await expect(page).toHaveURL(/q=/);
  await expect(page).toHaveURL(/etat=bon_etat/);
  await expect(compteur(page)).toContainText('« étagère »');
  await expect.poll(() => reponse.annonces.length).toBeGreaterThan(0);
  for (const a of reponse.annonces) {
    expect(a.etat).toBe('bon_etat');
    expect(`${a.titre} ${a.description}`.toLowerCase()).toContain('étagère');
  }
});

test('Sous-catégories cohérentes', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await ouvrirFeuille(page);
  await feuille(page).getByRole('button', { name: 'Mobilier' }).click();
  const sous = feuille(page).getByRole('group', { name: /Sous-catégorie · Mobilier/ });
  await expect(sous.getByRole('button')).toHaveCount(6);
  await expect(sous.getByRole('button', { name: 'Tables et bureaux' })).toBeVisible();

  await feuille(page).getByRole('button', { name: 'Électroménager' }).click();
  await expect(feuille(page).getByRole('group', { name: /Sous-catégorie · Électroménager/ }).getByRole('button', { name: 'Lave-linge et sèche-linge' })).toBeVisible();
  await expect(feuille(page).getByRole('button', { name: 'Tables et bureaux' })).toHaveCount(0);
});

test('Retirer un filtre', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche?categorieId=mobilier&etat=bon_etat');
  const puces = page.getByRole('list', { name: 'Filtres actifs' }).getByRole('button');
  await expect(puces).toHaveCount(2);
  await page.getByRole('button', { name: 'Retirer le filtre Bon état' }).click();
  await expect(puces).toHaveCount(1);
  await expect(page).not.toHaveURL(/etat=/);
  await expect(cartes(page).first()).toBeVisible();
});

test('Réinitialiser', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await expect(compteur(page)).toBeVisible();
  const totalComplet = await compteur(page).innerText();

  await ouvrirFeuille(page);
  await feuille(page).getByRole('button', { name: 'Animaux' }).click();
  await feuille(page).getByRole('button', { name: 'Appliquer' }).click();
  await expect(compteur(page)).not.toHaveText(totalComplet);

  await ouvrirFeuille(page);
  await feuille(page).getByRole('button', { name: 'Réinitialiser' }).click();
  await expect(feuille(page)).toBeHidden();
  await expect(page.getByRole('list', { name: 'Filtres actifs' })).toHaveCount(0);
  await expect(compteur(page)).toHaveText(totalComplet);
});

test('Aucun résultat (cas limite)', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche?categorieId=animaux&etat=neuf&participationMax=0.5');
  await expect(page.getByText('Aucun objet avec ces filtres')).toBeVisible();
  await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
  await expect(cartes(page).first()).toBeVisible();
});

test('Participation maximale invalide (erreur gérée)', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await ouvrirFeuille(page);
  const champ = feuille(page).getByLabel('Participation maximale');
  for (const valeur of ['-3', 'abc']) {
    await champ.fill(valeur);
    await expect(feuille(page).getByRole('alert')).toContainText('montant positif');
    await expect(feuille(page).getByRole('button', { name: 'Appliquer' })).toBeDisabled();
  }
  await champ.fill('2,50');
  await expect(feuille(page).getByRole('alert')).toHaveCount(0);
  await expect(feuille(page).getByRole('button', { name: 'Appliquer' })).toBeEnabled();
});

test('Filtres conservés au retour', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await ouvrirFeuille(page);
  await feuille(page).getByRole('button', { name: 'Mobilier' }).click();
  await feuille(page).getByRole('button', { name: 'Appliquer' }).click();
  // La liste precedente reste affichee pendant le chargement : on attend la
  // fin de la mise a jour avant de lire le premier resultat.
  await expect(page.getByRole('button', { name: 'Retirer le filtre Mobilier' })).toBeVisible();
  await expect(page.locator('main ul[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  await expect(cartes(page).first()).toBeVisible();
  const premierTitre = await cartes(page).first().getByRole('heading').innerText();

  await cartes(page).first().click();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('button', { name: 'Retirer le filtre Mobilier' })).toBeVisible();
  await expect(cartes(page).first().getByRole('heading')).toHaveText(premierTitre);
});

test('Affichage sur mobile', async ({ page }) => {
  await ouvrirConnecte(page, PROFILS.demandeurSeul, '/recherche');
  await ouvrirFeuille(page);
  // Meme avec une categorie ouverte, les deux boutons restent a l'ecran.
  await feuille(page).getByRole('button', { name: 'Mobilier' }).click();
  await expect(feuille(page).getByRole('button', { name: 'Appliquer' })).toBeInViewport();
  await expect(feuille(page).getByRole('button', { name: 'Réinitialiser' })).toBeInViewport();
});
