// src/pages/NotFound.tsx
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, UtensilsCrossed } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">

        {/* Logo */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 150 }}
          className="w-20 h-20 bg-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-orange-600/30"
        >
          <UtensilsCrossed className="text-white w-10 h-10" />
        </motion.div>

        {/* 404 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h1 className="text-8xl font-black text-orange-600 leading-none tracking-tighter mb-2">
            404
          </h1>
          <h2 className="text-2xl font-black text-zinc-900 mb-3">
            Page introuvable
          </h2>
          <p className="text-zinc-500 mb-2">
            La page <code className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-lg text-sm font-mono">{location.pathname}</code> n'existe pas.
          </p>
          <p className="text-zinc-400 text-sm mb-10">
            Elle a peut-être été déplacée ou supprimée.
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-100 text-zinc-700 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20"
          >
            <Home className="w-4 h-4" />
            Accueil
          </button>
        </motion.div>

        {/* Branding */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-12 text-zinc-300 font-black tracking-tighter text-lg"
        >
          RESTAFY<span className="text-orange-400">.</span>
        </motion.p>
      </div>
    </div>
  );
}