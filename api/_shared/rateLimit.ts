/**
 * Server-side rate limiting backed by Supabase.
 *
 * Vercel serverless n'ayant pas de mémoire partagée fiable entre invocations,
 * on délègue le compteur à Supabase via la RPC `check_rate_limit` (script SQL
 * 100). Coût : ~30-50ms par check. Acceptable pour les endpoints sensibles.
 *
 * Usage:
 *   const rl = await checkRateLimit({
 *     bucket: 'payments_initiate',
 *     identity: userId,
 *     limit: 10,
 *     windowSeconds: 60,
 *   });
 *   if (!rl.allowed) {
 *     return res.status(429).json({ error: '...', retry_after: rl.retryAfter });
 *   }
 *
 * Mode fail-open : si Supabase est down ou la RPC est absente, on retourne
 * `allowed: true` (avec un log) plutôt que de bloquer tous les paiements.
 * C'est un trade-off conscient — un attaquant peut profiter d'une panne
 * Supabase, mais on accepte de privilégier la disponibilité du paiement.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabaseAdmin';

export type RateLimitOptions = {
  bucket: string;
  identity: string;
  limit: number;
  windowSeconds: number;
  client?: SupabaseClient;
};

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfter: number;
};

/**
 * Returns whether the request is allowed under the bucket's quota and how
 * many events have been counted in the sliding window. Fail-open on Supabase
 * errors so a transient outage doesn't block payments.
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const { bucket, identity, limit, windowSeconds } = opts;

  try {
    // Le resolver de client est dans le try : si getSupabaseAdmin() throw
    // (env vars manquantes, schema corrupt), le contract fail-open documenté
    // ci-dessus garantit qu'on retourne `allowed: true` au lieu de crasher
    // les routes consommatrices (partner-join-request notamment, qui n'a
    // pas de try-catch externe autour de l'appel).
    const sb = opts.client ?? getSupabaseAdmin();
    const { data, error } = await sb.rpc('check_rate_limit', {
      p_bucket: bucket,
      p_identity: identity,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.warn('[rateLimit] RPC error (fail-open):', error.message);
      return { allowed: true, count: 0, limit, retryAfter: 0 };
    }

    const result = data as { allowed: boolean; count: number; limit: number; retry_after_seconds: number } | null;
    if (!result) {
      return { allowed: true, count: 0, limit, retryAfter: 0 };
    }

    return {
      allowed: !!result.allowed,
      count: Number(result.count) || 0,
      limit: Number(result.limit) || limit,
      retryAfter: Number(result.retry_after_seconds) || 0,
    };
  } catch (err) {
    console.warn('[rateLimit] unexpected error (fail-open):', err);
    return { allowed: true, count: 0, limit, retryAfter: 0 };
  }
}

/**
 * Helper to derive a stable identity from a Vercel request: trusted forwarded
 * IP if available, falling back to the socket remote address.
 */
export function getClientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for'];
  const xff = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (xff) {
    const first = String(xff).split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headers['x-real-ip'];
  const real = Array.isArray(realIp) ? realIp[0] : realIp;
  if (real) return String(real).trim();
  return 'unknown';
}
