// src/components/admin/RealtimeStatusBanner.tsx
//
// Bandeau global qui informe le restaurateur de l'état de la connexion
// temps réel. Visible uniquement quand le status n'est pas 'connected'
// pour ne pas polluer l'UI quand tout va bien.
//
// Affichage compact, fixé sous le header du dashboard.

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, WifiOff } from 'lucide-react';
import { useRealtimeStatus } from '@/context/RealtimeStatusContext';

export const RealtimeStatusBanner: React.FC = () => {
  const { status } = useRealtimeStatus();
  const isDegraded = status === 'degraded';

  // Le AnimatePresence doit rester monté pour orchestrer les animations
  // d'exit; on rend conditionnellement l'enfant motion.div à l'intérieur,
  // sinon le composant disparaît brutalement (cf. PR #87 Devin Review).
  return (
    <AnimatePresence>
      {status !== 'connected' && (
        <motion.div
          key={status}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          role="status"
          aria-live="polite"
          className={
            'flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold border-b ' +
            (isDegraded
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-sky-50 border-sky-200 text-sky-900')
          }
        >
          {isDegraded ? (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span>
                Mode dégradé — synchronisation toutes les 15 secondes. Vérifiez votre connexion.
              </span>
            </>
          ) : (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Reconnexion au temps réel…</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
