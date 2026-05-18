import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Crown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LeaderboardEntry } from '../../types/loyalty';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}

export const Leaderboard = ({ entries, currentUserId }: LeaderboardProps) => {
  return (
    <div className="space-y-3">
      {entries.map((entry, index) => {
        const isTop3 = index < 3;
        const isCurrentUser = entry.userId === currentUserId;

        return (
          <motion.div
            key={entry.userId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "flex items-center gap-4 p-4 rounded-3xl border transition-all",
              isCurrentUser ? "bg-primary/5 border-primary/20" : "bg-white border-zinc-100",
              isTop3 ? "shadow-md" : "shadow-sm"
            )}
          >
            <div className="w-10 flex items-center justify-center">
              {index === 0 ? (
                <Crown className="w-6 h-6 text-yellow-500" />
              ) : index === 1 ? (
                <Medal className="w-6 h-6 text-zinc-400" />
              ) : index === 2 ? (
                <Medal className="w-6 h-6 text-orange-400" />
              ) : (
                <span className="text-sm font-bold text-zinc-400">#{index + 1}</span>
              )}
            </div>

            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-zinc-100 flex-shrink-0">
              {entry.avatar ? (
                <img src={entry.avatar} alt={entry.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-100 text-zinc-400 font-bold">
                  {entry.userName.charAt(0)}
                </div>
              )}
            </div>

            <div className="flex-1">
              <h4 className={cn("font-bold text-sm", isCurrentUser && "text-primary")}>
                {entry.userName}
                {isCurrentUser && " (Vous)"}
              </h4>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{entry.levelName}</p>
            </div>

            <div className="text-right">
              <p className="text-sm font-bold">{entry.points.toLocaleString()}</p>
              <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-400">pts</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
