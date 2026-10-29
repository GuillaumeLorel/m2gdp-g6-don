/**
 * Echanges entre membres (J4) :
 *  - favoris (US-21, US-22 — #49, #50) ;
 *  - messagerie (US-30 a US-32 — #63, #64, #65) ;
 *  - reservation : demande, validation ou declin, renoncement, paiement de
 *    test et adresse exacte (US-24 a US-28 — #52, #53, #55, #56) ;
 *  - modifier ou retirer son annonce (US-11 — #39) ;
 *  - profil et modification du profil (US-35, US-36 — #67, #68).
 *
 * Fatou (demandeuse seule) demande des objets a Bastien (offrant). Les tests
 * s'enchainent et ne touchent qu'a des annonces de Bastien que les autres
 * fichiers n'utilisent pas ; global-teardown.js remet tout en etat.
 */
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PROFILS, appelApi, ouvrirConnecte, supprimerAnnonces } from './outils.js';

test.describe.configure({ mode: 'serial' });

const lireJson = (f) => JSON.parse(readFileSync(new URL(`../../specs/donnees/demo/${f}`, import.meta.url), 'utf8'));
const annonces = lireJson('annonces.json');
const utilisateurs = lireJson('utilisateurs.json');
const annonce = (id) => annonces.find((a) => a.id === id);
const membre = (id) => utilisateurs.find((u) => u.id === id);

const POTHOS = annonce('demo-a-099'); // reservations
const CAISSE = annonce('demo-a-117'); // messagerie
const OUTILS = annonce('demo-a-020'); // favoris
const BOITES = annonce('demo-a-060'); // modification
const fatou = membre(PROFILS.demandeurSeul);
const bastien = membre(PROFILS.offrantEtDemandeur);
const nom = (u) => `${u.prenom} ${u.nom[0]}.`;
const euros = (m) => `${String(m).replace('.', ',')} €`;

/** Un second navigateur, connecte sous un autre profil. */
async function autrePage(browser, baseURL, profil, chemin) {
  const contexte = await browser.newContext({ baseURL, viewport: { width: 375, height: 812 }, locale: 'fr-FR' });
  const page = await contexte.newPage();
  await ouvrirConnecte(page, profil, chemin);
  return page;
}

/** Ferme les demandes en cours de Fatou sur une annonce, pour repartir de zero. */
async function solderDemandes(annonceId) {
  const { corps } = await appelApi(PROFILS.demandeurSeul, '/api/reservations?role=demandeur');
  for (const r of corps.reservations.filter((x) => x.annonceId === annonceId && x.statut !== 'annulee')) {
    await appelApi(PROFILS.demandeurSeul, `/api/reservations/${r.id}/renonciation`, { methode: 'POST' });
  }
}

test.describe('Favoris', () => {
  test('Ajouter depuis la fiche, retrouver dans l’onglet, retirer', async ({ page }) => {
    await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${OUTILS.id}`);
    await page.getByRole('button', { name: 'Ajouter aux favoris' }).click();
    await expect(page.getByRole('button', { name: 'Retirer des favoris' })).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/');
    await ouvrirConnecte(page, PROFILS.demandeurSeul, '/favoris');
    await expect(page.getByRole('heading', { name: 'Mes favoris' })).toBeVisible();
    await expect(page.getByText(OUTILS.titre)).toBeVisible();

    await page.getByRole('button', { name: `Retirer « ${OUTILS.titre} » des favoris` }).click();
    await expect(page.getByText('Aucun favori pour le moment')).toBeVisible();
  });
});

test.describe('Messagerie', () => {
  test('Contacter l’offrant, échanger, retrouver la conversation', async ({ page, browser, baseURL }) => {
    await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${CAISSE.id}`);
    await page.getByRole('button', { name: `Écrire à ${bastien.prenom}` }).click();
    await expect(page).toHaveURL(/\/messages\/[\w-]+$/);
    await expect(page.getByRole('heading', { level: 1, name: nom(bastien) })).toBeVisible();

    await page.getByLabel('Votre message').fill('Bonjour, la caisse est-elle lourde ?');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.getByRole('list', { name: 'Messages' }).getByText('Bonjour, la caisse est-elle lourde ?')).toBeVisible();

    // L'offrant la retrouve dans ses messages, et repond.
    const offrant = await autrePage(browser, baseURL, PROFILS.offrantEtDemandeur, '/messages');
    const ligne = offrant.getByRole('link', { name: new RegExp(nom(fatou)) }).filter({ hasText: CAISSE.titre });
    await expect(ligne).toContainText('Bonjour, la caisse est-elle lourde ?');
    await ligne.click();
    await offrant.getByLabel('Votre message').fill('Non, elle se porte facilement.');
    await offrant.getByRole('button', { name: 'Envoyer' }).click();
    await expect(offrant.getByText('Non, elle se porte facilement.')).toBeVisible();
    await offrant.context().close();

    // Le demandeur voit la reponse (rafraichissement periodique).
    await expect(page.getByText('Non, elle se porte facilement.')).toBeVisible({ timeout: 15_000 });
  });

  test('Une conversation est privée', async () => {
    const { corps } = await appelApi(PROFILS.demandeurSeul, '/api/conversations');
    const conversation = corps.conversations.find((c) => c.annonce?.id === CAISSE.id);
    const intrus = await appelApi(PROFILS.connexion, `/api/conversations/${conversation.id}/messages`);
    expect(intrus.statut).toBe(403);
  });
});

