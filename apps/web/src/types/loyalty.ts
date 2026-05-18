import { LucideIcon } from 'lucide-react';

export type LoyaltyLevel = {
  id: string;
  restaurantId: string;
  name: string;
  minPoints: number;
  color: string;
  benefits: string[];
};

export type Reward = {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  pointsCost: number;
  category: 'food' | 'drink' | 'discount' | 'service';
  image?: string;
  minLevelId?: string;
  stockLimit?: number;
  expiryDays?: number;
};

export type Challenge = {
  id: string;
  restaurantId: string;
  title: string;
  description: string;
  pointsReward: number;
  type: 'order_count' | 'spend_amount' | 'streak' | 'specific_item';
  targetValue: number;
  currentValue: number;
  deadline?: string;
};

export type Badge = {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  iconName: string;
  unlockedAt?: string;
};

export type RestaurantLoyaltyConfig = {
  restaurantId: string;
  pointsPerFcfa: number;
  pointExpirationMonths: number; // 0 for never
  multipliers: {
    firstOrder: number;
    weekend: number;
    happyHour: number;
  };
};

export type UserLoyaltyState = {
  restaurantId: string;
  points: number;
  totalPointsEarned: number;
  currentLevelId: string;
  unlockedBadges: string[];
  activeChallenges: {
    challengeId: string;
    progress: number;
    completed: boolean;
  }[];
};

export type LeaderboardEntry = {
  userId: string;
  userName: string;
  avatar?: string;
  points: number;
  levelName: string;
  rank: number;
};
