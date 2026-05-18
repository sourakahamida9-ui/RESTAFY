import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface LevelProgressProps {
  currentPoints: number;
  nextLevelPoints: number;
  currentLevelName: string;
  nextLevelName: string;
  colorClass?: string;
}

export const LevelProgress = ({ 
  currentPoints, 
  nextLevelPoints, 
  currentLevelName, 
  nextLevelName,
  colorClass = "bg-primary"
}: LevelProgressProps) => {
  const progress = Math.min((currentPoints / nextLevelPoints) * 100, 100);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Niveau Actuel</p>
          <p className="text-lg font-bold">{currentLevelName}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Prochain Niveau</p>
          <p className="text-sm font-bold text-zinc-600">{nextLevelName}</p>
        </div>
      </div>
      
      <div className="relative h-3 bg-zinc-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn("absolute inset-y-0 left-0 rounded-full", colorClass)}
        />
      </div>
      
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
        <span>{currentPoints} pts</span>
        <span>{nextLevelPoints} pts</span>
      </div>
    </div>
  );
};
