/**
 * Service worker minimal — DON.
 *
 * Strategie « network first, cache de secours » sur la navigation uniquement :
 * l'application reste ouvrable hors ligne, mais on ne sert jamais une donnee
 * perimee tant que le reseau repond. C'est le comportement souhaitable pour des
 * encheres, ou une valeur en cache peut etre fausse en quelques secondes.
 *
 * Volontairement sans dependance (pas de Workbox) : la J2 demande une PWA
 * installable, pas une strategie de cache elaboree.
 */
const VERSION = 'don-v1';
const COQUILLE = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll([COQUILLE, '/manifest.webmanifest'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge les caches des versions precedentes.
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Jamais de cache sur les appels API : une enchere doit etre fraiche.
  if (new URL(request.url).pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(VERSION).then((cache) => cache.put(COQUILLE, copie));
          return reponse;
        })
        .catch(() => caches.match(COQUILLE)),
    );
    return;
  }

  // Ressources statiques : cache d'abord, reseau ensuite.
  if (request.method === 'GET' && request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(request).then(
        (enCache) =>
          enCache ||
          fetch(request).then((reponse) => {
            const copie = reponse.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copie));
            return reponse;
          }),
      ),
    );
  }
});
