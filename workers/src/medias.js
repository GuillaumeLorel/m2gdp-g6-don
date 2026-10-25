/**
 * Medias : les photos des annonces, stockees dans R2.
 *
 * Le televersement est separe de la publication : le front envoie chaque
 * photo des qu'elle est choisie, recoit un identifiant, puis cite ces
 * identifiants dans l'annonce. L'auteur de la photo est note dans les
 * metadonnees de l'objet R2 : seul lui peut la citer ou la supprimer.
 *
 * Les fichiers sont servis par le Worker lui-meme (GET /api/medias/{id}) : le
 * bucket n'a pas d'acces public.
 */

/** Formats acceptes et taille maximale (voir POST /api/medias). */
export const TYPES_PHOTO = ['image/jpeg', 'image/png', 'image/webp'];
export const TAILLE_MAX = 5 * 1024 * 1024;

const cle = (id) => `medias/${id}`;
const ID_VALIDE = /^[0-9a-f-]{36}$/;

/** Adresse publique d'un media, servie par ce Worker. */
export const urlMedia = (origine, id) => `${origine}/api/medias/${id}`;

/** Forme publique d'un media (schema Media). */
export function versMedia(origine, id, { typeMime, tailleOctets, creeLe } = {}) {
  return {
    id,
    type: 'photo',
    ...(typeMime ? { typeMime } : {}),
    ...(tailleOctets ? { tailleOctets } : {}),
    url: urlMedia(origine, id),
    ...(creeLe ? { creeLe } : {}),
  };
}

/**
 * Enregistre la photo envoyee. Renvoie { statut, corps } : 201 et le media,
 * ou 413 / 415 / 422 avec un message lisible.
 */
export async function televerser(env, request, utilisateurId, origine) {
  const formulaire = await request.formData().catch(() => null);
  const fichier = formulaire?.get('fichier');
  if (!fichier || typeof fichier === 'string') {
    return { statut: 422, corps: { erreurs: ['Aucun fichier reçu (champ « fichier »).'] } };
  }
  if (!TYPES_PHOTO.includes(fichier.type)) {
    return { statut: 415, corps: { erreur: 'Format non pris en charge : JPEG, PNG ou WebP.' } };
  }
  if (fichier.size > TAILLE_MAX) {
    return { statut: 413, corps: { erreur: 'Cette photo est trop lourde (5 Mo au plus).' } };
  }

  const id = crypto.randomUUID();
  const creeLe = new Date().toISOString();
  await env.BUCKET_FICHIERS.put(cle(id), fichier.stream(), {
    httpMetadata: { contentType: fichier.type },
    customMetadata: { proprietaireId: utilisateurId, creeLe },
  });
  return {
    statut: 201,
    corps: versMedia(origine, id, { typeMime: fichier.type, tailleOctets: fichier.size, creeLe }),
  };
}

/** Le fichier d'un media, pret a renvoyer ; null s'il n'existe pas. */
export async function servir(env, id, cors) {
  if (!ID_VALIDE.test(id)) return null;
  const objet = await env.BUCKET_FICHIERS.get(cle(id));
  if (!objet) return null;
  return new Response(objet.body, {
    headers: {
      'Content-Type': objet.httpMetadata?.contentType || 'application/octet-stream',
      // Un identifiant designe toujours le meme fichier : il peut rester en
      // cache indefiniment.
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...cors,
    },
  });
}

/** Auteur d'un media, ou null s'il n'existe pas. */
export async function proprietaire(env, id) {
  if (!ID_VALIDE.test(id)) return null;
  const objet = await env.BUCKET_FICHIERS.head(cle(id));
  return objet ? objet.customMetadata?.proprietaireId || '' : null;
}

/** Supprime un media de son auteur. Renvoie le statut HTTP : 204, 403 ou 404. */
export async function supprimer(env, id, utilisateurId) {
  const auteur = await proprietaire(env, id);
  if (auteur === null) return 404;
  if (auteur !== utilisateurId) return 403;
  await env.BUCKET_FICHIERS.delete(cle(id));
  return 204;
}
