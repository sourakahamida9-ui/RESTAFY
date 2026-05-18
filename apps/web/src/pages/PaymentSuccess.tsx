import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle, Ticket, ShoppingBag, RefreshCw, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCartStore } from '@/hooks/useOrderCart';

type PendingPayment = {
  reference: string;
  type: 'order' | 'event';
  order_id?: string;
  purchase_id?: string;
  event_id?: string;
  amount?: number;
  currency?: string;
};

type Stage = 'connecting' | 'awaiting_user' | 'verifying' | 'patient' | 'finalizing';

const STAGE_COPY: Record<Stage, { title: string; body: string; hint: string }> = {
  connecting: {
    title: 'Connexion à votre opérateur…',
    body: "On prépare la demande de paiement.",
    hint: 'Gardez votre téléphone à portée de main',
  },
  awaiting_user: {
    title: 'Validez sur votre téléphone',
    body: "MTN/Moov vous a envoyé un message. Tapez votre code PIN pour confirmer.",
    hint: 'Consultez les notifications de votre téléphone',
  },
  verifying: {
    title: 'Vérification en cours',
    body: "Votre paiement est en route. Encore quelques secondes…",
    hint: 'Ne fermez pas cette page',
  },
  patient: {
    title: 'Le réseau prend un peu plus de temps',
    body: "Pas de souci, on continue de vérifier. Votre commande sera confirmée dès réception.",
    hint: 'Si vous avez validé, tout ira bien',
  },
  finalizing: {
    title: 'Paiement confirmé !',
    body: "On enregistre votre commande et envoie la confirmation.",
    hint: 'Redirection en cours…',
  },
};

function nextDelayMs(attempt: number): number {
  if (attempt < 5) return 1000;
  if (attempt < 15) return 2000;
  return 4000;
}

function stageFor(elapsedSec: number): Stage {
  if (elapsedSec < 3) return 'connecting';
  if (elapsedSec < 15) return 'awaiting_user';
  if (elapsedSec < 30) return 'verifying';
  return 'patient';
}

