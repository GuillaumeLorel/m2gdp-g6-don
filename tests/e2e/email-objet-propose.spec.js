/**
 * #61 — Envoyer un e-mail quand un objet est propose.
 *
 * L'envoi reel passe par le SMTP de Gmail et n'est pas rejoue ici : ces tests
 * verifient le contenu de l'e-mail et les regles qui decident s'il part.
 */
import { expect, test } from '@playwright/test';
import { composerObjetPropose, destinataireJoignable, emailsActifs } from '../../workers/src/email.js';
import { construireMessage } from '../../workers/src/smtp.js';

const proposition = {
  prenom: 'Fatou',
  titre: 'Étagère bois 3 niveaux',
  participation: 2,
  association: 'Les Restos du Cœur du Rhône',
  creneau: { debut: '2026-11-14T14:00:00.000Z', fin: '2026-11-14T17:00:00.000Z' },
};

test('L’e-mail nomme l’objet, la participation, l’association et le créneau', () => {
  const { objet, texte } = composerObjetPropose(proposition);
  expect(objet).toContain('Étagère bois 3 niveaux');
  expect(texte).toContain('Bonjour Fatou');
  expect(texte).toContain('2 €');
  expect(texte).toContain('Les Restos du Cœur du Rhône');
  // 14 h UTC = 15 h a Paris en novembre.
  expect(texte).toContain('le samedi 14 novembre, de 15h00 à 18h00');
  expect(texte).toContain('participation');
  expect(texte).not.toMatch(/\bprix\b/i);
});

test('Aucun lien : le filtre anti-spam de Lyon 2 rejetterait l’e-mail', () => {
  const { objet, texte } = composerObjetPropose(proposition);
  for (const contenu of [objet, texte]) {
    expect(contenu).not.toMatch(/https?:|www\.|\.(app|fr|com|org|io)\b/i);
  }
});

test('L’adresse exacte n’est jamais dans l’e-mail', () => {
  const { texte } = composerObjetPropose({ ...proposition, numeroRue: '12', rue: 'rue Paul Bert' });
  expect(texte).not.toContain('Paul Bert');
  expect(texte).toContain('L’adresse exacte vous sera donnée une fois la participation versée');
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
  const { objet, texte } = composerObjetPropose(proposition);
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
