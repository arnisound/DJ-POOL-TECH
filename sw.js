/**
 * Service worker : l'application reste utilisable hors ligne (en cabine,
 * en sous-sol, sans réseau). Stratégie « network-first » pour les documents
 * de navigation, « stale-while-revalidate » pour le reste.
 */
const VERSION = 'v2';
const CACHE = `dj-pool-tech-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './css/print.css',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './js/app.js',
  './js/core/dom.js',
  './js/core/store.js',
  './js/core/ui.js',
  './js/core/icons.js',
  './js/core/music.js',
  './js/core/forms.js',
  './js/core/profile.js',
  './js/core/doc.js',
  './js/core/setlists.js',
  './js/core/text.js',
  './js/core/xml.js',
  './js/core/gear.js',
  './js/core/patch.js',
  './js/core/performers.js',
  './js/core/playlist-import.js',
  './js/audio/fft.js',
  './js/audio/decode.js',
  './js/audio/analyze.js',
  './js/audio/analyzer.js',
  './js/audio/worker.js',
  './js/tools/index.js',
  './js/tools/accueil.js',
  './js/tools/analyse.js',
  './js/tools/tap.js',
  './js/tools/camelot.js',
  './js/tools/pitch.js',
  './js/tools/delay.js',
  './js/tools/setlist.js',
  './js/tools/timer.js',
  './js/tools/checklist.js',
  './js/tools/profil.js',
  './js/tools/fiche.js',
  './js/tools/rider.js',
  './js/tools/cablage.js',
  './js/tools/performeurs.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Les échecs individuels ne doivent pas faire échouer l'installation.
    await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    const network = fetch(request).then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
