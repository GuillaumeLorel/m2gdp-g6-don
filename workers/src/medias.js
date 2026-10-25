/**
 * Medias : les photos des annonces, dans Supabase Storage (region UE).
 *
 * Le televersement est separe de la publication : le front envoie chaque
 * photo des qu'elle est choisie, recoit un identifiant, puis cite ces
 * identifiants dans l'annonce. L'auteur de la photo est note dans la table
 * `medias` : seul lui peut la citer ou la supprimer.
 *
 * Le bucket `medias` est public en lecture (supabase/migrations/002) : le
 * navigateur charge les photos directement depuis Supabase. Seul le Worker,
 * avec la cle secrete, y ecrit.
 */
import { deposerFichier, ecrireLigne, lireLigne, retirerFichiers, supprimerLigne, urlPublique } from './base.js';

/** Formats acceptes et taille maximale (voir POST /api/medias). */
export const TYPES_PHOTO = ['image/jpeg', 'image/png', 'image/webp'];
export const TAILLE_MAX = 5 * 1024 * 1024;

const BUCKET = 'medias';
const ID_VALIDE = /^[0-9a-f-]{36}$/;

/** Adresse publique d'une photo. */
export const urlMedia = (env, id) => urlPublique(env, BUCKET, id);

/** Forme publique d'un media (schema Media). */
export function versMedia(env, id, { typeMime, tailleOctets, creeLe } = {}) {
  return {
    id,
    type: 'photo',
    ...(typeMime ? { typeMime } : {}),
    ...(tailleOctets ? { tailleOctets } : {}),
    url: urlMedia(env, id),
    ...(creeLe ? { creeLe } : {}),
  };
}

/**
 * Enregistre la photo envoyee. Renvoie { statut, corps } : 201 et le media,
 * ou 413 / 415 / 422 avec un message lisible.
 */
export async function televerser(env, request, utilisateurId) {
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
  await deposerFichier(env, BUCKET, id, await fichier.arrayBuffer(), fichier.type);
  try {
    await ecrireLigne(env, 'medias', id, {
      proprietaireId: utilisateurId,
      typeMime: fichier.type,
      tailleOctets: fichier.size,
      creeLe,
    });
  } catch (e) {
    // Sans sa ligne, le fichier serait orphelin : on le retire.
    await retirerFichiers(env, BUCKET, [id]).catch(() => {});
    throw e;
  }
  return {
    statut: 201,
    corps: versMedia(env, id, { typeMime: fichier.type, tailleOctets: fichier.size, creeLe }),
  };
}

/** Auteur d'un media, ou null s'il n'existe pas. */
export async function proprietaire(env, id) {
  if (!ID_VALIDE.test(id)) return null;
  const media = await lireLigne(env, 'medias', id);
  return media ? media.proprietaireId : null;
}

/** Supprime un media de son auteur. Renvoie le statut HTTP : 204, 403 ou 404. */
export async function supprimer(env, id, utilisateurId) {
  const auteur = await proprietaire(env, id);
  if (auteur === null) return 404;
  if (auteur !== utilisateurId) return 403;
  await retirerFichiers(env, BUCKET, [id]);
  await supprimerLigne(env, 'medias', id);
  return 204;
}
