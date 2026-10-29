/**
 * Acces aux donnees, sur Supabase (Postgres, region UE).
 *
 * Par l'API REST de Supabase (PostgREST), avec la cle secrete : elle contourne
 * la Row Level Security, active sans aucune regle d'acces. Le navigateur ne
 * peut donc rien lire directement ; tout passe par le Worker, qui filtre par
 * liste blanche. Aucune dependance : un simple fetch.
 *
 * Les noms de colonnes sont ceux de l'API (camelCase, en francais) : les
 * lignes renvoyees ont la meme forme que les documents Firestore d'avant.
 */

async function appeler(env, chemin, options = {}) {
  const reponse = await fetch(`${env.SUPABASE_URL}/rest/v1/${chemin}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      'content-type': 'application/json',
      ...options.headers,
    },
  });
  if (!reponse.ok) throw new Error(`Supabase ${reponse.status} : ${await reponse.text()}`);
  // Une suppression repond sans corps (204).
  const texte = await reponse.text();
  return texte ? JSON.parse(texte) : null;
}

const filtreIds = (ids) =>
  `id=in.(${encodeURIComponent(ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(','))})`;

/** Une ligne, ou null si elle n'existe pas. */
export async function lireLigne(env, table, id) {
  const [ligne] = await appeler(env, `${table}?${filtreIds([id])}&select=*`);
  return ligne ?? null;
}

/** Plusieurs lignes par identifiant : une Map id -> ligne (les absents n'y sont pas). */
export async function lireLignes(env, table, ids) {
  const uniques = [...new Set(ids.filter(Boolean))];
  if (uniques.length === 0) return new Map();
  const lignes = await appeler(env, `${table}?${filtreIds(uniques)}&select=*`);
  return new Map(lignes.map((l) => [l.id, l]));
}

/** Cree ou remplace une ligne ; renvoie la ligne enregistree. */
export async function ecrireLigne(env, table, id, donnees) {
  const [ligne] = await appeler(env, `${table}?on_conflict=id`, {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ ...donnees, id }),
  });
  return ligne;
}

/** Vrai si un profil porte deja cette adresse e-mail. */
export async function profilExistePourEmail(env, email) {
  const lignes = await appeler(env, `utilisateurs?email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
  return lignes.length > 0;
}

/**
 * Utilisateur connecte, d'apres son jeton d'acces Supabase : Supabase verifie
 * lui-meme signature et expiration. Renvoie { id, email } ou null.
 */
export async function utilisateurDuJeton(env, jeton) {
  const reponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${jeton}` },
  });
  if (!reponse.ok) return null;
  const { id, email } = await reponse.json();
  return id ? { id, email } : null;
}

/**
 * Toute une table. Les volumes du projet — quelques centaines de lignes —
 * tiennent en memoire : on filtre et trie ensuite dans le Worker.
 */
export function listerTable(env, table, limite = 2000) {
  return appeler(env, `${table}?select=*&limit=${limite}`);
}

/** Supprime une ligne ; sans effet si elle n'existe pas. */
export async function supprimerLigne(env, table, id) {
  await appeler(env, `${table}?${filtreIds([id])}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
}

/**
 * Filtre PostgREST a partir d'un objet : { statut: 'proposee', annonceId: 'x' }
 * donne `statut=eq.proposee&annonceId=eq.x`. Une liste donne un `in.(...)`.
 */
function filtre(criteres) {
  return Object.entries(criteres)
    .map(([champ, valeur]) =>
      Array.isArray(valeur)
        ? `${champ}=in.(${encodeURIComponent(valeur.map((v) => `"${String(v).replace(/"/g, '')}"`).join(','))})`
        : `${champ}=eq.${encodeURIComponent(valeur)}`,
    )
    .join('&');
}

/** Lignes qui satisfont tous les criteres, dans l'ordre demande (ex. « creeLe.desc »). */
export function chercherLignes(env, table, criteres, { ordre, limite = 2000 } = {}) {
  return appeler(env, `${table}?${filtre(criteres)}&select=*${ordre ? `&order=${ordre}` : ''}&limit=${limite}`);
}

/** Insere une ligne ; renvoie la ligne enregistree. Echoue si elle existe deja. */
export async function insererLigne(env, table, donnees) {
  const [ligne] = await appeler(env, table, {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify(donnees),
  });
  return ligne;
}

/**
 * Met a jour les lignes qui satisfont `criteres`, et renvoie celles modifiees.
 * C'est la garde contre les doubles clics et les courses : « passer a
 * `proposee` la reservation X SI elle est encore `demandee` » ne modifie rien
 * — et renvoie une liste vide — si quelqu'un est passe avant.
 */
export function mettreAJour(env, table, criteres, champs) {
  return appeler(env, `${table}?${filtre(criteres)}`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify(champs),
  });
}

/** Supprime les lignes qui satisfont `criteres`. */
export async function supprimerLignes(env, table, criteres) {
  await appeler(env, `${table}?${filtre(criteres)}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
}

/* --- Supabase Storage ------------------------------------------------------ */

const urlStockage = (env, chemin) => `${env.SUPABASE_URL}/storage/v1/${chemin}`;
const entetesStockage = (env) => ({ apikey: env.SUPABASE_SECRET_KEY, authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` });

/** Adresse publique d'un fichier d'un bucket public. */
export const urlPublique = (env, bucket, nom) => urlStockage(env, `object/public/${bucket}/${nom}`);

/** Depose un fichier dans un bucket. */
export async function deposerFichier(env, bucket, nom, contenu, typeMime) {
  const reponse = await fetch(urlStockage(env, `object/${bucket}/${nom}`), {
    method: 'POST',
    headers: {
      ...entetesStockage(env),
      'content-type': typeMime,
      // Un nom designe toujours le meme fichier : cache d'un an.
      'cache-control': 'max-age=31536000',
    },
    body: contenu,
  });
  if (!reponse.ok) throw new Error(`Supabase Storage ${reponse.status} : ${await reponse.text()}`);
}

/** Retire des fichiers d'un bucket ; les absents sont ignores. */
export async function retirerFichiers(env, bucket, noms) {
  if (noms.length === 0) return;
  const reponse = await fetch(urlStockage(env, `object/${bucket}`), {
    method: 'DELETE',
    headers: { ...entetesStockage(env), 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: noms }),
  });
  if (!reponse.ok) throw new Error(`Supabase Storage ${reponse.status} : ${await reponse.text()}`);
}
