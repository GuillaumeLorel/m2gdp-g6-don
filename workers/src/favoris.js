/**
 * Favoris (US-21 et US-22, issues #49 et #50) : un couple (utilisateur,
 * annonce), sans identifiant propre, donc sans doublon possible.
 */
import { chercherLignes, insererLigne, lireLigne, lireLignes, supprimerLignes } from './base.js';
import { versAnnoncesPubliques } from './annonces.js';

/** Ajoute aux favoris. Idempotent. Renvoie le statut HTTP : 204 ou 404. */
export async function ajouterFavori(env, utilisateurId, annonceId) {
  const annonce = await lireLigne(env, 'annonces', annonceId);
  if (!annonce || annonce.statut === 'retiree') return 404;
  try {
    await insererLigne(env, 'favoris', { utilisateurId, annonceId, creeLe: new Date().toISOString() });
  } catch (e) {
    // Deja en favori : la cle primaire refuse le doublon, c'est le but.
    if (!/Supabase 409/.test(e.message)) throw e;
  }
  return 204;
}

/** Retire des favoris. Sans effet si l'annonce n'y etait pas. */
export async function retirerFavori(env, utilisateurId, annonceId) {
  await supprimerLignes(env, 'favoris', { utilisateurId, annonceId });
}

/**
 * Les annonces favorites, la plus recemment ajoutee d'abord — y compris celles
 * remises depuis, pour comprendre pourquoi elles ne sont plus disponibles.
 * Une annonce retiree par son offrant disparait : sa fiche n'existe plus.
 */
export async function listerFavoris(env, utilisateurId) {
  const favoris = await chercherLignes(env, 'favoris', { utilisateurId }, { ordre: 'creeLe.desc' });
  const annonces = await lireLignes(env, 'annonces', favoris.map((f) => f.annonceId));
  const presentes = favoris.map((f) => annonces.get(f.annonceId)).filter((a) => a && a.statut !== 'retiree');
  const publiques = await versAnnoncesPubliques(env, presentes);
  return publiques.map((a) => ({ ...a, estFavori: true }));
}
