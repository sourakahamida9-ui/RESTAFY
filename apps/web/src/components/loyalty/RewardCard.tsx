import React from 'react';
import { motion } from 'framer-motion';
import { Gift, Lock, ShoppingBag } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RewardCardProps {
  key?: string | number;
  name: string;
  description: string;
  pointsCost: number;
  category: string;
  image?: string;
  isLocked?: boolean;
  canAfford?: boolean;
  onRedeem?: () => void;
}

export const RewardCard = ({ 
  name, 
  description, 
  pointsCost, 
  category, 
  image,
  isLocked = false,
  canAfford = false,
  onRedeem 
}: RewardCardProps) => {
  return (
    <div className={cn(
      "bg-white rounded-[2.5rem] border border-zinc-100 overflow-hidden transition-all duration-300 group",
      isLocked ? "opacity-60" : "hover:shadow-xl hover:-translate-y-1"
    )}>
      <div className="aspect-[4/3] relative overflow-hidden bg-zinc-100">
        {image ? (
          <img src={image} alt={name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-300">
            <Gift className="w-12 h-12" />
          </div>
        )}
        <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm">
          {category}
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="space-y-1">
          <h4 className="font-bold text-lg">{name}</h4>
          <p className="text-sm text-zinc-500 line-clamp-2">{description}</p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-primary">{pointsCost}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">pts</span>
          </div>
          
          <button 
            disabled={isLocked || !canAfford}
            onClick={onRedeem}
            className={cn(
              "px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2",
              isLocked ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" :
              canAfford ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200 hover:bg-black" :
              "bg-zinc-100 text-zinc-400 cursor-not-allowed"
            )}
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5" />}
            {isLocked ? 'Verrouillé' : 'Échanger'}
          </button>
        </div>
      </div>
    </div>
  );
};