test.describe('Réservation', () => {
  test.beforeEach(() => solderDemandes(POTHOS.id));
  // Pas de demande qui traine : l'accueil de Fatou est verifie par d'autres tests.
  test.afterAll(() => solderDemandes(POTHOS.id));

  test('Demander, l’offrant valide, puis le demandeur renonce', async ({ page, browser, baseURL }) => {
    await ouvrirConnecte(page, PROFILS.demandeurSeul, `/annonces/${POTHOS.id}`);
    await page.getByRole('button', { name: `Réserver pour ${euros(POTHOS.participation)}` }).click();
    await page.getByLabel(/Un mot pour/).fill('Bonjour, je passe au créneau indiqué.');
    await page.getByRole('button', { name: 'Envoyer la demande' }).click();

    await expect(page).toHaveURL(/\/messages\/[\w-]+$/);
    const conversation = page.url().split('/').pop();
    await expect(page.getByText('Demande envoyée : l’offrant doit la valider.')).toBeVisible();
    await expect(page.getByText(`${fatou.prenom} souhaite récupérer cet objet.`)).toBeVisible();

    // L'offrant valide : l'objet est reserve pour Fatou, au montant de l'annonce.
    const offrant = await autrePage(browser, baseURL, PROFILS.offrantEtDemandeur, `/messages/${conversation}`);
    await offrant.getByRole('button', { name: 'Valider la demande' }).click();
    await expect(offrant.getByText(`Objet réservé pour ${fatou.prenom}`)).toBeVisible();
    await offrant.context().close();

    const { corps: fiche } = await appelApi(PROFILS.demandeurSeul, `/api/annonces/${POTHOS.id}`);
    expect(fiche.statut).toBe('reserve');
    // Avant paiement, personne ne voit l'adresse exacte.
    const { corps: liste } = await appelApi(PROFILS.demandeurSeul, '/api/reservations?role=demandeur');
    const reservation = liste.reservations.find((r) => r.annonceId === POTHOS.id && r.statut === 'proposee');
    expect(reservation.participationDemandee).toBe(POTHOS.participation);
    expect((await appelApi(PROFILS.demandeurSeul, `/api/reservations/${reservation.id}`)).corps.adresseRetrait).toBeUndefined();

    await page.reload();
    await expect(page.getByRole('button', { name: `Verser ${euros(POTHOS.participation)}` })).toBeVisible();
    await page.getByRole('button', { name: 'Renoncer' }).click();
    await expect(page.getByText('Le demandeur a renoncé à l’objet : il est de nouveau disponible.').first()).toBeVisible();
    expect((await appelApi(PROFILS.demandeurSeul, `/api/annonces/${POTHOS.id}`)).corps.statut).toBe('disponible');
  });

  test('L’offrant décline une demande', async ({ page }) => {
    const { corps: demande } = await appelApi(PROFILS.demandeurSeul, `/api/annonces/${POTHOS.id}/reservations`, { methode: 'POST' });
    await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, `/messages/${demande.conversationId}`);
    await page.getByRole('button', { name: 'Décliner' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'L’offrant a décliné cette demande.' })).toBeVisible();
  });

  test('On ne demande ni deux fois le même objet, ni son propre objet', async () => {
    await appelApi(PROFILS.demandeurSeul, `/api/annonces/${POTHOS.id}/reservations`, { methode: 'POST' });
    const doublon = await appelApi(PROFILS.demandeurSeul, `/api/annonces/${POTHOS.id}/reservations`, { methode: 'POST' });
    expect(doublon.statut).toBe(409);
    const sienne = await appelApi(PROFILS.offrantEtDemandeur, `/api/annonces/${POTHOS.id}/reservations`, { methode: 'POST' });
    expect(sienne.statut).toBe(403);
  });

  test('L’adresse exacte s’affiche une fois la participation validée', async ({ page }) => {
    // Le paiement reel (Stripe, mode test) est couvert par le test suivant ;
    // ici, on verifie l'affichage d'une reservation confirmee.
    const { corps: demande } = await appelApi(PROFILS.demandeurSeul, `/api/annonces/${POTHOS.id}/reservations`, { methode: 'POST' });
    await page.route(`**/api/conversations/${demande.conversationId}/messages`, async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const reponse = await route.fetch();
      const c = await reponse.json();
      c.reservation = {
        ...c.reservation,
        statut: 'confirmee',
        statutPaiement: 'paye',
        participationDemandee: POTHOS.participation,
        referencePaiement: 'pi_test_affichage',
        adresseRetrait: { numeroRue: POTHOS.numeroRue, rue: POTHOS.rue, complementAdresse: '', codePostal: POTHOS.codePostal, ville: POTHOS.ville },
      };
      await route.fulfill({ response: reponse, json: c });
    });
    await ouvrirConnecte(page, PROFILS.demandeurSeul, `/messages/${demande.conversationId}`);
    await expect(page.getByText('Adresse exacte du retrait')).toBeVisible();
    await expect(page.getByText(`${POTHOS.numeroRue} ${POTHOS.rue}`)).toBeVisible();
    await expect(page.getByText('Référence du paiement de test : pi_test_affichage')).toBeVisible();
  });

  test('Payer en mode test avec Stripe, puis découvrir l’adresse', async ({ page }) => {
    const varsDev = new URL('../../workers/.dev.vars', import.meta.url);
    test.skip(
      !existsSync(varsDev) || !/STRIPE_SECRET_KEY\s*=\s*'?sk_test_/.test(readFileSync(varsDev, 'utf8')),
      'Clé Stripe de test absente de workers/.dev.vars',
    );
    test.setTimeout(90_000);
    const { corps: demande } = await appelApi(PROFILS.demandeurSeul, `/api/annonces/${POTHOS.id}/reservations`, { methode: 'POST' });
    await appelApi(PROFILS.offrantEtDemandeur, `/api/reservations/${demande.id}/validation`, { methode: 'POST' });

    await ouvrirConnecte(page, PROFILS.demandeurSeul, `/messages/${demande.conversationId}`);
    await page.getByRole('button', { name: `Verser ${euros(POTHOS.participation)}` }).click();
    // Page de paiement Stripe (mode test) : carte de test officielle.
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    await page.getByLabel(/E-mail|Email/i).fill('fatou.test@example.org').catch(() => {});
    await page.locator('#cardNumber').fill('4242 4242 4242 4242');
    await page.locator('#cardExpiry').fill('12 / 34');
    await page.locator('#cardCvc').fill('123');
    await page.locator('#billingName').fill('Fatou Test').catch(() => {});
    await page.locator('[data-testid="hosted-payment-submit-button"]').click();

    await page.waitForURL(/\/messages\//, { timeout: 60_000 });
    await expect(page.getByText('Participation validée ! Voici l’adresse exacte du retrait.')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`${POTHOS.numeroRue} ${POTHOS.rue}`)).toBeVisible();
    // L'offrant, lui, ne recoit jamais l'adresse sur la reservation : c'est la sienne.
    expect((await appelApi(PROFILS.offrantEtDemandeur, `/api/reservations/${demande.id}`)).corps.adresseRetrait).toBeUndefined();
  });
});

