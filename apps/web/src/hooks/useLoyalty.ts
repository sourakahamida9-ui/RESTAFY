import { getAppUrl } from '@/lib/appUrl';
import { reloadProfileForCurrentUser } from '@/lib/authSync';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ============================================================================
// LOYALTY LEVEL DEFINITIONS
// ============================================================================
export const LOYALTY_LEVELS = {
  bronze: { min: 0, max: 499, name: 'Bronze', emoji: '🥉', color: '#CD7F32' },
  silver: { min: 500, max: 1499, name: 'Argent', emoji: '🥈', color: '#C0C0C0' },
  gold: { min: 1500, max: 3999, name: 'Or', emoji: '🥇', color: '#FFD700' },
  platinum: { min: 4000, max: 9999, name: 'Platine', emoji: '🏆', color: '#E5E4E2' },
  diamond: { min: 10000, max: Infinity, name: 'Diamant', emoji: '💎', color: '#B9F2FF' },
};

interface LoyaltyAccount {
  account_id: string | null;
  points: number;
  level: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  total_earned: number;
  total_redeemed: number;
}

interface LoyaltyConfig {
  loyalty_enabled: boolean;
  points_per_fcfa: number;
  min_points_redeem: number;
  restaurant_name: string;
}

interface Challenge {
  id: string;
  description: string;
  targetValue: number;
  pointsReward: number;
  emoji: string;
  progress: number;
  isCompleted: boolean;
  type: string;
}

interface ReferralInfo {
  code: string;
  link: string;
  stats: {
    totalReferrals: number;
    activeReferrals: number;
    pointsFromReferrals: number;
  };
}

interface LoyaltyState {
  account: LoyaltyAccount;
  config: LoyaltyConfig | null;
  loading: boolean;
  error: string | null;
}

interface RedeemResult {
  success: boolean;
  discount?: number;
  points_used?: number;
  remaining_points?: number;
  error?: string;
}

