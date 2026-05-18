/**
 * Retry helper avec backoff exponentiel + jitter.
 *
 * Utilisé pour wrapper les appels sortants GeniusPay. On ne retry QUE sur
 * erreurs transitoires (5xx, 408 timeout, 429 rate-limit, erreurs réseau).
 * Les 4xx autres restent fatals — retenter une 400 ou une 401 serait inutile
 * et bruyant.
 */

export type RetryOptions = {
  attempts?: number;
  baseMs?: number;
  maxMs?: number;
  /** Tag utilisé dans les logs (ex: "GeniusPay initiate", "GeniusPay status"). */
  label?: string;
};

export class RetryableError extends Error {
  public readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RetryableError';
    this.status = status;
  }
}

/** Statuts HTTP qu'on considère comme transitoires et donc retryables. */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function isRetryableStatus(status: number | undefined | null): boolean {
  if (status == null) return false;
  return RETRYABLE_STATUS.has(status) || status >= 500;
}

/**
 * `fn` peut retourner directement une Response fetch — on inspecte alors
 * `response.status` et on retry sur 5xx/429/408. `fn` peut aussi throw
 * une RetryableError (pour signaler explicitement une erreur réseau).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { attempts = 3, baseMs = 300, maxMs = 3000, label = 'fetch' } = opts;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await fn();

      // Cas fetch Response: si status retryable et on a encore des tentatives,
      // on throw une RetryableError pour déclencher le backoff.
      if (
        result &&
        typeof (result as any).status === 'number' &&
        typeof (result as any).headers?.get === 'function' &&
        typeof (result as any).ok === 'boolean'
      ) {
        const resp = result as unknown as Response;
        if (!resp.ok && isRetryableStatus(resp.status) && attempt < attempts) {
          throw new RetryableError(
            `[${label}] upstream ${resp.status} on attempt ${attempt}`,
            resp.status,
          );
        }
      }

      return result;
    } catch (err: any) {
      lastErr = err;

      const status: number | undefined =
        err?.status ?? err?.response?.status ?? undefined;

      // Erreur réseau (fetch TypeError, AbortError, ECONNRESET, etc.) ou
      // status HTTP transitoire: on retente.
      const isNetworkError =
        err?.name === 'TypeError' ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'ECONNREFUSED' ||
        err instanceof RetryableError;

      const shouldRetry =
        attempt < attempts && (isNetworkError || isRetryableStatus(status));

      if (!shouldRetry) throw err;

      const delay = Math.min(maxMs, baseMs * 2 ** (attempt - 1))
        + Math.floor(Math.random() * 100);
      console.warn(
        `[withRetry] ${label} attempt ${attempt}/${attempts} failed (status=${status ?? 'n/a'}), retrying in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr;
}
