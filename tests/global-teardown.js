/**
 * Apres tous les tests : supprime les photos televersees par les tests dans
 * le vrai Supabase Storage. Une seule fois, et pas dans chaque fichier : les
 * navigateurs tournent en parallele, un nettoyage anticipe retirerait la
 * photo d'un test encore en cours.
 */
import { PROFILS, supprimerPhotosDe } from './e2e/outils.js';

export default async function nettoyer() {
  for (const idLisible of Object.values(PROFILS)) await supprimerPhotosDe(idLisible);
}
