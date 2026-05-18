import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

/** Ligne menu normalisée pour le POS (alignée sur la table `items` + nom de catégorie). */
export interface RestaurantMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string;
  /** Libellé affiché (join `categories` ou repli). */
  category: string;
  is_available: boolean;
  image_url: string | null;
}

function parsePrice(v: string | number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

interface RestaurantState {
  menuItems: RestaurantMenuItem[];
  loading: boolean;
  error: string | null;
  fetchMenuForRestaurant: (restaurantId: string) => Promise<void>;
  updateItemAvailability: (itemId: string, available: boolean) => Promise<void>;
}

export const useRestaurantStore = create<RestaurantState>((set) => ({
  menuItems: [],
  loading: false,
  error: null,

  fetchMenuForRestaurant: async (restaurantId: string) => {
    set({ loading: true, error: null });
    try {
      const [{ data: catRows, error: catErr }, { data, error: err }] = await Promise.all([
        supabase.from('categories').select('id,name').eq('restaurant_id', restaurantId),
        supabase
          .from('items')
          .select('id,name,description,price,category_id,is_available,image_url')
          .eq('restaurant_id', restaurantId)
          .order('created_at'),
      ]);

      if (catErr) throw catErr;
      if (err) throw err;

      const catNames = new Map((catRows ?? []).map((c) => [c.id, c.name?.trim() || 'Plats']));

      type Row = {
        id: string;
        name: string;
        description: string | null;
        price: string | number;
        category_id: string;
        is_available: boolean;
        image_url: string | null;
      };

      const rows = (data ?? []) as Row[];
      const menuItems: RestaurantMenuItem[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        price: parsePrice(row.price),
        category_id: row.category_id,
        category: catNames.get(row.category_id) ?? 'Plats',
        is_available: row.is_available !== false,
        image_url: row.image_url,
      }));

      set({ menuItems, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Impossible de charger le menu',
        loading: false,
      });
    }
  },

  updateItemAvailability: async (itemId: string, available: boolean) => {
    try {
      const { error: err } = await supabase
        .from('items')
        .update({ is_available: available })
        .eq('id', itemId);

      if (err) throw err;
      set((state) => ({
        menuItems: state.menuItems.map((item) =>
          item.id === itemId ? { ...item, is_available: available } : item,
        ),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update item' });
    }
  },
}));
