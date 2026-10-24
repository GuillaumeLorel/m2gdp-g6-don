/**
 * Cree un compte pour chaque personne du cours (etudiants et enseignant),
 * pour qu'on puisse tester Doneo sans passer par l'inscription (mail de
 * l'enseignant du 24/10/2026).
 *
 *   node scripts/donnees/creer-comptes-cours.mjs --simulation
 *   node scripts/donnees/creer-comptes-cours.mjs
 *
 * Source : scripts/donnees/comptes-cours.local.json, GIT-IGNORE — des e-mails
 * reels n'ont rien a faire dans un depot public. Forme :
 *   { "comptes": [{ "prenom": "…", "nom": "…", "email": "…" }] }
 *
 * Pour chaque personne :
 *  - un compte de connexion Supabase deja confirme, sans mot de passe : on se
 *    connecte par lien magique, aucun e-mail n'est envoye a la creation ;
 *  - un profil deja rempli, avec les deux roles (offrant ET demandeur) pour
 *    que toutes les actions soient accessibles, et des valeurs tirees au
 *    hasard (une adresse lyonnaise reelle, une date de naissance).
 *
 * Rejouable : un compte ou un profil existant n'est pas modifie — un etudiant
 * qui a corrige son profil le retrouve tel quel.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  RACINE_DEPOT,
  creerCompte,
  ecrireLot,
  listerComptes,
  listerIds,
  simulation,
} from './supabase-admin.mjs';

const fichier = path.join(RACINE_DEPOT, 'scripts/donnees/comptes-cours.local.json');
if (!existsSync(fichier)) throw new Error(`Liste introuvable : ${fichier}`);
const personnes = JSON.parse(readFileSync(fichier, 'utf8')).comptes.map((p) => ({
  ...p,
  email: p.email.trim().toLowerCase(),
}));

// Adresses reelles, deja geocodees, des profils de demonstration.
const adresses = JSON.parse(
  readFileSync(path.join(RACINE_DEPOT, 'specs/donnees/demo/utilisateurs.json'), 'utf8'),
).map(({ numeroRue, rue, codePostal, ville }) => ({ numeroRue, rue, codePostal, ville }));

/** Valeurs « au hasard », mais stables pour une meme adresse e-mail. */
function valeurs(email) {
  const h = createHash('sha256').update(email).digest();
  const adresse = adresses[h.readUInt16BE(0) % adresses.length];
  const naissance = new Date(Date.UTC(1996 + (h[2] % 8), h[3] % 12, 1 + (h[4] % 28)));
  return { ...adresse, complementAdresse: '', dateNaissance: naissance.toISOString().slice(0, 10) };
}

const comptes = await listerComptes();
const profils = new Set(await listerIds('utilisateurs'));
let nouveauxComptes = 0;
const nouveauxProfils = [];

for (const p of personnes) {
  let compte = comptes.get(p.email);
  if (!compte) {
    nouveauxComptes++;
    compte = simulation ? { id: `(nouveau) ${p.email}` } : await creerCompte(p.email);
  }
  if (!profils.has(compte.id)) {
    const maintenant = new Date().toISOString();
    nouveauxProfils.push({
      id: compte.id,
      email: p.email,
      prenom: p.prenom,
      nom: p.nom,
      roles: ['offrant', 'demandeur'],
      ...valeurs(p.email),
      photoUrl: '',
      fictif: false,
      creeLe: maintenant,
      misAJourLe: maintenant,
    });
  }
}

console.log(
  `${personnes.length} personnes : ${nouveauxComptes} compte(s) a creer, ${nouveauxProfils.length} profil(s) a creer`,
);
if (simulation) console.log('(simulation) rien n\'est ecrit');
else {
  await ecrireLot('utilisateurs', nouveauxProfils);
  console.log('fait');
}
