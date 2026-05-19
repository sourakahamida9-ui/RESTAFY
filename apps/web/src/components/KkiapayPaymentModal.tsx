/**
 * KkiapayPaymentModal — Modal de paiement Kkiapay pour Restafy
 *
 * Remplace PaymentDirectModal et PaymentModal.
 * Flow :
 *   1. Affiche récapitulatif du montant
 *   2. Ouvre le widget Kkiapay (MTN/Moov/Carte)
 *   3. Sur succès → vérifie côté serveur → confirme la commande en DB
 *   4. Redirige vers /payment/success
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { useKkiapay } from '@/hooks/useKkiapay';

interface KkiapayPaymentModalProps {
  amount: number;
  currency?: string;
  description?: string;
  customerName: string;
  customerEmail: string;
  defaultPhone?: string | null;
  orderId?: string;
  restaurantId?: string;
  restaurantName?: string;
  ticketPurchaseId?: string;
  ticketOrderId?: string;
  metadata?: Record<string, unknown>;
  onSuccess: (data: { transactionId: string; reference: string }) => void;
  onClose: () => void;
  onError?: (message: string) => void;
}

type ModalStep = 'confirm' | 'processing' | 'verifying' | 'success' | 'error';

export default function KkiapayPaymentModal({
  amount,
  currency = 'XOF',
  description,
  customerName,
  customerEmail,
  defaultPhone,
  orderId,
  restaurantId,
  restaurantName,
  ticketPurchaseId,
  ticketOrderId,
  metadata,
  onSuccess,
  onClose,
  onError,
}: KkiapayPaymentModalProps) {
  const [step, setStep] = useState<ModalStep>('confirm');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { openPayment, verifyTransaction, loading, verifying } = useKkiapay();
  const handledRef = useRef(false);

  const handleOpenWidget = useCallback(async () => {
    setStep('processing');
    setErrorMessage(null);

    try {
      await openPayment({
        amount,
        reason: description || `Paiement ${restaurantName || 'Restafy'}`,
        email: customerEmail,
        phone: defaultPhone || '',
        name: customerName,
        countries: ['BJ', 'CI', 'TG', 'SN'],
        partnerId: orderId || ticketPurchaseId || ticketOrderId || undefined,
        metadata: {
          order_id: orderId,
          restaurant_id: restaurantId,
          ticket_purchase_id: ticketPurchaseId,
          ticket_order_id: ticketOrderId,
          ...metadata,
        },
      });
    } catch (err) {
      const msg = 'Impossible d\'ouvrir le paiement. Veuillez réessayer.';
      setErrorMessage(msg);
      setStep('error');
      onError?.(msg);
    }
  }, [
    amount, description, customerEmail, customerName, defaultPhone,
    orderId, restaurantId, restaurantName, ticketPurchaseId, ticketOrderId,
    metadata, openPayment, onError,
  ]);

  // Listen for Kkiapay success/failure events
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;

    const successHandler = async (response: { transactionId: string }) => {
      if (handledRef.current) return;
      handledRef.current = true;

      console.log('[KkiapayModal] Success callback:', response.transactionId);
      setStep('verifying');

      const result = await verifyTransaction(response.transactionId, {
        order_id: orderId,
        restaurant_id: restaurantId,
        ticket_purchase_id: ticketPurchaseId,
        ticket_order_id: ticketOrderId,
        ...metadata,
      });

      if (result.success) {
        setStep('success');
        setTimeout(() => {
          onSuccess({
            transactionId: response.transactionId,
            reference: response.transactionId,
          });
        }, 1500);
      } else {
        setErrorMessage(result.error || 'Vérification échouée');
        setStep('error');
        onError?.(result.error || 'Vérification échouée');
        handledRef.current = false;
      }
    };

    const failedHandler = () => {
      if (handledRef.current) return;
      const msg = 'Le paiement a échoué. Veuillez réessayer.';
      setErrorMessage(msg);
      setStep('error');
      onError?.(msg);
    };

    const addSuccessListener = w.addSuccessListener as ((cb: (r: { transactionId: string }) => void) => void) | undefined;
    const addFailedListener = w.addFailedListener as ((cb: () => void) => void) | undefined;

    if (typeof addSuccessListener === 'function') {
      addSuccessListener(successHandler);
    }
    if (typeof addFailedListener === 'function') {
      addFailedListener(failedHandler);
    }

    return () => {
      const removeSuccessListener = w.removeSuccessListener as ((cb: (r: { transactionId: string }) => void) => void) | undefined;
      const removeFailedListener = w.removeFailedListener as ((cb: () => void) => void) | undefined;
      if (typeof removeSuccessListener === 'function') {
        removeSuccessListener(successHandler);
      }
      if (typeof removeFailedListener === 'function') {
        removeFailedListener(failedHandler);
      }
    };
  }, [verifyTransaction, orderId, restaurantId, ticketPurchaseId, ticketOrderId, metadata, onSuccess, onError]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100]"
        onClick={step === 'confirm' || step === 'error' ? onClose : undefined}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md sm:mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-5 text-white relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="pr-10">
              <p className="text-orange-100 text-sm font-medium">
                {restaurantName || 'Restafy'}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black">{amount.toLocaleString('fr-FR')}</span>
                <span className="text-lg font-semibold">{currency}</span>
              </div>
              {description && (
                <p className="text-orange-100 text-xs mt-1 truncate">{description}</p>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 'confirm' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-zinc-900 text-sm">Mobile Money & Carte</p>
                    <p className="text-xs text-zinc-500">MTN MoMo · Moov Money · Visa · Mastercard</p>
                  </div>
                </div>

                <button
                  onClick={handleOpenWidget}
                  disabled={loading}
                  className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold hover:bg-orange-700 disabled:bg-zinc-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 text-base"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Chargement...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Payer {amount.toLocaleString('fr-FR')} {currency}
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 text-xs text-zinc-400">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  <span>Paiement sécurisé par Kkiapay</span>
                </div>
              </div>
            )}

            {step === 'processing' && (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
                  <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
                </div>
                <div>
                  <p className="font-bold text-zinc-900">Widget Kkiapay ouvert</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    Complétez le paiement dans la fenêtre Kkiapay
                  </p>
                </div>
              </div>
            )}

            {step === 'verifying' && (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
                <div>
                  <p className="font-bold text-zinc-900">Vérification en cours...</p>
                  <p className="text-sm text-zinc-500 mt-1">
                    Confirmation du paiement auprès de Kkiapay
                  </p>
                </div>
              </div>
            )}

            {step === 'success' && (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-zinc-900">Paiement confirmé !</p>
                  <p className="text-sm text-zinc-500 mt-1">Redirection en cours...</p>
                </div>
              </div>
            )}

            {step === 'error' && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <p className="font-bold text-zinc-900">Échec du paiement</p>
                  <p className="text-sm text-red-600 mt-2">{errorMessage}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 rounded-xl border border-zinc-200 font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      setStep('confirm');
                      setErrorMessage(null);
                      handledRef.current = false;
                    }}
                    className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-semibold hover:bg-orange-700 transition"
                  >
                    Réessayer
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
