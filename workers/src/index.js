/**
 * Worker Cloudflare — Backend Donéo (don caritatif par la vente d'objets)
 *
 * Passerelle entre le front et les services auto-geres. Le front ne touche
 * jamais la base directement : il presente un jeton d'identite Firebase, le
 * Worker le verifie, puis lit et ecrit dans Supabase (Postgres, region UE)
 * avec la cle secrete.
 *
 *   POST /api/auth/statut-email   l'email a-t-il deja un compte ?
 *   GET  /api/profil              profil de l'utilisateur connecte
 *   PUT  /api/profil              cree ou met a jour son profil
 *   GET  /api/utilisateurs        annuaire public des inscrits
 *   GET  /api/categories          arbre des categories
 *   GET  /api/associations        associations beneficiaires
 *   GET  /api/annonces            recherche d'annonces (forme publique)
 *   GET  /api/annonces/{id}       fiche publique d'une annonce
 *   GET  /api/health              healthcheck
 */

import { verifierJetonIdentite, jetonService } from './google.js';
import { ecrireLigne, lireLigne, listerTable } from './base.js';
import { chargerAnnonce, rechercherAnnonces } from './annonces.js';
import { arbreCategories, associations, versAssociation } from './referentiels.js';
import { correspond } from './texte.js';

// Firebase ne sert plus qu'a l'authentification : la cle de service n'a besoin
// que de l'API Identity Toolkit (savoir si un e-mail a deja un compte).
const SCOPES = ['https://www.googleapis.com/auth/identitytoolkit'];

// Valeurs stockees en base : sans accent ni espace, pour rester stables.
// Un utilisateur peut cumuler les deux : on donne ce dont on n'a plus besoin
// tout en cherchant autre chose. Le champ est donc une liste, pas une valeur.
const ROLES = ['offrant', 'demandeur'];

/**
 * Origines autorisees. En plus du front en production, on laisse passer le
 * serveur de dev Vite : sans cela, impossible de developper en local.
 */
