// ============================================================================
// CACHE MULTI-COUCHES - Optimisation Restafy
// React.cache() + In-memory cache + SWR patterns
// ============================================================================

import { supabase, isSupabaseConfigured } from './supabase';

// Configuration cache
const CACHE_DURATIONS = {
  restaurants: 5 * 60 * 1000,      // 5 minutes
  menu: 2 * 60 * 1000,             // 2 minutes
  events: 5 * 60 * 1000,           // 5 minutes
  userDashboard: 30 * 1000,        // 30 secondes
  analytics: 60 * 1000,            // 1 minute
} as const;

// In-memory cache store
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cacheStore = new Map<string, CacheEntry<unknown>>();

// Generic cache wrapper
export function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  const cached = cacheStore.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (cached && now - cached.timestamp < cached.ttl) {
    return Promise.resolve(cached.data);
  }

  return fetcher().then((data) => {
    cacheStore.set(key, { data, timestamp: now, ttl });
    return data;
  });
}

// Invalidate cache by key prefix
export function invalidateCache(prefix: string): void {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}

// Clear all cache
export function clearCache(): void {
  cacheStore.clear();
}

// ============================================================================
// CACHED RPC CALLS - Utilise les fonctions Supabase optimisées
// ============================================================================

// Restaurants avec événements (utilise RPC)
export async function getRestosWithEvents(limit = 20) {
  if (!isSupabaseConfigured) return [];

  return withCache(
    `restos_events_${limit}`,
    async () => {
      const { data, error } = await supabase.rpc('get_restos_with_events', { p_limit: limit });
      if (error) {
        console.warn('[Cache] RPC fallback:', error.message);
        // Fallback to regular query
        const { data: fallback } = await supabase
          .from('restaurants')
          .select('id,name,slug,logo_url,cuisine_type,avg_rating,delivery_time_min,delivery_time_max,delivery_fee,is_active')
          .eq('is_active', true)
          .order('avg_rating', { ascending: false })
          .limit(limit);
        return fallback || [];
      }
      return data || [];
    },
    CACHE_DURATIONS.restaurants
  );
}

// Menu complet restaurant (utilise RPC)
export async function getRestaurantMenuFull(restaurantId: string) {
  if (!isSupabaseConfigured || !restaurantId) return null;

  return withCache(
    `menu_full_${restaurantId}`,
    async () => {
      const { data, error } = await supabase.rpc('get_restaurant_menu_full', {
        p_restaurant_id: restaurantId,
      });
      if (error) {
        console.warn('[Cache] Menu RPC fallback:', error.message);
        return null;
      }
      return data;
    },
    CACHE_DURATIONS.menu
  );
}

// Dashboard utilisateur (utilise RPC)
export async function getUserDashboard(userId: string) {
  if (!isSupabaseConfigured || !userId) return null;

  return withCache(
    `user_dashboard_${userId}`,
    async () => {
      const { data, error } = await supabase.rpc('get_user_dashboard', {
        p_user_id: userId,
      });
      if (error) {
        console.warn('[Cache] Dashboard RPC error:', error.message);
        return null;
      }
      return data;
    },
    CACHE_DURATIONS.userDashboard
  );
}

// Analytics restaurant (utilise RPC)
export async function getRestaurantAnalytics(restaurantId: string, days = 30) {
  if (!isSupabaseConfigured || !restaurantId) return null;

  return withCache(
    `analytics_${restaurantId}_${days}`,
    async () => {
      const { data, error } = await supabase.rpc('get_restaurant_analytics', {
        p_restaurant_id: restaurantId,
        p_days: days,
      });
      if (error) {
        console.warn('[Cache] Analytics RPC error:', error.message);
        return null;
      }
      return data;
    },
    CACHE_DURATIONS.analytics
  );
}

// Stats globales (utilise RPC)
export async function getOrderStats() {
  if (!isSupabaseConfigured) return null;

  return withCache(
    'order_stats_global',
    async () => {
      const { data, error } = await supabase.rpc('get_order_stats');
      if (error) {
        console.warn('[Cache] Stats RPC error:', error.message);
        return null;
      }
      return data?.[0] || null;
    },
    CACHE_DURATIONS.analytics
  );
}

// ============================================================================
// MATERIALIZED VIEWS ACCESS
// ============================================================================

export async function getEventsSummary(restaurantId?: string) {
  if (!isSupabaseConfigured) return [];

  const cacheKey = restaurantId ? `events_summary_${restaurantId}` : 'events_summary_all';

  return withCache(
    cacheKey,
    async () => {
      let query = supabase.from('events_summary').select('*');
      if (restaurantId) {
        query = query.eq('restaurant_id', restaurantId);
      }
      const { data, error } = await query.order('start_time', { ascending: true });
      if (error) {
        console.warn('[Cache] Events summary error:', error.message);
        return [];
      }
      return data || [];
    },
    CACHE_DURATIONS.events
  );
}

export async function getRestaurantStats(restaurantId: string) {
  if (!isSupabaseConfigured || !restaurantId) return null;

  return withCache(
    `restaurant_stats_${restaurantId}`,
    async () => {
      const { data, error } = await supabase
        .from('restaurant_stats')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .single();
      if (error) {
        console.warn('[Cache] Restaurant stats error:', error.message);
        return null;
      }
      return data;
    },
    CACHE_DURATIONS.analytics
  );
}

export async function getLoyaltyLeaderboard(limit = 10) {
  if (!isSupabaseConfigured) return [];

  return withCache(
    `loyalty_leaderboard_${limit}`,
    async () => {
      const { data, error } = await supabase
        .from('loyalty_leaderboard')
        .select('*')
        .limit(limit);
      if (error) {
        console.warn('[Cache] Leaderboard error:', error.message);
        return [];
      }
      return data || [];
    },
    CACHE_DURATIONS.restaurants
  );
}

// ============================================================================
// SWR-LIKE HOOK FOR REACT
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseCachedDataOptions {
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  refreshInterval?: number;
}

export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  options: UseCachedDataOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  const {
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    refreshInterval = 0,
  } = options;

  const fetchData = useCallback(async () => {
    try {
      const result = await withCache(key, fetcher, ttl);
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Fetch failed'));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [key, fetcher, ttl]);

  const mutate = useCallback((newData?: T) => {
    if (newData !== undefined) {
      setData(newData);
      cacheStore.set(key, { data: newData, timestamp: Date.now(), ttl });
    } else {
      invalidateCache(key);
      fetchData();
    }
  }, [key, ttl, fetchData]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    // Revalidate on focus
    const handleFocus = () => {
      if (revalidateOnFocus) {
        invalidateCache(key);
        fetchData();
      }
    };

    // Revalidate on reconnect
    const handleOnline = () => {
      if (revalidateOnReconnect) {
        invalidateCache(key);
        fetchData();
      }
    };

    if (revalidateOnFocus) {
      window.addEventListener('focus', handleFocus);
    }
    if (revalidateOnReconnect) {
      window.addEventListener('online', handleOnline);
    }

    // Refresh interval
    let intervalId: NodeJS.Timeout | undefined;
    if (refreshInterval > 0) {
      intervalId = setInterval(() => {
        invalidateCache(key);
        fetchData();
      }, refreshInterval);
    }

    return () => {
      mountedRef.current = false;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      if (intervalId) clearInterval(intervalId);
    };
  }, [key, fetchData, revalidateOnFocus, revalidateOnReconnect, refreshInterval]);

  return { data, error, isLoading, mutate };
}