test.describe('Modifier ou retirer son annonce', () => {
  test('Modifier le titre de son annonce', async ({ page }) => {
    await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, `/annonces/${BOITES.id}`);
    await page.getByRole('link', { name: 'Modifier' }).click();
    await expect(page.getByRole('heading', { name: 'Modifier l’annonce' })).toBeVisible();
    const titre = page.getByLabel('Titre de l’objet', { exact: true });
    await expect(titre).toHaveValue(BOITES.titre);
    await titre.fill(`${BOITES.titre} empilables`);
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();

    await expect(page.getByRole('status')).toContainText('Modifications enregistrées');
    await expect(page.getByRole('heading', { level: 1, name: `${BOITES.titre} empilables` })).toBeVisible();
    await appelApi(PROFILS.offrantEtDemandeur, `/api/annonces/${BOITES.id}`, { methode: 'PATCH', corps: { titre: BOITES.titre } });
  });

  test('Une demande en cours fige la participation et l’association', async ({ page }) => {
    const { corps: demande } = await appelApi(PROFILS.demandeurSeul, `/api/annonces/${BOITES.id}/reservations`, { methode: 'POST' });
    await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, `/annonces/${BOITES.id}/modifier`);
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByText('Une demande est en cours')).toBeVisible();
    await expect(page.getByLabel('Participation solidaire (€)', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('Association soutenue', { exact: true })).toBeDisabled();
    const refus = await appelApi(PROFILS.offrantEtDemandeur, `/api/annonces/${BOITES.id}`, { methode: 'PATCH', corps: { participation: 99 } });
    expect(refus.statut).toBe(409);
    await appelApi(PROFILS.demandeurSeul, `/api/reservations/${demande.id}/renonciation`, { methode: 'POST' });
  });

  test('Retirer son annonce', async ({ page }) => {
    const demain = new Date(Date.now() + 86400e3);
    const { corps: publiee } = await appelApi(PROFILS.offrantEtDemandeur, '/api/annonces', {
      methode: 'POST',
      corps: {
        titre: 'Annonce à retirer', description: 'Créée par un test.', categorieId: BOITES.categorieId, sousCategorieId: BOITES.sousCategorieId,
        etat: 'bon_etat', participation: 1, associationId: BOITES.associationId,
        creneauRetrait: { debut: demain.toISOString(), fin: new Date(+demain + 3600e3).toISOString() },
        numeroRue: bastien.numeroRue, rue: bastien.rue, codePostal: bastien.codePostal, ville: bastien.ville,
      },
    });
    try {
      await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, `/annonces/${publiee.id}`);
      await page.getByRole('button', { name: 'Retirer', exact: true }).click();
      await page.getByRole('button', { name: 'Retirer l’annonce' }).click();
      await expect(page).toHaveURL(/\/profil$/);
      await expect(page.getByRole('status')).toContainText('« Annonce à retirer » a été retirée.');
      expect((await appelApi(PROFILS.demandeurSeul, `/api/annonces/${publiee.id}`)).statut).toBe(404);
    } finally {
      await supprimerAnnonces([publiee.id]);
    }
  });
});

