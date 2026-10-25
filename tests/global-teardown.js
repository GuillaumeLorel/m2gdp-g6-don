/**
 * Apres tous les tests : supprime les photos televersees par les tests dans
 * le vrai Supabase Storage (depuis le debut de la suite, voir global-setup.js),
 * sans toucher aux photos des donnees de demo. Une seule fois, et pas dans chaque fichier : les
 * navigateurs tournent en parallele, un nettoyage anticipe retirerait la
 * photo d'un test encore en cours.
 */
import { PROFILS, supprimerPhotosDe } from './e2e/outils.js';

export default async function nettoyer() {
  const depuis = process.env.DONEO_DEBUT_TESTS;
  if (!depuis) return;
  for (const idLisible of Object.values(PROFILS)) await supprimerPhotosDe(idLisible, depuis);
}
