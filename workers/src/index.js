/**
 * Worker Cloudflare — Backend Donéo (don caritatif par la vente d'objets)
 *
 * Passerelle entre le front et les services auto-geres. Le front ne touche
 * jamais la base directement : il presente son jeton d'acces Supabase, le
 * Worker le fait verifier, puis lit et ecrit dans Supabase (Postgres, region
 * UE) avec la cle secrete.
 *
 *   POST /api/auth/statut-email   l'email a-t-il deja un compte ?
 *   GET  /api/profil              profil de l'utilisateur connecte
 *   PUT  /api/profil              cree ou met a jour son profil
 *   GET  /api/utilisateurs        annuaire public des inscrits
 *   GET  /api/categories          arbre des categories
 *   GET  /api/associations        associations beneficiaires
 *   GET  /api/annonces            recherche d'annonces (forme publique)
 *   POST /api/annonces            publier une annonce (offrant)
 *   GET  /api/annonces/{id}       fiche publique d'une annonce
 *   POST /api/medias              televerser une photo
 *   GET  /api/medias/{id}         redirige vers le fichier (Supabase Storage)
 *   DELETE /api/medias/{id}       supprimer une de ses photos
 *   GET  /api/health              healthcheck
 *
 * Connecte (J4) :
 *   GET|PATCH|DELETE /api/annonces/{id}/edition|{id}  modifier, retirer son annonce
 *   PUT|DELETE /api/annonces/{id}/favori, GET /api/favoris
 *   POST /api/annonces/{id}/conversation, GET /api/conversations,
 *   GET|POST /api/conversations/{id}/messages
 *   POST /api/annonces/{id}/reservations, GET /api/reservations?role=,
 *   GET /api/reservations/{id}, POST /api/reservations/{id}/(validation|
 *   declin|renonciation|paiement|paiement/confirmation)
 *   GET /api/profil/resume
 */

import { ecrireLigne, lireLigne, listerTable, profilExistePourEmail, utilisateurDuJeton } from './base.js';
import { validerAdresse } from './adresse.js';
import { chargerAnnonce, rechercherAnnonces } from './annonces.js';
import { contacter, envoyerMessage, lireConversation, listerConversations } from './conversations.js';
import { lireEdition, modifierAnnonce, retirerAnnonce } from './edition.js';
import { ajouterFavori, listerFavoris, retirerFavori } from './favoris.js';
import { supprimer, televerser, urlMedia } from './medias.js';
import { resumeProfil } from './profil.js';
import { publierAnnonce } from './publication.js';
import {
  confirmerPaiement,
  decliner,
  demander,
  lireReservation,
  listerReservations,
  payer,
  renoncer,
  valider,
} from './reservations.js';
import { arbreCategories, associations, versAssociation } from './referentiels.js';
import { correspond } from './texte.js';


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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
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

