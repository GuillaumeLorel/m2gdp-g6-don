/**
 * Compteur des conversations non lues, partage par le menu du bas et l'en-tete
 * du grand ecran. Il se rafraichit toutes les 30 secondes tant que la page est
 * visible, au retour sur l'onglet, et des qu'une conversation est lue.
 */
import { useSyncExternalStore } from 'react';
import { chargerNotifications } from '@/lib/api.js';

const INTERVALLE = 30_000;

let nombre = 0;
// Change a chaque deconnexion : une reponse arrivee pour le compte precedent
// ne doit pas s'afficher pour le suivant.
let generation = 0;
let minuterie = null;
const abonnes = new Set();
const prevenir = () => abonnes.forEach((f) => f());

/** Relit le compteur aupres du serveur. Un echec garde la valeur affichee. */
export function rafraichirNonLus() {
  const pour = generation;
  return chargerNotifications()
    .then(({ conversationsNonLues }) => {
      if (pour !== generation || conversationsNonLues === nombre) return;
      nombre = conversationsNonLues;
      prevenir();
    })
    .catch(() => {});
}

/** A la deconnexion : le compteur repart de zero. */
export function oublierNonLus() {
  generation += 1;
  nombre = 0;
  prevenir();
}

const pageVisible = () => document.visibilityState === 'visible';
const auRetour = () => pageVisible() && rafraichirNonLus();

function abonner(f) {
  abonnes.add(f);
  if (abonnes.size === 1) {
    rafraichirNonLus();
    minuterie = setInterval(auRetour, INTERVALLE);
    document.addEventListener('visibilitychange', auRetour);
  }
  return () => {
    abonnes.delete(f);
    if (abonnes.size === 0) {
      clearInterval(minuterie);
      document.removeEventListener('visibilitychange', auRetour);
    }
  };
}

/** Nombre de conversations non lues. */
export const useNonLus = () => useSyncExternalStore(abonner, () => nombre);

/** Libelle accessible de l'onglet Messages. */
export const libelleMessages = (n) =>
  n > 0 ? `Messages, ${n} conversation${n > 1 ? 's' : ''} non lue${n > 1 ? 's' : ''}` : 'Messages';
