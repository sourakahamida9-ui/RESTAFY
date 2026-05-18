/**
 * Singleton Supabase admin client (service role).
 *
 * Avant : chaque endpoint appelait `createClient(url, key, ...)` à chaque
 * requête, ce qui allouait un nouvel objet Supabase + initialisait un
 * fetcher HTTP à chaque hit. En cold start ça coûtait ~10ms, en warm ça
 * coûtait quand même ~2-3ms × N requêtes par invocation.
 *
 * Après : une seule instance créée au premier appel, mémoizée au niveau
 * module. Sur Vercel chaque sandbox isolée a son propre singleton ; pas
 * de partage cross-tenant.
 *
 * Sécurité : la clé `SUPABASE_SERVICE_ROLE_KEY` reste server-only (jamais
 * exposée au bundle client). On lit explicitement les env vars à chaque
 * appel pour pouvoir détecter une mauvaise config dès le premier hit.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

function resolveUrl(): string {
  // Couvre tous les fallbacks utilisés dans la codebase (ex. partner-join,
  // auth, landing/api/*) pour que le singleton remplace n'importe quel
  // resolver maison sans regression.
  const candidates = [
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
    process.env.PUBLIC_SUPABASE_URL,
  ];
  for (const c of candidates) {
    const t = typeof c === 'string' ? c.trim() : '';
    if (t && /^https:\/\//i.test(t)) return t.replace(/\/$/, '');
  }
  throw new Error(
    'Missing Supabase URL (SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL / PUBLIC_SUPABASE_URL)'
  );
}

function resolveServiceRoleKey(): string {
  const candidates = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_SERVICE_ROLE_KEY,
  ];
  for (const c of candidates) {
    const t = typeof c === 'string' ? c.trim() : '';
    if (t.length > 0) return t;
  }
  throw new Error(
    'Missing SUPABASE_SERVICE_ROLE_KEY (also checked SUPABASE_SECRET_SERVICE_ROLE_KEY)'
  );
}

/**
 * Returns the memoized service-role client. Throws if env vars are absent.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = resolveUrl();
  const key = resolveServiceRoleKey();
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

/**
 * Test-only helper to clear the singleton (eg. for unit tests that need
 * to swap env vars). Not exported to production code paths.
 */
export function __resetSupabaseAdminForTests(): void {
  cached = null;
}
