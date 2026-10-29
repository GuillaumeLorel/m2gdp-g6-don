/**
 * Ecran Profil (US-35, issue #67) : statistiques du membre et toutes ses
 * annonces, y compris celles deja remises, que la recherche publique ne
 * renvoie plus. Ses reservations viennent de GET /api/reservations.
 */
import { chercherLignes } from './base.js';
import { versAnnoncesPubliques } from './annonces.js';

const VERSEES = ['confirmee', 'remise'];

export async function resumeProfil(env, utilisateurId) {
  const [annonces, commeDemandeur, commeOffrant] = await Promise.all([
    chercherLignes(env, 'annonces', { offrantId: utilisateurId }, { ordre: 'creeLe.desc' }),
    chercherLignes(env, 'reservations', { demandeurId: utilisateurId, statut: VERSEES }),
    chercherLignes(env, 'reservations', { offrantId: utilisateurId, statut: VERSEES }),
  ]);
  const visibles = annonces.filter((a) => a.statut !== 'retiree');
  const remises = visibles.filter((a) => a.statut === 'remis');
  // Ce qui part aux associations grace au membre : les participations de ses
  // dons (remis, ou reserves et payes) et celles qu'il a lui-meme versees.
  const dejaComptees = new Set(commeOffrant.map((r) => r.annonceId));
  const montant =
    commeOffrant.reduce((t, r) => t + Number(r.participationDemandee || 0), 0) +
    remises.filter((a) => !dejaComptees.has(a.id)).reduce((t, a) => t + Number(a.participation), 0) +
    commeDemandeur.reduce((t, r) => t + Number(r.participationDemandee || 0), 0);
  return {
    statistiques: {
      objetsDonnes: new Set([...remises.map((a) => a.id), ...commeOffrant.map((r) => r.annonceId)]).size,
      objetsRecus: commeDemandeur.length,
      montantReverse: Math.round(montant * 100) / 100,
    },
    annonces: await versAnnoncesPubliques(env, visibles),
  };
}