function StageIcon({ stage }: { stage: Stage }) {
  if (stage === 'awaiting_user') {
    return <Smartphone className="w-10 h-10 text-orange-600 animate-pulse" />;
  }
  if (stage === 'verifying') {
    return <Wifi className="w-10 h-10 text-orange-600 animate-pulse" />;
  }
  return <Loader2 className="w-10 h-10 text-orange-600 animate-spin" />;
}

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'timeout'>('loading');
  const [stage, setStage] = useState<Stage>('connecting');
  const [elapsed, setElapsed] = useState(0);
  const [paymentData, setPaymentData] = useState<PendingPayment | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [attempts, setAttempts] = useState(0);

  const startedAtRef = useRef<number>(Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(true);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    abortRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  const checkOnce = useCallback(async (pending: PendingPayment, accessToken: string | undefined) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams({ reference: pending.reference });
    if (pending.purchase_id) params.set('purchase_id', pending.purchase_id);
    if (pending.order_id) params.set('order_id', pending.order_id);

    const resp = await fetch(`/api/payments/status?${params.toString()}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      signal: controller.signal,
    });
    const payload = await resp.json();
    return String(payload?.status || '').toLowerCase();
  }, []);

  const handleSuccess = useCallback((pending: PendingPayment) => {
    if (!activeRef.current) return;
    setStage('finalizing');
    useCartStore.getState().clear();
    localStorage.removeItem('cart-store');
    localStorage.removeItem('pending_payment');
    localStorage.removeItem('pending_order_data');
    setPaymentData(pending);
    setStatus('success');
    timeoutRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      navigate(pending.type === 'event' ? '/my-tickets' : `/track/${pending.order_id}`);
    }, 2500);
  }, [navigate]);

  const startPolling = useCallback(async (pending: PendingPayment) => {
    setPaymentData(pending);
    activeRef.current = true;
    startedAtRef.current = Date.now();

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    let attempt = 0;
    const loop = async () => {
      if (!activeRef.current) return;
      attempt += 1;
      setAttempts(attempt);
      try {
        const resolved = await checkOnce(pending, accessToken);
        if (!activeRef.current) return;

        if (resolved === 'completed') {
          handleSuccess(pending);
          return;
        }
        if (resolved === 'failed' || resolved === 'cancelled') {
          const reason = resolved === 'failed' ? 'failed' : 'cancelled';
          navigate(`/payment/cancel?reason=${reason}`);
          return;
        }

        const elapsedSec = Math.floor((Date.now() - startedAtRef.current) / 1000);
        if (elapsedSec >= 90) {
          setStatus('timeout');
          return;
        }
        timeoutRef.current = setTimeout(loop, nextDelayMs(attempt));
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return;
        if (!activeRef.current) return;
        const elapsedSec = Math.floor((Date.now() - startedAtRef.current) / 1000);
        if (elapsedSec >= 90) {
          setErrorMessage('Connexion intermittente. Vérifiez votre réseau et réessayez.');
          setStatus('error');
          return;
        }
        timeoutRef.current = setTimeout(loop, nextDelayMs(attempt));
      }
    };

    void loop();
  }, [checkOnce, handleSuccess, navigate]);

  useEffect(() => {
    const pendingRaw = localStorage.getItem('pending_payment');
    if (!pendingRaw) {
      navigate('/');
      return;
    }
    let pending: PendingPayment;
    try {
      pending = JSON.parse(pendingRaw);
    } catch {
      navigate('/');
      return;
    }
    if (!pending.reference) {
      navigate('/');
      return;
    }

    void startPolling(pending);

    tickRef.current = setInterval(() => {
      if (!activeRef.current) return;
      const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(sec);
      setStage(stageFor(sec));
    }, 500);

    return () => {
      cleanup();
    };
  }, [navigate, startPolling, cleanup]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && status === 'loading' && paymentData) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        void startPolling(paymentData);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [paymentData, status, startPolling]);

  const handleManualRecheck = useCallback(async () => {
    if (!paymentData) return;
    setStatus('loading');
    setErrorMessage('');
    setElapsed(0);
    setAttempts(0);
    void startPolling(paymentData);
  }, [paymentData, startPolling]);

  const goToCart = useCallback(() => navigate('/cart'), [navigate]);

  const copy = STAGE_COPY[stage];
  const progressPct = Math.min(100, Math.round((elapsed / 90) * 100));

  const amountDisplay = paymentData?.amount
    ? `${Number(paymentData.amount).toLocaleString('fr-FR')} ${paymentData.currency || 'FCFA'}`
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafaf9] p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-2xl shadow-lg border border-zinc-100 overflow-hidden">
          <AnimatePresence mode="wait">
            {/* ── LOADING (polling) ── */}
            {status === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6 sm:p-8 text-center"
              >
                {/* Amount header */}
                {amountDisplay && (
                  <div className="bg-orange-50 rounded-2xl px-4 py-3 mb-6 inline-block">
                    <span className="text-2xl font-bold text-orange-600">{amountDisplay}</span>
                  </div>
                )}

                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <StageIcon stage={stage} />
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 mb-2">{copy.title}</h2>
                <p className="text-zinc-500 mb-1 min-h-[3em] text-[15px]">{copy.body}</p>
                <p className="text-xs text-orange-500 font-medium mb-5">{copy.hint}</p>

                {/* Progress bar */}
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden mb-5">
                  <motion.div
                    className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>

                {/* Steps indicator */}
                <div className="flex justify-center gap-2 mb-5">
                  {(['connecting', 'awaiting_user', 'verifying', 'patient'] as Stage[]).map((s) => (
                    <div
                      key={s}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        s === stage
                          ? 'w-8 bg-orange-500'
                          : stageFor(elapsed) > s || elapsed > { connecting: 3, awaiting_user: 15, verifying: 30, patient: 75, finalizing: 90 }[s]
                            ? 'w-4 bg-orange-300'
                            : 'w-4 bg-zinc-200'
                      }`}
                    />
                  ))}
                </div>

                {paymentData?.reference && (
                  <p className="text-xs text-zinc-400 font-mono mb-4">Réf : {paymentData.reference}</p>
                )}

                <button
                  onClick={handleManualRecheck}
                  className="text-sm text-orange-600 hover:text-orange-700 inline-flex items-center gap-1.5 font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Vérifier maintenant
                </button>
                <p className="text-xs text-zinc-400 mt-2">
                  {elapsed}s · tentative {attempts} · ne fermez pas cette page
                </p>
              </motion.div>
            )}

            {/* ── SUCCESS ── */}
            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                  >
                    <CheckCircle2 className="w-16 h-16 text-white mx-auto" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-white mt-3">Paiement confirme !</h2>
                  {amountDisplay && (
                    <p className="text-green-100 text-lg font-semibold mt-1">{amountDisplay}</p>
                  )}
                </div>

                <div className="p-6 space-y-4">
                  <p className="text-zinc-600">
                    {paymentData?.type === 'event' ? 'Votre billet est confirmé.' : 'Votre commande est confirmée.'}
                  </p>

                  {paymentData?.type === 'event' && (
                    <div className="bg-orange-50 rounded-xl p-4">
                      <Ticket className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                      <p className="text-sm text-orange-700">QR code envoyé par email · disponible dans Mes billets</p>
                    </div>
                  )}

                  {paymentData?.type === 'order' && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <ShoppingBag className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                      <p className="text-sm text-blue-700">Le restaurant prépare votre commande</p>
                    </div>
                  )}

                  <p className="text-sm text-zinc-400">Redirection automatique…</p>
                </div>
              </motion.div>
            )}

            {/* ── TIMEOUT ── */}
            {status === 'timeout' && (
              <motion.div
                key="timeout"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="bg-gradient-to-br from-amber-500 to-orange-500 px-6 py-8">
                  <Loader2 className="w-14 h-14 text-white mx-auto" />
                  <h2 className="text-xl font-bold text-white mt-3">Paiement encore en attente</h2>
                </div>

                <div className="p-6 space-y-4">
                  <p className="text-zinc-600 text-[15px]">
                    Si vous avez validé sur votre téléphone, votre commande sera confirmée dès la réception du signal opérateur.
                    Vous recevrez un email de confirmation.
                  </p>

                  {paymentData?.reference && (
                    <div className="bg-zinc-50 rounded-xl p-3">
                      <p className="text-xs text-zinc-500">
                        Référence : <span className="font-mono font-medium">{paymentData.reference}</span>
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={handleManualRecheck}
                      className="w-full bg-orange-500 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-orange-600 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Vérifier à nouveau
                    </button>
                    <button
                      onClick={() => navigate(paymentData?.type === 'event' ? '/my-tickets' : '/cart')}
                      className="w-full bg-zinc-100 text-zinc-700 px-6 py-3 rounded-xl hover:bg-zinc-200 transition text-sm"
                    >
                      {paymentData?.type === 'event' ? 'Voir mes billets' : 'Retour au panier'}
                    </button>
                  </div>

                  <p className="text-xs text-zinc-400">
                    Débité mais pas confirmé ? Contactez support@restafy.shop avec votre référence.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── ERROR ── */}
            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="bg-gradient-to-br from-red-500 to-red-600 px-6 py-8">
                  <WifiOff className="w-14 h-14 text-white mx-auto" />
                  <h2 className="text-xl font-bold text-white mt-3">Problème de connexion</h2>
                </div>

                <div className="p-6 space-y-4">
                  <p className="text-zinc-600 text-[15px]">
                    {errorMessage || 'Impossible de vérifier le paiement pour le moment. Vérifiez votre connexion internet.'}
                  </p>

                  {paymentData?.reference && (
                    <div className="bg-zinc-50 rounded-xl p-3">
                      <p className="text-xs text-zinc-500">
                        Référence : <span className="font-mono font-medium">{paymentData.reference}</span>
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={handleManualRecheck}
                      className="w-full bg-orange-500 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-orange-600 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Réessayer
                    </button>
                    <button
                      onClick={goToCart}
                      className="w-full bg-zinc-100 text-zinc-700 px-6 py-3 rounded-xl hover:bg-zinc-200 transition text-sm"
                    >
                      Retour au panier
                    </button>
                  </div>

                  <p className="text-xs text-zinc-400">
                    Débité mais pas confirmé ? Contactez support@restafy.shop
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
