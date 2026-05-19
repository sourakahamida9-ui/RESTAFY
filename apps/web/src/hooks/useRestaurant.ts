// src/hooks/useRestaurant.ts
// ✅ BUG CORRIGÉ #1 — PostgrestError n'est PAS instanceof Error
// ✅ BUG CORRIGÉ #2 — Aucune fonction retry → ajout d'un refetch() manuel
// ✅ BUG CORRIGÉ #3 — CAUSE RACINE "page blanche" pour les clients connectés :
//    useAuth() n'est PAS un Context/singleton. Appeler useAuth() à l'intérieur
//    de useRestaurants() et useRestaurantMenu() créait des instances PARASITES
//    avec leur propre loading:true → race condition → page bloquée.
//    FIX : écouter supabase.auth directement (source unique, pas d'instance parasite).

import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];
type Item = Database['public']['Tables']['items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

// ── Helper universel extraction erreur ────────────────────────────────────────
function extractMsg(_err: unknown): string {
  return 'Impossible de charger les données. Veuillez réessayer.';
}

// ── Hook utilitaire : userId courant via supabase.auth (PAS useAuth) ──────────
// Écouter supabase.auth directement évite de créer une instance parasite de
// useAuth() qui aurait son propre loading:true et ses propres subscriptions.
function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Session initiale (synchrone depuis le cache Supabase JS)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setUserId(session?.user?.id ?? null);
    });

    // Écouter les changements (connexion / déconnexion)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => {
        if (mounted) setUserId(session?.user?.id ?? null);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return userId;
}

// ── Cache global pour les restaurants ────────────────────────────────────────
let restaurantCache: {
  data: Restaurant[] | null;
  timestamp: number;
  userId: string | null;
} = { data: null, timestamp: 0, userId: null };

const RESTAURANT_CACHE_DURATION = 15 * 1000; // 15 seconds — shorter to reflect admin changes faster

/** Invalidate the restaurant cache so the next fetch gets fresh data from DB. */
export function invalidateRestaurantCache(): void {
  restaurantCache = { data: null, timestamp: 0, userId: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// useRestaurants
// ─────────────────────────────────────────────────────────────────────────────
interface UseRestaurantsReturn {
  restaurants: Restaurant[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useRestaurants(): UseRestaurantsReturn {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ✅ FIX #3 — source unique, pas d'instance parasite de useAuth
  const userId = useCurrentUserId();

  const fetchRestaurants = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setError(new Error('Supabase non configuré — vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY'));
      return;
    }

    // Invalider le cache si l'utilisateur a changé
    const now = Date.now();
    const cacheStale = restaurantCache.userId !== userId;
    if (cacheStale) {
      restaurantCache = { data: null, timestamp: 0, userId };
    }

    // Retourner le cache si encore valide
    if (restaurantCache.data && now - restaurantCache.timestamp < RESTAURANT_CACHE_DURATION) {
      setRestaurants(restaurantCache.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: pgErr } = await supabase
        .from('restaurants')
        .select('id,name,slug,logo_url,banner_url,cuisine_type,description,phone,website,avg_rating,delivery_time_min,delivery_time_max,delivery_fee,min_order,is_active,total_reviews,address,city,is_open,opening_hours')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (pgErr) {
        const msg = extractMsg(pgErr);
        throw new Error(msg);
      }

      const list = (data || []) as unknown as Restaurant[];
      restaurantCache = { data: list, timestamp: Date.now(), userId };
      setRestaurants(list);
    } catch (err) {
      const msg = extractMsg(err);
      setError(new Error(msg));
    } finally {
      setLoading(false);
    }
  }, [userId]); // ✅ se ré-exécute uniquement quand userId change

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  return { restaurants, loading, error, refetch: fetchRestaurants };
}

// ─────────────────────────────────────────────────────────────────────────────
// useRestaurantMenu
// ─────────────────────────────────────────────────────────────────────────────
interface UseRestaurantMenuReturn {
  categories: Category[];
  items: Item[];
  loading: boolean;
  error: Error | null;
}

export function useRestaurantMenu(restaurantId: string): UseRestaurantMenuReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ✅ FIX #3 — source unique, pas d'instance parasite de useAuth
  const userId = useCurrentUserId();

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchMenu = async () => {
      if (mounted) {
        setLoading(true);
        setError(null);
      }
      try {
        const [categoriesData, itemsData] = await Promise.all([
          supabase
            .from('categories')
            .select('id,restaurant_id,name,description,sort_order')
            .eq('restaurant_id', restaurantId)
            .order('sort_order'),
          supabase
            .from('items')
            .select('id,restaurant_id,category_id,name,description,price,image_url,is_available')
            .eq('restaurant_id', restaurantId)
            .eq('is_available', true)
            .order('created_at'),
        ]);

        if (categoriesData.error) throw new Error(extractMsg(categoriesData.error));
        if (itemsData.error) throw new Error(extractMsg(itemsData.error));

        if (mounted) {
          setCategories((categoriesData.data || []) as Category[]);
          setItems((itemsData.data || []) as Item[]);
        }
      } catch (err) {
        const msg = extractMsg(err);
        if (mounted) setError(new Error(msg));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchMenu();
    return () => { mounted = false; };
    // ✅ FIX perf — userId RETIRÉ des deps : le menu est public, pas besoin d'attendre l'auth
    // Avant: double-fetch (null→userId) sur chaque page publique
  }, [restaurantId]);

  return { categories, items, loading, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// useUserOrders
// ─────────────────────────────────────────────────────────────────────────────
interface UseOrderReturn {
  orders: (Database['public']['Tables']['orders']['Row'] & {
    items: Database['public']['Tables']['order_items']['Row'][];
  })[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useUserOrders(userId: string | null | undefined): UseOrderReturn {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: pgErr } = await supabase
        .from('orders')
        .select('*, items:order_items (*)')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });

      if (pgErr) throw new Error(extractMsg(pgErr));
      setOrders(data || []);
    } catch (err) {
      const msg = extractMsg(err);
      setError(new Error(msg));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}
