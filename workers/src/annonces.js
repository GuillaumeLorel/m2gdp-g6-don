/**
 * Annonces : lecture, filtres et forme publique.
 *
 * Les volumes du projet — quelques centaines d'annonces — tiennent en memoire :
 * on lit la collection, puis on filtre, trie et pagine dans le Worker. C'est
 * plus simple que des requetes SQL dediees pour chaque filtre, et la base ne sait de
 * toute facon pas chercher du texte sans accents.
 */
import { lireLigne, lireLignes, listerTable } from './base.js';
import { versMedia } from './medias.js';
import { associations, categoriesAPlat } from './referentiels.js';
import { correspond } from './texte.js';

/** Statuts visibles par defaut : une annonce reservee accepte encore la file d'attente. */
const STATUTS_VISIBLES = ['disponible', 'reserve'];

const plusRecente = (a, b) => (b.creeLe || '').localeCompare(a.creeLe || '');
const debutCreneau = (a) => Date.parse(a.creneauRetrait?.debut) || Infinity;
const creneauTermine = (a) => (Date.parse(a.creneauRetrait?.fin) || 0) < Date.now();

/**
 * Tris de GET /api/annonces. A egalite, les plus recentes d'abord : l'ordre
 * reste stable d'une page a l'autre.
 *  - recent : les plus recentes d'abord (par defaut) ;
 *  - participation : la plus petite d'abord, pour qui compte chaque euro ;
 *  - creneau : le retrait le plus proche d'abord ; un creneau deja termine
 *    passe en fin de liste, il n'est plus possible d'y aller.
 */
const TRIS = {
  recent: plusRecente,
  participation: (a, b) => a.participation - b.participation || plusRecente(a, b),
  creneau: (a, b) =>
    creneauTermine(a) - creneauTermine(b) || debutCreneau(a) - debutCreneau(b) || plusRecente(a, b),
};

/** Valeurs d'etat de l'objet (schema EtatObjet). */
export const ETATS = ['neuf', 'tres_bon_etat', 'bon_etat', 'usage'];

const parId = (liste) => new Map(liste.map((x) => [x.id, x]));

/**
 * Met des annonces sous forme publique : SEUL chemin vers la forme publique,
 * pour la liste comme pour la fiche, afin qu'elles ne divergent jamais.
 *
 * Les referentiels viennent du cache ; les offrants sont lus un par un — en
 * un seul appel —, et seulement ceux des annonces renvoyees.
 */
export async function versAnnoncesPubliques(env, annonces, origine) {
  const [categories, listeAssociations, utilisateurs] = await Promise.all([
    categoriesAPlat(env),
    associations(env),
    lireLignes(env, 'utilisateurs', annonces.map((a) => a.offrantId)),
  ]);
  const contexte = { categories: parId(categories), associations: parId(listeAssociations), utilisateurs, origine };
  return annonces.map((a) => versAnnoncePublique(a, contexte));
}

/**
 * Une seule annonce, sous sa forme publique, ou null si elle n'existe pas ou a
 * ete retiree par son offrant. Une annonce remise reste consultable : un lien
 * partage ne doit pas tomber sur une erreur, la fiche dit simplement que
 * l'objet a trouve preneur.
 */
export async function chargerAnnonce(env, id, origine) {
  const annonce = await lireLigne(env, 'annonces', id);
  if (!annonce || annonce.statut === 'retiree') return null;
  const [publique] = await versAnnoncesPubliques(env, [annonce], origine);
  return publique;
}

/**
 * Ce qu'on montre d'un membre a cote de son annonce : prenom et initiale du
 * nom (« Claire M. »), comme sur les maquettes. Jamais l'adresse ni l'e-mail.
 */
function versProfilResume(utilisateur) {
  if (!utilisateur) return { id: '', prenom: 'Membre' };
  return {
    id: utilisateur.id,
    prenom: utilisateur.prenom,
    initialeNom: utilisateur.nom ? `${utilisateur.nom[0].toUpperCase()}.` : '',
    photoUrl: utilisateur.photoUrl || null,
  };
}

const resume = (entree) => (entree ? { id: entree.id, libelle: entree.libelle } : undefined);

/**
 * Forme PUBLIQUE d'une annonce. Liste blanche : numeroRue, rue,
 * complementAdresse, latitude et longitude n'y entrent jamais, quel que soit
 * l'appelant. Voir AGENTS.md et le schema AnnoncePublique.
 */
