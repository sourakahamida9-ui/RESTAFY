import { useEffect, useState } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isOnline: boolean;
  syncSupported: boolean;
}

/**
 * Hook pour gérer le Service Worker et la synchronisation en arrière-plan
 * Support du caching offline et de la Background Sync API
 */
export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncSupported: 'serviceWorker' in navigator && 'SyncManager' in (window as any),
  });

  useEffect(() => {
    if (!state.isSupported) {
      console.warn('[useServiceWorker] Service Worker not supported');
      return;
    }

    // Enregistrer le Service Worker
    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          '/service-worker.js',
          { scope: '/' }
        );

        console.log('[useServiceWorker] Service Worker registered:', registration);
        setState((prev) => ({ ...prev, isRegistered: true }));

        // Écouter les mises à jour
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[useServiceWorker] New Service Worker available');
                // Notifier l'utilisateur qu'une mise à jour est disponible
                window.dispatchEvent(
                  new CustomEvent('sw-update-available', {
                    detail: { registration },
                  })
                );
              }
            });
          }
        });

        // Écouter les messages du Service Worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          const { type, tag } = event.data;

          if (type === 'BACKGROUND_SYNC') {
            console.log('[useServiceWorker] Background sync triggered:', tag);
            window.dispatchEvent(
              new CustomEvent('background-sync', { detail: { tag } })
            );
          }

          if (type === 'PERIODIC_SYNC') {
            console.log('[useServiceWorker] Periodic sync triggered:', tag);
            window.dispatchEvent(
              new CustomEvent('periodic-sync', { detail: { tag } })
            );
          }
        });
      } catch (error) {
        console.error('[useServiceWorker] Registration failed:', error);
      }
    };

    registerServiceWorker();
  }, [state.isSupported]);

  // Écouter les changements de connexion
  useEffect(() => {
    const handleOnline = () => {
      console.log('[useServiceWorker] Online');
      setState((prev) => ({ ...prev, isOnline: true }));
      // Déclencher la synchronisation
      triggerSync();
    };

    const handleOffline = () => {
      console.log('[useServiceWorker] Offline');
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Déclencher la synchronisation en arrière-plan
   */
  const triggerSync = async () => {
    if (!state.syncSupported) {
      console.warn('[useServiceWorker] Background Sync not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const syncManager = (registration as any).sync;
      if (syncManager) {
        await syncManager.register('sync-offline-scans');
        console.log('[useServiceWorker] Background sync registered');
      }
    } catch (error) {
      console.error('[useServiceWorker] Failed to register sync:', error);
    }
  };

  /**
   * Enregistrer une synchronisation périodique
   */
  const registerPeriodicSync = async (minInterval: number = 60000) => {
    if (!state.syncSupported) {
      console.warn('[useServiceWorker] Periodic Sync not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const periodicSync = (registration as any).periodicSync;
      if (periodicSync) {
        await periodicSync.register('sync-offline-scans-periodic', {
          minInterval,
        });
        console.log('[useServiceWorker] Periodic sync registered');
      }
    } catch (error) {
      console.error('[useServiceWorker] Failed to register periodic sync:', error);
    }
  };

  /**
   * Mettre en cache des URLs
   */
  const cacheUrls = async (urls: string[]) => {
    if (!state.isRegistered) {
      console.warn('[useServiceWorker] Service Worker not registered');
      return;
    }

    try {
      const controller = navigator.serviceWorker.controller;
      if (controller) {
        const channel = new MessageChannel();
        controller.postMessage(
          {
            type: 'CACHE_URLS',
            data: { urls },
          },
          [channel.port2]
        );

        return new Promise<boolean>((resolve) => {
          channel.port1.onmessage = (event) => {
            if (event.data.success) {
              console.log('[useServiceWorker] URLs cached successfully');
              resolve(true);
            } else {
              console.error('[useServiceWorker] Failed to cache URLs:', event.data.error);
              resolve(false);
            }
          };
        });
      }
    } catch (error) {
      console.error('[useServiceWorker] Failed to cache URLs:', error);
      return false;
    }
  };

  /**
   * Effacer tous les caches
   */
  const clearCache = async () => {
    if (!state.isRegistered) {
      console.warn('[useServiceWorker] Service Worker not registered');
      return;
    }

    try {
      const controller = navigator.serviceWorker.controller;
      if (controller) {
        const channel = new MessageChannel();
        controller.postMessage(
          { type: 'CLEAR_CACHE' },
          [channel.port2]
        );

        return new Promise<boolean>((resolve) => {
          channel.port1.onmessage = (event) => {
            if (event.data.success) {
              console.log('[useServiceWorker] Cache cleared successfully');
              resolve(true);
            } else {
              console.error('[useServiceWorker] Failed to clear cache');
              resolve(false);
            }
          };
        });
      }
    } catch (error) {
      console.error('[useServiceWorker] Failed to clear cache:', error);
      return false;
    }
  };

  /**
   * Mettre à jour le Service Worker
   */
  const updateServiceWorker = async () => {
    if (!state.isRegistered) {
      console.warn('[useServiceWorker] Service Worker not registered');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      console.log('[useServiceWorker] Service Worker updated');
    } catch (error) {
      console.error('[useServiceWorker] Failed to update Service Worker:', error);
    }
  };

  return {
    ...state,
    triggerSync,
    registerPeriodicSync,
    cacheUrls,
    clearCache,
    updateServiceWorker,
  };
}
