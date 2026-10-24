/**
 * Outils communs aux tests.
 *
 * Connexion : le lien magique passe par une boite mail, inutilisable dans un
 * test. On demande donc a Supabase, avec la cle secrete, un jeton de connexion
 * a usage unique — sans envoyer d'e-mail —, on l'echange contre une session,
 * et le front adopte cette session par un crochet present en developpement
 * seulement (window.__doneoTest, voir public/src/lib/auth.js).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import { idUtilisateurDemo } from '../../scripts/donnees/identifiants.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const URL_SUPABASE = 'https://ocapkeuidpuhcsnerkse.supabase.co';

/** Cle secrete Supabase : variable d'environnement, ou .env.supabase a la racine. */
function cleSecrete() {
  if (process.env.SUPABASE_SECRET_KEY) return process.env.SUPABASE_SECRET_KEY;
  const fichier = path.join(RACINE, '.env.supabase');
  const ligne = existsSync(fichier)
    ? readFileSync(fichier, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('SUPABASE_SECRET_KEY='))
    : null;
  if (!ligne) throw new Error('SUPABASE_SECRET_KEY introuvable (.env.supabase, voir docs/SETUP.md)');
  return ligne.slice(ligne.indexOf('=') + 1).trim();
}

async function auth(chemin, corps) {
  const cle = cleSecrete();
  const reponse = await fetch(`${URL_SUPABASE}/auth/v1/${chemin}`, {
    method: 'POST',
    headers: { apikey: cle, authorization: `Bearer ${cle}`, 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  });
  return { statut: reponse.status, corps: await reponse.json() };
}

const utilisateursDemo = JSON.parse(
  readFileSync(path.join(RACINE, 'specs/donnees/demo/utilisateurs.json'), 'utf8'),
);

const sessions = new Map();

/**
 * Session Supabase pour un profil de demonstration, obtenue une seule fois par
 * processus de test : Supabase limite la verification de liens a 30 toutes
 * les 5 minutes, bien moins que le nombre de tests. Le compte de connexion
 * est cree au besoin, avec l'identifiant du profil : les profils de demo n'en
 * ont pas d'office.
 */
export function sessionDeTest(idLisible) {
  if (!sessions.has(idLisible)) sessions.set(idLisible, ouvrirSession(idLisible));
  return sessions.get(idLisible);
}

const emailDe = (idLisible) => utilisateursDemo.find((u) => u.id === idLisible).email;

/**
 * Cree les comptes de connexion des profils de test. Appelee une seule fois,
 * avant tous les tests (global-setup.js) : faite en parallele par chaque
 * navigateur, la creation entrerait en collision.
 */
export async function preparerComptesDeTest() {
  for (const idLisible of Object.values(PROFILS)) {
    const r = await auth('admin/users', { id: idUtilisateurDemo(idLisible), email: emailDe(idLisible), email_confirm: true });
    const existeDeja = r.statut === 422 || JSON.stringify(r.corps).includes('already exists');
    if (r.statut !== 200 && !existeDeja) throw new Error(`Compte de test : ${JSON.stringify(r.corps)}`);
  }
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Un nouveau lien invalide le precedent : si un autre navigateur en demande un
 * pour le meme profil entre-temps, la verification echoue. On reessaie alors,
 * apres une pause tiree au hasard pour ne pas retomber en meme temps.
 */
async function ouvrirSession(idLisible) {
  for (let essai = 1; ; essai++) {
    try {
      return await sessionDepuisLien(emailDe(idLisible));
    } catch (e) {
      if (essai >= 5) throw e;
      await pause(300 + Math.random() * 1200);
    }
  }
}

async function sessionDepuisLien(email) {
  const lien = await auth('admin/generate_link', { type: 'magiclink', email });
  if (!lien.corps.hashed_token) throw new Error(`Jeton de test : ${JSON.stringify(lien.corps)}`);
  const verification = await auth('verify', { type: 'email', token_hash: lien.corps.hashed_token });
  const session = verification.corps;
  if (!session.access_token) throw new Error(`Session de test : ${JSON.stringify(session)}`);
  return { access_token: session.access_token, refresh_token: session.refresh_token };
}

/**
 * Profils de demonstration utilises par les tests (specs/donnees/demo) :
 * ils existent en base ; seuls les tests s'y connectent.
 */
export const PROFILS = {
  offrantEtDemandeur: 'demo-u-005', // Bastien, 8 annonces
  demandeurSeul: 'demo-u-001', // Fatou, aucune annonce
};

/** Ouvre l'app connecte sous ce profil, sur le chemin demande. */
export async function ouvrirConnecte(page, uid, chemin = '/') {
  await page.goto('/');
  await page.waitForFunction(() => window.__doneoTest);
  const session = await sessionDeTest(uid);
  await page.evaluate((s) => window.__doneoTest.connecter(s), session);
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  if (chemin !== '/') {
    // Navigation interne, sans recharger : la session reste chargee. L'etat
    // reprend la forme de celui du routeur (idx), pour que « Retour » se
    // comporte comme apres un vrai clic.
    await page.evaluate((c) => {
      window.history.pushState({ usr: null, key: 'test', idx: 1 }, '', c);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, chemin);
  }
}

/** Aucune barre de defilement horizontale (critere « affichage sur mobile »). */
export async function attendrePasDeDefilementHorizontal(page) {
  const debord = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(debord).toBeLessThanOrEqual(0);
}