// ============================================================================
// GLOBAL LOYALTY HOOK - Points/Levels/Referrals/Challenges
// ============================================================================
export function useGlobalLoyalty() {
  const { user, profile } = useAuth();
  const [currentLevel, setCurrentLevel] = useState<keyof typeof LOYALTY_LEVELS>('bronze');
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profile) return;
    fetchGlobalLoyaltyData();
  }, [user, profile]);

  const fetchGlobalLoyaltyData = async () => {
    try {
      setIsLoading(true);

      // Determine level based on points
      const points = profile?.loyalty_points || 0;
      const levelKey = Object.keys(LOYALTY_LEVELS).find(
        (key) => {
          const level = LOYALTY_LEVELS[key as keyof typeof LOYALTY_LEVELS];
          return points >= level.min && points <= level.max;
        }
      ) as keyof typeof LOYALTY_LEVELS;

      setCurrentLevel(levelKey || 'bronze');

      // Fetch referral code and stats
      if (profile?.referral_code) {
        const { data: referrals } = await supabase
          .from('referrals')
          .select('status')
          .eq('referrer_id', user!.id);

        const active = referrals?.filter((r) => r.status === 'active').length || 0;
        const total = referrals?.length || 0;

        setReferral({
          code: profile.referral_code,
          link: `${getAppUrl()}/join?ref=${profile.referral_code}`,
          stats: {
            totalReferrals: total,
            activeReferrals: active,
            pointsFromReferrals: active * 200,
          },
        });
      }

      // Fetch weekly challenges
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());

      const { data: weekChallenges, error: chErr } = await supabase
        .from('weekly_challenges')
        .select(
          'id,description,challenge_type,target_value,points_reward,emoji,week_start,is_active',
        )
        .gte('week_start', weekStart.toISOString().split('T')[0])
        .eq('is_active', true);

      if (chErr && import.meta.env.DEV) {
        console.warn('[useGlobalLoyalty] weekly_challenges:', chErr.message);
      }

      if (weekChallenges?.length) {
        const { data: progress } = await supabase
          .from('challenge_progress')
          .select('challenge_id, progress_value, is_completed')
          .eq('customer_id', user!.id);

        const progressMap = new Map(progress?.map((p) => [p.challenge_id, p]) || []);

        const formatted: Challenge[] = weekChallenges.map((ch) => {
          const p = progressMap.get(ch.id);
          const row = ch as {
            id: string;
            description: string | null;
            challenge_type: string | null;
            target_value: number | null;
            points_reward: number | null;
            emoji: string | null;
          };
          return {
            id: row.id,
            description: typeof row.description === 'string' ? row.description : 'Défi',
            targetValue: Math.max(1, Number(row.target_value) || 1),
            pointsReward: Math.max(0, Number(row.points_reward) || 0),
            emoji: row.emoji?.trim() || '⭐',
            progress: Math.max(0, Number(p?.progress_value) || 0),
            isCompleted: Boolean(p?.is_completed),
            type: typeof row.challenge_type === 'string' ? row.challenge_type : 'défi',
          };
        });

        setChallenges(formatted);
      } else {
        setChallenges([]);
      }
    } catch (err) {
      setError('Erreur lors du chargement de la fidélité');
    } finally {
      setIsLoading(false);
    }
  };

  const currentLevelData = LOYALTY_LEVELS[currentLevel] ?? LOYALTY_LEVELS.bronze;
  const nextLevelKey = Object.keys(LOYALTY_LEVELS)[
    Object.keys(LOYALTY_LEVELS).indexOf(currentLevel) + 1
  ] as keyof typeof LOYALTY_LEVELS | undefined;
  const nextLevelData = nextLevelKey ? LOYALTY_LEVELS[nextLevelKey] : null;

  const points = profile?.loyalty_points || 0;
  const pointsToNextLevel = nextLevelData ? nextLevelData.min - points : 0;
  const progressPercent = nextLevelData
    ? Math.min(
        100,
        Math.round(
          ((points - currentLevelData.min) /
            (nextLevelData.min - currentLevelData.min)) *
            100
        )
      )
    : 100;

  return {
    currentLevel,
    currentLevelData,
    points,
    nextLevel: nextLevelKey,
    nextLevelData,
    pointsToNextLevel,
    progressPercent,
    referral,
    challenges,
    isLoading,
    error,
    refetch: fetchGlobalLoyaltyData,
  };
}

// ============================================================================
// RESTAURANT-SPECIFIC LOYALTY HOOK
// ============================================================================
export function useCustomerLoyalty(restaurantId: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<LoyaltyState>({
    account: { account_id: null, points: 0, level: 'bronze', total_earned: 0, total_redeemed: 0 },
    config: null,
    loading: true,
    error: null,
  });

  const fetchLoyalty = useCallback(async () => {
    if (!user?.id || !restaurantId) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_customer_loyalty', {
        p_customer_id: user.id,
        p_restaurant_id: restaurantId,
      });

      if (error) throw error;

      setState({
        account: data?.account || { points: 0, level: 'bronze', total_earned: 0, total_redeemed: 0 },
        config: data?.config || null,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Impossible de charger les informations de fidélité',
      }));
    }
  }, [user?.id, restaurantId]);

  useEffect(() => {
    fetchLoyalty();
  }, [fetchLoyalty]);

  // Calculer les points qui seront gagnes pour un montant donne
  const calculatePointsForAmount = (amount: number): number => {
    if (!state.config?.loyalty_enabled) return 0;
    return Math.floor(amount * (state.config.points_per_fcfa || 0.01));
  };

  // Utiliser des points pour une reduction
  const redeemPoints = async (pointsToRedeem: number, orderId?: string): Promise<RedeemResult> => {
    if (!user?.id || !restaurantId) {
      return { success: false, error: 'Non connecte' };
    }

    try {
      const { data, error } = await supabase.rpc('redeem_loyalty_points', {
        p_customer_id: user.id,
        p_restaurant_id: restaurantId,
        p_points_to_redeem: pointsToRedeem,
        p_order_id: orderId || null,
      });

      if (error) throw error;

      if (data?.success) {
        await reloadProfileForCurrentUser();
        await fetchLoyalty();
      }

      return data as RedeemResult;
    } catch (err) {
      return {
        success: false,
        error: 'Impossible d\'utiliser les points. Veuillez réessayer.',
      };
    }
  };

  return {
    ...state,
    calculatePointsForAmount,
    redeemPoints,
    refetch: fetchLoyalty,
  };
}

