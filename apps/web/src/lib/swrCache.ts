// Mini stale-while-revalidate cache pour les lectures publiques répétées
// (menus, restaurant by slug, etc.). Volontairement minimaliste pour ne pas
// embarquer une lib (react-query ~10 KB). 2 niveaux :
//   - mémoire (Map) : partage cross-component dans la même tab
//   - sessionStorage : survit aux navigations SPA et back/forward
//
// Sémantique :
//   - ttlMs   : tant que la donnée est plus jeune que ttlMs, on retourne tel quel
//                sans refetch (fresh).
//   - staleMs : entre ttlMs et staleMs on retourne le cache puis on relance un
//                refetch en background (stale-while-revalidate).
//   - au-delà de staleMs : on refait le fetch synchrone.
//
// L'helper NE doit JAMAIS être utilisé pour des données auth-tied (orders d'un
// user, paiements en cours). Il est volontairement scoped aux lectures
// publiques anonymes.

type CacheEntry<T> = { data: T; ts: number };

const memCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

const STORAGE_PREFIX = 'restafy:swr:';

function readSession<T>(key: string): CacheEntry<T> | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (typeof parsed?.ts !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession<T>(key: string, entry: CacheEntry<T>): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // QuotaExceededError or storage disabled — best-effort, ignore
  }
}

export interface SwrFetchOptions {
  /** Tant que la donnée est plus jeune que ttlMs, retour direct (default 60s). */
  ttlMs?: number;
  /** Entre ttlMs et staleMs : retour cache + revalidation en bg (default 5min). */
  staleMs?: number;
}

/**
 * Fetch avec cache mémoire + sessionStorage + stale-while-revalidate.
 *
 * Garantie : 1 seul fetch concurrent par clé (dedup). Les appels parallèles
 * obtiennent la même promesse.
 */
export async function swrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: SwrFetchOptions = {},
): Promise<T> {
  const ttlMs = opts.ttlMs ?? 60_000;
  const staleMs = opts.staleMs ?? 300_000;
  const now = Date.now();

  // 1. mémoire
  const mem = memCache.get(key) as CacheEntry<T> | undefined;
  if (mem && now - mem.ts < ttlMs) return mem.data;

  // 2. sessionStorage (hydrate la mémoire si dispo)
  const stored = readSession<T>(key);
  if (stored && now - stored.ts < ttlMs) {
    memCache.set(key, stored);
    return stored.data;
  }

  // 3. SWR : on a du stale, on retourne ça + revalidate en background
  const stale = mem || stored;
  if (stale && now - stale.ts < staleMs) {
    if (!inFlight.has(key)) {
      const p = fetcher()
        .then((data) => {
          const entry: CacheEntry<T> = { data, ts: Date.now() };
          memCache.set(key, entry);
          writeSession(key, entry);
          return data;
        })
        .catch((err) => {
          // revalidation échouée : on garde le stale, on rethrow pour les
          // appelants qui auraient await la même clé via inFlight (étape 4).
          console.warn('[swrCache] revalidate failed for', key, err);
          throw err;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, p);
      // Le caller de l'étape 3 ne await PAS p (fire-and-forget), donc on
      // attache un handler no-op pour éviter UnhandledPromiseRejection si
      // aucun caller de l'étape 4 ne reprend la promesse.
      p.catch(() => {
        /* swallow: rejection already logged + propagated to await callers */
      });
    }
    return stale.data;
  }

  // 4. pas de cache utile → fetch direct (avec dedup)
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const p = fetcher()
    .then((data) => {
      const entry: CacheEntry<T> = { data, ts: Date.now() };
      memCache.set(key, entry);
      writeSession(key, entry);
      return data;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, p);
  return p;
}

/** Invalide une clé (ex: après un POST côté admin). */
export function swrInvalidate(key: string): void {
  memCache.delete(key);
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      /* ignore */
    }
  }
}

/** Invalide toutes les clés matchant un préfixe (ex: `menu:${restoId}:*`). */
export function swrInvalidatePrefix(prefix: string): void {
  for (const k of memCache.keys()) {
    if (k.startsWith(prefix)) memCache.delete(k);
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      const fullPrefix = STORAGE_PREFIX + prefix;
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(fullPrefix)) sessionStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
  }
}

// Pour tests unitaires : reset complet
export function __swrResetForTests(): void {
  memCache.clear();
  inFlight.clear();
  if (typeof sessionStorage !== 'undefined') {
    try {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
      }
      keys.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }
}
