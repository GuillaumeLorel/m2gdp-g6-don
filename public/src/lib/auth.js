/**
 * Connexion sans mot de passe, par lien magique (Supabase Auth, region UE).
 *
 * C'est Supabase qui envoie l'e-mail. Le Worker, lui, ne voit que le jeton
 * d'acces resultant, qu'il fait verifier par Supabase.
 *
 * Le lien de l'e-mail pointe directement sur l'app, avec un jeton a usage
 * unique (?token_hash=…) que l'app echange contre une session : l'e-mail ne
 * contient aucune adresse supabase.co, domaine que les filtres anti-spam
 * (celui de Lyon 2 notamment) rejettent. Il fonctionne aussi d'un appareil a
 * l'autre. L'e-mail porte en plus un code a 6 chiffres, a saisir dans l'app
 * si le lien est inutilisable. Modeles d'e-mail : supabase/templates/.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CLE_PUBLIQUE, SUPABASE_URL } from '@/lib/config.js';

// Le retour de lien est lu AVANT la creation du client, qui nettoie l'URL des
// qu'il a recupere la session. Trois formes : le jeton de nos modeles
// (?token_hash=…&type=email) ; la session deja ouverte (#access_token=…) si
// l'e-mail suit encore le modele par defaut de Supabase ; une erreur
// (error_code=otp_expired pour un lien perime).
function lireRetour() {
  const parametres = new URLSearchParams(
    `${window.location.hash.replace(/^#/, '')}&${window.location.search.replace(/^\?/, '')}`,
  );
  if (parametres.get('token_hash')) {
    return { type: 'jeton', jeton: parametres.get('token_hash'), typeOtp: parametres.get('type') || 'email' };
  }
  if (parametres.get('access_token')) return { type: 'session' };
  if (parametres.get('error') || parametres.get('error_code')) {
    return { type: 'erreur', code: parametres.get('error_code') || parametres.get('error') };
  }
  return null;
}
const retour = lireRetour();

export const supabase = createClient(SUPABASE_URL, SUPABASE_CLE_PUBLIQUE, {
  auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true },
});

// Adresse saisie, gardee pour pre-remplir l'ecran « lien invalide ».
const CLE_EMAIL = 'doneo.email-en-attente';

/** Messages lisibles pour les refus de Supabase. */
function traduire(erreur) {
  const message = erreur?.message || '';
  if (erreur?.status === 429 || /rate limit|too many/i.test(message)) {
    return 'Trop de demandes de lien pour le moment. Patientez une minute avant de réessayer.';
  }
  if (/invalid.*email|email.*invalid/i.test(message)) return 'Cette adresse e-mail n’est pas valide.';
  return 'L’envoi du lien a échoué. Réessayez dans un instant.';
}

/** Envoie le lien magique a l'adresse indiquee (cree le compte au besoin). */
export async function envoyerLienMagique(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Le lien ramene sur l'app ({{ .RedirectTo }} des modeles). Cette
      // adresse doit figurer dans les « Redirect URLs » de Supabase, sinon il
      // ramene sur la « Site URL ».
      emailRedirectTo: `${window.location.origin}/`,
      shouldCreateUser: true,
    },
  });
  if (error) throw new Error(traduire(error));
  try {
    window.localStorage.setItem(CLE_EMAIL, email);
  } catch {
    // Navigation privee ou stockage bloque : sans consequence.
  }
}

/** L'URL courante est-elle un retour de lien magique ? */
export const estRetourDeLien = () => retour !== null;

/** Email memorise lors de l'envoi, s'il est encore disponible. */
export function emailEnAttente() {
  try {
    return window.localStorage.getItem(CLE_EMAIL);
  } catch {
    return null;
  }
}

/**
 * Termine la connexion au retour du lien. La session elle-meme est recuperee
 * par le client Supabase ; on traduit seulement un lien perime ou deja
 * consomme en une erreur que l'appelant aiguille vers l'ecran dedie — ce
 * n'est pas une panne, c'est un cas nominal du parcours.
 */
export async function finaliserConnexion() {
  const lienInvalide = (code) => {
    const e = new Error('LIEN_INVALIDE');
    e.expire = code === 'otp_expired';
    return e;
  };
  if (retour?.type === 'erreur') {
    window.history.replaceState({}, '', `${window.location.origin}/`);
    throw lienInvalide(retour.code);
  }
  if (retour?.type === 'jeton') {
    window.history.replaceState({}, '', `${window.location.origin}/`);
    const { error } = await supabase.auth.verifyOtp({ token_hash: retour.jeton, type: retour.typeOtp });
    if (error) throw lienInvalide(error.code);
    return;
  }
  await supabase.auth.getSession();
}

/** Connexion par le code a 6 chiffres de l'e-mail, si le lien est inutilisable. */
export async function verifierCode(email, code) {
  const { error } = await supabase.auth.verifyOtp({ email, token: code.replace(/\s/g, ''), type: 'email' });
  if (!error) return;
  if (error.status === 429) throw new Error(traduire(error));
  throw new Error('Ce code est incorrect ou a expiré. Vérifiez-le, ou demandez un nouvel e-mail.');
}

/** Jeton d'acces a presenter au Worker. */
export async function jetonIdentite() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export const seDeconnecter = () => supabase.auth.signOut();

/** Appelle `rappel(utilisateur | null)` a chaque changement ; renvoie de quoi se desabonner. */
export function surChangementAuth(rappel) {
  const { data } = supabase.auth.onAuthStateChange((_evenement, session) => rappel(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

// En developpement seulement : les tests automatises entrent dans l'app en
// fournissant une session obtenue cote test (avec la cle secrete), sans
// ouvrir de boite mail. Le build de production ne contient pas ce code.
if (import.meta.env.DEV) {
  window.__doneoTest = { connecter: (session) => supabase.auth.setSession(session) };
}