export function versAnnoncePublique(annonce, contexte) {
  const association = contexte.associations.get(annonce.associationId);
  const categorie = contexte.categories.get(annonce.categorieId);
  const sousCategorie = contexte.categories.get(annonce.sousCategorieId);
  return {
    id: annonce.id,
    titre: annonce.titre,
    description: annonce.description,
    categorie: resume(categorie),
    sousCategorie: resume(sousCategorie),
    etat: annonce.etat,
    participation: annonce.participation,
    association: association ? { id: association.id, nom: association.nom } : undefined,
    offrant: versProfilResume(contexte.utilisateurs.get(annonce.offrantId)),
    creneauRetrait: annonce.creneauRetrait,
    codePostal: annonce.codePostal,
    ville: annonce.ville,
    quartier: annonce.quartier || null,
    latitudeApprochee: annonce.latitudeApprochee,
    longitudeApprochee: annonce.longitudeApprochee,
    // Les photos sont servies par le Worker : leur adresse en depend.
    medias: (annonce.mediaIds || []).map((id) => versMedia(contexte.origine, id)),
    // US-12 : sans photo, l'annonce prend l'illustration de sa sous-categorie,
    // plus precise, sinon celle de sa categorie principale.
    illustrationUrl: sousCategorie?.illustrationUrl || categorie?.illustrationUrl,
    statut: annonce.statut,
    assisteeParIA: Boolean(annonce.assisteeParIA),
    creeLe: annonce.creeLe,
    misAJourLe: annonce.misAJourLe,
  };
}

/** Lit un entier de la requete, borne ; la valeur par defaut si absent. */
function entier(parametres, nom, defaut, min, max) {
  const brut = parametres.get(nom);
  if (brut === null || brut === '') return { valeur: defaut };
  const n = Number(brut);
  if (!Number.isInteger(n) || n < min || n > max) {
    return { erreur: `« ${nom} » doit être un entier entre ${min} et ${max}.` };
  }
  return { valeur: n };
}

/**
 * GET /api/annonces : filtre, trie et pagine. Renvoie { erreurs } si un
 * parametre est invalide, sinon la page au format PageAnnonces.
 */
export async function rechercherAnnonces(env, parametres, origine) {
  const erreurs = [];
  const page = entier(parametres, 'page', 1, 1, 10000);
  const parPage = entier(parametres, 'parPage', 20, 1, 50);
  if (page.erreur) erreurs.push(page.erreur);
  if (parPage.erreur) erreurs.push(parPage.erreur);
  if (erreurs.length) return { erreurs };

  const categorieId = parametres.get('categorieId');
  const sousCategorieId = parametres.get('sousCategorieId');
  // US-5 : les dons en cours d'un membre, pour son accueil. Ses annonces sont
  // de toute facon publiques : le filtre ne revele rien de plus.
  const offrantId = parametres.get('offrantId');
  const q = (parametres.get('q') || '').trim();
  if (q.length > 100) erreurs.push('La recherche est trop longue (100 caractères au plus).');

  const etat = parametres.get('etat');
  if (etat && !ETATS.includes(etat)) erreurs.push(`« etat » doit valoir : ${ETATS.join(', ')}.`);

  const tri = parametres.get('tri') || 'recent';
  if (tri === 'proximite') {
    erreurs.push('Le tri par proximité n’est pas encore disponible.');
  } else if (!TRIS[tri]) {
    erreurs.push(`« tri » doit valoir : ${Object.keys(TRIS).join(', ')}.`);
  }

  const brutMax = parametres.get('participationMax');
  const participationMax = brutMax === null || brutMax === '' ? null : Number(brutMax);
  if (participationMax !== null && (!Number.isFinite(participationMax) || participationMax < 0)) {
    erreurs.push('La participation maximale doit être un nombre positif.');
  }
  if (erreurs.length) return { erreurs };

  // Les filtres portent sur toute la collection, d'ou une lecture complete ;
  // les offrants, eux, ne sont lus que pour la page renvoyee.
  const toutes = await listerTable(env, 'annonces');
  const retenues = toutes
    .filter((a) => STATUTS_VISIBLES.includes(a.statut))
    .filter((a) => !offrantId || a.offrantId === offrantId)
    .filter((a) => !categorieId || a.categorieId === categorieId)
    .filter((a) => !sousCategorieId || a.sousCategorieId === sousCategorieId)
    .filter((a) => !etat || a.etat === etat)
    .filter((a) => participationMax === null || a.participation <= participationMax)
    // Chaque mot doit figurer dans le titre ou la description, sans tenir
    // compte des accents ni de la casse : « etagere » trouve « Étagère ».
    .filter((a) => !q || correspond(q, a.titre, a.description))
    .sort(TRIS[tri]);

  const debut = (page.valeur - 1) * parPage.valeur;
  return {
    total: retenues.length,
    page: page.valeur,
    parPage: parPage.valeur,
    annonces: await versAnnoncesPubliques(env, retenues.slice(debut, debut + parPage.valeur), origine),
  };
}
