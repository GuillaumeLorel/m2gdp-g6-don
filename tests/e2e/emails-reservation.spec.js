/**
 * #61 — E-mails aux etapes de la reservation : nouvelle demande, objet
 * propose, demande declinee, participation versee, desistement.
 *
 * L'envoi reel passe par le SMTP de Gmail et n'est pas rejoue ici : ces tests
 * verifient le contenu des e-mails et les regles qui decident s'ils partent.
 */
import { expect, test } from '@playwright/test';
import { DESTINATAIRES, composerEmail, destinataireJoignable, emailsActifs } from '../../workers/src/email.js';
import { construireMessage } from '../../workers/src/smtp.js';

const donnees = {
  prenom: 'Fatou',
  autre: 'Bastien',
  titre: 'Étagère bois 3 niveaux',
  participation: 2,
  association: 'Les Restos du Cœur du Rhône',
  creneau: { debut: '2026-11-14T14:00:00.000Z', fin: '2026-11-14T17:00:00.000Z' },
};
const EVENEMENTS = Object.keys(DESTINATAIRES);

test('Chaque étape prévient la bonne personne', () => {
  expect(DESTINATAIRES).toEqual({
    demande_recue: 'offrant',
    objet_propose: 'demandeur',
    demande_declinee: 'demandeur',
    paiement_valide: 'offrant',
    desistement: 'offrant',
  });
  expect(composerEmail('message_quelconque', donnees)).toBeNull();
});

test('Objet proposé : l’objet, la participation, l’association et le créneau', () => {
  const { objet, texte } = composerEmail('objet_propose', donnees);
  expect(objet).toContain('Étagère bois 3 niveaux');
  expect(texte).toContain('Bonjour Fatou');
  expect(texte).toContain('2 €');
  // #54 : la part de l'association, commission de Doneo deduite.
  expect(texte).toContain('dont 1,90 € reversés à Les Restos du Cœur du Rhône');
  // 14 h UTC = 15 h a Paris en novembre.
  expect(texte).toContain('le samedi 14 novembre, de 15h00 à 18h00');
});

test('Nouvelle demande et participation versée : l’offrant sait qui et quoi faire', () => {
  const demande = composerEmail('demande_recue', { ...donnees, prenom: 'Bastien', autre: 'Fatou' });
  expect(demande.objet).toBe('Fatou souhaite récupérer « Étagère bois 3 niveaux »');
  expect(demande.texte).toContain('valider ou décliner');
  const paiement = composerEmail('paiement_valide', { ...donnees, prenom: 'Bastien', autre: 'Fatou' });
  expect(paiement.texte).toContain('Fatou a versé la participation de 2 €');
  expect(paiement.texte).toContain('confirmez la remise');
});

test('Aucun lien, jamais d’adresse exacte, toujours « participation »', () => {
  for (const evenement of EVENEMENTS) {
    const { objet, texte } = composerEmail(evenement, { ...donnees, numeroRue: '12', rue: 'rue Paul Bert' });
    for (const contenu of [objet, texte]) {
      expect(contenu, evenement).not.toMatch(/https?:|www\.|\.(app|fr|com|org|io)\b/i);
      expect(contenu, evenement).not.toContain('Paul Bert');
      expect(contenu, evenement).not.toMatch(/\bprix\b/i);
    }
  }
});

test('Rien ne part vers un profil de démonstration ou sans adresse', () => {
  expect(destinataireJoignable({ email: 'fatou.diallo@example.org', fictif: false })).toBe(false);
  expect(destinataireJoignable({ email: 'vrai.membre@univ-lyon2.fr', fictif: true })).toBe(false);
  expect(destinataireJoignable({ email: '' })).toBe(false);
  expect(destinataireJoignable(null)).toBe(false);
  expect(destinataireJoignable({ email: 'vrai.membre@univ-lyon2.fr', fictif: false })).toBe(true);
});

test('Interrupteur coupé ou identifiants absents : rien ne part', () => {
  const identifiants = { SMTP_UTILISATEUR: 'envoi@gmail.com', SMTP_MOT_DE_PASSE: 'x' };
  expect(emailsActifs({ EMAILS_ACTIFS: 'false', ...identifiants })).toBe(false);
  expect(emailsActifs({ EMAILS_ACTIFS: 'true' })).toBe(false);
  expect(emailsActifs({ EMAILS_ACTIFS: 'true', ...identifiants })).toBe(true);
});

test('Le message SMTP garde les accents et ne peut pas se couper en route', () => {
  const { objet, texte } = composerEmail('objet_propose', donnees);
  const message = construireMessage({ de: 'envoi@gmail.com', a: 'vrai.membre@univ-lyon2.fr', objet, texte });
  const [entetes, corps] = message.split('\r\n\r\n');
  expect(entetes).toContain('Content-Type: text/plain; charset=utf-8');
  expect(entetes).toMatch(/^Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/m);
  // Corps en base64 : aucune ligne ne commence par un point, qui finirait le message.
  expect(corps.split('\r\n').every((ligne) => /^[A-Za-z0-9+/=]{1,76}$/.test(ligne))).toBe(true);
  expect(Buffer.from(corps.replace(/\r\n/g, ''), 'base64').toString('utf8')).toContain('Étagère');
  const sujet = entetes.match(/^Subject: =\?UTF-8\?B\?(.+)\?=$/m)[1];
  expect(Buffer.from(sujet, 'base64').toString('utf8')).toBe(objet);
});
