/**
 * Referentiels : categories (et, plus loin, associations).
 *
 * Ils changent rarement : on les garde en memoire quelques minutes, plutot que
 * de relire la base a chaque recherche d'annonces qui en a besoin.
 */
import { listerTable } from './base.js';

const DUREE_CACHE = 5 * 60 * 1000;
const cache = new Map();

async function enCache(cle, charger) {
  const entree = cache.get(cle);
  if (entree && Date.now() < entree.expire) return entree.valeur;
  const valeur = await charger();
  cache.set(cle, { valeur, expire: Date.now() + DUREE_CACHE });
  return valeur;
}

/**
 * Categories a plat, telles que stockees : chaque document porte `parentId`
 * (`null` pour une principale). Sert aux index du Worker.
 */
export function categoriesAPlat(env) {
  return enCache('categories', () => listerTable(env, 'categories'));
}

/** Associations, telles que stockees. */
export function associations(env) {
  return enCache('associations', () => listerTable(env, 'associations'));
}

/** Champs publics d'une association : liste blanche. */
export const versAssociation = ({ id, nom, description, thematique, numeroRna, codePostal, ville, siteWeb, logoUrl }) => ({
  id,
  nom,
  ...(description ? { description } : {}),
  ...(thematique ? { thematique } : {}),
  ...(numeroRna ? { numeroRna } : {}),
  ...(codePostal ? { codePostal } : {}),
  ...(ville ? { ville } : {}),
  ...(siteWeb ? { siteWeb } : {}),
  ...(logoUrl ? { logoUrl } : {}),
});

/** Champs publics d'une categorie : liste blanche, comme partout ailleurs. */
const versCategorie = ({ id, libelle, parentId, illustrationUrl, ordre }) => ({
  id,
  libelle,
  parentId: parentId ?? null,
  ...(illustrationUrl ? { illustrationUrl } : {}),
  ordre,
});

/** Arbre a deux niveaux, trie par `ordre` : la reponse de GET /api/categories. */
export async function arbreCategories(env) {
  const toutes = await categoriesAPlat(env);
  const parOrdre = (a, b) => (a.ordre ?? 0) - (b.ordre ?? 0);

  return toutes
    .filter((c) => !c.parentId)
    .sort(parOrdre)
    .map((principale) => ({
      ...versCategorie(principale),
      sousCategories: toutes
        .filter((c) => c.parentId === principale.id)
        .sort(parOrdre)
        .map(versCategorie),
    }));
}
