/**
 * Publication d'une annonce (POST /api/annonces, US-6 a US-8).
 *
 * L'offrant est repris du jeton verifie, jamais du corps. Toutes les erreurs
 * de saisie sont renvoyees d'un coup (422), pour que le formulaire se corrige
 * en une fois. A la publication, l'adresse est geocodee : coordonnees exactes
 * (privees), quartier et position approchee (publics).
 */
import { ecrireLigne, lireLigne } from './base.js';
import { adresseNettoyee, geocoder, positionApprochee, validerAdresse } from './adresse.js';
import { ETATS, versAnnoncesPubliques } from './annonces.js';
import { proprietaire } from './medias.js';
import { associations, categoriesAPlat } from './referentiels.js';

const texte = (v) => (typeof v === 'string' ? v.trim() : '');
const MEDIAS_MAX = 8;

/** Erreurs de saisie des champs de l'annonce (hors medias), vide si tout va bien. */
async function validerChamps(env, corps) {
  const erreurs = [];

  if (!texte(corps.titre)) erreurs.push('Le titre est obligatoire.');
  else if (texte(corps.titre).length > 80) erreurs.push('Le titre est trop long (80 caractères au plus).');

  if (!texte(corps.description)) erreurs.push('La description est obligatoire.');
  else if (texte(corps.description).length > 1000) {
    erreurs.push('La description est trop longue (1000 caractères au plus).');
  }

  const categories = new Map((await categoriesAPlat(env)).map((c) => [c.id, c]));
  const categorie = categories.get(corps.categorieId);
  if (!categorie || categorie.parentId) erreurs.push('Choisissez une catégorie.');
  else if (categories.get(corps.sousCategorieId)?.parentId !== categorie.id) {
    erreurs.push('Choisissez une sous-catégorie de la catégorie choisie.');
  }

  if (!ETATS.includes(corps.etat)) erreurs.push("Choisissez l'état de l'objet.");

  // US-7 : la participation est obligatoire, au centime pres. Aucun plafond.
  const participation = corps.participation;
  if (typeof participation !== 'number' || !Number.isFinite(participation) || participation <= 0) {
    erreurs.push('La participation est obligatoire et doit être supérieure à 0 €.');
  } else if (Math.abs(participation * 100 - Math.round(participation * 100)) > 1e-6) {
    erreurs.push('La participation se donne au centime près.');
  }

  if (!(await associations(env)).some((a) => a.id === corps.associationId)) {
    erreurs.push("Choisissez l'association qui recevra la participation.");
  }

  // US-7 : un creneau ponctuel, a venir.
  const debut = Date.parse(corps.creneauRetrait?.debut);
  const fin = Date.parse(corps.creneauRetrait?.fin);
  if (Number.isNaN(debut) || Number.isNaN(fin)) {
    erreurs.push('Le créneau de retrait est obligatoire.');
  } else {
    if (debut <= Date.now()) erreurs.push('Le créneau de retrait doit commencer dans le futur.');
    if (fin <= debut) erreurs.push("L'heure de fin doit suivre l'heure de début.");
  }

  erreurs.push(...validerAdresse(corps));
  return erreurs;
}

/**
 * Publie l'annonce. Renvoie { statut, corps } : 201 et l'annonce publique, ou
 * 403 / 422 / 503 avec le ou les messages a afficher.
 */
export async function publierAnnonce(env, corps, utilisateurId, origine) {
  const profil = await lireLigne(env, 'utilisateurs', utilisateurId);
  if (!profil?.roles?.includes('offrant')) {
    return { statut: 403, corps: { erreur: 'Ajoutez le rôle offrant à votre profil pour publier une annonce.' } };
  }

  const erreurs = await validerChamps(env, corps);

  const mediaIds = corps.mediaIds ?? [];
  if (!Array.isArray(mediaIds) || mediaIds.length > MEDIAS_MAX || new Set(mediaIds).size !== mediaIds.length) {
    erreurs.push(`Une annonce compte ${MEDIAS_MAX} photos au plus.`);
  } else {
    const auteurs = await Promise.all(mediaIds.map((id) => proprietaire(env, String(id))));
    if (auteurs.some((a) => a === null)) erreurs.push('Une photo est introuvable : retirez-la et ajoutez-la de nouveau.');
    else if (auteurs.some((a) => a !== utilisateurId)) {
      return { statut: 403, corps: { erreur: "Une photo citée appartient à un autre membre." } };
    }
  }
  if (erreurs.length) return { statut: 422, corps: { erreurs } };

  const adresse = adresseNettoyee(corps);
  let position;
  try {
    position = await geocoder(adresse);
  } catch (e) {
    console.error(e);
    return {
      statut: 503,
      corps: { erreur: 'Le service de localisation des adresses ne répond pas. Réessayez dans un instant.' },
    };
  }
  if (!position) {
    return {
      statut: 422,
      corps: { erreurs: ['Adresse de retrait introuvable : vérifiez le numéro, la rue et le code postal.'] },
    };
  }

  const maintenant = new Date().toISOString();
  const annonce = await ecrireLigne(env, 'annonces', crypto.randomUUID(), {
    offrantId: utilisateurId,
    associationId: corps.associationId,
    categorieId: corps.categorieId,
    sousCategorieId: corps.sousCategorieId,
    titre: texte(corps.titre),
    description: texte(corps.description),
    etat: corps.etat,
    participation: corps.participation,
    creneauRetrait: {
      debut: new Date(corps.creneauRetrait.debut).toISOString(),
      fin: new Date(corps.creneauRetrait.fin).toISOString(),
    },
    ...adresse,
    latitude: position.latitude,
    longitude: position.longitude,
    ...(await positionApprochee(position.latitude, position.longitude, adresse)),
    quartier: position.quartier,
    mediaIds,
    statut: 'disponible',
    assisteeParIA: corps.assisteeParIA === true,
    fictif: false,
    creeLe: maintenant,
    misAJourLe: maintenant,
  });
  const [publique] = await versAnnoncesPubliques(env, [annonce], origine);
  return { statut: 201, corps: publique };
}
