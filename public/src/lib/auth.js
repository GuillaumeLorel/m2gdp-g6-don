/**
 * Connexion sans mot de passe, par lien magique (Firebase Auth).
 *
 * C'est Firebase qui envoie l'email : inutile de monter un SMTP. Le Worker,
 * lui, ne voit que le jeton d'identite resultant.
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut,
} from 'firebase/auth';
import { firebaseConfig } from '@/lib/firebase.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = 'fr';

// Le lien magique s'ouvre potentiellement dans un autre onglet : Firebase a
// besoin de retrouver l'adresse saisie au depart. On la garde ici en attendant.
const CLE_EMAIL = 'don.email-en-attente';

/** Envoie le lien magique a l'adresse indiquee. */
export async function envoyerLienMagique(email) {
  await sendSignInLinkToEmail(auth, email, {
    // Le lien ramene sur l'app. Ce domaine doit figurer dans les domaines
    // autorises de Firebase Auth, sinon le retour est rejete.
    url: `${window.location.origin}/`,
    handleCodeInApp: true,
  });
  try {
    window.localStorage.setItem(CLE_EMAIL, email);
  } catch {
    // Navigation privee ou stockage bloque : on redemandera l'email au retour.
  }
}

/** L'URL courante est-elle un retour de lien magique ? */
export function estRetourDeLien() {
  return isSignInWithEmailLink(auth, window.location.href);
}

/** Email memorise lors de l'envoi, s'il est encore disponible. */
export function emailEnAttente() {
  try {
    return window.localStorage.getItem(CLE_EMAIL);
  } catch {
    return null;
  }
}

/**
 * Termine la connexion au retour du lien.
 * `email` doit etre fourni si l'appareil qui ouvre le lien n'est pas celui qui
 * a fait la demande (cas classique : demande sur ordinateur, ouverture sur
 * telephone).
 */
export async function finaliserConnexion(email) {
  const adresse = email || emailEnAttente();
  if (!adresse) throw new Error('EMAIL_MANQUANT');

  try {
    await signInWithEmailLink(auth, adresse, window.location.href);
  } catch (erreur) {
    // Un lien perime ou deja consomme n'est pas une panne : c'est un cas
    // nominal du parcours, qui merite son propre ecran plutot qu'un message
    // technique. On le distingue ici pour que l'appelant puisse l'aiguiller.
    if (
      erreur.code === 'auth/expired-action-code' ||
      erreur.code === 'auth/invalid-action-code'
    ) {
      const e = new Error('LIEN_INVALIDE');
      e.expire = erreur.code === 'auth/expired-action-code';
      throw e;
    }
    throw erreur;
  }

  try {
    window.localStorage.removeItem(CLE_EMAIL);
  } catch {
    /* sans importance */
  }

  // On retire le code a usage unique de la barre d'adresse : il ne doit pas
  // trainer dans l'historique ni etre rejoue par un rafraichissement.
  window.history.replaceState({}, '', window.location.origin + '/');
}

/** Jeton d'identite a presenter au Worker. */
export async function jetonIdentite() {
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

export const seDeconnecter = () => signOut(auth);
export const surChangementAuth = (rappel) => onAuthStateChanged(auth, rappel);
