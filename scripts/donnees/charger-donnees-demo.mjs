/**
 * Charge les associations et les donnees de demonstration dans Supabase.
 *
 *   node scripts/donnees/charger-donnees-demo.mjs --simulation   # n'ecrit rien
 *   node scripts/donnees/charger-donnees-demo.mjs                # (re)charge
 *   node scripts/donnees/charger-donnees-demo.mjs --supprimer    # retire la demo
 *
 * Sources : specs/donnees/associations.json et specs/donnees/demo/*.json
 * (produits par generer-donnees-demo.mjs). Une partie des annonces a une
 * photo : specs/donnees/demo/photos.json et photos/, envoyees dans le bucket
 * `medias` de Supabase Storage. Les autres gardent l'illustration de leur
 * categorie, comme une vraie annonce publiee sans photo. Les profils et annonces de
 * demonstration portent `fictif: true` : on les distingue des vrais comptes,
 * et --supprimer ne retire qu'eux. Les associations sont un referentiel reel,
 * elles restent.
 *
 * Un profil de demo n'a pas de compte de connexion : il apparait dans
 * l'annuaire et comme offrant, mais personne ne s'y connecte (sauf les tests,
 * qui se creent un compte au meme identifiant).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { idPhotoDemo, idUtilisateurDemo } from './identifiants.mjs';
import {
  RACINE_DEPOT,
  deposerFichier,
  ecrireLot,
  retirerFichiers,
  simulation,
  supprimerFictifs,
  supprimerLot,
} from './supabase-admin.mjs';

const lire = (fichier) => JSON.parse(readFileSync(path.join(RACINE_DEPOT, fichier), 'utf8'));

const { associations } = lire('specs/donnees/associations.json');
const utilisateurs = lire('specs/donnees/demo/utilisateurs.json').map((u) => ({
  ...u,
  id: idUtilisateurDemo(u.id),
  fictif: true,
}));
const photos = lire('specs/donnees/demo/photos.json');
const photoDe = new Map(photos.map((p) => [p.annonceId, p]));
const annonces = lire('specs/donnees/demo/annonces.json').map((a) => ({
  ...a,
  offrantId: idUtilisateurDemo(a.offrantId),
  mediaIds: photoDe.has(a.id) ? [idPhotoDemo(a.id)] : [],
  fictif: true,
}));
// Une photo appartient a l'offrant de son annonce, comme une vraie.
const medias = photos.map((p) => {
  const annonce = annonces.find((a) => a.id === p.annonceId);
  const fichier = path.join(RACINE_DEPOT, 'specs/donnees/demo/photos', p.fichier);
  return {
    id: idPhotoDemo(p.annonceId),
    proprietaireId: annonce.offrantId,
    typeMime: 'image/jpeg',
    tailleOctets: readFileSync(fichier).length,
    fichier,
  };
});

console.log(
  `${associations.length} associations, ${utilisateurs.length} profils, ${annonces.length} annonces, ${medias.length} photos`,
);
if (simulation) {
  console.log('(simulation) rien n\'est ecrit');
} else {
  // On repart de zero pour la demo : les annonces d'abord (elles referencent
  // les profils), puis les profils.
  await supprimerFictifs('annonces');
  await retirerFichiers('medias', medias.map((m) => m.id));
  await supprimerLot('medias', medias.map((m) => m.id));
  await supprimerFictifs('utilisateurs');
  if (!process.argv.includes('--supprimer')) {
    await ecrireLot('associations', associations);
    await ecrireLot('utilisateurs', utilisateurs);
    for (const { fichier, ...media } of medias) {
      await deposerFichier('medias', media.id, readFileSync(fichier), media.typeMime);
      await ecrireLot('medias', [media]);
    }
    await ecrireLot('annonces', annonces);
  }
  console.log(process.argv.includes('--supprimer') ? 'demonstration retiree' : 'charge');
}
