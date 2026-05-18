import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalLoyalty, LOYALTY_LEVELS } from '@/hooks/useLoyalty';
import { useAuth } from '@/hooks/useAuth';
import { ChallengeCard } from '@/components/loyalty/ChallengeCard';
import { Copy, Share2, Target, Zap, Gift, TrendingUp, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoyaltyDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const {
    currentLevel,
    currentLevelData,
    points,
    nextLevel,
    nextLevelData,
    pointsToNextLevel,
    progressPercent,
    referral,
    challenges,
    isLoading,
    error,
  } = useGlobalLoyalty();
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement de votre fidélité...</p>
        </div>
      </div>
    );
  }

  const copyReferralCode = () => {
    if (referral?.code) {
      navigator.clipboard.writeText(referral.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const levelEntries = Object.entries(LOYALTY_LEVELS);
  const currentLevelIndex = levelEntries.findIndex(([key]) => key === currentLevel);

  // Check if points are expiring soon (simulated - in real app, get from DB)
  const pointsExpiringWarning = points > 500 && Math.random() > 0.5;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-black text-gray-900">Mon Compte Fidélité</h1>
          <p className="text-gray-600 mt-1">
            {currentLevelData.emoji} {currentLevelData.name} • {points.toLocaleString()} points
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 m-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Expiring Points Warning */}
        {pointsExpiringWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-orange-900">Points en danger!</p>
              <p className="text-sm text-orange-800">
                340 points expirent dans 14 jours. Commandez maintenant pour les conserver.
              </p>
            </div>
          </motion.div>
        )}

        {/* Level Progress Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl p-8 shadow-lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Current Level */}
            <div className="text-center">
              <p className="text-sm font-bold text-orange-100 uppercase tracking-wider mb-2">Niveau actuel</p>
              <div className="text-6xl mb-3">{currentLevelData.emoji}</div>
              <p className="text-2xl font-black">{currentLevelData.name}</p>
            </div>

            {/* Progress */}
            <div className="flex flex-col justify-center">
              <p className="text-sm font-bold text-orange-100 uppercase tracking-wider mb-4">Progression</p>
              <div className="space-y-3">
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-white"
                  />
                </div>
                <p className="text-sm text-orange-50 text-center">
                  {points.toLocaleString()} / {nextLevelData?.min.toLocaleString() || '∞'} points
                </p>
                <p className="text-xs text-orange-200 text-center font-bold">
                  {pointsToNextLevel > 0
                    ? `${pointsToNextLevel.toLocaleString()} points avant ${nextLevelData?.name}`
                    : 'Vous avez atteint le maximum! 🎉'}
                </p>
              </div>
            </div>

            {/* Benefits */}
            <div className="flex flex-col justify-center">
              <p className="text-sm font-bold text-orange-100 uppercase tracking-wider mb-3">Avantages</p>
              <ul className="space-y-2 text-sm">
                {['Livraison gratuite', '-10% de réduction', 'Accès prioritaire'].map((benefit, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Level Journey */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <h2 className="text-xl font-black text-gray-900 mb-6">Parcours des niveaux</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {levelEntries.map(([key, level], index) => (
              <div
                key={key}
                className={`text-center p-4 rounded-xl border-2 transition ${
                  index <= currentLevelIndex ? 'border-orange-600 bg-orange-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <p className="text-3xl mb-2">{level.emoji}</p>
                <p className="font-bold text-sm text-gray-900">{level.name}</p>
                <p className="text-xs text-gray-600 mt-1">{level.min}+ pts</p>
              </div>
            ))}
          </div>
        </div>

        {/* Referral Section */}
        {referral && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <Share2 className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-black text-gray-900">Parrainez vos amis</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Code */}
              <div className="bg-white rounded-xl p-6 border border-purple-200">
                <p className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3">Votre code</p>
                <div className="flex items-center gap-2 mb-4">
                  <code className="flex-1 font-bold text-2xl text-purple-600 text-center py-3 bg-purple-50 rounded-lg">
                    {referral.code}
                  </code>
                  <button
                    onClick={copyReferralCode}
                    className="p-3 hover:bg-gray-100 rounded-lg transition"
                  >
                    <Copy className={`w-5 h-5 ${copied ? 'text-green-600' : 'text-gray-600'}`} />
                  </button>
                </div>
                <p className="text-xs text-gray-600">Partagez ce code pour que vos amis reçoivent -500 FCFA!</p>
              </div>

              {/* Stats */}
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-6 border border-purple-200">
                  <p className="text-sm font-bold text-gray-600 uppercase tracking-wider">Filleuls actifs</p>
                  <p className="text-4xl font-black text-purple-600 mt-2">{referral.stats.activeReferrals}</p>
                  <p className="text-xs text-gray-600 mt-1">{referral.stats.totalReferrals} inscrits</p>
                </div>
                <div className="bg-white rounded-xl p-6 border border-purple-200">
                  <p className="text-sm font-bold text-gray-600 uppercase tracking-wider">Points gagnés</p>
                  <p className="text-4xl font-black text-purple-600 mt-2">+{referral.stats.pointsFromReferrals}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Weekly Challenges */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-6 h-6 text-orange-600" />
            <h2 className="text-2xl font-black text-gray-900">Défis de la semaine</h2>
          </div>

          {challenges.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">Aucun défi cette semaine</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {challenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard Preview */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-orange-600" />
              <h2 className="text-2xl font-black text-gray-900">Classement</h2>
            </div>
            <button
              onClick={() => navigate('/leaderboard')}
              className="text-orange-600 font-bold hover:underline"
            >
              Voir plus →
            </button>
          </div>
          <p className="text-gray-600">
            Découvrez le classement des clients les plus fidèles de chaque restaurant et gagnez des récompenses exclusives chaque mois!
          </p>
        </div>
      </div>
    </div>
  );
}
