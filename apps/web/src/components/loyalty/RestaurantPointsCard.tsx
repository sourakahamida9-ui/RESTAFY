import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Award, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LevelProgress } from './LevelProgress';

interface RestaurantPointsCardProps {
  key?: string | number;
  restaurantName: string;
  points: number;
  currentLevel: string;
  nextLevel: string;
  nextLevelPoints: number;
  restaurantImage?: string;
  onClick?: () => void;
}

export const RestaurantPointsCard = ({ 
  restaurantName, 
  points, 
  currentLevel, 
  nextLevel, 
  nextLevelPoints,
  restaurantImage,
  onClick 
}: RestaurantPointsCardProps) => {
  return (
    <button 
      onClick={onClick}
      className="w-full bg-white p-6 rounded-[2.5rem] border border-zinc-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left group relative overflow-hidden"
    >
      <div className="flex items-center gap-4 mb-6 relative z-10">
        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-100 flex-shrink-0">
          {restaurantImage ? (
            <img src={restaurantImage} alt={restaurantName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-300">
              <Award className="w-8 h-8" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-1">{restaurantName}</h3>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold uppercase tracking-widest">
              {currentLevel}
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              <TrendingUp className="w-3 h-3" />
              <span>{points} pts</span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-6 h-6 text-zinc-300 group-hover:text-primary transition-colors" />
      </div>

      <div className="relative z-10">
        <LevelProgress 
          currentPoints={points}
          nextLevelPoints={nextLevelPoints}
          currentLevelName={currentLevel}
          nextLevelName={nextLevel}
        />
      </div>

      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
    </button>
  );
};
