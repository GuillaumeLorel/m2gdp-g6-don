/**
 * Favoris partages entre les ecrans (fiche, onglet Favoris) : la liste est
 * chargee une fois, puis chaque ajout ou retrait est repercute partout, sans
 * recharger. Un echec du serveur annule le changement affiche.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { ajouterFavori, chargerFavoris, retirerFavori } from '@/lib/api.js';

let ids = null; // Set des annonces favorites ; null tant que non charge
let chargement = null;
let charge = false; // la liste du serveur est-elle arrivee ?
// Change a chaque deconnexion : un chargement lance pour le compte precedent
// ne doit pas remplir les favoris du suivant.
let generation = 0;
// Ajouts et retraits faits pendant le chargement : la liste du serveur,
// lue avant eux, ne doit pas les ecraser.
const pendantChargement = new Map(); // annonceId -> true (ajout) | false (retrait)
const abonnes = new Set();
const prevenir = () => abonnes.forEach((f) => f());

function charger() {
  const pour = generation;
  chargement ??= chargerFavoris()
    .then((annonces) => {
      if (pour !== generation) return;
      ids = new Set(annonces.map((a) => a.id));
      charge = true;
      for (const [id, ajoute] of pendantChargement) {
        if (ajoute) ids.add(id);
        else ids.delete(id);
      }
      pendantChargement.clear();
      prevenir();
    })
    .catch(() => {
      if (pour === generation) chargement = null; // on retentera au prochain ecran
    });
  return chargement;
}

/** A la deconnexion : on oublie les favoris du compte precedent. */
export function oublierFavoris() {
  generation += 1;
  ids = null;
  chargement = null;
  charge = false;
  pendantChargement.clear();
  prevenir();
}

export async function basculerFavori(annonceId) {
  const etait = Boolean(ids?.has(annonceId));
  const appliquer = (ajoute) => {
    ids = new Set(ids || []);
    if (ajoute) ids.add(annonceId);
    else ids.delete(annonceId);
    if (!charge) pendantChargement.set(annonceId, ajoute);
  };
  appliquer(!etait);
  prevenir();
  try {
    await (etait ? retirerFavori(annonceId) : ajouterFavori(annonceId));
  } catch (e) {
    appliquer(etait);
    prevenir();
    throw e;
  }
}

/** L'ensemble des favoris (ou null pendant le chargement), tenu a jour. */
export function useFavoris() {
  useEffect(() => {
    charger();
  }, []);
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => ids,
  );
}
