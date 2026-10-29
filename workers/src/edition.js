/**
 * Modifier ou retirer son annonce (US-11, issue #39).
 *
 * Champs figes, pour ne pas changer les regles en cours de route :
 *  - participation et association, des qu'une reservation non annulee existe ;
 *  - adresse, tant qu'une reservation est confirmee (le demandeur l'a recue).
 * Le creneau, lui, reste modifiable : c'est le report de rendez-vous, et les
 * demandeurs en cours en sont prevenus par un message systeme.
 */
import { chercherLignes, lireLigne, mettreAJour } from './base.js';
import { adresseNettoyee, positionApprochee } from './adresse.js';
import { versAnnoncesPubliques } from './annonces.js';
import { ajouterMessage } from './conversations.js';
import { localiser, validerChamps, validerMedias } from './publication.js';
import { EN_COURS } from './reservations.js';

const CHAMPS_ADRESSE = ['numeroRue', 'rue', 'complementAdresse', 'codePostal', 'ville'];
const maintenant = () => new Date().toISOString();
const refus = (statut, erreur) => ({ statut, corps: { erreur } });

/** L'annonce, si `utilisateurId` en est l'offrant ; sinon la reponse d'erreur. */
async function annonceDe(env, utilisateurId, id) {
  const annonce = await lireLigne(env, 'annonces', id);
  if (!annonce || annonce.statut === 'retiree') return { erreur: refus(404, 'Cette annonce n’existe pas ou a été retirée.') };
  if (annonce.offrantId !== utilisateurId) return { erreur: refus(403, 'Seul l’offrant peut modifier cette annonce.') };
  return { annonce };
}

/** Champs non modifiables en l'etat, d'apres les reservations en cours. */
function champsFiges(reservations) {
  const fige = [];
  if (reservations.length) fige.push('participation', 'associationId');
  if (reservations.some((r) => r.statut === 'confirmee')) fige.push(...CHAMPS_ADRESSE);
  return fige;
}

/** Fiche complete pour le formulaire de modification (offrant seulement). */
export async function lireEdition(env, utilisateurId, id) {
  const { annonce, erreur } = await annonceDe(env, utilisateurId, id);
  if (erreur) return erreur;
  const [[publique], reservations] = await Promise.all([
    versAnnoncesPubliques(env, [annonce]),
    chercherLignes(env, 'reservations', { annonceId: id, statut: EN_COURS }),
  ]);
  return {
    statut: 200,
    corps: {
      ...publique,
      categorieId: annonce.categorieId,
      sousCategorieId: annonce.sousCategorieId,
      associationId: annonce.associationId,
      numeroRue: annonce.numeroRue,
      rue: annonce.rue,
      complementAdresse: annonce.complementAdresse || '',
      champsFiges: champsFiges(reservations),
    },
  };
}

