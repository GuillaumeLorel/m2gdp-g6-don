/**
 * Favoris partages entre les ecrans (fiche, onglet Favoris) : la liste est
 * chargee une fois, puis chaque ajout ou retrait est repercute partout, sans
 * recharger. Un echec du serveur annule le changement affiche.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { ajouterFavori, chargerFavoris, retirerFavori } from '@/lib/api.js';

let ids = null; // Set des annonces favorites ; null tant que non charge
let chargement = null;
const abonnes = new Set();
const prevenir = () => abonnes.forEach((f) => f());

function charger() {
  chargement ??= chargerFavoris()
    .then((annonces) => {
      ids = new Set(annonces.map((a) => a.id));
      prevenir();
    })
    .catch(() => {
      chargement = null; // on retentera au prochain ecran
    });
  return chargement;
}

/** A la deconnexion : on oublie les favoris du compte precedent. */
export function oublierFavoris() {
  ids = null;
  chargement = null;
  prevenir();
}

export async function basculerFavori(annonceId) {
  const etait = ids?.has(annonceId);
  ids = new Set(ids || []);
  if (etait) ids.delete(annonceId);
  else ids.add(annonceId);
  prevenir();
  try {
    await (etait ? retirerFavori(annonceId) : ajouterFavori(annonceId));
  } catch (e) {
    ids = new Set(ids);
    if (etait) ids.add(annonceId);
    else ids.delete(annonceId);
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