test.describe('Profil', () => {
  test('Statistiques, annonces et réservations', async ({ page }) => {
    await ouvrirConnecte(page, PROFILS.offrantEtDemandeur, '/profil');
    const stats = page.getByRole('list', { name: 'Statistiques' });
    await expect(stats.getByText('objets donnés')).toBeVisible();
    await expect(stats.getByText('reversés')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Mes annonces \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(CAISSE.titre) })).toBeVisible();

    await page.goto('/');
    await ouvrirConnecte(page, PROFILS.demandeurSeul, '/profil');
    await expect(page.getByRole('heading', { name: /Mes réservations \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Mes annonces/ })).toHaveCount(0);
  });

  test('Modifier son profil, rôles compris', async ({ page }) => {
    const { corps: avant } = await appelApi(PROFILS.connexion, '/api/profil');
    try {
      await ouvrirConnecte(page, PROFILS.connexion, '/profil');
      await page.getByRole('link', { name: 'Modifier mon profil et mes rôles' }).click();
      await expect(page.getByRole('heading', { name: 'Modifier mon profil' })).toBeVisible();
      await expect(page.getByLabel('Prénom')).toHaveValue(avant.prenom);
      await page.getByLabel('Complément (facultatif)').fill('Bâtiment C');
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page).toHaveURL(/\/profil$/);
      await expect(page.getByRole('status')).toContainText('Profil enregistré.');
      expect((await appelApi(PROFILS.connexion, '/api/profil')).corps.complementAdresse).toBe('Bâtiment C');
    } finally {
      await appelApi(PROFILS.connexion, '/api/profil', { methode: 'PUT', corps: avant });
    }
  });
});
