/**
 * Charge le referentiel des categories (specs/donnees/categories.json) dans la
 * table Supabase `categories`.
 *
 *   node scripts/donnees/charger-categories.mjs [--simulation]
 *
 * Le stockage est a plat — une categorie principale a `parentId: null`, une
 * sous-categorie l'identifiant de sa principale — et c'est le Worker qui
 * reconstruit l'arbre. Les identifiants sont stables : relancer le script met
 * a jour sans dupliquer. Une categorie retiree du fichier est supprimee.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RACINE_DEPOT, ecrireLot, listerIds, simulation, supprimerLot } from './supabase-admin.mjs';

const { categories } = JSON.parse(
  readFileSync(path.join(RACINE_DEPOT, 'specs/donnees/categories.json'), 'utf8'),
);

// Illustrations generees par generer-illustrations.mjs et servies par le front
// (public/static) : un chemin relatif suffit, l'app et ses images partagent
// la meme origine.
const illustration = (id) => `/illustrations/categories/${id}.svg`;

const documents = [];
categories.forEach((principale, i) => {
  documents.push({
    id: principale.id,
    libelle: principale.libelle,
    parentId: null,
    ordre: i + 1,
    icone: principale.icone,
    teinte: principale.teinte,
    illustrationUrl: illustration(principale.id),
  });
  principale.sousCategories.forEach((sous, j) => {
    documents.push({
      id: sous.id,
      libelle: sous.libelle,
      parentId: principale.id,
      ordre: j + 1,
      icone: sous.icone,
      // La teinte est celle de la principale : toute une famille d'objets
      // partage la meme couleur, ce qui aide a la reconnaitre dans une liste.
      teinte: principale.teinte,
      illustrationUrl: illustration(sous.id),
    });
  });
});

const sousCategories = documents.filter((d) => d.parentId);
console.log(`${categories.length} categories principales, ${sousCategories.length} sous-categories`);

const existants = await listerIds('categories');
const aSupprimer = existants.filter((id) => !documents.some((d) => d.id === id));

if (simulation) {
  console.log(`(simulation) ${documents.length} a ecrire, ${aSupprimer.length} a supprimer`);
} else {
  await ecrireLot('categories', documents);
  if (aSupprimer.length) await supprimerLot('categories', aSupprimer);
  console.log(`${documents.length} ecrites, ${aSupprimer.length} supprimees`);
}