/** Modifie l'annonce : les champs fournis remplacent les anciens. */
export async function modifierAnnonce(env, utilisateurId, id, corps) {
  const { annonce, erreur } = await annonceDe(env, utilisateurId, id);
  if (erreur) return erreur;
  if (annonce.statut === 'remis') return refus(409, 'Cet objet a déjà été remis : l’annonce ne se modifie plus.');

  const reservations = await chercherLignes(env, 'reservations', { annonceId: id, statut: EN_COURS });
  const figes = champsFiges(reservations);
  const change = (champ) => champ in corps && JSON.stringify(corps[champ] ?? '') !== JSON.stringify(annonce[champ] ?? '');
  const bloques = figes.filter(change);
  if (bloques.length) {
    return refus(409, bloques.includes('participation') || bloques.includes('associationId')
      ? 'Une demande est en cours : la participation et l’association ne peuvent plus changer.'
      : 'La réservation est confirmée : l’adresse ne peut plus changer.');
  }

  const fusion = { ...annonce, ...corps };
  const creneauChange =
    'creneauRetrait' in corps &&
    (Date.parse(corps.creneauRetrait?.debut) !== Date.parse(annonce.creneauRetrait?.debut) ||
      Date.parse(corps.creneauRetrait?.fin) !== Date.parse(annonce.creneauRetrait?.fin));
  const erreurs = await validerChamps(env, fusion, { exigerCreneauFutur: creneauChange });
  if ('mediaIds' in corps) {
    const ids = corps.mediaIds;
    if (!Array.isArray(ids) || ids.length > 8 || new Set(ids).size !== ids.length) {
      erreurs.push('Une annonce compte 8 photos au plus, sans doublon.');
    } else {
      // Les photos deja publiees restent citables ; les nouvelles doivent etre de l'offrant.
      const nouvelles = ids.filter((m) => !(annonce.mediaIds || []).includes(m));
      const medias = await validerMedias(env, nouvelles, utilisateurId);
      if (medias.interdit) return medias.interdit;
      erreurs.push(...medias.erreurs);
    }
  }
  if (erreurs.length) return { statut: 422, corps: { erreurs } };

  const champs = {
    titre: fusion.titre.trim(),
    description: fusion.description.trim(),
    categorieId: fusion.categorieId,
    sousCategorieId: fusion.sousCategorieId,
    etat: fusion.etat,
    participation: fusion.participation,
    associationId: fusion.associationId,
    creneauRetrait: {
      debut: new Date(fusion.creneauRetrait.debut).toISOString(),
      fin: new Date(fusion.creneauRetrait.fin).toISOString(),
    },
    mediaIds: fusion.mediaIds || [],
    misAJourLe: maintenant(),
  };
  if (CHAMPS_ADRESSE.some(change)) {
    const adresse = adresseNettoyee(fusion);
    const { position, refus: introuvable } = await localiser(adresse);
    if (introuvable) return introuvable;
    Object.assign(champs, adresse, {
      latitude: position.latitude,
      longitude: position.longitude,
      ...(await positionApprochee(position.latitude, position.longitude, adresse)),
      quartier: position.quartier,
    });
  }

  const [modifiee] = await mettreAJour(env, 'annonces', { id }, champs);
  if (creneauChange) {
    for (const r of reservations) {
      await ajouterMessage(env, r.conversationId, {
        type: 'systeme', reservationId: r.id, evenement: 'creneau_modifie',
        contenu: 'L’offrant a modifié le créneau de retrait : vérifiez le nouveau rendez-vous.',
      });
    }
  }
  const [publique] = await versAnnoncesPubliques(env, [modifiee]);
  return { statut: 200, corps: publique };
}

/**
 * Retire l'annonce (retrait logique). Les reservations en cours sont closes,
 * avec un message ; une participation deja versee passe a « remboursee » —
 * fictivement, comme le paiement.
 */
export async function retirerAnnonce(env, utilisateurId, id) {
  const { annonce, erreur } = await annonceDe(env, utilisateurId, id);
  if (erreur) return erreur;
  if (annonce.statut === 'remis') return refus(409, 'Cet objet a déjà été remis : l’annonce ne peut plus être retirée.');

  await mettreAJour(env, 'annonces', { id }, { statut: 'retiree', misAJourLe: maintenant() });
  const reservations = await chercherLignes(env, 'reservations', { annonceId: id, statut: EN_COURS });
  for (const r of reservations) {
    await mettreAJour(env, 'reservations', { id: r.id }, {
      statut: 'annulee',
      motifAnnulation: 'annonce_retiree',
      ...(r.statutPaiement === 'paye' ? { statutPaiement: 'rembourse' } : {}),
      misAJourLe: maintenant(),
    });
    await ajouterMessage(env, r.conversationId, {
      type: 'systeme', reservationId: r.id, evenement: 'annonce_retiree',
      contenu: r.statutPaiement === 'paye'
        ? 'L’offrant a retiré son annonce. La participation versée est remboursée (paiement de test).'
        : 'L’offrant a retiré son annonce : la demande est close.',
    });
  }
  return { statut: 204, corps: null };
}
