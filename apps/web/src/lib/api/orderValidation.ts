/**
 * Validation et calcul des totaux de commande côté serveur
 * Déplace la logique métier critique du client vers le serveur
 */

import { createServiceRoleClient, getSupabaseUrlForServer, getServiceRoleKeyForServer } from './supabaseAuthAdmin';

export interface OrderItemInput {
  itemId: string;
  quantity: number;
  variantId?: string;
}

export interface OrderValidationInput {
  restaurantId: string;
  customerId: string;
  items: OrderItemInput[];
  orderType: 'delivery' | 'dine_in' | 'takeaway' | 'pickup' | 'sur_place';
  deliveryAddress?: string;
}

export interface OrderValidationResult {
  valid: boolean;
  error?: string;
  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
  totalAmount?: number;
  items?: Array<{
    itemId: string;
    itemName: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    variantId?: string;
  }>;
}

/**
 * Valide une commande et calcule les totaux côté serveur
 * Empêche la manipulation des prix côté client
 */
export async function validateAndCalculateOrder(input: OrderValidationInput): Promise<OrderValidationResult> {
  const supabaseUrl = getSupabaseUrlForServer();
  const serviceKey = getServiceRoleKeyForServer();

  if (!supabaseUrl || !serviceKey) {
    return { valid: false, error: 'Configuration serveur manquante' };
  }

  const supabaseAdmin = createServiceRoleClient(supabaseUrl, serviceKey);

  try {
    // 1. Valider que le restaurant existe et est actif
    const { data: restaurant, error: restaurantError } = await supabaseAdmin
      .from('restaurants')
      .select('id, name, delivery_fee, min_order, is_active, is_open')
      .eq('id', input.restaurantId)
      .single();

    if (restaurantError || !restaurant) {
      return { valid: false, error: 'Restaurant introuvable' };
    }

    if (!restaurant.is_active) {
      return { valid: false, error: 'Ce restaurant n\'est pas actif' };
    }

    // 2. Récupérer les items avec leurs prix actuels (éviter manipulation client)
    const itemIds = input.items.map(i => i.itemId);
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('items')
      .select('id, name, price, is_available, category_id')
      .in('id', itemIds)
      .eq('restaurant_id', input.restaurantId);

    if (itemsError) {
      return { valid: false, error: 'Erreur lors de la récupération des articles' };
    }

    if (!items || items.length === 0) {
      return { valid: false, error: 'Aucun article trouvé' };
    }

    // 3. Valider que tous les items sont disponibles
    const unavailableItems = items.filter(i => !i.is_available);
    if (unavailableItems.length > 0) {
      return { valid: false, error: 'Certains articles ne sont pas disponibles' };
    }

    // 4. Calculer le subtotal avec les prix serveur (éviter manipulation client)
    const itemMap = new Map(items.map(i => [i.id, i]));
    const validatedItems: OrderValidationResult['items'] = [];

    let subtotal = 0;
    for (const inputItem of input.items) {
      const item = itemMap.get(inputItem.itemId) as any;
      if (!item) {
        return { valid: false, error: `Article ${inputItem.itemId} introuvable` };
      }

      const itemSubtotal = Number(item.price) * inputItem.quantity;
      subtotal += itemSubtotal;

      validatedItems.push({
        itemId: item.id,
        itemName: item.name,
        unitPrice: Number(item.price),
        quantity: inputItem.quantity,
        subtotal: itemSubtotal,
        variantId: inputItem.variantId,
      });
    }

    // 5. Calculer les frais de livraison selon le type de commande
    let deliveryFee = 0;
    if (input.orderType === 'delivery') {
      deliveryFee = Number(restaurant.delivery_fee) || 0;
    }

    // 6. Valider le minimum de commande
    if (restaurant.min_order && subtotal < Number(restaurant.min_order)) {
      return { 
        valid: false, 
        error: `Le minimum de commande est de ${Number(restaurant.min_order)} FCFA` 
      };
    }

    // 7. Calculer le total (discount = 0 pour l'instant, peut être étendu)
    const discount = 0;
    const totalAmount = subtotal + deliveryFee - discount;

    return {
      valid: true,
      subtotal,
      deliveryFee,
      discount,
      totalAmount,
      items: validatedItems,
    };
  } catch (error) {
    console.error('[Order Validation]', error);
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Erreur lors de la validation' 
    };
  }
}
