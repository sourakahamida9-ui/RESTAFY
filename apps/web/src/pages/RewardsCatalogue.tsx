import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Gift, 
  ArrowLeft, 
  Search, 
  Filter, 
  CheckCircle2, 
  X,
  Star,
  Zap,
  ShoppingBag
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLoyaltyStore } from '../store/useLoyaltyStore';
import { RewardCard } from '../components/loyalty/RewardCard';
import { cn } from '../lib/utils';

export default function RewardsCatalogue() {
  const navigate = useNavigate();
  const { rewards, userStates, redeemReward } = useLoyaltyStore();
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [redeemingReward, setRedeemingReward] = useState<any | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const allRewards = selectedRestaurant === 'all' 
    ? Object.values(rewards).flat()
    : rewards[selectedRestaurant] || [];

  const filteredRewards = allRewards.filter(r => 
    selectedCategory === 'all' || r.category === selectedCategory
  );

  const restaurantNames: Record<string, string> = {
    '1': 'Burger House',
    '2': 'Pizza Time'
  };

  const handleRedeem = (reward: any) => {
    setRedeemingReward(reward);
  };

  const confirmRedeem = () => {
    if (redeemingReward) {
      const success = redeemReward(redeemingReward.restaurantId, redeemingReward.id);
      if (success) {
        setRedeemingReward(null);
        setShowSuccess(true);
        // Lazy-load confetti only when actually firing.
        void import('canvas-confetti').then(({ default: confetti }) =>
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FF6321', '#000000', '#FFFFFF']
          })
        ).catch(() => {});
        setTimeout(() => setShowSuccess(false), 3000);
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-32">
      <header className="bg-white border-b border-zinc-100 px-4 py-8 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 bg-zinc-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold">Récompenses</h1>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-full">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-bold">2.550 pts</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Rechercher une récompense..."
              className="w-full bg-zinc-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <FilterButton 
              active={selectedRestaurant === 'all'} 
              onClick={() => setSelectedRestaurant('all')}
              label="Tous les restaurants"
            />
            {Object.keys(rewards).map(id => (
              <FilterButton 
                key={id}
                active={selectedRestaurant === id} 
                onClick={() => setSelectedRestaurant(id)}
                label={restaurantNames[id]}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRewards.map((reward) => {
            const userState = userStates[reward.restaurantId];
            const canAfford = userState ? userState.points >= reward.pointsCost : false;

            return (
              <RewardCard
                key={reward.id}
                name={reward.name}
                description={reward.description}
                pointsCost={reward.pointsCost}
                category={reward.category}
                image={`https://picsum.photos/seed/reward${reward.id}/400/300`}
                canAfford={canAfford}
                onRedeem={() => handleRedeem(reward)}
              />
            );
          })}
        </div>
      </div>

      {/* Redeem Confirmation Modal */}
      <AnimatePresence>
        {redeemingReward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-lg rounded-[3rem] p-8 space-y-8"
            >
              <div className="flex justify-between items-start">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <button onClick={() => setRedeemingReward(null)} className="p-2 bg-zinc-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Confirmer l'échange ?</h3>
                <p className="text-zinc-500">
                  Vous allez échanger <span className="font-bold text-zinc-900">{redeemingReward.pointsCost} points</span> contre :
                </p>
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden">
                    <img src={`https://picsum.photos/seed/reward${redeemingReward.id}/100/100`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-bold">{redeemingReward.name}</p>
                    <p className="text-xs text-zinc-400">{restaurantNames[redeemingReward.restaurantId]}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setRedeemingReward(null)}
                  className="flex-1 py-4 bg-zinc-100 rounded-full font-bold text-zinc-600"
                >
                  Annuler
                </button>
                <button 
                  onClick={confirmRedeem}
                  className="flex-1 py-4 bg-zinc-900 text-white rounded-full font-bold shadow-xl shadow-zinc-200"
                >
                  Confirmer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 text-center shadow-2xl">
              <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Félicitations !</h3>
              <p className="text-zinc-500 mb-8">Votre récompense a été ajoutée à votre portefeuille. Profitez-en bien !</p>
              <button 
                onClick={() => setShowSuccess(false)}
                className="btn-primary w-full"
              >
                Super !
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FilterButton = ({ active, onClick, label }: any) => (
  <button 
    onClick={onClick}
    className={cn(
      "px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all",
      active ? "bg-zinc-900 text-white shadow-lg" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
    )}
  >
    {label}
  </button>
);
