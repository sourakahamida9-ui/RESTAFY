import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Crown, 
  Users,
  TrendingUp
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface LeaderboardEntry {
  customer_id: string;
  customer_name: string;
  rank: number;
  total_points: number;
  total_spent: number;
  restaurant_id: string;
  restaurant_name: string;
}

export default function LeaderboardPage() {
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  const fetchLeaderboards = async () => {
    try {
      const { data } = await supabase
        .from('restaurant_leaderboard')
        .select(
          `
          *,
          restaurants(name),
          profiles(full_name)
        `
        )
        .order('restaurant_id')
        .order('rank');

      if (data) {
        const grouped = data.reduce(
          (acc, item) => {
            const restaurantId = item.restaurant_id;
            if (!acc[restaurantId]) acc[restaurantId] = [];
            acc[restaurantId].push({
              customer_id: item.customer_id,
              customer_name: (item as any).profiles?.full_name || 'Anonyme',
              rank: item.rank,
              total_points: item.total_points,
              total_spent: item.total_spent,
              restaurant_id: restaurantId,
              restaurant_name: (item as any).restaurants?.name || 'Restaurant',
            });
            return acc;
          },
          {} as Record<string, LeaderboardEntry[]>
        );
        setLeaderboards(grouped);
      }
    } catch (error) {
      console.error('[v0] Error fetching leaderboards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Chargement des classements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-yellow-600" />
            <h1 className="text-3xl font-black text-gray-900">Classements</h1>
          </div>
          <p className="text-gray-600">Découvrez les clients les plus fidèles de chaque restaurant</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-12">
        {Object.entries(leaderboards).map(([restaurantId, entries]) => (
          <motion.section
            key={restaurantId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 mb-6">
              <h2 className="text-2xl font-black text-gray-900">{entries[0]?.restaurant_name}</h2>
              <span className="text-sm font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                {entries.length} clients
              </span>
            </div>

            <div className="space-y-3">
              {entries.slice(0, 10).map((entry) => (
                <motion.div
                  key={`${restaurantId}-${entry.customer_id}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`bg-white rounded-xl border-2 p-6 flex items-center justify-between ${
                    entry.rank === 1 ? 'border-yellow-400 shadow-lg' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Rank Badge */}
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-black text-white ${
                        entry.rank === 1
                          ? 'bg-yellow-400 text-yellow-900'
                          : entry.rank === 2
                            ? 'bg-gray-400'
                            : entry.rank === 3
                              ? 'bg-orange-400'
                              : 'bg-gray-600'
                      }`}
                    >
                      {entry.rank === 1 && <Crown className="w-6 h-6" />}
                      {entry.rank > 1 && entry.rank}
                    </div>

                    {/* Name & Stats */}
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-lg">{entry.customer_name}</p>
                      <p className="text-sm text-gray-600">{entry.total_points.toLocaleString()} points</p>
                    </div>
                  </div>

                  {/* VIP Badge */}
                  {entry.rank === 1 && (
                    <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">
                      <Trophy className="w-5 h-5 text-yellow-600" />
                      <span className="font-bold text-sm text-yellow-900">Client VIP</span>
                    </div>
                  )}

                  {/* Spent Amount */}
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Dépensé</p>
                    <p className="font-black text-gray-900">
                      {entry.total_spent.toLocaleString()} FCFA
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {entries.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">Pas de classement pour ce restaurant</p>
              </div>
            )}
          </motion.section>
        ))}

        {Object.keys(leaderboards).length === 0 && (
          <div className="text-center py-20">
            <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">Aucun classement disponible pour le moment</p>
          </div>
        )}
      </div>
    </div>
  );
}
