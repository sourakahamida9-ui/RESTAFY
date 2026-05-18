import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Share2, 
  Copy, 
  Users, 
  Gift, 
  Check,
  MessageCircle
} from 'lucide-react';
import { useGlobalLoyalty } from '@/hooks/useLoyalty';

export default function ReferralPage() {
  const { referral } = useGlobalLoyalty();
  const [copied, setCopied] = useState(false);

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOptions = [
    {
      name: 'WhatsApp',
      icon: '💬',
      action: () =>
        window.open(
          `https://wa.me/?text=Rejoignez Restafy avec mon code ${referral?.code}! Tu reçois -500 FCFA sur ta première commande. ${referral?.link}`
        ),
    },
    {
      name: 'Copy Link',
      icon: '🔗',
      action: () => copyCode(referral?.link || ''),
    },
    {
      name: 'Copy Code',
      icon: '📋',
      action: () => copyCode(referral?.code || ''),
    },
  ];

  if (!referral) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-2xl p-12 text-center relative overflow-hidden"
        >
          <div className="relative z-10 space-y-4">
            <Share2 className="w-16 h-16 mx-auto mb-4" />
            <h1 className="text-4xl font-black">Parrainage</h1>
            <p className="text-purple-100 text-lg">Invitez vos amis et gagnez des points!</p>
          </div>
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24" />
        </motion.div>

        {/* Share Options */}
        <div className="grid grid-cols-3 gap-4">
          {shareOptions.map((option) => (
            <motion.button
              key={option.name}
              whileHover={{ scale: 1.05 }}
              onClick={option.action}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition text-center"
            >
              <div className="text-4xl mb-3">{option.icon}</div>
              <p className="font-bold text-gray-900 text-sm">{option.name}</p>
            </motion.button>
          ))}
        </div>

        {/* Code Display */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <p className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-4">Votre code unique</p>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="text"
              value={referral.code}
              readOnly
              className="flex-1 px-4 py-4 border-2 border-purple-200 rounded-lg font-bold text-2xl text-center bg-purple-50 text-purple-600"
            />
            <button
              onClick={() => copyCode(referral.code)}
              className="p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-600">
            Partagez ce code avec vos amis. Quand ils s'inscrivent et font leur première commande, vous gagnez tous les deux!
          </p>
        </div>

        {/* How it Works */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h2 className="text-2xl font-black text-gray-900 mb-6">Comment ça marche?</h2>
          <div className="space-y-4">
            {[
              { step: 1, title: 'Partagez votre code', desc: 'Donnez votre code unique à vos amis' },
              { step: 2, title: 'Ils s\'inscrivent', desc: 'Ils créent un compte avec votre code' },
              { step: 3, title: 'Première commande', desc: 'Ils reçoivent -500 FCFA automatiquement' },
              { step: 4, title: 'Vous gagnez!', desc: 'Vous recevez +200 points de fidélité' },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                  {item.step}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            whileHover={{ y: -5 }}
            className="bg-white rounded-xl border border-gray-200 p-6 text-center"
          >
            <Users className="w-8 h-8 text-purple-600 mx-auto mb-3" />
            <p className="text-3xl font-black text-gray-900">{referral.stats.totalReferrals}</p>
            <p className="text-sm text-gray-600 mt-1">Personnes inscrites</p>
          </motion.div>

          <motion.div
            whileHover={{ y: -5 }}
            className="bg-white rounded-xl border border-gray-200 p-6 text-center"
          >
            <Check className="w-8 h-8 text-green-600 mx-auto mb-3" />
            <p className="text-3xl font-black text-gray-900">{referral.stats.activeReferrals}</p>
            <p className="text-sm text-gray-600 mt-1">Ont commandé</p>
          </motion.div>

          <motion.div
            whileHover={{ y: -5 }}
            className="bg-white rounded-xl border border-gray-200 p-6 text-center"
          >
            <Gift className="w-8 h-8 text-orange-600 mx-auto mb-3" />
            <p className="text-3xl font-black text-gray-900">+{referral.stats.pointsFromReferrals}</p>
            <p className="text-sm text-gray-600 mt-1">Points gagnés</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

