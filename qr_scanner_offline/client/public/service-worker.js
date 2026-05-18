// Service Worker pour QR Scanner Offline
// Support du caching offline et de la synchronisation en arrière-plan

const CACHE_NAME = 'qr-scanner-v1';
const RUNTIME_CACHE = 'qr-scanner-runtime-v1';
const API_CACHE = 'qr-scanner-api-v1';

// Assets à mettre en cache au démarrage
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installation en cours...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Mise en cache des assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activation en cours...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && 
                     cacheName !== RUNTIME_CACHE && 
                     cacheName !== API_CACHE;
            })
            .map((cacheName) => {
              console.log('[Service Worker] Suppression du cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Interception des requêtes (Network First pour l'API, Cache First pour les assets)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API tRPC - Network First avec fallback cache
  if (url.pathname.startsWith('/api/trpc')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Mettre en cache les réponses réussies
          if (response.ok) {
            const cache = caches.open(API_CACHE);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Fallback au cache en cas d'erreur réseau
          return caches.match(request)
            .then((response) => {
              if (response) {
                console.log('[Service Worker] Réponse depuis le cache:', url.pathname);
                return response;
              }
              // Réponse par défaut si rien en cache
              return new Response(
                JSON.stringify({ error: 'Offline' }),
                { status: 503, statusText: 'Service Unavailable' }
              );
            });
        })
    );
    return;
  }

  // Assets statiques - Cache First
  if (request.method === 'GET' && 
      (url.pathname.endsWith('.js') || 
       url.pathname.endsWith('.css') || 
       url.pathname.endsWith('.woff2') ||
       url.pathname.endsWith('.png') ||
       url.pathname.endsWith('.svg'))) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then((response) => {
              if (!response || response.status !== 200 || response.type === 'error') {
                return response;
              }
              const responseClone = response.clone();
              caches.open(RUNTIME_CACHE)
                .then((cache) => {
                  cache.put(request, responseClone);
                });
              return response;
            })
            .catch(() => {
              // Fallback pour les assets manquants
              return new Response('Asset not found', { status: 404 });
            });
        })
    );
    return;
  }

  // Autres requêtes - Network First
  event.respondWith(
    fetch(request)
      .catch(() => {
        return caches.match(request)
          .then((response) => {
            return response || new Response('Offline', { status: 503 });
          });
      })
  );
});

// Background Sync API pour la synchronisation des scans
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background Sync:', event.tag);

  if (event.tag === 'sync-offline-scans') {
    event.waitUntil(
      // Envoyer un message au client pour déclencher la synchronisation
      self.clients.matchAll()
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'BACKGROUND_SYNC',
              tag: 'sync-offline-scans',
            });
          });
        })
    );
  }
});

// Message handler pour les communications client-worker
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName))
          );
        })
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
    );
  }

  if (type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE)
        .then((cache) => {
          return cache.addAll(data.urls);
        })
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        })
    );
  }
});

// Periodic Background Sync pour les synchronisations régulières
self.addEventListener('periodicsync', (event) => {
  console.log('[Service Worker] Periodic Sync:', event.tag);

  if (event.tag === 'sync-offline-scans-periodic') {
    event.waitUntil(
      self.clients.matchAll()
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'PERIODIC_SYNC',
              tag: 'sync-offline-scans-periodic',
            });
          });
        })
    );
  }
});
