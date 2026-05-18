/**
 * =====================================================================
 * FEATURE TUTORIAL - Guide interactif des fonctionnalités Restafy
 * =====================================================================
 * 
 * Guide explicatif pour les nouveaux utilisateurs
 * Explique chaque fonctionnalité avec des animations et exemples concrets
 * 
 * @author Restafy Team
 * @date 2025-05-05
 * =====================================================================
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  // Icons - Fonctionnalités
  ShoppingBag, ChefHat, Heart, Gift, Ticket, Calendar,
  Users, MapPin, Clock, CreditCard, Smartphone, Star,
  ArrowRight, ArrowLeft, Check, X, Copy, Share,
  Home, QrCode, ScanLine, Truck, UtensilsCrossed,
  Sparkles, Play, BookOpen, HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =====================================================================
// DONNÉES - Features à expliquer
// =====================================================================

interface Feature {
  id: string;
  emoji: string;
  title: string;
  shortDesc: string;
  longDesc: string;
  benefits: string[];
  icon: React.ReactNode;
  howTo: { step: number; text: string }[];
  example?: string;
}

/** Toutes les fonctionnalités de Restafy */
const FEATURES: Feature[] = [
  {
    id: 'order',
    emoji: '🍽️',
    title: 'Commander',
    shortDesc: 'Commandez en quelques tapotages',
    longDesc: 'Parcourez les menus, ajoutez vos plats préférés au panier, et payez directement depuis votre téléphone. Livraison ou à emporter.',
    benefits: [
      'Menu en temps réel',
      'Photos et descriptions',
      'Calcul des frais de livraison',
      'Suivi temps réel',
    ],
    icon: <ShoppingBag className="w-6 h-6" />,
    howTo: [
      { step: 1, text: 'Recherchez un restaurant' },
      { step: 2, text: 'Parcourez le menu' },
      { step: 3, text: 'Ajoutez au panier' },
      { step: 4, text: 'Payez par Mobile Money' },
    ],
    example: '2x Poulet + 1x Attiéké = 3500 F',
  },
  {
    id: 'loyalty',
    emoji: '💎',
    title: 'Fidélité',
    shortDesc: 'Gagnez des points à chaque commande',
    longDesc: 'Accumulez des points fidélité à chaque achat. Échangez-les contre des plats gratuits, boissons, ou des réductions.',
    benefits: [
      '1 point par 100 F',
      'Récompenses exclusives',
      'Parrainage奖励',
      'Classement',
    ],
    icon: <Heart className="w-6 h-6" />,
    howTo: [
      { step: 1, text: 'Faites votre première commande' },
      { step: 2, text: 'Gagnez des points' },
      { step: 3, text: 'Allez dans "Fidélité"' },
      { step: 4, text: 'Échangez vos points' },
    ],
    example: '500 pts = 1 plat gratuit !',
  },
  {
    id: 'events',
    emoji: '🎉',
    title: 'Événements',
    shortDesc: 'Découvrez les événements gastronomiques',
    longDesc: 'Participez à des événements spéciaux: déjeuners thématique, dégustations, brunch, afterwork, etc. Réservez votre place!',
    benefits: [
      'Billetterie intégrée',
      'QR code d\'entrée',
      'Places limitées',
      'Événements exclusifs',
    ],
    icon: <Calendar className="w-6 h-6" />,
    howTo: [
      { step: 1, text: 'Allez dans "Événements"' },
      { step: 2, text: 'Choisissez un événement' },
      { step: 3, text: 'Achetez votre billet' },
      { step: 4, text: 'Présentez votre QR à l\'entrée' },
    ],
    example: 'Brunchdimanche = 2500 F',
  },
  {
    id: 'tickets',
    emoji: '🎫',
    title: 'Mes Billets',
    shortDesc: 'Vos billets d\'événement',
    longDesc: 'Tous vos billets d\'événement au même endroit. Accédez-y rapidement avec votre QR code.',
    benefits: [
      'QR code automatique',
      'Hors-ligne',
      'Historique complet',
      'Partageable',
    ],
    icon: <Ticket className="w-6 h-6" />,
    howTo: [
      { step: 1, text: 'Allez dans "Mes Billets"' },
      { step: 2, text: 'Choisissez un billet' },
      { step: 3, text: 'Scannez le QR à l\'entrée' },
      { step: 4, text: 'Profitez !' },
    ],
  },
  {
    id: 'payment',
    emoji: '📱',
    title: 'Paiement',
    shortDesc: 'Payez simplement par Mobile Money',
    longDesc: 'Paiement sécurisé via MTN MoMo, Moov Money ou Celtiis. Pas de liquide, pas de carte bancaire nécessaire.',
    benefits: [
      'MTN & Moov',
      'Sécurisé',
      'Reçu automatique',
      'Support 24/7',
    ],
    icon: <Smartphone className="w-6 h-6" />,
    howTo: [
      { step: 1, text: 'Ajoutez au panier' },
      { step: 2, text: 'Choisissez "Mobile Money"' },
      { step: 3, text: 'Validez le paiement' },
      { step: 4, text: '收到 confirmation SMS' },
    ],
    example: '*880*654321000*3500#',
  },
  {
    id: 'delivery',
    emoji: '🚴',
    title: 'Livraison',
    shortDesc: 'Livraison rapide à domicile',
    longDesc: 'Faites-vous livrer partout à Cotonou. Suivez votre livreur en temps réel sur la carte.',
    benefits: [
      '30-45 min',
      'Suivi temps réel',
      'Frais fixes',
      'Same day',
    ],
    icon: <Truck className="w-6 h-6" />,
    howTo: [
      { step: 1, text: 'Choisissez "Livraison"' },
      { step: 2, text: 'Entrez votre adresse' },
      { step: 3, text: 'Validez la commande' },
      { step: 4, text: 'Suivez sur la carte' },
    ],
    example: 'Frais: 500 F',
  },
];

