/**
 * Acces administrateur a Firestore pour les scripts de chargement de donnees.
 *
 * Meme principe que le Worker (workers/src/firestore.js) : l'API REST, avec un
 * jeton obtenu par la cle de service. Aucune dependance.
 *
 * La cle est cherchee dans GOOGLE_APPLICATION_CREDENTIALS, sinon a la racine
 * du depot (doneo-3561b-firebase-adminsdk-*.json, git-ignoree).
 */
import { createSign } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { RACINE_DEPOT } from './chemins.mjs';

export { RACINE_DEPOT };

function cheminCle() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const trouvee = readdirSync(RACINE_DEPOT).find((f) => /-adminsdk-.*\.json$/.test(f));
  if (!trouvee) {
    throw new Error(
      'Cle de service introuvable : definir GOOGLE_APPLICATION_CREDENTIALS ou la poser a la racine du depot.',
    );
  }
  return path.join(RACINE_DEPOT, trouvee);
}

const cle = JSON.parse(readFileSync(cheminCle(), 'utf8'));
export const PROJET = cle.project_id;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJET}/databases/(default)/documents`;

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

let jetonEnCache = null;
async function jeton() {
  if (jetonEnCache) return jetonEnCache;
  const maintenant = Math.floor(Date.now() / 1000);
  const corps = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: cle.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: maintenant,
    exp: maintenant + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(corps).sign(cle.private_key, 'base64url');
  const reponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${corps}.${signature}`,
    }),
  });
  const donnees = await reponse.json();
  if (!donnees.access_token) throw new Error(`Jeton refuse : ${JSON.stringify(donnees)}`);
  jetonEnCache = donnees.access_token;
  return jetonEnCache;
}

/** Objet JS -> representation typee Firestore (meme regles que le Worker). */
export function versChamps(objet) {
  const champs = {};
  for (const [nom, valeur] of Object.entries(objet)) {
    if (valeur === undefined) continue;
    if (valeur === null) champs[nom] = { nullValue: null };
    else if (typeof valeur === 'string') champs[nom] = { stringValue: valeur };
    else if (typeof valeur === 'boolean') champs[nom] = { booleanValue: valeur };
    else if (typeof valeur === 'number') {
      champs[nom] = Number.isInteger(valeur)
        ? { integerValue: String(valeur) }
        : { doubleValue: valeur };
    } else if (Array.isArray(valeur)) {
      champs[nom] = { arrayValue: { values: valeur.map((v) => versChamps({ v }).v) } };
    } else {
      champs[nom] = { mapValue: { fields: versChamps(valeur) } };
    }
  }
  return champs;
}

async function appeler(url, options = {}) {
  const reponse = await fetch(url, {
    ...options,
    headers: { authorization: `Bearer ${await jeton()}`, 'content-type': 'application/json' },
  });
  if (!reponse.ok) throw new Error(`Firestore ${reponse.status} : ${await reponse.text()}`);
  return reponse.json();
}

/**
 * Ecrit des documents par lots de 400 (la limite d'un commit est 500).
 * Chaque document doit porter son `id` ; il n'est pas stocke dans les champs.
 */
export async function ecrireLot(collection, documents) {
  for (let i = 0; i < documents.length; i += 400) {
    const writes = documents.slice(i, i + 400).map(({ id, ...champs }) => ({
      update: {
        name: `projects/${PROJET}/databases/(default)/documents/${collection}/${id}`,
        fields: versChamps(champs),
      },
    }));
    await appeler(`${BASE}:commit`, { method: 'POST', body: JSON.stringify({ writes }) });
  }
}

/** Supprime des documents par identifiant, par lots. */
export async function supprimerLot(collection, ids) {
  for (let i = 0; i < ids.length; i += 400) {
    const writes = ids.slice(i, i + 400).map((id) => ({
      delete: `projects/${PROJET}/databases/(default)/documents/${collection}/${id}`,
    }));
    await appeler(`${BASE}:commit`, { method: 'POST', body: JSON.stringify({ writes }) });
  }
}

/** Liste les identifiants d'une collection, toutes pages confondues. */
export async function listerIds(collection) {
  const ids = [];
  let pageToken = '';
  do {
    const url = new URL(`${BASE}/${collection}`);
    url.searchParams.set('pageSize', '300');
    url.searchParams.set('mask.fieldPaths', '__name__');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const { documents = [], nextPageToken } = await appeler(url);
    ids.push(...documents.map((d) => d.name.split('/').pop()));
    pageToken = nextPageToken || '';
  } while (pageToken);
  return ids;
}

/** Representation typee Firestore -> objet JS. */
function depuisChamps(champs = {}) {
  const objet = {};
  for (const [nom, enveloppe] of Object.entries(champs)) {
    const [type, valeur] = Object.entries(enveloppe)[0];
    if (type === 'integerValue' || type === 'doubleValue') objet[nom] = Number(valeur);
    else if (type === 'nullValue') objet[nom] = null;
    else if (type === 'mapValue') objet[nom] = depuisChamps(valeur.fields);
    else if (type === 'arrayValue') objet[nom] = (valeur.values || []).map((v) => depuisChamps({ v }).v);
    else objet[nom] = valeur;
  }
  return objet;
}

/** Tous les documents d'une collection, avec leur identifiant. */
export async function lireCollection(collection) {
  const documents = [];
  let pageToken = '';
  do {
    const url = new URL(`${BASE}/${collection}`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const page = await appeler(url);
    documents.push(...(page.documents || []).map((d) => ({ id: d.name.split('/').pop(), ...depuisChamps(d.fields) })));
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return documents;
}

/** Vrai si la ligne de commande demande une simple simulation. */
export const simulation = process.argv.includes('--simulation');
