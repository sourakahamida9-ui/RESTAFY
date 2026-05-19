/**
 * Hook de polling pour le statut d'un paiement Genius Pay (option B).
 *
 * Quand on déclenche un paiement en mode "direct" (USSD push sans redirect),
 * Genius Pay renvoie juste { reference, status: 'pending' } et envoie l'USSD
 * au téléphone du client en background. On poll alors `/api/payments/status`
 * toutes les `intervalMs` jusqu'à ce que le statut devienne final
 * (completed / failed / cancelled / expired) ou jusqu'au timeout.
 *
 * Le polling stoppe automatiquement :
 *  - quand le statut devient final
 *  - après `timeoutMs` (par défaut 90s — l'USSD expire généralement en ~60s)
 *  - quand le composant est unmount
 *  - quand on appelle `cancel()` manuellement
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type PaymentPollingStatus =
  | 'idle'
  | 'polling'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'timeout'
  | 'error';

export interface UsePaymentPollingOptions {
  reference: string | null;
  /** Intervalle de poll en ms (défaut 3000 = 3s) */
  intervalMs?: number;
  /** Timeout total en ms (défaut 90 000 = 90s) */
  timeoutMs?: number;
  /** Optionnel : purchase_id ou order_id pour aider le serveur à confirmer côté DB */
  purchaseId?: string | null;
  orderId?: string | null;
  /** Callback quand le statut devient final */
  onComplete?: (status: PaymentPollingStatus, raw: unknown) => void;
}

export interface UsePaymentPollingResult {
  status: PaymentPollingStatus;
  /** Nombre de tentatives effectuées */
  attempts: number;
  /** Erreur réseau / parse rencontrée (informational) */
  lastError: string | null;
  /** Force l'arrêt du polling (le statut passe à 'cancelled') */
  cancel: () => void;
  /** Démarre/redémarre le polling (utile après réouverture du modal) */
  restart: () => void;
}

const TERMINAL_STATUSES = new Set([
  'completed',
  'failed',
  'cancelled',
  'expired',
  'success', // alias possible côté serveur
  'confirmed', // alias possible côté serveur
]);

function normalizeStatus(raw: string | undefined | null): PaymentPollingStatus {
  if (!raw) return 'polling';
  const s = String(raw).toLowerCase();
  if (s === 'success' || s === 'completed' || s === 'confirmed') return 'completed';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'expired') return 'expired';
  return 'polling';
}

export function usePaymentPolling(
  options: UsePaymentPollingOptions,
): UsePaymentPollingResult {
  const {
    reference,
    intervalMs = 3000,
    timeoutMs = 90_000,
    purchaseId,
    orderId,
    onComplete,
  } = options;

  const [status, setStatus] = useState<PaymentPollingStatus>('idle');
  const [attempts, setAttempts] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
    setStatus((prev) => (prev === 'polling' ? 'cancelled' : prev));
  }, [stop]);

  const tick = useCallback(async () => {
    if (cancelledRef.current || !reference) return;

    // Timeout global ?
    const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
    if (elapsed >= timeoutMs) {
      stop();
      setStatus('timeout');
      onCompleteRef.current?.('timeout', null);
      return;
    }

    setAttempts((n) => n + 1);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        // Pas de session — on ne peut pas appeler l'endpoint authentifié.
        // On laisse le polling tourner ; au pire on tombera en timeout et le
        // webhook côté serveur rattrapera (source de vérité).
        setLastError('Session expirée');
      } else {
        const url = new URL('/api/payments/status', window.location.origin);
        url.searchParams.set('reference', reference);
        if (purchaseId) url.searchParams.set('purchase_id', purchaseId);
        if (orderId) url.searchParams.set('order_id', orderId);

        const resp = await fetch(url.toString(), {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (resp.ok) {
          const data = await resp.json().catch(() => null);
          const next = normalizeStatus(data?.status);
          if (TERMINAL_STATUSES.has(String(data?.status).toLowerCase()) ||
              next === 'completed' || next === 'failed' ||
              next === 'cancelled' || next === 'expired') {
            stop();
            setStatus(next);
            onCompleteRef.current?.(next, data);
            return;
          }
          setLastError(null);
        } else if (resp.status === 401) {
          setLastError('Authentification expirée');
        } else if (resp.status >= 500) {
          // Erreur serveur transitoire ; on continue à poll.
          setLastError(`Erreur serveur (${resp.status})`);
        } else {
          setLastError(`Erreur ${resp.status}`);
        }
      }
    } catch (err) {
      setLastError('Erreur de connexion. Nouvelle tentative en cours...');
    }

    // Re-arm
    if (!cancelledRef.current) {
      timerRef.current = setTimeout(tick, intervalMs);
    }
  }, [reference, intervalMs, timeoutMs, purchaseId, orderId, stop]);

  const start = useCallback(() => {
    cancelledRef.current = false;
    startedAtRef.current = Date.now();
    setStatus('polling');
    setAttempts(0);
    setLastError(null);
    stop();
    // Premier tick immédiat
    void tick();
  }, [stop, tick]);

  const restart = useCallback(() => {
    start();
  }, [start]);

  useEffect(() => {
    if (!reference) {
      setStatus('idle');
      return;
    }
    start();
    return () => {
      cancelledRef.current = true;
      stop();
    };
  }, [reference, start, stop]);

  return { status, attempts, lastError, cancel, restart };
}
