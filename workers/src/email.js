/**
 * E-mail au demandeur quand un objet lui est propose (#61).
 *
 * Il double le message systeme de la conversation, pour qu'un demandeur qui
 * n'ouvre pas l'app sache qu'il doit verser la participation.
 *
 * Regles :
 * - aucun lien : le filtre anti-spam de Lyon 2 rejette tout e-mail qui en
 *   contient (essais du 24/10/2026) ;
 * - jamais d'envoi a un profil de demonstration (`fictif`, adresses en
 *   example.org) ;
 * - un envoi rate ne bloque jamais la reservation : il part en arriere-plan.
 *
 * Interrupteur : EMAILS_ACTIFS, avec les secrets SMTP_UTILISATEUR et
 * SMTP_MOT_DE_PASSE (voir smtp.js).
 */
import { lireLignes } from './base.js';
import { associations } from './referentiels.js';
import { envoyerSmtp } from './smtp.js';

/** Envoi active ? Coupe, rien ne part. */
export const emailsActifs = (env) =>
  String(env.EMAILS_ACTIFS).toLowerCase() === 'true' && Boolean(env.SMTP_UTILISATEUR && env.SMTP_MOT_DE_PASSE);

/** Un vrai membre, avec une adresse qui recoit du courrier. */
export const destinataireJoignable = (profil) =>
  Boolean(profil?.email) && !profil.fictif && !/@example\.(org|com|net)$/i.test(profil.email);

const euros = (montant) =>
  `${Number(montant).toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(Number(montant)) ? 0 : 2, maximumFractionDigits: 2 })} €`;

const formatCreneau = (creneau) => {
  if (!creneau?.debut) return null;
  const options = { timeZone: 'Europe/Paris' };
  const jour = new Date(creneau.debut).toLocaleDateString('fr-FR', { ...options, weekday: 'long', day: 'numeric', month: 'long' });
  const heure = (d) => new Date(d).toLocaleTimeString('fr-FR', { ...options, hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  return `le ${jour}, de ${heure(creneau.debut)} à ${heure(creneau.fin)}`;
};

/** Objet et texte de l'e-mail. Sans lien ni adresse de site. */
export function composerObjetPropose({ prenom, titre, participation, association, creneau }) {
  const quand = formatCreneau(creneau);
  return {
    objet: `« ${titre} » vous est proposé sur Donéo`,
    texte: [
      `Bonjour ${prenom},`,
      '',
      `Bonne nouvelle : l’objet « ${titre} » vous est proposé.`,
      '',
      `Pour le réserver, ouvrez l’application Donéo et versez la participation de ${euros(participation)}`
        + `${association ? `, reversée à ${association}` : ''}. Vous pouvez aussi le refuser depuis vos messages.`,
      ...(quand ? ['', `Retrait ${quand}. L’adresse exacte vous sera donnée une fois la participation versée.`] : []),
      '',
      'Sans réponse de votre part, l’objet pourra être proposé à la personne suivante.',
      '',
      'L’équipe Donéo',
    ].join('\n'),
  };
}

async function envoyerObjetPropose(env, reservation, annonce) {
  const profils = await lireLignes(env, 'utilisateurs', [reservation.demandeurId]);
  const demandeur = profils.get(reservation.demandeurId);
  if (!destinataireJoignable(demandeur)) return;
  const association = (await associations(env)).find((a) => a.id === annonce.associationId);
  const { objet, texte } = composerObjetPropose({
    prenom: demandeur.prenom,
    titre: annonce.titre,
    participation: reservation.participationDemandee ?? annonce.participation,
    association: association?.nom,
    creneau: annonce.creneauRetrait,
  });
  await envoyerSmtp(env, { a: demandeur.email, objet, texte });
}

/**
 * Previent le demandeur par e-mail, sans retarder ni faire echouer la
 * reponse : l'envoi continue apres elle (`enArrierePlan`, voir index.js).
 */
export function prevenirObjetPropose(env, reservation, annonce) {
  if (!emailsActifs(env)) return;
  const envoi = envoyerObjetPropose(env, reservation, annonce).catch((e) =>
    console.error(`E-mail « objet proposé » non envoyé (réservation ${reservation.id}) : ${e.message}`),
  );
  if (env.enArrierePlan) env.enArrierePlan(envoi);
}
