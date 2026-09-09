// Configuration Firebase côté client (app web « m2gdp-g6-don »).
// Ces valeurs sont PUBLIQUES par conception : elles sont livrées dans le bundle
// navigateur. La sécurité repose sur les règles Firestore/RTDB et sur les
// restrictions de la clé API, jamais sur le secret de ces valeurs.
// La service account key (accès admin) ne doit JAMAIS apparaître ici.
export const firebaseConfig = {
  apiKey: "AIzaSyD8ZbZ-Sf7Rfej1HGYm4AOTHoUi9D6kFj8",
  authDomain: "projet-bon-debarras.firebaseapp.com",
  projectId: "projet-bon-debarras",
  storageBucket: "projet-bon-debarras.firebasestorage.app",
  messagingSenderId: "134185101825",
  appId: "1:134185101825:web:ff72316d4db2548be46e00",
  measurementId: "G-RWBDJ6R3Y6",
  databaseURL:
    "https://projet-bon-debarras-default-rtdb.europe-west1.firebasedatabase.app",
};
