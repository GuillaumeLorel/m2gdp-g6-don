/**
 * Commission de Doneo (#54) : 5 % de la participation, prelevee dessus
 * (decision de l'equipe du 09/11/2026). Le demandeur paie la participation
 * fixee par l'offrant ; Doneo en garde 5 % pour son fonctionnement,
 * l'association recoit le reste.
 *
 * Calcul en centimes, commission arrondie au centime le plus proche. Meme
 * regle cote app : public/src/lib/commission.js (un test verifie qu'elles
 * donnent les memes montants).
 */
export const TAUX_COMMISSION = 0.05;

/** { participation, commission, partAssociation }, en euros. */
export function repartition(participation) {
  const centimes = Math.round(Number(participation) * 100);
  const commission = Math.round(centimes * TAUX_COMMISSION);
  return {
    participation: centimes / 100,
    commission: commission / 100,
    partAssociation: (centimes - commission) / 100,
  };
}
