/**
 * US-29, US-30, US-31 (#58, #57, #60) — liste d'attente : s'y inscrire,
 * garder sa place, être promu au désistement ou quand l'offrant passe au
 * suivant. Sur le vrai Worker, avec quatre comptes : Bastien (offrant) et trois
 * demandeurs (Fatou, Lina, Enzo) sur la même annonce.
 *
 * Règles : une file de 5 personnes au plus, qui survit au paiement et ne se
 * clôt qu'à la remise (validé par le PO le 08/11/2026).
 */
import { expect, test } from '@playwright/test';
import { PROFILS, appelApi, ouvrirConnecte } from './outils.js';

test.describe.configure({ mode: 'serial' });

const ANNONCE = 'demo-a-020';
const FATOU = PROFILS.demandeurSeul;
const LINA = PROFILS.deuxiemeDemandeur;
const ENZO = PROFILS.troisiemeDemandeur;
const BASTIEN = PROFILS.offrantEtDemandeur;

const post = (qui, chemin) => appelApi(qui, chemin, { methode: 'POST' });
const lire = async (qui, id) => (await appelApi(qui, `/api/reservations/${id}`)).corps;
const annonce = async () => (await appelApi(FATOU, `/api/annonces/${ANNONCE}`)).corps;
const ids = {};

test.beforeAll(async () => {
  // Une annonce libre : on solde ce qui traînerait d'un essai précédent.
  for (const qui of [FATOU, LINA, ENZO]) {
    const { corps } = await appelApi(qui, '/api/reservations?role=demandeur');
    for (const r of corps.reservations.filter((x) => x.annonceId === ANNONCE && ['demandee', 'liste_attente', 'proposee', 'confirmee'].includes(x.statut))) {
      await post(qui, `/api/reservations/${r.id}/${r.statut === 'confirmee' || r.statut === 'liste_attente' ? 'desistement' : 'renonciation'}`);
    }
  }
});

test.afterAll(async () => {
  for (const [qui, id] of [[FATOU, ids.fatou], [LINA, ids.lina], [ENZO, ids.enzo]]) {
    if (!id) continue;
    const r = await lire(qui, id);
    if (['liste_attente', 'proposee', 'confirmee'].includes(r?.statut)) await post(qui, `/api/reservations/${id}/desistement`);
    else if (r?.statut === 'demandee') await post(qui, `/api/reservations/${id}/renonciation`);
  }
});

test('Fatou obtient l’objet : demande, validation, l’annonce est réservée', async () => {
  const demande = await post(FATOU, `/api/annonces/${ANNONCE}/reservations`);
  expect(demande.statut).toBe(201);
  ids.fatou = demande.corps.id;
  expect(demande.corps.statut).toBe('demandee');
  const validation = await post(BASTIEN, `/api/reservations/${ids.fatou}/validation`);
  expect(validation.statut).toBe(200);
  expect(validation.corps.statut).toBe('proposee');
  expect((await annonce()).statut).toBe('reserve');
});

test('Lina puis Enzo s’inscrivent en liste d’attente, dans l’ordre', async () => {
  const lina = await post(LINA, `/api/annonces/${ANNONCE}/reservations`);
  expect(lina.statut).toBe(201);
  ids.lina = lina.corps.id;
  expect(lina.corps.statut).toBe('liste_attente');
  const enzo = await post(ENZO, `/api/annonces/${ANNONCE}/reservations`);
  expect(enzo.statut).toBe(201);
  ids.enzo = enzo.corps.id;
  expect(enzo.corps.statut).toBe('liste_attente');
  expect((await lire(LINA, ids.lina)).position).toBe(1);
  expect((await lire(ENZO, ids.enzo)).position).toBe(2);
});

test('On ne peut pas s’inscrire deux fois', async () => {
  const doublon = await post(LINA, `/api/annonces/${ANNONCE}/reservations`);
  expect(doublon.statut).toBeGreaterThanOrEqual(400);
  expect(doublon.statut).toBeLessThan(500);
});

test('Le désistement de Fatou propose l’objet à Lina, Enzo monte en tête', async () => {
  const fin = await post(FATOU, `/api/reservations/${ids.fatou}/desistement`);
  expect(fin.statut).toBe(200);
  expect(fin.corps.statut).toBe('annulee');
  expect(fin.corps.motifAnnulation).toBe('desistement');

  const lina = await lire(LINA, ids.lina);
  expect(lina.statut).toBe('proposee');
  expect(lina.participationDemandee).toBeGreaterThan(0);
  const enzo = await lire(ENZO, ids.enzo);
  expect(enzo.statut).toBe('liste_attente');
  expect(enzo.position).toBe(1);
  expect((await annonce()).statut).toBe('reserve');
});

test('Lina voit l’objet qui lui est proposé dans l’appli', async ({ page }) => {
  await ouvrirConnecte(page, LINA, `/messages/${(await lire(LINA, ids.lina)).conversationId}`);
  await expect(page.getByText('À payer', { exact: false }).first().or(page.getByRole('button', { name: /^Verser / }))).toBeVisible();
  await expect(page.getByText('L’objet est libre et vous est proposé')).toBeVisible();
});

test('Bastien passe au suivant faute de réponse : Enzo reçoit l’objet', async () => {
  const passe = await post(BASTIEN, `/api/reservations/${ids.lina}/sans-reponse`);
  expect(passe.statut).toBe(200);
  expect(passe.corps.statut).toBe('annulee');
  expect(passe.corps.motifAnnulation).toBe('sans_reponse');

  const enzo = await lire(ENZO, ids.enzo);
  expect(enzo.statut).toBe('proposee');
  expect((await annonce()).statut).toBe('reserve');
});

test('Enzo se désiste, personne derrière : l’objet redevient disponible', async () => {
  const fin = await post(ENZO, `/api/reservations/${ids.enzo}/desistement`);
  expect(fin.statut).toBe(200);
  expect((await annonce()).statut).toBe('disponible');
});
