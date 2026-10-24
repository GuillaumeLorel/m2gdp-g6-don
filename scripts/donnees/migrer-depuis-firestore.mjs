/**
 * Migration ponctuelle : recopie les VRAIS profils (hors demonstration) de
 * Firestore vers Supabase. Les donnees de demonstration, elles, se rechargent
 * depuis leurs JSON (charger-donnees-demo.mjs).
 *
 *   node scripts/donnees/migrer-depuis-firestore.mjs --simulation
 *   node scripts/donnees/migrer-depuis-firestore.mjs
 *
 * Rejouable : les profils sont ecrits par identifiant. Firestore n'est pas
 * modifie, il reste en sauvegarde.
 */
import { lireCollection } from './firestore-admin.mjs';
import { ecrireLot, simulation } from './supabase-admin.mjs';

// Colonnes de la table utilisateurs (supabase/migrations/001_donnees.sql).
// Toutes les lignes d'un lot doivent porter les memes cles.
const COLONNES = {
  email: null,
  nom: '',
  prenom: '',
  roles: [],
  numeroRue: null,
  rue: null,
  complementAdresse: '',
  codePostal: null,
  ville: null,
  dateNaissance: null,
  photoUrl: '',
  creeLe: null,
  misAJourLe: null,
};

const profils = (await lireCollection('utilisateurs'))
  .filter((u) => !u.id.startsWith('demo-'))
  .map((u) => {
    const ligne = { id: u.id, fictif: false };
    for (const [colonne, defaut] of Object.entries(COLONNES)) ligne[colonne] = u[colonne] ?? defaut;
    const maintenant = new Date().toISOString();
    ligne.creeLe ??= maintenant;
    ligne.misAJourLe ??= ligne.creeLe;
    if (!ligne.dateNaissance) ligne.dateNaissance = null;
    return ligne;
  });

console.log(`${profils.length} profil(s) reel(s) dans Firestore :`);
for (const p of profils) console.log(`  ${p.id}  ${p.prenom} ${p.nom}  ${p.roles.join(', ')}`);

if (simulation) console.log('(simulation) rien n\'est ecrit');
else {
  await ecrireLot('utilisateurs', profils);
  console.log('recopies dans Supabase');
}
