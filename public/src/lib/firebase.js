// Configuration Firebase cote client (app web « m2gdp-g6-don »).
//
// Ces valeurs sont PUBLIQUES par conception : elles sont livrees dans le bundle
// navigateur. La securite repose sur les regles Firestore / Realtime Database
// et sur les restrictions de la cle API, jamais sur le secret de ces valeurs.
// La service account key (acces admin) ne doit JAMAIS apparaitre ici : elle vit
// dans les secrets du Worker Cloudflare.
export const firebaseConfig = {
  apiKey: 'AIzaSyD8ZbZ-Sf7Rfej1HGYm4AOTHoUi9D6kFj8',
  authDomain: 'projet-bon-debarras.firebaseapp.com',
  projectId: 'projet-bon-debarras',
  storageBucket: 'projet-bon-debarras.firebasestorage.app',
  messagingSenderId: '134185101825',
  appId: '1:134185101825:web:ff72316d4db2548be46e00',
  measurementId: 'G-RWBDJ6R3Y6',
  databaseURL:
    'https://projet-bon-debarras-default-rtdb.europe-west1.firebasedatabase.app',
};

/** URL du backend Cloudflare Workers. */
export const API_BASE = 'https://m2gdp-g6-don.guillaume-lorel.workers.dev';
