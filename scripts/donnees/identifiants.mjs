import { createHash } from 'node:crypto';

/**
 * Identifiant en base d'un profil de demonstration.
 *
 * Un profil porte l'identifiant de son compte Supabase Auth, un UUID. Les JSON
 * de demonstration gardent leurs identifiants lisibles (« demo-u-005 ») ; on en
 * derive un UUID stable (empreinte SHA-1, au format d'un UUID v5) : le meme
 * profil garde le meme identifiant a chaque chargement, et les tests
 * retrouvent leurs comptes.
 */
export function idUtilisateurDemo(idLisible) {
  if (!idLisible.startsWith('demo-u-')) return idLisible;
  const h = createHash('sha1').update(`doneo:${idLisible}`).digest('hex');
  const variante = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
