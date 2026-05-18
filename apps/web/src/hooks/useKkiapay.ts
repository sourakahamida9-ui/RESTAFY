/**
 * Hook React pour intégrer Kkiapay
 * Basé sur le SDK officiel kkiapay-react
 *
 * Flow :
 *   1. openKkiapayWidget() ouvre le widget Kkiapay côté client
 *   2. L'utilisateur choisit MTN/Moov/Carte dans le widget Kkiapay
 *   3. Paiement traité par Kkiapay (USSD push ou carte)
 *   4. success callback → transactionId retourné
 *   5. Vérification serveur via POST /api/payments/verify
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { safeParseResponse } from '@/lib/http/safeParseResponse';

let kkiapayLoaded = false;
let kkiapayLoadPromise: Promise<void> | null = null;
let kkiapayWarnedMissingKey = false;

function loadKkiapayScript(): Promise<void> {
  if (kkiapayLoaded) return Promise.resolve();
  if (kkiapayLoadPromise) return kkiapayLoadPromise;

  kkiapayLoadPromise = new Promise<void>((resolve, reject) => {
    if (document.querySelector('script[src*="cdn.kkiapay.me/k.js"]')) {
      kkiapayLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.kkiapay.me/k.js';
    script.async = true;
    script.onload = () => {
      kkiapayLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Impossible de charger le SDK Kkiapay'));
    document.body.appendChild(script);
  });

  return kkiapayLoadPromise;
}

export interface KkiapayPaymentRequest {
  amount: number;
  reason?: string;
  email?: string;
  phone?: string;
  name?: string;
  /** Restrict to momo | card | wallet */
  paymentmethod?: string;
  /** Countries to accept: BJ, CI, TG, SN, NE */
  countries?: string[];
  /** Custom data to pass through */
  partnerId?: string;
  /** Extra data for our backend */
  metadata?: {
    order_id?: string;
    restaurant_id?: string;
    ticket_purchase_id?: string;
    ticket_order_id?: string;
    [key: string]: unknown;
  };
}

export interface KkiapayVerifyResponse {
  success: boolean;
  transactionId?: string;
  status?: string;
  amount?: number;
  fees?: number;
  error?: string;
}

export interface UseKkiapayResult {
  openPayment: (request: KkiapayPaymentRequest) => Promise<void>;
  verifyTransaction: (transactionId: string, metadata?: KkiapayPaymentRequest['metadata']) => Promise<KkiapayVerifyResponse>;
  loading: boolean;
  verifying: boolean;
  error: string | null;
}

export function useKkiapay(): UseKkiapayResult {
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const getApiKey = useCallback(() => {
    return import.meta.env.VITE_KKIAPAY_PUBLIC_KEY || '';
  }, []);

  const isSandbox = useCallback(() => {
    const env = import.meta.env.VITE_KKIAPAY_ENVIRONMENT || 'sandbox';
    return env === 'sandbox';
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const apiKey = getApiKey();
    if (!apiKey && !kkiapayWarnedMissingKey) {
      kkiapayWarnedMissingKey = true;
      console.warn('[Kkiapay] Clé API non configurée (VITE_KKIAPAY_PUBLIC_KEY)');
    }
    loadKkiapayScript().catch((err) => {
      console.error('[Kkiapay] Failed to load SDK:', err);
    });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const openPayment = useCallback(async (request: KkiapayPaymentRequest) => {
    setError(null);
    setLoading(true);

    try {
      await loadKkiapayScript();

      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error('Clé API Kkiapay non configurée (VITE_KKIAPAY_PUBLIC_KEY)');
      }

      const w = window as unknown as Record<string, unknown>;
      const openKkiapayWidget = w.openKkiapayWidget as ((config: Record<string, unknown>) => void) | undefined;

      if (typeof openKkiapayWidget !== 'function') {
        throw new Error('Le widget Kkiapay n\'est pas disponible. Rechargez la page.');
      }

      openKkiapayWidget({
        amount: request.amount,
        key: apiKey,
        sandbox: isSandbox(),
        email: request.email || '',
        phone: request.phone || '',
        name: request.name || '',
        reason: request.reason || 'Paiement Restafy',
        ...(request.paymentmethod ? { paymentmethod: request.paymentmethod } : {}),
        ...(request.countries ? { countries: request.countries } : {}),
        ...(request.partnerId ? { partnerId: request.partnerId } : {}),
        theme: '#FF5C00',
        callback: '',
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      if (mountedRef.current) {
        setError(msg);
        setLoading(false);
      }
      throw err;
    }
  }, [getApiKey, isSandbox]);

  const verifyTransaction = useCallback(async (
    transactionId: string,
    metadata?: KkiapayPaymentRequest['metadata'],
  ): Promise<KkiapayVerifyResponse> => {
    setVerifying(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          transaction_id: transactionId,
          ...(metadata || {}),
        }),
      });

      const { ok, data, message } = await safeParseResponse(response);

      if (!ok) {
        throw new Error(message || 'Vérification du paiement échouée');
      }

      return {
        success: true,
        transactionId: data?.transactionId || transactionId,
        status: data?.status,
        amount: data?.amount,
        fees: data?.fees,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de vérification';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setVerifying(false);
      setLoading(false);
    }
  }, []);

  return {
    openPayment,
    verifyTransaction,
    loading,
    verifying,
    error,
  };
}
