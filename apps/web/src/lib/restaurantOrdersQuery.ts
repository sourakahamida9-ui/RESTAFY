/**
 * Chargement commandes + lignes (2 requêtes) pour éviter la jointure imbriquée lente sous RLS.
 * Utilisé par le tableau de bord admin et la page Commandes restaurant.
 */
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

export type OrderItemLine = OrderItemRow & { item_name?: string | null; notes?: string | null };
export type OrderWithItems = Order & { order_items?: OrderItemLine[] };

export const ORDER_QUERY_TIMEOUT_MS = 45_000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Requête trop longue')), ms),
    ),
  ]);
}

const ORDER_ITEMS_COLUMNS = 'id,order_id,item_name,quantity,unit_price,subtotal,notes';

/**
 * Listes décroissantes : la 1ʳᵉ qui passe sur votre schéma Supabase est utilisée.
 * (Beaucoup de projets n’ont pas prep_time_min / driver_id sur orders — évite PGRST / 42703.)
 */
const ORDERS_SELECT_FALLBACKS: string[] = [
  'id,order_number,status,type,total_amount,delivery_address,notes,cancel_reason,customer_id,customer_name,customer_phone,customer_email,created_at,updated_at,restaurant_id,driver_id,prep_time_min,estimated_delivery',
  'id,order_number,status,type,total_amount,delivery_address,notes,cancel_reason,customer_id,customer_name,customer_phone,customer_email,created_at,updated_at,restaurant_id,driver_id,estimated_delivery',
  'id,order_number,status,type,total_amount,delivery_address,notes,cancel_reason,customer_id,customer_name,customer_phone,customer_email,created_at,updated_at,restaurant_id,estimated_delivery',
  'id,order_number,status,type,total_amount,delivery_address,notes,customer_id,customer_name,customer_phone,customer_email,created_at,updated_at,restaurant_id,cancel_reason,estimated_delivery',
  'id,order_number,status,type,total_amount,delivery_address,notes,customer_id,customer_name,customer_phone,customer_email,created_at,updated_at,restaurant_id,cancel_reason',
  'id,order_number,status,type,total_amount,delivery_address,notes,customer_id,customer_name,customer_phone,customer_email,created_at,updated_at,restaurant_id',
  // ✅ Fallback minimal si customer_phone/customer_name n'existent pas encore
  'id,order_number,status,type,total_amount,delivery_address,notes,customer_id,created_at,updated_at,restaurant_id',
];

function isUndefinedColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  if (e.code === '42703') return true;
  const m = (e.message || '').toLowerCase();
  return m.includes('does not exist') && m.includes('column');
}

/**
 * @param limit max 500 recommandé pour la page Commandes ; 100 pour le widget dashboard.
 */
export async function fetchRestaurantOrdersWithItems(
  restaurantId: string,
  limit: number,
): Promise<OrderWithItems[]> {
  const lim = Math.min(Math.max(1, limit), 500);
  let lastErr: unknown;
  let rows: OrderWithItems[] | null = null;

  for (const cols of ORDERS_SELECT_FALLBACKS) {
    const { data, error } = await withTimeout(
      supabase
        .from('orders')
        .select(cols)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(lim),
      ORDER_QUERY_TIMEOUT_MS,
    );
    if (!error) {
      rows = (data || []) as unknown as OrderWithItems[];
      break;
    }
    lastErr = error;
    if (!isUndefinedColumnError(error)) throw error;
    if (import.meta.env.DEV) {
      console.warn('[fetchRestaurantOrdersWithItems] colonnes absentes, repli :', cols, '→', error);
    }
  }

  if (rows === null) throw lastErr ?? new Error('Impossible de charger les commandes');

  let list: OrderWithItems[] = rows;
  const ids = list.map((o) => o.id).filter(Boolean);

  if (ids.length === 0) return list;

  const { data: itemsRows, error: errItems } = await withTimeout(
    supabase.from('order_items').select(ORDER_ITEMS_COLUMNS).in('order_id', ids),
    ORDER_QUERY_TIMEOUT_MS,
  );

  if (errItems) {
    if (import.meta.env.DEV) console.warn('[fetchRestaurantOrdersWithItems] order_items:', errItems.message);
    return list;
  }

  if (!itemsRows?.length) return list;

  const byOrder = new Map<string, OrderItemLine[]>();
  for (const it of itemsRows as OrderItemLine[]) {
    const oid = it.order_id;
    const arr = byOrder.get(oid) ?? [];
    arr.push(it);
    byOrder.set(oid, arr);
  }

  return list.map((o) => ({ ...o, order_items: byOrder.get(o.id) ?? [] }));
}
