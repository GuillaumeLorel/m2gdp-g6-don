/**
 * Worker Cloudflare — Backend m2gdp-g6-don (dons entre particuliers)
 *
 * Passerelle entre le front et les services auto-geres. Le front n'ecrit
 * jamais dans Firestore directement : il presente un jeton d'identite Firebase,
 * le Worker le verifie, puis agit avec la cle de service.
 *
 *   POST /api/auth/statut-email   l'email a-t-il deja un compte ?
 *   GET  /api/profil              profil de l'utilisateur connecte
 *   PUT  /api/profil              cree ou met a jour son profil
 *   GET  /api/utilisateurs        annuaire public des inscrits
 *   GET  /api/health              healthcheck
 */

import { verifierJetonIdentite, jetonService } from './google.js';
import { lireDocument, ecrireDocument, listerCollection } from './firestore.js';

const SCOPES = [
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/firebase',
  'https://www.googleapis.com/auth/identitytoolkit',
];

// Valeurs stockees en base : sans accent ni espace, pour rester stables.
// Un utilisateur peut cumuler les deux : on donne ce dont on n'a plus besoin
// tout en cherchant autre chose. Le champ est donc une liste, pas une valeur.
const ROLES = ['donateur', 'beneficiaire'];

/**
 * Origines autorisees. En plus du front en production, on laisse passer le
 * serveur de dev Vite : sans cela, impossible de developper en local.
 */
function origineAutorisee(origine, env) {
  if (!origine) return null;
  if (origine === env.ALLOWED_ORIGIN) return origine;
  if (/^http:\/\/localhost:\d+$/.test(origine)) return origine;
  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origine)) return origine;
  return null;
}