/** Utilisateur connecte d'apres le jeton presente, ou null si absent ou invalide. */
async function utilisateurConnecte(request, env) {
  const entete = request.headers.get('Authorization') || '';
  if (!entete.startsWith('Bearer ')) return null;
  return utilisateurDuJeton(env, entete.slice(7));
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
  // la rue. Memes regles que pour le lieu de retrait d'une annonce.
  erreurs.push(...validerAdresse(corps));

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

/**
 * Routes des echanges entre membres : favoris, messagerie, reservations,
 * modification d'annonce, profil. Renvoie null si le chemin n'en fait pas
 * partie. Les modules renvoient { statut, corps } ; ici, on ne fait que
 * l'aiguillage et l'authentification.
 */
async function routerEchanges(request, env, pathname, cors) {
  const m = (motif) => motif.exec(pathname);
  const methode = request.method;
  const routes = [
    [/^\/api\/annonces\/([\w-]{1,64})\/favori$/, ['PUT', 'DELETE']],
    [/^\/api\/favoris$/, ['GET']],
    [/^\/api\/annonces\/([\w-]{1,64})\/edition$/, ['GET']],
    [/^\/api\/annonces\/([\w-]{1,64})$/, ['PATCH', 'DELETE']],
    [/^\/api\/annonces\/([\w-]{1,64})\/conversation$/, ['POST']],
    [/^\/api\/conversations$/, ['GET']],
    [/^\/api\/conversations\/([\w-]{1,64})\/messages$/, ['GET', 'POST']],
    [/^\/api\/annonces\/([\w-]{1,64})\/reservations$/, ['POST']],
    [/^\/api\/reservations$/, ['GET']],
    [/^\/api\/reservations\/([\w-]{1,64})(?:\/(validation|declin|renonciation|paiement|paiement\/confirmation))?$/, ['GET', 'POST']],
    [/^\/api\/profil\/resume$/, ['GET']],
  ];
  if (!routes.some(([motif, methodes]) => motif.test(pathname) && methodes.includes(methode))) return null;

  const utilisateur = await utilisateurConnecte(request, env);
  if (!utilisateur) return json({ erreur: 'Authentification requise.' }, 401, cors);
  const uid = utilisateur.id;
  const corps = ['POST', 'PUT', 'PATCH'].includes(methode) ? await request.json().catch(() => ({})) : {};
  const repondre = ({ statut, corps: reponse }) =>
    statut === 204 ? new Response(null, { status: 204, headers: cors }) : json(reponse, statut, cors);

  let r;
  if ((r = m(/^\/api\/annonces\/([\w-]{1,64})\/favori$/))) {
    if (methode === 'DELETE') {
      await retirerFavori(env, uid, r[1]);
      return repondre({ statut: 204 });
    }
    const statut = await ajouterFavori(env, uid, r[1]);
    return statut === 204 ? repondre({ statut }) : json({ erreur: 'Cette annonce n’existe pas ou a été retirée.' }, 404, cors);
  }
  if (pathname === '/api/favoris') {
    const annonces = await listerFavoris(env, uid);
    return json({ total: annonces.length, page: 1, parPage: annonces.length, annonces }, 200, cors);
  }
  if ((r = m(/^\/api\/annonces\/([\w-]{1,64})\/edition$/))) return repondre(await lireEdition(env, uid, r[1]));
  if ((r = m(/^\/api\/annonces\/([\w-]{1,64})$/))) {
    return repondre(methode === 'DELETE' ? await retirerAnnonce(env, uid, r[1]) : await modifierAnnonce(env, uid, r[1], corps));
  }
  if ((r = m(/^\/api\/annonces\/([\w-]{1,64})\/conversation$/))) return repondre(await contacter(env, uid, r[1], corps.contenu));
  if (pathname === '/api/conversations') return json({ conversations: await listerConversations(env, uid) }, 200, cors);
  if ((r = m(/^\/api\/conversations\/([\w-]{1,64})\/messages$/))) {
    return repondre(methode === 'GET' ? await lireConversation(env, uid, r[1]) : await envoyerMessage(env, uid, r[1], corps.contenu));
  }
  if ((r = m(/^\/api\/annonces\/([\w-]{1,64})\/reservations$/))) return repondre(await demander(env, uid, r[1], corps.message));
  if (pathname === '/api/reservations') {
    const role = new URL(request.url).searchParams.get('role');
    if (!['demandeur', 'offrant'].includes(role)) return json({ erreurs: ['« role » doit valoir demandeur ou offrant.'] }, 422, cors);
    return json({ reservations: await listerReservations(env, uid, role) }, 200, cors);
  }
  if ((r = m(/^\/api\/reservations\/([\w-]{1,64})(?:\/(validation|declin|renonciation|paiement|paiement\/confirmation))?$/))) {
    const [, id, action] = r;
    if (!action) return methode === 'GET' ? repondre(await lireReservation(env, uid, id)) : null;
    if (methode !== 'POST') return null;
    if (action === 'validation') return repondre(await valider(env, uid, id));
    if (action === 'declin') return repondre(await decliner(env, uid, id));
    if (action === 'renonciation') return repondre(await renoncer(env, uid, id));
    if (action === 'paiement/confirmation') return repondre(await confirmerPaiement(env, uid, id));
    // Retour du tunnel de paiement sur le front qui l'a ouvert.
    const origine = origineAutorisee(request.headers.get('Origin'), env) || 'https://doneo-app.vercel.app';
    return repondre(await payer(env, uid, id, origine));
  }
  if (pathname === '/api/profil/resume') return json(await resumeProfil(env, uid), 200, cors);
  return null;
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
        // « A deja un compte » = a deja un profil : c'est ce qui decide si la
        // personne arrivera sur l'app ou sur le formulaire d'inscription.
        const existe = await profilExistePourEmail(env, email.toLowerCase());
        return json({ existe }, 200, cors);
      }

      /* --- Profil de l'utilisateur connecte ---------------------------- */
      if (pathname === '/api/profil') {
        const utilisateur = await utilisateurConnecte(request, env);
        if (!utilisateur) {
          return json({ erreur: 'Authentification requise.' }, 401, cors);
        }

        if (request.method === 'GET') {
          const profil = await lireLigne(env, 'utilisateurs', utilisateur.id);
          // 404 volontaire : le front s'en sert pour savoir qu'il doit
          // afficher le formulaire d'inscription.
          //
          return profil
            ? json({ id: utilisateur.id, ...profil }, 200, cors)
            : json({ erreur: 'Profil inexistant.', inscriptionRequise: true }, 404, cors);
        }

        if (request.method === 'PUT') {
          const corps = await request.json().catch(() => ({}));
          const erreurs = validerProfil(corps);
          if (erreurs.length) return json({ erreurs }, 422, cors);

          const existant = await lireLigne(env, 'utilisateurs', utilisateur.id);

          const profil = await ecrireLigne(env, 'utilisateurs', utilisateur.id, {
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
          return json({ id: utilisateur.id, ...profil }, existant ? 200 : 201, cors);
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

      if (pathname === '/api/annonces' && request.method === 'POST') {
        const utilisateur = await utilisateurConnecte(request, env);
        if (!utilisateur) return json({ erreur: 'Authentification requise.' }, 401, cors);
        const corps = await request.json().catch(() => ({}));
        const { statut, corps: reponse } = await publierAnnonce(env, corps, utilisateur.id);
        return json(reponse, statut, cors);
      }

      const routeAnnonce = /^\/api\/annonces\/([A-Za-z0-9_-]{1,64})$/.exec(pathname);
      if (routeAnnonce && request.method === 'GET') {
        const annonce = await chargerAnnonce(env, routeAnnonce[1]);
        return annonce
          ? json(annonce, 200, cors)
          : json({ erreur: 'Cette annonce n’existe pas ou a été retirée.' }, 404, cors);
      }

      /* --- Echanges entre membres (J4) : tout exige d'etre connecte ------ */
      const echanges = await routerEchanges(request, env, pathname, cors);
      if (echanges) return echanges;

      /* --- Medias (photos des annonces) --------------------------------- */
      if (pathname === '/api/medias' && request.method === 'POST') {
        const utilisateur = await utilisateurConnecte(request, env);
        if (!utilisateur) return json({ erreur: 'Authentification requise.' }, 401, cors);
        const { statut, corps } = await televerser(env, request, utilisateur.id);
        return json(corps, statut, cors);
      }

      const routeMedia = /^\/api\/medias\/([A-Za-z0-9-]{1,64})$/.exec(pathname);
      if (routeMedia && request.method === 'GET') {
        // Les photos sont servies par Supabase Storage : on y renvoie.
        return Response.redirect(urlMedia(env, routeMedia[1]), 302);
      }
      if (routeMedia && request.method === 'DELETE') {
        const utilisateur = await utilisateurConnecte(request, env);
        if (!utilisateur) return json({ erreur: 'Authentification requise.' }, 401, cors);
        const statut = await supprimer(env, routeMedia[1], utilisateur.id);
        if (statut === 204) return new Response(null, { status: 204, headers: cors });
        return json({ erreur: statut === 403 ? 'Cette photo appartient à un autre membre.' : 'Photo introuvable.' }, statut, cors);
      }

      return json({ erreur: 'Route non trouvée', chemin: pathname }, 404, cors);
    } catch (erreur) {
      // Le detail part dans les logs (wrangler tail), pas au client.
      console.error(erreur);
      return json({ erreur: 'Erreur interne.' }, 500, cors);
    }
  },
};
