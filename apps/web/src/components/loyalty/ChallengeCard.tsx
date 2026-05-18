import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Objet renvoyé par useGlobalLoyalty (après mapping SQL). */
export interface LoyaltyChallengeRow {
  id: string;
  description: string;
  targetValue: number;
  pointsReward: number;
  emoji?: string;
  progress: number;
  isCompleted: boolean;
  type: string;
}

interface ChallengeCardProps {
  challenge: LoyaltyChallengeRow;
}

export const ChallengeCard = ({ challenge }: ChallengeCardProps) => {
  const title = challenge.type?.trim() || 'Défi';
  const description = challenge.description?.trim() || '';
  const target = Math.max(1, Number(challenge.targetValue) || 1);
  const current = Math.max(0, Number(challenge.progress) || 0);
  const pointsReward = Math.max(0, Number(challenge.pointsReward) || 0);
  const completed = Boolean(challenge.isCompleted);
  const progress = Math.min((current / target) * 100, 100);

  return (
    <div
      className={cn(
        'p-6 rounded-[2.5rem] border border-zinc-100 transition-all duration-300 relative overflow-hidden',
        completed ? 'bg-success/5 border-success/20' : 'bg-white shadow-sm hover:shadow-md',
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <h4 className="font-bold text-lg">
            <span className="mr-2" aria-hidden>
              {challenge.emoji || '⭐'}
            </span>
            {title}
          </h4>
          <p className="text-sm text-zinc-500">{description}</p>
        </div>
        <div
          className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg',
            completed ? 'bg-success text-white' : 'bg-primary text-white',
          )}
        >
          {completed ? <CheckCircle2 className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          <span>Progression</span>
          <span>
            {current} / {target}
          </span>
        </div>
        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Number.isFinite(progress) ? progress : 0}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={cn('h-full rounded-full', completed ? 'bg-success' : 'bg-primary')}
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          <Clock className="w-3 h-3" />
          <span>Semaine en cours</span>
        </div>
        <div className="px-3 py-1 bg-zinc-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-600">
          +{pointsReward} PTS
        </div>
      </div>

      {completed && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-success/10 rounded-full blur-3xl -mr-12 -mt-12" />
      )}
    </div>
  );
};
