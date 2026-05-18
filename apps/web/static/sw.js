// Service Worker — Restafy
//
// CACHE_NAME bumpé à chaque release significative pour purger les anciens
// caches du navigateur et garantir que les utilisateurs récupèrent la dernière
// version du build (résout le bug "page semi-cassée tant qu'on ne fait pas
// Ctrl+Shift+R").
//
// Stratégies :
//   - HTML (navigate)  → network-first + fallback cache
//   - JS/CSS/fonts     → stale-while-revalidate
//                        (renvoie cache immédiatement si dispo, met à jour en
//                         tâche de fond → SI le réseau échoue, on n'inflige
//                         PLUS de 503 synthétique au navigateur, on relaie
//                         l'erreur réelle pour que le navigateur retente.)
//   - images           → cache-first avec timeout réseau
//   - cross-origin API → network-first avec timeout
const CACHE_NAME = 'restafy-v3';

// App shell precaché à l'install pour rendre la PWA fonctionnelle au reload
// offline. Liste minimale (les chunks sont fingerprintés donc récupérés
// dynamiquement en SWR au premier hit en ligne).
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest-restaurant.json',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        // best-effort : si une URL échoue (ex. offline.html absent en dev),
        // on continue plutôt que de tuer l'install.
        await Promise.all(
          PRECACHE_URLS.map(async (url) => {
            try {
              const res = await fetch(url, { cache: 'reload' });
              if (res && res.status === 200) await cache.put(url, res.clone());
            } catch {
              /* ignore */
            }
          }),
        );
      } catch {
        /* ignore */
      }
      // Active immédiatement la nouvelle version (skipWaiting) pour ne pas
      // laisser un ancien SW servir des assets périmés.
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => (name !== CACHE_NAME ? caches.delete(name) : null)),
      );
      // Prend le contrôle des onglets ouverts immédiatement.
      await self.clients.claim();
    })(),
  );
});

// Kill-switch : un client peut envoyer { type: 'UNREGISTER_SW' } pour
// désinscrire ce SW et purger le cache si on suspecte un état corrompu.
self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'UNREGISTER_SW') {
    event.waitUntil(
      (async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll();
        clients.forEach((c) => c.navigate(c.url));
      })(),
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (request.url.includes('localhost') || request.url.includes('vite')) return;

  const url = new URL(request.url);

  // ─── Navigation HTML : network-first + fallback cache ─────────────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200 && response.type !== 'error') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then(
              (cached) =>
                cached ||
                caches.match('/index.html').then((idx) => idx || caches.match('/offline.html')),
            ),
        ),
    );
    return;
  }

  // ─── JS / CSS / fonts : stale-while-revalidate ────────────────────────────
  // Important : on NE renvoie PAS de Response synthétique 503 si le réseau
  // échoue — sinon le navigateur reçoit du HTML "Offline" comme s'il s'agissait
  // de JS, ce qui casse silencieusement React (page semi-rendue / blanche tant
  // qu'on ne fait pas Ctrl+Shift+R). On laisse l'erreur se propager pour que le
  // navigateur applique son comportement par défaut (retry, page d'erreur).
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response.status === 200 && response.type !== 'error') {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch((err) => {
            // Pas de Response synthétique : on relaie l'erreur si on n'a pas de
            // version cache à offrir. Sinon, renvoyer cachedResponse en dessous.
            if (cached) return cached;
            throw err;
          });
        return cached || networkPromise;
      })(),
    );
    return;
  }

  // ─── Images : cache-first avec timeout réseau ─────────────────────────────
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return Promise.race([
          fetch(request),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Image fetch timeout')), 3000),
          ),
        ])
          .then((response) => {
            if (response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => caches.match(request).then((c) => c || Response.error()));
      }),
    );
    return;
  }

  // ─── API cross-origin : network-first sans cache (sécurité + fraîcheur) ───
  // On NE cache PAS les réponses cross-origin :
  //   - risque de fuite de données auth-tied (sessions Supabase, etc.)
  //   - données business périmées (commandes, paiements) servies stale
  // Pour l'offline, l'app a sa propre couche (queue + retry) au-dessus.
  const API_FETCH_TIMEOUT_MS = 55000;
  if (url.host !== location.host) {
    event.respondWith(
      Promise.race([
        fetch(request),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('API timeout')), API_FETCH_TIMEOUT_MS),
        ),
      ]).catch(() => new Response('Offline', { status: 503 })),
    );
    return;
  }

  // ─── Default : network-first ─────────────────────────────────────────────
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200 && response.type !== 'error') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

// Push notifications
self.addEventListener('push', (e) => {
  if (!e.data) return;
  try {
    const d = e.data.json();
    e.waitUntil(
      self.registration.showNotification(d.title, {
        body: d.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: d.data || {},
        actions: d.actions || [],
      }),
    );
  } catch (err) {
    // ignore
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.openWindow(url));
});
