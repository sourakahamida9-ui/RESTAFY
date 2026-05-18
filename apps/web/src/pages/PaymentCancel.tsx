import React, { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, ArrowLeft, RefreshCw, ShoppingBag, AlertTriangle } from 'lucide-react';

type CancelReason = 'cancelled' | 'failed' | 'expired' | 'timeout' | 'declined' | 'unknown';

const REASON_CONFIG: Record<CancelReason, { title: string; message: string; icon: React.ReactNode }> = {
  cancelled: {
    title: 'Paiement annulé',
    message: 'Vous avez annulé le paiement. Votre panier est toujours disponible.',
    icon: <XCircle className="w-16 h-16 text-orange-500" />,
  },
  failed: {
    title: 'Paiement échoué',
    message: "Le paiement n'a pas pu aboutir. Vérifiez votre solde Mobile Money et réessayez.",
    icon: <XCircle className="w-16 h-16 text-red-500" />,
  },
  expired: {
    title: 'Paiement expiré',
    message: 'Le délai de validation a expiré. Relancez le paiement pour réessayer.',
    icon: <AlertTriangle className="w-16 h-16 text-amber-500" />,
  },
  timeout: {
    title: 'Délai dépassé',
    message: 'Le réseau mobile a mis trop de temps à répondre. Vérifiez votre connexion et réessayez.',
    icon: <AlertTriangle className="w-16 h-16 text-amber-500" />,
  },
  declined: {
    title: 'Paiement refusé',
    message: 'Votre opérateur a refusé la transaction. Vérifiez votre solde ou contactez votre opérateur.',
    icon: <XCircle className="w-16 h-16 text-red-500" />,
  },
  unknown: {
    title: 'Paiement non abouti',
    message: "Le paiement n'a pas pu être finalisé. Votre panier est toujours disponible.",
    icon: <XCircle className="w-16 h-16 text-red-500" />,
  },
};

function parseReason(raw: string | null): CancelReason {
  if (!raw) return 'unknown';
  const s = raw.toLowerCase().trim();
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'expired') return 'expired';
  if (s === 'timeout') return 'timeout';
  if (s === 'declined' || s === 'rejected') return 'declined';
  return 'unknown';
}

export default function PaymentCancel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const reason = useMemo(() => parseReason(searchParams.get('reason')), [searchParams]);
  const config = REASON_CONFIG[reason];
  const returnTo = searchParams.get('return') || '/cart';

  useEffect(() => {
    localStorage.removeItem('pending_order_data');
    localStorage.removeItem('last_payment_ref');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-50 to-zinc-100 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 px-6 py-8 text-center">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
            >
              {config.icon}
            </motion.div>
            <h2 className="text-2xl font-bold text-white mt-4">{config.title}</h2>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            <p className="text-zinc-600 text-center text-[15px] leading-relaxed">
              {config.message}
            </p>

            {/* Conseils */}
            {(reason === 'failed' || reason === 'declined') && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-orange-800"
              >
                <p className="font-semibold mb-1">Conseils :</p>
                <ul className="list-disc list-inside space-y-0.5 text-orange-700">
                  <li>Vérifiez que votre solde est suffisant</li>
                  <li>Assurez-vous d'avoir tapé le bon code PIN</li>
                  <li>Contactez votre opérateur si le problème persiste</li>
                </ul>
              </motion.div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => navigate(returnTo)}
                className="w-full bg-orange-500 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-orange-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <RefreshCw className="w-5 h-5" />
                Réessayer le paiement
              </button>
              <button
                onClick={() => navigate('/cart')}
                className="w-full bg-zinc-100 text-zinc-700 px-6 py-3.5 rounded-xl font-medium hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-5 h-5" />
                Retour au panier
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full text-zinc-400 text-sm hover:text-zinc-600 transition py-2"
              >
                Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
