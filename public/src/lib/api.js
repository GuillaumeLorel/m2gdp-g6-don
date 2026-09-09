/** Appels au backend Cloudflare Workers. */
import { API_BASE } from '@/lib/firebase.js';
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