function origineAutorisee(origine, env) {
  if (!origine) return null;
  // ALLOWED_ORIGIN est une liste separee par des virgules. Une etoile remplace
  // un segment d'adresse (lettres, chiffres, tirets) : elle sert aux apercus
  // que Vercel cree pour chaque branche, dont l'adresse change a chaque fois.
  const autorisees = (env.ALLOWED_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
  const correspond = (modele) =>
    new RegExp(`^${modele.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+')}$`).test(origine);
  if (autorisees.some(correspond)) return origine;
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
  // Adresse decomposee, et non une chaine unique : cela permet de publier
  // codePostal + ville dans l'annuaire sans jamais laisser sortir le numero et
  // la rue. Voir specs/data-model.md, « Adresse a deux niveaux ».
  if (texte(corps.numeroRue).length < 1) {
    erreurs.push('Le numéro de rue est obligatoire.');
  } else if (texte(corps.numeroRue).length > 10) {
    erreurs.push('Le numéro de rue est trop long (10 max).');
  }

  if (texte(corps.rue).length < 2) {
    erreurs.push('La rue est obligatoire.');
  } else if (texte(corps.rue).length > 150) {
    erreurs.push('Le nom de rue est trop long (150 max).');
  }

  // Facultatif : on ne controle que la longueur s'il est renseigne.
  if (texte(corps.complementAdresse).length > 100) {
    erreurs.push("Le complément d'adresse est trop long (100 max).");
  }

  if (!/^\d{5}$/.test(texte(corps.codePostal))) {
    erreurs.push('Le code postal doit comporter 5 chiffres.');
  }

  if (texte(corps.ville).length < 1) erreurs.push('La ville est obligatoire.');
  if (texte(corps.ville).length > 100) erreurs.push('Le nom de ville est trop long (100 max).');

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
        return json({ status: 'ok', service: 'doneo-api', ts: Date.now() }, 200, cors);
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

        if (request.method === 'GET') {
          const profil = await lireLigne(env, 'utilisateurs', utilisateur.sub);
          // 404 volontaire : le front s'en sert pour savoir qu'il doit
          // afficher le formulaire d'inscription.
          //
          return profil
            ? json({ id: utilisateur.sub, ...profil }, 200, cors)
            : json({ erreur: 'Profil inexistant.', inscriptionRequise: true }, 404, cors);
        }

        if (request.method === 'PUT') {
          const corps = await request.json().catch(() => ({}));
          const erreurs = validerProfil(corps);
          if (erreurs.length) return json({ erreurs }, 422, cors);

          const existant = await lireLigne(env, 'utilisateurs', utilisateur.sub);

          const profil = await ecrireLigne(env, 'utilisateurs', utilisateur.sub, {
              // L'email vient du jeton verifie, jamais du corps de la requete :
              // sinon n'importe qui pourrait se declarer une autre adresse.
              email: utilisateur.email,
              nom: corps.nom.trim(),
              prenom: corps.prenom.trim(),
              // Ordre normalise, pour que l'affichage soit stable d'un profil
              // a l'autre quel que soit l'ordre de cochage.
              roles: ROLES.filter((r) => corps.roles.includes(r)),
              numeroRue: corps.numeroRue.trim(),
              rue: corps.rue.trim(),
              // Facultatif : absent du corps, il devient une chaine vide plutot
              // qu'un undefined.
              complementAdresse:
                typeof corps.complementAdresse === 'string'
                  ? corps.complementAdresse.trim()
                  : '',
              codePostal: corps.codePostal.trim(),
              ville: corps.ville.trim(),
              dateNaissance: corps.dateNaissance.trim(),
              photoUrl: typeof corps.photoUrl === 'string' ? corps.photoUrl : '',
              creeLe: existant?.creeLe || new Date().toISOString(),
              misAJourLe: new Date().toISOString(),
          });
          return json({ id: utilisateur.sub, ...profil }, existant ? 200 : 201, cors);
        }

        return json({ erreur: 'Méthode non autorisée.' }, 405, cors);
      }

      /* --- Annuaire des inscrits --------------------------------------- */
      if (pathname === '/api/utilisateurs' && request.method === 'GET') {
        const tous = await listerTable(env, 'utilisateurs');
        // Liste BLANCHE, et non liste noire : l'annuaire est lisible sans etre
        // connecte, donc tout champ ajoute au profil ne doit pas s'y retrouver
        // par defaut.
        //
        // Ville et code postal y figurent volontairement : les objets se
        // remettent en main propre, donc la localisation approximative est
        // l'information utile de l'annuaire. On s'arrete la : l'adresse exacte,
        // l'e-mail et la date de naissance restent prives.
        //
        // Les profils crees avant l'ajout du champ n'ont pas de ville ; on
        // renvoie une chaine vide plutot qu'un trou, le front decide quoi
        // afficher.
        const publics = tous.map(({ id, prenom, nom, roles, photoUrl, codePostal, ville }) => ({
          id,
          prenom,
          nom,
          roles,
          photoUrl,
          codePostal: codePostal || '',
          ville: ville || '',
        }));
        return json({ utilisateurs: publics, total: publics.length }, 200, cors);
      }

      /* --- Categories --------------------------------------------------- */
      if (pathname === '/api/categories' && request.method === 'GET') {
        const categories = await arbreCategories(env);
        return json({ categories }, 200, cors);
      }

      /* --- Associations ------------------------------------------------- */
      if (pathname === '/api/associations' && request.method === 'GET') {
        const parametres = new URL(request.url).searchParams;
        const q = parametres.get('q') || '';
        const thematique = parametres.get('thematique');
        const codePostal = parametres.get('codePostal');

        const liste = (await associations(env))
          .filter((a) => !q || correspond(q, a.nom, a.description))
          .filter((a) => !thematique || a.thematique === thematique)
          .filter((a) => !codePostal || a.codePostal === codePostal)
          .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
          .map(versAssociation);
        return json({ associations: liste }, 200, cors);
      }

      /* --- Annonces ------------------------------------------------------ */
      if (pathname === '/api/annonces' && request.method === 'GET') {
        const resultat = await rechercherAnnonces(env, new URL(request.url).searchParams);
        if (resultat.erreurs) return json({ erreurs: resultat.erreurs }, 422, cors);
        return json(resultat, 200, cors);
      }

      const routeAnnonce = /^\/api\/annonces\/([A-Za-z0-9_-]{1,64})$/.exec(pathname);
      if (routeAnnonce && request.method === 'GET') {
        const annonce = await chargerAnnonce(env, routeAnnonce[1]);
        return annonce
          ? json(annonce, 200, cors)
          : json({ erreur: 'Cette annonce n’existe pas ou a été retirée.' }, 404, cors);
      }

      return json({ erreur: 'Route non trouvée', chemin: pathname }, 404, cors);
    } catch (erreur) {
      // Le detail part dans les logs (wrangler tail), pas au client.
      console.error(erreur);
      return json({ erreur: 'Erreur interne.' }, 500, cors);
    }
  },
};
