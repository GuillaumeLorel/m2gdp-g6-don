/**
 * E-mails aux etapes de la reservation (#61) : ils doublent les messages
 * systeme de la conversation, pour qu'un membre qui n'ouvre pas l'app sache
 * qu'on attend quelque chose de lui.
 *
 *   demande_recue     -> offrant    : quelqu'un demande son objet
 *   objet_propose     -> demandeur  : l'objet lui est reserve, a lui de verser la participation
 *   demande_declinee  -> demandeur  : l'offrant n'a pas retenu sa demande
 *   paiement_valide   -> offrant    : la participation est versee, rendez-vous au creneau
 *   desistement       -> offrant    : le demandeur qui tenait l'objet renonce
 *
 * Regles :
 * - aucun lien : le filtre anti-spam de Lyon 2 rejette tout e-mail qui en
 *   contient (essais du 24/10/2026) ;
 * - jamais l'adresse exacte du retrait ;
 * - jamais d'envoi a un profil de demonstration (`fictif`, adresses en
 *   example.org) ;
 * - un envoi rate ne bloque jamais la reservation : il part en arriere-plan.
 *
 * Interrupteur : EMAILS_ACTIFS, avec les secrets SMTP_UTILISATEUR et
 * SMTP_MOT_DE_PASSE (voir smtp.js).
 */
import { lireLigne, lireLignes } from './base.js';
import { repartition } from './commission.js';
import { associations } from './referentiels.js';
import { envoyerSmtp } from './smtp.js';

/** Envoi active ? Coupe, ou sans identifiants, rien ne part. */
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

/** Qui recoit l'e-mail de chaque evenement. */
export const DESTINATAIRES = {
  demande_recue: 'offrant',
  objet_propose: 'demandeur',
  demande_declinee: 'demandeur',
  paiement_valide: 'offrant',
  desistement: 'offrant',
};

const SIGNATURE = ['', 'L’équipe Donéo'];

/**
 * Objet et texte de l'e-mail d'un evenement. Sans lien ni adresse de site.
 * `prenom` est celui du destinataire, `autre` celui de l'autre partie.
 */
export function composerEmail(evenement, { prenom, autre, titre, participation, association, creneau }) {
  const quand = formatCreneau(creneau);
  const montant = euros(participation);
  // La commission de Doneo est prelevee sur la participation (#54).
  const part = euros(repartition(participation).partAssociation);
  const pourAssociation = `, dont ${part} reversés à ${association || 'l’association choisie'}`;
  const bonjour = [`Bonjour ${prenom},`, ''];
  switch (evenement) {
    case 'demande_recue':
      return {
        objet: `${autre} souhaite récupérer « ${titre} »`,
        texte: [
          ...bonjour,
          `${autre} souhaite récupérer votre objet « ${titre} ».`,
          '',
          'Ouvrez l’application Donéo pour valider ou décliner sa demande, depuis vos messages.',
          ...SIGNATURE,
        ].join('\n'),
      };
    case 'objet_propose':
      return {
        objet: `« ${titre} » vous est proposé sur Donéo`,
        texte: [
          ...bonjour,
          `Bonne nouvelle : l’objet « ${titre} » vous est proposé.`,
          '',
          `Pour le réserver, ouvrez l’application Donéo et versez la participation de ${montant}${pourAssociation}.`
            + ' Vous pouvez aussi le refuser depuis vos messages.',
          ...(quand ? ['', `Retrait ${quand}. L’adresse exacte vous sera donnée une fois la participation versée.`] : []),
          '',
          'Sans réponse de votre part, l’objet pourra être proposé à la personne suivante.',
          ...SIGNATURE,
        ].join('\n'),
      };
    case 'demande_declinee':
      return {
        objet: `Votre demande pour « ${titre} »`,
        texte: [
          ...bonjour,
          `${autre} n’a pas retenu votre demande pour « ${titre} ».`,
          '',
          'D’autres objets vous attendent dans l’application Donéo.',
          ...SIGNATURE,
        ].join('\n'),
      };
    case 'paiement_valide':
      return {
        objet: `« ${titre} » est réservé par ${autre}`,
        texte: [
          ...bonjour,
          `${autre} a versé la participation de ${montant}${pourAssociation} : « ${titre} » lui est réservé.`,
          ...(quand ? ['', `Rendez-vous ${quand} pour lui remettre l’objet.`] : []),
          '',
          'Une fois l’objet remis, confirmez la remise depuis vos messages.',
          ...SIGNATURE,
        ].join('\n'),
      };
    case 'desistement':
      return {
        objet: `${autre} renonce à « ${titre} »`,
        texte: [
          ...bonjour,
          `${autre} s’est désisté·e pour « ${titre} ».`,
          '',
          'Ouvrez vos messages dans l’application Donéo pour voir la suite : l’objet passe à la personne suivante, ou redevient disponible.',
          ...SIGNATURE,
        ].join('\n'),
      };
    default:
      return null;
  }
}

async function envoyer(env, evenement, reservation, annonceConnue) {
  const role = DESTINATAIRES[evenement];
  const annonce = annonceConnue ?? (await lireLigne(env, 'annonces', reservation.annonceId));
  const profils = await lireLignes(env, 'utilisateurs', [reservation.offrantId, reservation.demandeurId]);
  const destinataire = profils.get(role === 'offrant' ? reservation.offrantId : reservation.demandeurId);
  const autre = profils.get(role === 'offrant' ? reservation.demandeurId : reservation.offrantId);
  if (!destinataireJoignable(destinataire)) return;
  const association = (await associations(env)).find((a) => a.id === annonce.associationId);
  const { objet, texte } = composerEmail(evenement, {
    prenom: destinataire.prenom,
    autre: autre?.prenom || 'Un membre',
    titre: annonce.titre,
    participation: reservation.participationDemandee ?? annonce.participation,
    association: association?.nom,
    creneau: annonce.creneauRetrait,
  });
  await envoyerSmtp(env, { a: destinataire.email, objet, texte });
}

/**
 * Previent par e-mail la partie concernee par `evenement`, sans retarder ni
 * faire echouer la reponse : l'envoi continue apres elle (`enArrierePlan`,
 * voir index.js). Sans `annonce`, elle est relue au moment d'envoyer.
 */
export function prevenir(env, evenement, reservation, annonce = null) {
  if (!emailsActifs(env) || !DESTINATAIRES[evenement]) return;
  const envoi = envoyer(env, evenement, reservation, annonce).catch((e) =>
    console.error(`E-mail « ${evenement} » non envoyé (réservation ${reservation.id}) : ${e.message}`),
  );
  if (env.enArrierePlan) env.enArrierePlan(envoi);
}
