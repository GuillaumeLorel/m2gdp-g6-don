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

/** Associations beneficiaires, triees par nom. */
export async function chargerAssociations() {
  const { ok, donnees } = await appeler('/api/associations');
  if (!ok) throw new Error(donnees.erreur || 'Chargement des associations impossible.');
  return donnees.associations;
}

/**
 * Televerse une photo (multipart). Renvoie le media ; en cas de refus, une
 * erreur dont le message s'affiche tel quel (format, poids).
 */
export async function televerserPhoto(fichier) {
  const jeton = await jetonIdentite();
  if (!jeton) throw new Error('Non connecté.');
  const formulaire = new FormData();
  formulaire.append('fichier', fichier, fichier.name || 'photo.jpg');
  const reponse = await fetch(`${API_BASE}/api/medias`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}` },
    body: formulaire,
  }).catch(() => null);
  if (!reponse) throw new Error('Envoi de la photo impossible : vérifiez votre connexion.');
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) throw new Error(donnees.erreur || donnees.erreurs?.join(' ') || 'Envoi de la photo impossible.');
  return donnees;
}

/** Supprime une photo pas encore publiee. Un echec est sans consequence. */
export async function supprimerPhoto(id) {
  await appeler(`/api/medias/${encodeURIComponent(id)}`, { method: 'DELETE', authentifie: true }).catch(() => {});
}

/**
 * Publie une annonce. Renvoie l'annonce creee, ou leve une erreur portant
 * `erreurs` : la liste complete des refus, a afficher en une fois.
 */
export async function publierAnnonce(annonce) {
  const { ok, donnees } = await appeler('/api/annonces', { method: 'POST', authentifie: true, body: annonce });
  if (ok) return donnees;
  const erreur = new Error('Publication refusée.');
  erreur.erreurs = donnees.erreurs || [donnees.erreur || 'Publication impossible. Réessayez dans un instant.'];
  throw erreur;
}

/* --- Echanges entre membres (J4) ------------------------------------------ */

/**
 * Appel authentifie qui renvoie le corps, ou leve une erreur lisible : le
 * message du serveur, ou la liste de ses objections jointes.
 */
async function appelConnecte(chemin, options = {}, messageParDefaut = 'L’opération n’a pas abouti.') {
  const { ok, statut, donnees } = await appeler(chemin, { ...options, authentifie: true });
  if (ok) return donnees;
  const erreur = new Error(donnees.erreurs?.join(' ') || donnees.erreur || messageParDefaut);
  erreur.statut = statut;
  throw erreur;
}

/** Favoris : la liste, l'ajout, le retrait. */
export const chargerFavoris = () =>
  appelConnecte('/api/favoris', {}, 'Chargement des favoris impossible.').then((d) => d.annonces);
export const ajouterFavori = (annonceId) =>
  appelConnecte(`/api/annonces/${encodeURIComponent(annonceId)}/favori`, { method: 'PUT' });
export const retirerFavori = (annonceId) =>
  appelConnecte(`/api/annonces/${encodeURIComponent(annonceId)}/favori`, { method: 'DELETE' });

/** Messagerie. */
export const chargerConversations = () =>
  appelConnecte('/api/conversations', {}, 'Chargement des conversations impossible.').then((d) => d.conversations);
export const chargerConversation = (id) =>
  appelConnecte(`/api/conversations/${encodeURIComponent(id)}/messages`, {}, 'Chargement de la conversation impossible.');
export const envoyerMessage = (id, contenu) =>
  appelConnecte(`/api/conversations/${encodeURIComponent(id)}/messages`, { method: 'POST', body: { contenu } }, 'Envoi impossible.');
/** Ouvre (ou retrouve) la conversation avec l'offrant ; renvoie son identifiant. */
export const contacterOffrant = (annonceId, contenu) =>
  appelConnecte(`/api/annonces/${encodeURIComponent(annonceId)}/conversation`, { method: 'POST', body: contenu ? { contenu } : {} })
    .then((d) => d.id);

/** Reservations. */
export const demanderObjet = (annonceId, message) =>
  appelConnecte(`/api/annonces/${encodeURIComponent(annonceId)}/reservations`, { method: 'POST', body: message ? { message } : {} }, 'Demande impossible.');
export const chargerMesReservations = (role) =>
  appelConnecte(`/api/reservations?role=${role}`, {}, 'Chargement des réservations impossible.').then((d) => d.reservations);
const actionReservation = (id, action) =>
  appelConnecte(`/api/reservations/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
export const validerDemande = (id) => actionReservation(id, 'validation');
export const declinerDemande = (id) => actionReservation(id, 'declin');
export const renoncerReservation = (id) => actionReservation(id, 'renonciation');
/** Ouvre le tunnel de paiement de test ; renvoie l'adresse de la page Stripe. */
export const ouvrirPaiement = (id) => actionReservation(id, 'paiement').then((d) => d.urlPaiement);
export const confirmerPaiement = (id) => actionReservation(id, 'paiement/confirmation');

/** Modifier ou retirer son annonce. */
export const chargerEdition = (id) =>
  appelConnecte(`/api/annonces/${encodeURIComponent(id)}/edition`, {}, 'Chargement de l’annonce impossible.');
export async function modifierAnnonce(id, champs) {
  const { ok, donnees } = await appeler(`/api/annonces/${encodeURIComponent(id)}`, { method: 'PATCH', authentifie: true, body: champs });
  if (ok) return donnees;
  const erreur = new Error('Modification refusée.');
  erreur.erreurs = donnees.erreurs || [donnees.erreur || 'Modification impossible. Réessayez dans un instant.'];
  throw erreur;
}
export const retirerAnnonce = (id) =>
  appelConnecte(`/api/annonces/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'Retrait impossible.');

/** Profil : statistiques et toutes mes annonces. */
export const chargerResumeProfil = () => appelConnecte('/api/profil/resume', {}, 'Chargement du profil impossible.');
