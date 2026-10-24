/**
 * Texte normalise pour la recherche : minuscules, sans accents. « Étagère »,
 * « etagere » et « ÉTAGÈRE » deviennent la meme chaine, ce que la base ne
 * sait pas faire seul (il n'a pas de recherche plein texte).
 */
export const normaliser = (texte = '') =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Vrai si chaque mot de la recherche figure dans l'un des textes. */
export function correspond(recherche, ...textes) {
  const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
  const cible = normaliser(textes.filter(Boolean).join(' '));
  return mots.every((mot) => cible.includes(mot));
}
