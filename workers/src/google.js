/**
 * Acces authentifie aux API Google, depuis le Worker.
 *
 * Deux besoins distincts :
 *  - verifier le jeton d'identite presente par un utilisateur (cle publique)
 *  - agir en tant que projet pour lire/ecrire Firestore (cle de service)
 *
 * Aucune dependance : tout passe par WebCrypto, disponible dans les Workers.
 */

const JWK_FIREBASE =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

const b64urlVersOctets = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const octetsVersB64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const texte = (s) => new TextEncoder().encode(s);

/* ------------------------------------------------------------------ */
/*  1. Verification du jeton d'identite Firebase                       */
/* ------------------------------------------------------------------ */

// Les cles de signature de Google tournent regulierement. On les met en cache
// le temps indique par l'en-tete Cache-Control plutot que de les refetcher a
// chaque requete.
let cacheJwk = { cles: null, expire: 0 };

async function clesPubliques() {
  if (cacheJwk.cles && Date.now() < cacheJwk.expire) return cacheJwk.cles;

  const reponse = await fetch(JWK_FIREBASE);
  if (!reponse.ok) throw new Error('Cles publiques Google injoignables');

  const maxAge = /max-age=(\d+)/.exec(reponse.headers.get('cache-control') || '');
  const { keys } = await reponse.json();
  cacheJwk = {
    cles: keys,
    expire: Date.now() + (maxAge ? Number(maxAge[1]) : 3600) * 1000,
  };
  return keys;
}

/**
 * Verifie un jeton d'identite Firebase et renvoie ses revendications.
 * Leve une erreur si le jeton est invalide, expire, ou destine a un autre projet.
 */
export async function verifierJetonIdentite(jeton, projectId) {
  const parties = jeton.split('.');
  if (parties.length !== 3) throw new Error('Jeton malforme');

  const [enteteB64, corpsB64, signatureB64] = parties;
  const entete = JSON.parse(new TextDecoder().decode(b64urlVersOctets(enteteB64)));
  const corps = JSON.parse(new TextDecoder().decode(b64urlVersOctets(corpsB64)));

  if (entete.alg !== 'RS256') throw new Error('Algorithme inattendu');

  const jwk = (await clesPubliques()).find((k) => k.kid === entete.kid);
  if (!jwk) throw new Error('Cle de signature inconnue');

  const cle = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const valide = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cle,
    b64urlVersOctets(signatureB64),
    texte(`${enteteB64}.${corpsB64}`),
  );
  if (!valide) throw new Error('Signature invalide');

  // Une signature valide ne suffit pas : il faut aussi que le jeton nous soit
  // destine et qu'il soit encore valable.
  const maintenant = Math.floor(Date.now() / 1000);
  if (corps.exp <= maintenant) throw new Error('Jeton expire');
  if (corps.iat > maintenant + 60) throw new Error('Jeton date du futur');
  if (corps.aud !== projectId) throw new Error('Jeton destine a un autre projet');
  if (corps.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('Emetteur inattendu');
  }
  if (!corps.sub) throw new Error('Sujet absent');

  return corps;
}

/* ------------------------------------------------------------------ */
/*  2. Jeton d'acces au nom du projet (cle de service)                 */
/* ------------------------------------------------------------------ */

let cacheAcces = { jeton: null, expire: 0 };

/** Jeton OAuth pour appeler Firestore et l'API Identity Toolkit en admin. */
export async function jetonService(serviceAccountJson, scopes) {
  if (cacheAcces.jeton && Date.now() < cacheAcces.expire - 60_000) {
    return cacheAcces.jeton;
  }

  const sa = JSON.parse(serviceAccountJson);
  const maintenant = Math.floor(Date.now() / 1000);

  const entete = octetsVersB64url(texte(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const corps = octetsVersB64url(
    texte(
      JSON.stringify({
        iss: sa.client_email,
        scope: scopes.join(' '),
        aud: 'https://oauth2.googleapis.com/token',
        exp: maintenant + 3600,
        iat: maintenant,
      }),
    ),
  );

  // La cle privee est au format PEM PKCS#8 : on retire l'armure avant import.
  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const cle = await crypto.subtle.importKey(
    'pkcs8',
    b64urlVersOctets(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = octetsVersB64url(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cle, texte(`${entete}.${corps}`)),
  );

  const reponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${entete}.${corps}.${signature}`,
    }),
  });

  const donnees = await reponse.json();
  if (!donnees.access_token) {
    throw new Error(`Jeton de service refuse : ${JSON.stringify(donnees)}`);
  }

  cacheAcces = {
    jeton: donnees.access_token,
    expire: Date.now() + donnees.expires_in * 1000,
  };
  return cacheAcces.jeton;
}