// Hook pour les restaurants - gerer leur configuration fidelite
export function useRestaurantLoyaltySettings(restaurantId: string | null) {
  const [config, setConfig] = useState({
    loyalty_enabled: true,
    loyalty_points_per_fcfa: 0.01,
    loyalty_min_points_redeem: 100,
    loyalty_welcome_bonus: 50,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger la configuration
  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('loyalty_enabled, loyalty_points_per_fcfa, loyalty_min_points_redeem, loyalty_welcome_bonus')
          .eq('id', restaurantId)
          .single();

        if (error) throw error;

        setConfig({
          loyalty_enabled: data.loyalty_enabled ?? true,
          loyalty_points_per_fcfa: data.loyalty_points_per_fcfa ?? 0.01,
          loyalty_min_points_redeem: data.loyalty_min_points_redeem ?? 100,
          loyalty_welcome_bonus: data.loyalty_welcome_bonus ?? 50,
        });
      } catch (err) {
        setError('Impossible de charger la configuration fidélité');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [restaurantId]);

  // Sauvegarder la configuration
  const saveConfig = async (newConfig: Partial<typeof config>) => {
    if (!restaurantId) return { error: 'Restaurant non defini' };

    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          loyalty_enabled: newConfig.loyalty_enabled ?? config.loyalty_enabled,
          loyalty_points_per_fcfa: newConfig.loyalty_points_per_fcfa ?? config.loyalty_points_per_fcfa,
          loyalty_min_points_redeem: newConfig.loyalty_min_points_redeem ?? config.loyalty_min_points_redeem,
          loyalty_welcome_bonus: newConfig.loyalty_welcome_bonus ?? config.loyalty_welcome_bonus,
        })
        .eq('id', restaurantId);

      if (error) throw error;

      setConfig(prev => ({ ...prev, ...newConfig }));
      return { error: null };
    } catch (err) {
      const errorMsg = 'Impossible de sauvegarder la configuration';
      setError(errorMsg);
      return { error: errorMsg };
    } finally {
      setSaving(false);
    }
  };

  // Obtenir les statistiques de fidelite
  const [stats, setStats] = useState({
    totalAccounts: 0,
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
    activeMembers: 0,
  });

  useEffect(() => {
    if (!restaurantId) return;

    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('loyalty_accounts')
          .select('points, total_earned, total_redeemed')
          .eq('restaurant_id', restaurantId);

        if (error) throw error;

        setStats({
          totalAccounts: data?.length || 0,
          totalPointsIssued: data?.reduce((sum, a) => sum + (a.total_earned || 0), 0) || 0,
          totalPointsRedeemed: data?.reduce((sum, a) => sum + (a.total_redeemed || 0), 0) || 0,
          activeMembers: data?.filter(a => (a.points || 0) > 0).length || 0,
        });
      } catch (err) {
      }
    };

    fetchStats();
  }, [restaurantId]);

  return {
    config,
    stats,
    loading,
    saving,
    error,
    saveConfig,
    updateConfig: (updates: Partial<typeof config>) => setConfig(prev => ({ ...prev, ...updates })),
  };
}

// Hook pour les transactions de fidelite
export function useLoyaltyTransactions(restaurantId: string | null, limit = 50) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const fetchTransactions = async () => {
      try {
        const { data, error } = await supabase
          .from('loyalty_transactions')
          .select(`
            *,
            account:loyalty_accounts!inner(
              customer:profiles!customer_id(full_name, phone)
            )
          `)
          .eq('loyalty_accounts.restaurant_id', restaurantId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        setTransactions(data || []);
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [restaurantId, limit]);

  return { transactions, loading };
}
