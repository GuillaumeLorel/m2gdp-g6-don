/** Appels au backend Cloudflare Workers. */
import { API_BASE } from '@/lib/config.js';
import { jetonIdentite } from '@/lib/auth.js';

async function appeler(chemin, options = {}) {
  const entetes = { ...options.headers };
  if (options.body) entetes['Content-Type'] = 'application/json';

  if (options.authentifie) {
    const jeton = await jetonIdentite();
    if (!jeton) throw new Error('Non connecté.');
    entetes.Authorization = `Bearer ${jeton}`;
  }

  const reponse = await fetch(`${API_BASE}${chemin}`, {
    method: options.method || 'GET',
    headers: entetes,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const donnees = await reponse.json().catch(() => ({}));
  return { statut: reponse.status, ok: reponse.ok, donnees };
}

/** L'adresse a-t-elle deja un compte ? Sert a adapter le message affiche. */
export async function statutEmail(email) {
  const { ok, donnees } = await appeler('/api/auth/statut-email', {
    method: 'POST',
    body: { email },
  });
  if (!ok) throw new Error(donnees.erreur || 'Vérification impossible.');
  return donnees.existe;
}

/** Profil de l'utilisateur connecte, ou null s'il doit encore s'inscrire. */
export async function chargerProfil() {
  const { statut, ok, donnees } = await appeler('/api/profil', { authentifie: true });
  if (statut === 404) return null;
  if (!ok) throw new Error(donnees.erreur || 'Chargement du profil impossible.');
  return donnees;
}

/** Cree ou met a jour le profil. Remonte les erreurs de validation du serveur. */
export async function enregistrerProfil(profil) {
  const { statut, ok, donnees } = await appeler('/api/profil', {
    method: 'PUT',
    authentifie: true,
    body: profil,
  });
  if (statut === 422) throw new Error(donnees.erreurs.join(' '));
  if (!ok) throw new Error(donnees.erreur || 'Enregistrement impossible.');
  return donnees;
}

/** Annuaire public des inscrits. */
export async function listerUtilisateurs() {
  const { ok, donnees } = await appeler('/api/utilisateurs');
  if (!ok) throw new Error(donnees.erreur || 'Chargement de l’annuaire impossible.');
  return donnees.utilisateurs;
}

// Les categories changent rarement : un seul appel par session suffit, partage
// par l'accueil, la recherche et la creation d'annonce.
let categoriesEnCours = null;

/** Arbre des categories (principales, avec leurs sous-categories). */
export function chargerCategories() {
  categoriesEnCours ??= appeler('/api/categories')
    .then(({ ok, donnees }) => {
      if (!ok) throw new Error(donnees.erreur || 'Chargement des catégories impossible.');
      return donnees.categories;
    })
    .catch((erreur) => {
      // Refus du serveur OU coupure reseau : on oublie l'echec, pour que le
      // prochain ecran retente au lieu de recevoir le meme rejet toute la session.
      categoriesEnCours = null;
      throw erreur;
    });
  return categoriesEnCours;
}

/** Fiche publique d'une annonce, ou null si elle n'existe pas (ou plus). */
export async function chargerAnnonce(id) {
  const { statut, ok, donnees } = await appeler(`/api/annonces/${encodeURIComponent(id)}`);
  if (statut === 404) return null;
  if (!ok) throw new Error(donnees.erreur || 'Chargement de l’annonce impossible.');
  return donnees;
}

/**
 * Page d'annonces. `criteres` reprend les parametres de GET /api/annonces ;
 * les valeurs vides sont ignorees.
 */
export async function chercherAnnonces(criteres = {}) {
  const parametres = new URLSearchParams();
  for (const [nom, valeur] of Object.entries(criteres)) {
    if (valeur !== undefined && valeur !== null && valeur !== '') parametres.set(nom, valeur);
  }
  const { ok, donnees } = await appeler(`/api/annonces?${parametres}`);
  if (!ok) {
    throw new Error(donnees.erreurs?.join(' ') || donnees.erreur || 'Chargement des annonces impossible.');
  }
  return donnees;
}
