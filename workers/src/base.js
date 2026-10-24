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
  return reponse.json();
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