function entetesCors(request, env) {
  const origine = origineAutorisee(request.headers.get('Origin'), env);
  return {
    // Pas de joker : on renvoie l'origine seulement si elle est autorisee.
    ...(origine ? { 'Access-Control-Allow-Origin': origine } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (donnees, statut, cors) =>
  new Response(JSON.stringify(donnees), {
    status: statut,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });

/** Extrait et verifie le jeton d'identite. Renvoie null si absent ou invalide. */
async function utilisateurConnecte(request, env) {
  const entete = request.headers.get('Authorization') || '';
  if (!entete.startsWith('Bearer ')) return null;
  try {
    return await verifierJetonIdentite(entete.slice(7), env.FIREBASE_PROJECT_ID);
  } catch {
    return null;
  }
}

/** L'email a-t-il deja un compte Firebase Auth ? */
async function emailConnu(jeton, projectId, email) {
  const reponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
      body: JSON.stringify({ email: [email] }),
    },
  );
  if (!reponse.ok) throw new Error(`Identity Toolkit ${reponse.status}`);
  const { users = [] } = await reponse.json();
  return users.length > 0;
}

/** Valide le profil soumis. Renvoie la liste des erreurs, vide si tout va bien. */
function validerProfil(corps) {
  const erreurs = [];
  const texte = (v) => (typeof v === 'string' ? v.trim() : '');

  if (texte(corps.nom).length < 1) erreurs.push('Le nom est obligatoire.');
  if (texte(corps.nom).length > 80) erreurs.push('Le nom est trop long (80 max).');
  if (texte(corps.prenom).length < 1) erreurs.push('Le prénom est obligatoire.');
  if (texte(corps.prenom).length > 80) erreurs.push('Le prénom est trop long (80 max).');
  const roles = Array.isArray(corps.roles) ? corps.roles : [];
  if (roles.length === 0) {
    erreurs.push('Choisissez au moins un rôle.');
  } else if (roles.some((r) => !ROLES.includes(r))) {
    erreurs.push(`Rôles acceptés : ${ROLES.join(', ')}.`);
  } else if (new Set(roles).size !== roles.length) {
    erreurs.push('Un rôle est présent en double.');
  }
  if (texte(corps.adressePostale).length < 5) {
    erreurs.push("L'adresse postale est obligatoire (5 caractères minimum).");
  }
  if (texte(corps.adressePostale).length > 200) {
    erreurs.push("L'adresse postale est trop longue (200 max).");
  }

  if (!/^\d{5}$/.test(texte(corps.codePostal))) {
    erreurs.push('Le code postal doit comporter 5 chiffres.');
  }

  // Pas de condition d'age : la plateforme est ouverte aux mineurs. On verifie
  // seulement que la date existe et reste plausible.
  const naissance = texte(corps.dateNaissance);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(naissance)) {
    erreurs.push('La date de naissance est obligatoire (AAAA-MM-JJ).');
  } else {
    const date = new Date(`${naissance}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || naissance !== date.toISOString().slice(0, 10)) {
      erreurs.push("Cette date de naissance n'existe pas.");
    } else if (date > new Date()) {
      erreurs.push('La date de naissance ne peut pas être dans le futur.');
    } else if (Date.now() - date.getTime() > 120 * 365.25 * 24 * 3600 * 1000) {
      erreurs.push('Cette date de naissance est invalide.');
    }
  }

  return erreurs;
}

export default {
  async fetch(request, env) {
    const cors = entetesCors(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const { pathname } = new URL(request.url);

    try {
      /* --- Healthcheck ------------------------------------------------ */
      if (pathname === '/api/health') {
        return json({ status: 'ok', service: 'm2gdp-g6-don', ts: Date.now() }, 200, cors);
      }

      /* --- L'email a-t-il un compte ? --------------------------------- */
      // Sert a adapter le message affiche : « lien de connexion » pour un
      // inscrit, « lien d'inscription » pour un nouveau venu.
      if (pathname === '/api/auth/statut-email' && request.method === 'POST') {
        const { email } = await request.json().catch(() => ({}));
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return json({ erreur: 'Adresse email invalide.' }, 400, cors);
        }
        const jeton = await jetonService(env.FIREBASE_SERVICE_ACCOUNT, SCOPES);
        const existe = await emailConnu(jeton, env.FIREBASE_PROJECT_ID, email.toLowerCase());
        return json({ existe }, 200, cors);
      }

      /* --- Profil de l'utilisateur connecte ---------------------------- */
      if (pathname === '/api/profil') {
        const utilisateur = await utilisateurConnecte(request, env);
        if (!utilisateur) {
          return json({ erreur: 'Authentification requise.' }, 401, cors);
        }

        const jeton = await jetonService(env.FIREBASE_SERVICE_ACCOUNT, SCOPES);

        if (request.method === 'GET') {
          const profil = await lireDocument(
            jeton, env.FIREBASE_PROJECT_ID, 'utilisateurs', utilisateur.sub,
          );
          // 404 volontaire : le front s'en sert pour savoir qu'il doit
          // afficher le formulaire d'inscription.
          return profil
            ? json(profil, 200, cors)
            : json({ erreur: 'Profil inexistant.', inscriptionRequise: true }, 404, cors);
        }

        if (request.method === 'PUT') {
          const corps = await request.json().catch(() => ({}));
          const erreurs = validerProfil(corps);
          if (erreurs.length) return json({ erreurs }, 422, cors);

          const existant = await lireDocument(
            jeton, env.FIREBASE_PROJECT_ID, 'utilisateurs', utilisateur.sub,
          );

          const profil = await ecrireDocument(
            jeton, env.FIREBASE_PROJECT_ID, 'utilisateurs', utilisateur.sub,
            {
              // L'email vient du jeton verifie, jamais du corps de la requete :
              // sinon n'importe qui pourrait se declarer une autre adresse.
              email: utilisateur.email,
              nom: corps.nom.trim(),
              prenom: corps.prenom.trim(),
              // Ordre normalise, pour que l'affichage soit stable d'un profil
              // a l'autre quel que soit l'ordre de cochage.
              roles: ROLES.filter((r) => corps.roles.includes(r)),
              adressePostale: corps.adressePostale.trim(),
              codePostal: corps.codePostal.trim(),
              dateNaissance: corps.dateNaissance.trim(),
              photoUrl: typeof corps.photoUrl === 'string' ? corps.photoUrl : '',
              creeLe: existant?.creeLe || new Date().toISOString(),
              misAJourLe: new Date().toISOString(),
            },
          );
          return json(profil, existant ? 200 : 201, cors);
        }

        return json({ erreur: 'Méthode non autorisée.' }, 405, cors);
      }

      /* --- Annuaire des inscrits --------------------------------------- */
      if (pathname === '/api/utilisateurs' && request.method === 'GET') {
        const jeton = await jetonService(env.FIREBASE_SERVICE_ACCOUNT, SCOPES);
        const tous = await listerCollection(jeton, env.FIREBASE_PROJECT_ID, 'utilisateurs');
        // Liste BLANCHE, et non liste noire : l'annuaire est lisible sans etre
        // connecte, donc tout champ ajoute au profil ne doit pas s'y retrouver
        // par defaut. E-mail, adresse, code postal et date de naissance restent
        // prives.
        const publics = tous.map(({ id, prenom, nom, roles, photoUrl }) => ({
          id,
          prenom,
          nom,
          roles,
          photoUrl,
        }));
        return json({ utilisateurs: publics, total: publics.length }, 200, cors);
      }

      return json({ erreur: 'Route non trouvée', chemin: pathname }, 404, cors);
    } catch (erreur) {
      // Le detail part dans les logs (wrangler tail), pas au client.
      console.error(erreur);
      return json({ erreur: 'Erreur interne.' }, 500, cors);
    }
  },
};
