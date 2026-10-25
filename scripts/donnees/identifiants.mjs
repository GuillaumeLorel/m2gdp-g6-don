import { createHash } from 'node:crypto';

/** UUID stable tire d'une cle (empreinte SHA-1, au format d'un UUID v5). */
function uuidStable(cle) {
  const h = createHash('sha1').update(cle).digest('hex');
  const variante = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Identifiant en base d'un profil de demonstration.
 *
 * Un profil porte l'identifiant de son compte Supabase Auth, un UUID. Les JSON
 * de demonstration gardent leurs identifiants lisibles (« demo-u-005 ») ; on en
 * derive un UUID stable : le meme profil garde le meme identifiant a chaque
 * chargement, et les tests retrouvent leurs comptes.
 */
export function idUtilisateurDemo(idLisible) {
  if (!idLisible.startsWith('demo-u-')) return idLisible;
  return uuidStable(`doneo:${idLisible}`);
}

/**
 * Identifiant de la photo d'une annonce de demonstration : aussi le nom du
 * fichier dans le bucket `medias`. Stable, pour qu'un rechargement remplace la
 * photo au lieu d'en ajouter une.
 */
export const idPhotoDemo = (annonceId) => uuidStable(`doneo:photo:${annonceId}`);
