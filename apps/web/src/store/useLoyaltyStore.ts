import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  LoyaltyLevel, 
  Reward, 
  Challenge, 
  Badge, 
  RestaurantLoyaltyConfig, 
  UserLoyaltyState,
  LeaderboardEntry
} from '../types/loyalty';

interface LoyaltyStore {
  configs: Record<string, RestaurantLoyaltyConfig>;
  levels: Record<string, LoyaltyLevel[]>;
  rewards: Record<string, Reward[]>;
  challenges: Record<string, Challenge[]>;
  badges: Record<string, Badge[]>;
  userStates: Record<string, UserLoyaltyState>;
  
  // Actions
  addPoints: (restaurantId: string, amount: number) => void;
  redeemReward: (restaurantId: string, rewardId: string) => boolean;
  updateChallengeProgress: (restaurantId: string, challengeId: string, progress: number) => void;
  getRestaurantState: (restaurantId: string) => UserLoyaltyState;
  getRestaurantLevels: (restaurantId: string) => LoyaltyLevel[];
  getRestaurantRewards: (restaurantId: string) => Reward[];
  getRestaurantChallenges: (restaurantId: string) => Challenge[];
  getRestaurantBadges: (restaurantId: string) => Badge[];
  getLeaderboard: (restaurantId: string) => LeaderboardEntry[];
}

