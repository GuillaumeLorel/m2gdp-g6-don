/**
 * Commission de Doneo (#54) : 5 % de la participation, prelevee dessus.
 * Le demandeur paie la participation fixee par l'offrant ; l'association
 * recoit le reste.
 *
 * Meme regle que workers/src/commission.js : un test verifie qu'elles
 * donnent les memes montants.
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

/** « 5 % », avec une espace insecable : le « % » ne part jamais seul a la ligne. */
export const libelleTaux = `${Math.round(TAUX_COMMISSION * 100)} %`;
