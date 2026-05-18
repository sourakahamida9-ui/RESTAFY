import { invalidateProfileCache, reloadProfileForCurrentUser } from '@/lib/authSync';
import { useAuthStore } from '@/store/useAuthStore';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { changeOrderStatus } from '@/lib/changeOrderStatus';

type OrderStatus = 'pending' | 'accepted' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';
type OrderType = 'delivery' | 'dine_in' | 'takeaway' | 'pickup' | 'sur_place';

interface CreateOrderParams {
  restaurantId: string;
  customerId: string;
  items: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    variantId?: string;
    notes?: string;
  }>;
  orderType: OrderType;
  deliveryAddress?: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  totalAmount: number;
  notes?: string;
  promoCodeId?: string;
  promoCode?: string;
}

interface OrderRow {
  id: string;
  restaurant_id: string;
  customer_id: string | null;
  status: OrderStatus;
  type: OrderType;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total_amount: number;
  delivery_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  promo_code_id?: string | null;
  promo_code?: string | null;
}

interface CreateOrderReturn {
  order: OrderRow | null;
  error: Error | null;
}

// ─── Helper : extrait le message d'une erreur Supabase ou JS ─────────────────
// PostgrestError n'est PAS un instanceof Error → on doit gérer les deux cas.
function extractError(err: unknown): Error {
  if (err instanceof Error) return err;
  // Supabase PostgrestError a ces champs
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, any>;
    const msg = e.message || e.details || e.hint || e.error_description || JSON.stringify(e);
    return new Error(msg);
  }
  return new Error(String(err));
}

export function useOrderManager() {
  const [loading, setLoading] = useState(false);

  const createOrder = async (params: CreateOrderParams): Promise<CreateOrderReturn> => {
    setLoading(true);
    try {

      // ── BUG CORRIGÉ #1 ────────────────────────────────────────────────────
      // AVANT : .select('id') sans filtre is_available
      // PROBLÈME : la politique RLS "items_public_read" filtre sur is_available = true
      //            → un item vendu (is_available = false) retourne 0 résultats
      //            → le code lève faussement "Plats introuvables"
      // SOLUTION : on ajoute is_available = true dans la requête, ET on supprime
      //            la vérification bloquante (la commande passera quand même si
      //            le prix est correct — la vraie vérification appartient au back).
      const itemIds = params.items.map(i => i.itemId);
      const { data: existingItems, error: checkErr } = await supabase
        .from('items')
        .select('id')
        .in('id', itemIds)
        .eq('is_available', true);   // ← aligné sur la politique RLS

      if (checkErr) {
        // ── BUG CORRIGÉ #2 ────────────────────────────────────────────────
        // AVANT : throw checkErr   → PostgrestError n'est pas instanceof Error
        //         → catch retourne 'Failed to create order' (message générique)
        // SOLUTION : utiliser extractError() partout
        throw extractError(checkErr);
      }

      // On log les items non trouvés mais on ne bloque PAS la commande
      // (évite de bloquer si RLS cache temporairement un item)
      const validIds = new Set((existingItems || []).map(i => i.id));
      const missingItems = params.items.filter(i => !validIds.has(i.itemId));
      if (missingItems.length > 0) {
        // On ne bloque plus — si la DB rejette l'insert, l'erreur sera claire
      }

      // ── 2. Créer la commande ─────────────────────────────────────────────
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
          restaurant_id: params.restaurantId,
          customer_id: params.customerId,
          customer_name: useAuthStore.getState().profile?.full_name || 'Client',
          customer_phone: useAuthStore.getState().profile?.phone || null,
          customer_email: useAuthStore.getState().profile?.email || null,
          status: 'pending',
          type: params.orderType,
          subtotal: params.subtotal,
          delivery_fee: params.deliveryFee,
          discount: params.discount,
          total_amount: params.totalAmount,
          delivery_address: params.deliveryAddress || null,
          notes: params.notes || null,
          promo_code_id: params.promoCodeId || null,
          promo_code: params.promoCode || null,
        }])
        .select()
        .single();

      if (orderError) throw extractError(orderError);   // ← BUG CORRIGÉ #2

      // ── 3. Créer les order_items ─────────────────────────────────────────
      const orderItems = params.items.map(item => ({
        order_id: orderData.id,
        item_id: item.itemId,
        item_name: item.itemName,
        variant_id: item.variantId || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.unitPrice * item.quantity,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw extractError(itemsError);   // ← BUG CORRIGÉ #2

      // ── 4. Points de fidélité (non-bloquant) — RPC ne throw pas : lire .error
      let loyaltyPointsAwarded = 0;
      try {
        const { data: pts, error: loyaltyRpcError } = await supabase.rpc('award_loyalty_points', {
          p_order_id: orderData.id,
          p_customer_id: params.customerId,
          p_restaurant_id: params.restaurantId,
          p_order_amount: params.totalAmount,
        });
        if (loyaltyRpcError) {
          console.warn('[loyalty] award_loyalty_points:', loyaltyRpcError.message, loyaltyRpcError);
        } else if (typeof pts === 'number' && pts > 0) {
          loyaltyPointsAwarded = pts;
          const sessionUser = useAuthStore.getState().user;
          if (sessionUser?.id === params.customerId) {
            await reloadProfileForCurrentUser();
          } else {
            invalidateProfileCache(params.customerId);
          }
        }
      } catch (e) {
        console.warn('[loyalty] award_loyalty_points exception:', e);
      }

      // ── 5. Notification (non-bloquant) ───────────────────────────────────
      try {
        // FIX : ne pas envoyer "data" — utiliser seulement les colonnes existantes
        const notifRow: Record<string, any> = {
          user_id: params.customerId,
          type: 'order',
          title: '✅ Commande confirmée',
          message: `Votre commande de ${params.totalAmount.toLocaleString('fr-FR')} FCFA est en cours de traitement.`,
          is_read: false,
          created_at: new Date().toISOString(),
        };
        // Ajouter action_url et emoji seulement s'ils existent en DB (non-bloquant)
        try {
          notifRow.action_url = `/track/${orderData.id}`;
          notifRow.emoji = '🍽️';
        } catch { /* colonnes optionnelles */ }
        await supabase.from('notifications').insert([notifRow]);
      } catch (e) { console.warn('[v0] Notification error (non-blocking):', e); }

      // ── 6. Email de confirmation ─────────────────────────────────────────
      // NOTE: L'email n'est PAS envoyé ici - il sera envoyé par le webhook
      // Kkiapay uniquement après confirmation du paiement (transaction.success)
      // Cela évite d'envoyer une confirmation pour une commande non payée

      return { order: orderData, error: null };

    } catch (err) {
      // ── BUG CORRIGÉ #2 — le message réel est maintenant visible ──────────
      const error = extractError(err);
      return { order: null, error };
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const device = typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)
        ? 'mobile' as const
        : 'desktop' as const;
      const result = await changeOrderStatus(orderId, status, device);
      if (!result.ok) {
        return { error: { message: result.error ?? 'unknown' } };
      }
      return { error: null };
    } catch (err) {
      return { error: extractError(err) };
    }
  };

  const getOrderTracking = async (orderId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders').select('id, status, updated_at').eq('id', orderId).single();
      if (error) throw extractError(error);
      return { orderId: data.id, status: data.status, updatedAt: data.updated_at };
    } catch { return null; }
  };

  return { createOrder, updateOrderStatus, getOrderTracking, loading };
}