export const useLoyaltyStore = create<LoyaltyStore>()(
  persist(
    (set, get) => ({
      configs: {
        '1': {
          restaurantId: '1',
          pointsPerFcfa: 0.1, // 100 FCFA = 10 pts
          pointExpirationMonths: 12,
          multipliers: { firstOrder: 2, weekend: 1.5, happyHour: 1.2 }
        },
        '2': {
          restaurantId: '2',
          pointsPerFcfa: 0.05, // 100 FCFA = 5 pts
          pointExpirationMonths: 6,
          multipliers: { firstOrder: 3, weekend: 1.2, happyHour: 1.1 }
        }
      },
      levels: {
        '1': [
          { id: 'l1', restaurantId: '1', name: 'CLIENT', minPoints: 0, color: 'bg-zinc-400', benefits: ['Points sur chaque commande'] },
          { id: 'l2', restaurantId: '1', name: 'HABITUÉ', minPoints: 1000, color: 'bg-orange-400', benefits: ['Boisson offerte', 'Réduction 5%'] },
          { id: 'l3', restaurantId: '1', name: 'VIP', minPoints: 5000, color: 'bg-yellow-400', benefits: ['Priorité livraison', 'Réduction 10%'] },
          { id: 'l4', restaurantId: '1', name: 'PREMIUM', minPoints: 15000, color: 'bg-blue-400', benefits: ['Livraison gratuite', 'Accès événements VIP'] }
        ],
        '2': [
          { id: 'l2-1', restaurantId: '2', name: 'NOVICE', minPoints: 0, color: 'bg-zinc-300', benefits: ['Points de base'] },
          { id: 'l2-2', restaurantId: '2', name: 'GOURMET', minPoints: 500, color: 'bg-emerald-400', benefits: ['Dessert offert le weekend'] },
          { id: 'l2-3', restaurantId: '2', name: 'ELITE', minPoints: 2000, color: 'bg-purple-400', benefits: ['-15% sur tout le menu'] }
        ]
      },
      rewards: {
        '1': [
          { id: 'r1', restaurantId: '1', name: 'Livraison Gratuite', description: 'Valable sur votre prochaine commande', pointsCost: 200, category: 'service' },
          { id: 'r2', restaurantId: '1', name: 'Réduction 500 FCFA', description: 'Utilisable immédiatement', pointsCost: 500, category: 'discount' },
          { id: 'r3', restaurantId: '1', name: 'Dessert Offert', description: 'Choisissez parmi nos desserts du jour', pointsCost: 800, category: 'food' },
          { id: 'r4', restaurantId: '1', name: 'Plat Signature Offert', description: 'Un plat au choix dans notre carte', pointsCost: 1500, category: 'food' }
        ],
        '2': [
          { id: 'r2-1', restaurantId: '2', name: 'Boisson Offerte', description: 'Soda ou jus local au choix', pointsCost: 150, category: 'drink' },
          { id: 'r2-2', restaurantId: '2', name: 'Réduction 1000 FCFA', description: 'Sur commande > 5000 FCFA', pointsCost: 800, category: 'discount' }
        ]
      },
      challenges: {
        '1': [
          { id: 'c1', restaurantId: '1', title: 'Fan de Burgers', description: 'Commandez 3 fois cette semaine', pointsReward: 300, type: 'order_count', targetValue: 3, currentValue: 1 },
          { id: 'c2', restaurantId: '1', title: 'Gros Appétit', description: 'Dépensez 10 000 FCFA en une fois', pointsReward: 500, type: 'spend_amount', targetValue: 10000, currentValue: 4500 }
        ],
        '2': [
          { id: 'c2-1', restaurantId: '2', title: 'Explorateur', description: 'Testez 3 plats différents', pointsReward: 400, type: 'specific_item', targetValue: 3, currentValue: 1 }
        ]
      },
      badges: {
        '1': [
          { id: 'b1', restaurantId: '1', name: 'Client Fidèle', description: '10 commandes effectuées', iconName: 'Award' },
          { id: 'b2', restaurantId: '1', name: 'Nocturne', description: 'Commandes après 22h', iconName: 'Moon' }
        ]
      },
      userStates: {
        '1': {
          restaurantId: '1',
          points: 1200,
          totalPointsEarned: 1500,
          currentLevelId: 'l2',
          unlockedBadges: ['b1'],
          activeChallenges: [
            { challengeId: 'c1', progress: 1, completed: false },
            { challengeId: 'c2', progress: 4500, completed: false }
          ]
        },
        '2': {
          restaurantId: '2',
          points: 450,
          totalPointsEarned: 450,
          currentLevelId: 'l2-1',
          unlockedBadges: [],
          activeChallenges: [
            { challengeId: 'c2-1', progress: 1, completed: false }
          ]
        }
      },

      addPoints: (restaurantId, amount) => {
        set((state) => {
          const userState = state.userStates[restaurantId] || {
            restaurantId,
            points: 0,
            totalPointsEarned: 0,
            currentLevelId: state.levels[restaurantId]?.[0]?.id || '',
            unlockedBadges: [],
            activeChallenges: []
          };
          
          const newPoints = userState.points + amount;
          const newTotal = userState.totalPointsEarned + amount;
          
          // Check for level up
          const restaurantLevels = state.levels[restaurantId] || [];
          const newLevel = [...restaurantLevels]
            .sort((a, b) => b.minPoints - a.minPoints)
            .find(l => newTotal >= l.minPoints);
            
          return {
            userStates: {
              ...state.userStates,
              [restaurantId]: {
                ...userState,
                points: newPoints,
                totalPointsEarned: newTotal,
                currentLevelId: newLevel?.id || userState.currentLevelId
              }
            }
          };
        });
      },

      redeemReward: (restaurantId, rewardId) => {
        const state = get();
        const userState = state.userStates[restaurantId];
        const reward = state.rewards[restaurantId]?.find(r => r.id === rewardId);
        
        if (userState && reward && userState.points >= reward.pointsCost) {
          set((state) => ({
            userStates: {
              ...state.userStates,
              [restaurantId]: {
                ...userState,
                points: userState.points - reward.pointsCost
              }
            }
          }));
          return true;
        }
        return false;
      },

      updateChallengeProgress: (restaurantId, challengeId, progress) => {
        set((state) => {
          const userState = state.userStates[restaurantId];
          if (!userState) return state;
          
          const challenge = state.challenges[restaurantId]?.find(c => c.id === challengeId);
          if (!challenge) return state;

          const updatedChallenges = userState.activeChallenges.map(ac => {
            if (ac.challengeId === challengeId) {
              const newProgress = ac.progress + progress;
              const completed = newProgress >= challenge.targetValue;
              
              // If just completed, add reward points
              if (completed && !ac.completed) {
                setTimeout(() => get().addPoints(restaurantId, challenge.pointsReward), 0);
              }
              
              return { ...ac, progress: newProgress, completed };
            }
            return ac;
          });

          return {
            userStates: {
              ...state.userStates,
              [restaurantId]: {
                ...userState,
                activeChallenges: updatedChallenges
              }
            }
          };
        });
      },

      getRestaurantState: (restaurantId) => get().userStates[restaurantId],
      getRestaurantLevels: (restaurantId) => get().levels[restaurantId] || [],
      getRestaurantRewards: (restaurantId) => get().rewards[restaurantId] || [],
      getRestaurantChallenges: (restaurantId) => get().challenges[restaurantId] || [],
      getRestaurantBadges: (restaurantId) => get().badges[restaurantId] || [],
      getLeaderboard: (restaurantId) => [
        { userId: 'u1', userName: 'Hamida S.', points: 15000, levelName: 'PREMIUM', rank: 1 },
        { userId: 'u2', userName: 'Ahmed B.', points: 8500, levelName: 'VIP', rank: 2 },
        { userId: 'u3', userName: 'Sarah K.', points: 4200, levelName: 'HABITUÉ', rank: 3 },
        { userId: 'u4', userName: 'Moussa D.', points: 1200, levelName: 'HABITUÉ', rank: 4 },
      ]
    }),
    { name: 'restafy-loyalty-storage' }
  )
);
