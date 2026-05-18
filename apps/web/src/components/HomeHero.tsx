import React from 'react';
import { motion } from 'framer-motion';
import { Search, X, Zap, Store, CheckCircle, Clock } from 'lucide-react';

interface HomeHeroProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onSearch: () => void;
  stats: {
    totalRestaurants: number;
    openNow: number;
  };
  loading: boolean;
}

export function HomeHero({ searchQuery, setSearchQuery, onSearch, stats, loading }: HomeHeroProps) {
  const searchRef = React.useRef<HTMLInputElement>(null);

  return (
    <section className="w-full bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 overflow-hidden relative">
      {/* Decorative blobs */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 md:py-12">
        <div className="max-w-2xl mx-auto text-center">
          {/* Subtitle badge */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white text-xs md:text-sm font-bold px-4 py-1.5 rounded-full mb-4"
          >
            <Zap className="w-4 h-4" />
            <span>Livraison rapide à Cotonou</span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-3 text-balance"
          >
            La faim, on s'en occupe.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-orange-100 text-base lg:text-lg mb-8 max-w-xl mx-auto text-pretty"
          >
            Découvrez les meilleurs restaurants • Livraison en 35 minutes • Paiement sécurisé
          </motion.p>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative mb-8"
          >
            <div className="flex items-center gap-2 bg-white rounded-2xl shadow-2xl shadow-black/20 overflow-hidden max-w-lg mx-auto">
              <div className="pl-4 md:pl-5 pr-2 flex-shrink-0">
                <Search className="w-5 h-5 text-orange-500" />
              </div>
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                placeholder="Restaurant ou plat..."
                className="flex-1 py-3 md:py-4 pr-3 text-gray-800 placeholder-gray-500 text-sm md:text-base outline-none bg-transparent font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="pr-3 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={onSearch}
                className="m-2 px-4 md:px-6 py-2.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-black text-xs md:text-sm rounded-xl transition-all flex-shrink-0"
              >
                Chercher
              </button>
            </div>
          </motion.div>

          {/* Quick stats */}
          {!loading && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-white text-xs md:text-sm font-semibold pt-6 border-t border-white/20"
            >
              <span className="flex items-center gap-1.5">
                <Store className="w-4 h-4 flex-shrink-0" />
                {stats.totalRestaurants} restaurants
              </span>
              <span className="hidden md:inline-block w-1 h-1 rounded-full bg-white/40"></span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {stats.openNow} ouverts
              </span>
              <span className="hidden md:inline-block w-1 h-1 rounded-full bg-white/40"></span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 flex-shrink-0" />
                35 min livraison
              </span>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
