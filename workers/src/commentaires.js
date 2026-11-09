/**
 * Questions publiques sous une annonce (EPIC 9, US-53 a US-55).
 *
 * Un demandeur pose une question, l'offrant y repond une fois (reponse
 * modifiable). Public, contrairement a la messagerie. Moderation minimale :
 * l'auteur supprime sa question, l'offrant masque ou retablit celles posees
 * sous son annonce. Les fonctions renvoient { statut, corps }.
 */
import { chercherLignes, insererLigne, lireLigne, lireLignes, mettreAJour, supprimerLignes } from './base.js';
import { versProfilResume } from './annonces.js';

export const LONGUEUR_MAX_COMMENTAIRE = 500;

const maintenant = () => new Date().toISOString();
const refus = (statut, erreur) => ({ statut, corps: { erreur } });

function erreurTexte(contenu, quoi) {
  if (typeof contenu !== 'string' || !contenu.trim()) return `Écrivez votre ${quoi}.`;
  if (contenu.trim().length > LONGUEUR_MAX_COMMENTAIRE) {
    return `Votre ${quoi} est trop longue (${LONGUEUR_MAX_COMMENTAIRE} caractères au plus).`;
  }
  return null;
}

/** Forme publique d'un commentaire : liste blanche. */
const versCommentaire = (c, auteur) => ({
  id: c.id,
  annonceId: c.annonceId,
  auteur: versProfilResume(auteur),
  contenu: c.contenu,
  reponse: c.reponse ?? null,
  statut: c.statut,
  creeLe: c.creeLe,
  misAJourLe: c.misAJourLe,
});

async function avecAuteur(env, c) {
  return versCommentaire(c, await lireLigne(env, 'utilisateurs', c.auteurId));
}

/**
 * Questions d'une annonce, de la plus ancienne a la plus recente. Les
 * questions masquees ne sont vues que de l'offrant, qui peut les retablir.
 */
export async function listerCommentaires(env, lecteurId, annonceId, { page = 1, parPage = 20 } = {}) {
  const annonce = await lireLigne(env, 'annonces', annonceId);
  if (!annonce || (annonce.statut === 'retiree' && annonce.offrantId !== lecteurId)) {
    return refus(404, 'Cette annonce n’existe pas ou a été retirée.');
  }
  const tous = await chercherLignes(env, 'commentaires', { annonceId }, { ordre: 'creeLe.asc' });
  const lisibles = lecteurId === annonce.offrantId ? tous : tous.filter((c) => c.statut === 'visible');
  const pageCourante = lisibles.slice((page - 1) * parPage, page * parPage);
  const auteurs = await lireLignes(env, 'utilisateurs', pageCourante.map((c) => c.auteurId));
  return {
    statut: 200,
    corps: {
      total: lisibles.length,
      page,
      parPage,
      commentaires: pageCourante.map((c) => versCommentaire(c, auteurs.get(c.auteurId))),
    },
  };
}

/** Un demandeur pose une question sous l'annonce d'un autre (US-53). */
export async function poserQuestion(env, utilisateurId, annonceId, contenu) {
  const [profil, annonce] = await Promise.all([
    lireLigne(env, 'utilisateurs', utilisateurId),
    lireLigne(env, 'annonces', annonceId),
  ]);
  if (!annonce || annonce.statut === 'retiree') return refus(404, 'Cette annonce n’existe pas ou a été retirée.');
  if (annonce.offrantId === utilisateurId) {
    return refus(403, 'C’est votre annonce : vous répondez aux questions, vous n’en posez pas.');
  }
  if (!profil?.roles?.includes('demandeur')) {
    return refus(403, 'Ajoutez le rôle demandeur à votre profil pour poser une question.');
  }
  if (annonce.statut === 'remis') return refus(409, 'Cet objet a déjà été remis : les questions sont closes.');
  const erreur = erreurTexte(contenu, 'question');
  if (erreur) return { statut: 422, corps: { erreurs: [erreur] } };

  const commentaire = await insererLigne(env, 'commentaires', {
    id: crypto.randomUUID(),
    annonceId,
    auteurId: utilisateurId,
    contenu: contenu.trim(),
    statut: 'visible',
    creeLe: maintenant(),
    misAJourLe: maintenant(),
  });
  return { statut: 201, corps: versCommentaire(commentaire, profil) };
}

/** Charge un commentaire et son annonce ; verifie que le lecteur en est l'offrant. */
async function chargerPourOffrant(env, id, utilisateurId) {
  const commentaire = await lireLigne(env, 'commentaires', id);
  if (!commentaire) return { erreur: refus(404, 'Question introuvable.') };
  const annonce = await lireLigne(env, 'annonces', commentaire.annonceId);
  if (annonce?.offrantId !== utilisateurId) {
    return { erreur: refus(403, 'Seul l’offrant de l’annonce peut faire cela.') };
  }
  return { commentaire };
}

/** L'offrant repond, ou corrige sa reponse : une seule par question (US-54). */
export async function repondre(env, utilisateurId, id, contenu) {
  const { commentaire, erreur } = await chargerPourOffrant(env, id, utilisateurId);
  if (erreur) return erreur;
  const erreurContenu = erreurTexte(contenu, 'réponse');
  if (erreurContenu) return { statut: 422, corps: { erreurs: [erreurContenu] } };
  const reponse = {
    contenu: contenu.trim(),
    creeLe: commentaire.reponse?.creeLe ?? maintenant(),
    misAJourLe: maintenant(),
  };
  const [maj] = await mettreAJour(env, 'commentaires', { id }, { reponse, misAJourLe: maintenant() });
  return { statut: 200, corps: await avecAuteur(env, maj) };
}

/** L'offrant masque ou retablit une question sous son annonce (US-55). */
export async function masquer(env, utilisateurId, id, masque) {
  if (typeof masque !== 'boolean') return { statut: 422, corps: { erreurs: ['« masque » doit valoir true ou false.'] } };
  const { erreur } = await chargerPourOffrant(env, id, utilisateurId);
  if (erreur) return erreur;
  const [maj] = await mettreAJour(env, 'commentaires', { id }, {
    statut: masque ? 'masque' : 'visible',
    misAJourLe: maintenant(),
  });
  return { statut: 200, corps: await avecAuteur(env, maj) };
}

/** L'auteur supprime sa question, et la reponse avec (US-55). */
export async function supprimerCommentaire(env, utilisateurId, id) {
  const commentaire = await lireLigne(env, 'commentaires', id);
  if (!commentaire) return refus(404, 'Question introuvable.');
  if (commentaire.auteurId !== utilisateurId) return refus(403, 'Seul son auteur peut supprimer cette question.');
  await supprimerLignes(env, 'commentaires', { id });
  return { statut: 204 };
}
