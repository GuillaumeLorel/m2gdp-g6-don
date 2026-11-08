/**
 * Consentement aux fonctions IA : le texte et les photos partent chez un tiers
 * (Google Gemini). Il est demande la premiere fois, une fois par fonction, puis
 * retenu dans ce navigateur : on ne le redemande pas a chaque usage. Il se
 * retire d'un clic. Sans stockage disponible (navigation privee), on redemande.
 */
export const FONCTIONS_IA = { brouillon: "brouillon", recherche: "recherche-image" };

const cle = (fonction) => `doneo-consentement-ia-${fonction}`;

export function consentementDonne(fonction) {
  try {
    return localStorage.getItem(cle(fonction)) === "1";
  } catch {
    return false;
  }
}

export function donnerConsentement(fonction) {
  try {
    localStorage.setItem(cle(fonction), "1");
  } catch {
    /* stockage indisponible : le consentement sera redemande */
  }
}

export function retirerConsentement(fonction) {
  try {
    localStorage.removeItem(cle(fonction));
  } catch {
    /* rien a retirer */
  }
}