// =====================================================================
// COMPOSANT PRINCIPAL
// =====================================================================

interface FeatureTutorialProps {
  /** Called when user closes the tutorial */
  onComplete?: () => void;
  /** Starting feature index */
  startIndex?: number;
}

/** Tutorial interactif des fonctionnalités */
export default function FeatureTutorial({ onComplete, startIndex = 0 }: FeatureTutorialProps) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [showAll, setShowAll] = useState(false);

  const currentFeature = FEATURES[currentIndex];
  const isLast = currentIndex === FEATURES.length - 1;
  const total = FEATURES.length;

  /** Passer à la feature suivante */
  const next = () => {
    if (isLast) {
      onComplete?.();
      navigate(-1); // Go back
    } else {
      setCurrentIndex(i => i + 1);
    }
  };

  /** Revenir à la feature précédente */
  const prev = () => {
    if (currentIndex === 0) {
      onComplete?.();
      navigate(-1);
    } else {
      setCurrentIndex(i => i - 1);
    }
  };

  /** Aller à une feature spécifique */
  const goTo = (index: number) => {
    setCurrentIndex(index);
  };

  // Vue "Toutes les fonctionnalités"
  if (showAll) {
    return (
      <div className="min-h-screen bg-paper px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black">Fonctionnalités</h1>
          <button 
            onClick={() => setShowAll(false)}
            className="p-2 bg-zinc-100 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Liste des features */}
        <div className="space-y-3">
          {FEATURES.map((feature, idx) => (
            <motion.button
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => { setShowAll(false); goTo(idx); }}
              className="w-full p-4 rounded-2xl bg-white border border-zinc-100 flex items-center gap-4 text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl">
                {feature.emoji}
              </div>
              <div className="flex-1">
                <h3 className="font-bold">{feature.title}</h3>
                <p className="text-sm text-zinc-500">{feature.shortDesc}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-zinc-400" />
            </motion.button>
          ))}
        </div>

        {/* Quick start button */}
        <button
          onClick={onComplete}
          className="w-full mt-8 py-4 bg-orange-500 text-white rounded-2xl font-bold"
        >
          C'est parti ! 🚀
        </button>
      </div>
    );
  }

  // Vue détaillée d'une feature
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Header avec progression */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prev} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </button>
          <div className="flex gap-1">
            {FEATURES.map((_, idx) => (
              <div 
                key={idx}
                className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  idx === currentIndex ? 'bg-orange-500 w-6' : 'bg-zinc-200'
                )}
              />
            ))}
          </div>
          <button onClick={() => setShowAll(true)} className="p-2 -mr-2">
            <HelpCircle className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        <div className="h-1 bg-zinc-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-orange-500 rounded-full"
            animate={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Contenu animé */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentFeature.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          className="flex-1 flex flex-col px-4"
        >
          {/* Hero emoji */}
          <div className="flex justify-center py-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-5xl shadow-xl shadow-orange-500/30"
            >
              {currentFeature.emoji}
            </motion.div>
          </div>

          {/* Titre & description */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black mb-2">{currentFeature.title}</h1>
            <p className="text-zinc-500">{currentFeature.longDesc}</p>
          </div>

          {/* Exemple */}
          {currentFeature.example && (
            <div className="mx-6 mb-6 p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Exemple</p>
              <p className="font-mono text-sm text-zinc-600">{currentFeature.example}</p>
            </div>
          )}

          {/* Comment ça marche */}
          <div className="flex-1 px-2">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3">Comment faire</h2>
            <div className="space-y-3">
              {currentFeature.howTo.map((item) => (
                <div key={item.step} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                    {item.step}
                  </div>
                  <p className="text-sm">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div className="px-2 py-4">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3">Avantages</h2>
            <div className="flex flex-wrap gap-2">
              {currentFeature.benefits.map((benefit) => (
                <span 
                  key={benefit}
                  className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold"
                >
                  ✓ {benefit}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Footer navigation */}
      <div className="px-4 py-4 pb-8 bg-white border-t border-zinc-100">
        <button
          onClick={next}
          className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
        >
          {isLast ? (
            <>
              <Sparkles className="w-5 h-5" /> Commencer !
            </>
          ) : (
            <>
              Suivant: {FEATURES[currentIndex + 1]?.title} <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
        
        {!isLast && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-3 text-sm text-zinc-400 font-medium mt-2"
          >
            Voir toutes les fonctionnalités
          </button>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// COMPOSANT SIMPLE - Info tooltip pour les pages
// =====================================================================

/** Tooltip d'aide simple pour explicar une fonctionnalité */
interface FeatureTooltipProps {
  featureId: string;
  children: React.ReactNode;
  className?: string;
}

/** Affiche une info-bulle avec icône d'aide */
export function FeatureTooltip({ featureId, children, className }: FeatureTooltipProps) {
  const [show, setShow] = useState(false);
  
  const feature = FEATURES.find(f => f.id === featureId);
  if (!feature) return <>{children}</>;

  return (
    <div className={cn('relative inline-block', className)}>
      {children}
      <button
        onClick={() => setShow(!show)}
        className="ml-2 p-1 rounded-full bg-zinc-100 hover:bg-zinc-200"
      >
        <HelpCircle className="w-4 h-4 text-zinc-400" />
      </button>
      
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-0 mb-2 w-64 p-4 bg-zinc-900 text-white rounded-2xl shadow-xl z-50"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{feature.emoji}</span>
              <div>
                <h4 className="font-bold text-sm">{feature.title}</h4>
                <p className="text-xs text-zinc-400 mt-1">{feature.howTo[0]?.text}</p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setShow(false); }}
              className="absolute top-2 right-2 p-1 rounded-full bg-zinc-800"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =====================================================================
// TYPES pour exports
// =====================================================================

export type { Feature, FeatureTutorialProps, FeatureTooltipProps };