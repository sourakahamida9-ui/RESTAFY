import { supabase } from '@/lib/supabase';

export type PickedDriver = { id: string; name: string };

/**
 * Choisit un livreur pour assignation automatique (premier disponible, ordre alphabétique).
 * Utilise la table `delivery_drivers` (même source que la page Commandes).
 */
export async function pickAvailableDeliveryDriver(restaurantId: string): Promise<PickedDriver | null> {
  const { data, error } = await supabase
    .from('delivery_drivers')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .eq('is_available', true)
    .order('name', { ascending: true })
    .limit(1);

  if (error) {
    if (import.meta.env.DEV) console.warn('[Restafy] pickAvailableDeliveryDriver:', error.message);
    return null;
  }
  return data?.[0] ?? null;
}
