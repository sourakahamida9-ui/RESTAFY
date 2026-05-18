import { FunctionsRelayError } from '@supabase/supabase-js';

/** Edge Functions / auth : cold start Supabase + réseau lent (éviter d’attendre plusieurs minutes si l’endpoint est KO) */
export const AUTH_INVOKE_TIMEOUT_MS = 28_000;
export const AUTH_INVOKE_MAX_ATTEMPTS = 2;
export const AUTH_INVOKE_BASE_DELAY_MS = 400;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('SERVER_TIMEOUT')), ms);
    }),
  ]);
}

export function isTransientNetworkError(err: unknown): boolean {
  if (err instanceof FunctionsRelayError) return true;
  if (!(err instanceof Error)) return false;
  const m = err.message;
  return (
    /SERVER_TIMEOUT/i.test(m) ||
    /failed to fetch|load failed|networkerror|network error|fetch/i.test(m)
  );
}

/**
 * Retente les appels qui lèvent une erreur réseau / timeout (pas les erreurs HTTP métier).
 */
export async function retryOnTransientFailure<T>(
  fn: () => Promise<T>,
  options: { maxAttempts: number; baseDelayMs: number },
): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isTransientNetworkError(e) || attempt === options.maxAttempts - 1) {
        throw e;
      }
      await sleep(options.baseDelayMs * (attempt + 1));
    }
  }
  throw last;
}

export async function fetchJsonPostWithTimeout(
  url: string,
  body: string,
  headers: Record<string, string>,
  ms: number,
): Promise<Response | null> {
  try {
    return await withTimeout(
      fetch(url, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json', ...headers },
        body,
      }),
      ms,
    );
  } catch {
    return null;
  }
}
