import { createClient } from '@supabase/supabase-js';

function pickEnv(...keys: (keyof ImportMetaEnv)[]): string {
  for (const key of keys) {
    const v = import.meta.env[key];
    if (typeof v !== 'string') continue;
    const t = v.trim().replace(/^['"]|['"]$/g, '');
    if (t) return t;
  }
  return '';
}

const rawUrl = pickEnv('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
const rawKey = pickEnv('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');

function isPlaceholderUrl(u: string): boolean {
  if (!u) return true;
  const x = u.toLowerCase();
  return (
    x.includes('your-project') ||
    x.includes('placeholder') ||
    x.includes('example.supabase') ||
    !/^https:\/\/.+\..+/.test(u)
  );
}

function isPlaceholderKey(k: string): boolean {
  if (!k || k.length < 30) return true;
  const x = k.toLowerCase();
  return x.includes('your-anon-key') || x.includes('changeme') || x === 'placeholder-key';
}

const supabaseUrl = !isPlaceholderUrl(rawUrl) ? rawUrl : '';
const supabaseKey = !isPlaceholderKey(rawKey) ? rawKey : '';

if (import.meta.env.DEV) {
  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      '[Restafy] Supabase non prêt : vérifie .env à la racine du projet, préfixe VITE_, pas d’espace autour du =, redémarre npm run dev.',
      { urlPrésente: Boolean(rawUrl), cléPrésente: Boolean(rawKey), urlRefusée: rawUrl && !supabaseUrl, cléRefusée: rawKey && !supabaseKey },
    );
  } else {
    try {
      console.info('[Restafy] Supabase →', new URL(supabaseUrl).hostname, `(anon key ${supabaseKey.length} car.)`);
    } catch {
      console.warn('[Restafy] VITE_SUPABASE_URL invalide (pas une URL https valide).');
    }
  }
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/**
 * Même URL / clé anon que le client Supabase (VITE_* ou NEXT_PUBLIC_* après filtrage).
 * À utiliser pour appeler les Edge Functions depuis le navigateur.
 */
export function getSupabaseEdgeFetchConfig(): { url: string; anonKey: string } | null {
  if (!supabaseUrl || !supabaseKey) return null;
  return { url: supabaseUrl.replace(/\/$/, ''), anonKey: supabaseKey };
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

// Type-safe database types
export type Database = {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          address: string | null;
          city: string;
          phone: string | null;
          logo_url: string | null;
          banner_url: string | null;
          is_active: boolean;
          is_open: boolean;
          cuisine_type: string | null;
          avg_rating: number;
          total_reviews: number;
          delivery_time_min: number;
          delivery_time_max: number;
          delivery_fee: number;
          min_order: number;
          ussd_mtn: string | null;
          ussd_moov: string | null;
          ussd_celtiis: string | null;
          lat: number | null;
          lng: number | null;
          settings: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          role: 'super_admin' | 'restaurant_owner' | 'manager' | 'staff' | 'livreur' | 'client';
          restaurant_id: string | null;
          avatar_url: string | null;
          city: string;
          address: string | null;
          is_active: boolean;
          preferred_cuisines: string[] | null;
          avg_order_value: number;
          total_orders: number;
          email?: string;
          loyalty_level?: string;
          loyalty_points?: number;
          has_completed_onboarding?: boolean;
          referral_code?: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      restaurant_staff: {
        Row: {
          id: string;
          profile_id: string | null;
          restaurant_id: string;
          role: string;
          is_active: boolean;
          shift_start: string | null;
          shift_end: string | null;
          full_name?: string | null;
          phone?: string | null;
          access_token?: string | null;
          pin_hash?: string | null;
          created_at: string;
        };
      };
      ticket_purchases: {
        Row: {
          id: string;
          event_id: string;
          ticket_id: string;
          customer_id: string | null;
          customer_name: string;
          customer_email: string | null;
          customer_phone: string | null;
          amount_paid: number;
          is_used: boolean;
          qr_code_data: string | null;
          qr_scanned_at: string | null;
          // Ajoutés par script 013
          status: 'pending' | 'confirmed' | 'cancelled';
          ticket_number: string | null;       // généré par trigger DB
          confirmed_at: string | null;
          confirmation_sent: boolean;
          payment_id: string | null;
          created_at: string;
        };
      };
      orders: {
        Row: {
          id: string;
          restaurant_id: string;
          customer_id: string | null;
          order_number?: string | null;
          status: 'pending' | 'accepted' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';
          type: 'delivery' | 'dine_in' | 'takeaway' | 'pickup' | 'sur_place';
          subtotal: number;
          delivery_fee: number;
          discount: number;
          total_amount: number;
          delivery_address: string | null;
          delivery_lat_lng?: any;
          notes: string | null;
          cancel_reason?: string | null;
          driver_id?: string | null;
          prep_time_min?: number | null;
          estimated_delivery?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_email?: string | null;
          table_number?: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      items: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          description: string | null;
          price: string | number;
          category_id: string;
          is_available: boolean;
          image_url?: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      categories: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          description?: string | null;
          sort_order: number;          // AJOUTÉ
          created_at: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          item_id: string;             // CORRIGÉ (c'est item_id pas item_name)
          item_name?: string | null;   // alias / vues ou select renommé
          variant_id?: string | null;
          quantity: number;
          unit_price: number;
          subtotal: number;
          created_at: string;
        };
      };
      loyalty_transactions: {
        Row: {
          id: string;
          customer_id: string;
          restaurant_id?: string;
          type: string;
          points: number;
          reason: string;
          created_at: string;
        };
      };
      events: {
        Row: {
          id: string;
          restaurant_id: string;
          title: string;
          description: string | null;
          start_time: string;
          end_time: string | null;
          location: string | null;
          image_url: string | null;
          is_published: boolean;
          total_capacity: number | null;
          created_at: string;
          updated_at: string;
        };
      };
      // event_tickets = les TYPES de billets (VIP, Standard, etc.) définis par le restaurant
      event_tickets: {
        Row: {
          id: string;
          event_id: string;
          name: string;              // ex: "VIP", "Standard", "Early Bird"
          price: number;
          quantity_available: number;
          quantity_sold: number;
          created_at: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'order' | 'payment' | 'loyalty' | 'event' | 'team' | 'promo' | 'system';
          title: string;
          message: string;
          emoji: string | null;
          action_url: string | null;
          is_read: boolean;
          read_at: string | null;
          created_at: string;
        };
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          restaurant_id: string;         // AJOUTÉ
          method: string;
          status: string;
          amount: number;
          transaction_ref?: string | null;
          provider_response?: any;
          created_at: string;
        };
      };
    };
  };
};