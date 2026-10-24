/**
 * Acces administrateur a Supabase pour les scripts de donnees.
 *
 * Les secrets viennent de `.env.supabase` a la racine du depot (git-ignore) :
 *   SUPABASE_SECRET_KEY=sb_secret_...   -> API REST, contourne la RLS
 *   SUPABASE_DB_PASSWORD=...            -> Postgres, pour les migrations
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { RACINE_DEPOT } from './chemins.mjs';

export { RACINE_DEPOT };

export const PROJET = 'ocapkeuidpuhcsnerkse';
export const URL_SUPABASE = `https://${PROJET}.supabase.co`;

function lireSecrets() {
  const fichier = path.join(RACINE_DEPOT, '.env.supabase');
  const depuisFichier = existsSync(fichier)
    ? Object.fromEntries(
        readFileSync(fichier, 'utf8')
          .split(/\r?\n/)
          .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
          .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
      )
    : {};
  return { ...depuisFichier, ...process.env };
}

export const secrets = lireSecrets();
if (!secrets.SUPABASE_SECRET_KEY) {
  throw new Error('SUPABASE_SECRET_KEY introuvable : creer .env.supabase a la racine du depot.');
}

/**
 * Connexion Postgres pour les migrations. Par le pooler (IPv4) : l'adresse
 * directe de la base n'est joignable qu'en IPv6.
 */
export function configurationPostgres() {
  return {
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    port: 5432,
    user: `postgres.${PROJET}`,
    database: 'postgres',
    password: secrets.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  };
}

async function appeler(chemin, options = {}) {
  const reponse = await fetch(`${URL_SUPABASE}/rest/v1/${chemin}`, {
    ...options,
    headers: {
      apikey: secrets.SUPABASE_SECRET_KEY,
      'content-type': 'application/json',
      ...options.headers,
    },
  });
  if (!reponse.ok) throw new Error(`Supabase ${reponse.status} : ${await reponse.text()}`);
  return reponse.status === 204 ? null : reponse.json().catch(() => null);
}

/** Cree ou met a jour des lignes (par identifiant), par lots de 500. */
export async function ecrireLot(table, lignes) {
  for (let i = 0; i < lignes.length; i += 500) {
    await appeler(`${table}?on_conflict=id`, {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(lignes.slice(i, i + 500)),
    });
  }
}

/** Supprime des lignes par identifiant. */
export async function supprimerLot(table, ids) {
  for (let i = 0; i < ids.length; i += 100) {
    const liste = ids.slice(i, i + 100).map((id) => `"${id}"`).join(',');
    await appeler(`${table}?id=in.(${encodeURIComponent(liste)})`, { method: 'DELETE' });
  }
}

/** Supprime toutes les lignes de demonstration (fictif = vrai) d'une table. */
export async function supprimerFictifs(table) {
  await appeler(`${table}?fictif=is.true`, { method: 'DELETE' });
}

/* --- Comptes de connexion (Supabase Auth, API d'administration) --------- */

async function appelerAuth(chemin, options = {}) {
  const reponse = await fetch(`${URL_SUPABASE}/auth/v1/${chemin}`, {
    ...options,
    headers: {
      apikey: secrets.SUPABASE_SECRET_KEY,
      authorization: `Bearer ${secrets.SUPABASE_SECRET_KEY}`,
      'content-type': 'application/json',
    },
  });
  const corps = await reponse.json().catch(() => null);
  if (!reponse.ok) throw new Error(`Supabase Auth ${reponse.status} : ${JSON.stringify(corps)}`);
  return corps;
}

/** Tous les comptes de connexion : une Map e-mail -> compte. */
export async function listerComptes() {
  const comptes = new Map();
  for (let page = 1; ; page++) {
    const { users } = await appelerAuth(`admin/users?page=${page}&per_page=500`);
    for (const u of users) comptes.set(u.email?.toLowerCase(), u);
    if (users.length < 500) return comptes;
  }
}

/**
 * Cree un compte de connexion deja confirme, sans mot de passe : on s'y
 * connecte par lien magique. Aucun e-mail n'est envoye a la creation.
 */
export const creerCompte = (email, id) =>
  appelerAuth('admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, email_confirm: true, ...(id ? { id } : {}) }),
  });

export const supprimerCompte = (id) => appelerAuth(`admin/users/${id}`, { method: 'DELETE' });

/** Identifiants d'une table. */
export async function listerIds(table) {
  return (await appeler(`${table}?select=id&limit=10000`)).map((l) => l.id);
}

/** Vrai si la ligne de commande demande une simple simulation. */
export const simulation = process.argv.includes('--simulation');
