/**
 * =====================================================================
 * USE ORDER CART - Gestion du panier de commandes
 * =====================================================================
 * 
 * Store persisté Zustand pour gérer le panier d'un client
 * - Persiste dans localStorage
 * - Supporte plusieurs restaurants (vide le panier lors de changement)
 * - Gestion du numéro de table pour commandes dine-in
 * 
 * @author Restafy Team
 * @date 2025-05-05
 * =====================================================================
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Article dans le panier */
export interface CartItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  variantId?: string;
  notes?: string;
}

/** Store du panier */
interface CartStore {
  restaurantId: string | null;
  restaurantName: string | null;
  tableNumber: string | null;
  items: CartItem[];
  deliveryFee: number;
  discount: number;

  setRestaurant: (params: { restaurantId: string; restaurantName: string }) => void;
  setTableNumber: (tableNumber: string | null) => void;
  addItem: (item: CartItem) => void;
  removeItem: (itemId: string) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  updateItemNote: (itemId: string, note: string) => void;
  clear: () => void;
  setDeliveryFee: (fee: number) => void;
  setDiscount: (discount: number) => void;

  subtotal: () => number;
  total: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      restaurantId: null,
      restaurantName: null,
      tableNumber: null,
      items: [],
      deliveryFee: 0,
      discount: 0,

      setRestaurant: ({ restaurantId, restaurantName }) => {
        const current = get().restaurantId;
        if (current && current !== restaurantId) {
          // Changement de restaurant → vider le panier
          set({ restaurantId, restaurantName, tableNumber: null, items: [], deliveryFee: 0, discount: 0 });
        } else {
          set({ restaurantId, restaurantName });
        }
      },

      setTableNumber: (tableNumber) => set({ tableNumber }),

      addItem: (item: CartItem) => {
        const { items } = get();
        const existing = items.find(i => i.itemId === item.itemId && i.variantId === item.variantId);

        if (existing) {
          set({
            items: items.map(i =>
              i.itemId === item.itemId && i.variantId === item.variantId
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          });
        } else {
          set({ items: [...items, item] });
        }
      },

      removeItem: (itemId: string) => {
        set({ items: get().items.filter(i => i.itemId !== itemId) });
      },

      updateItemQuantity: (itemId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(itemId);
          return;
        }
        set({
          items: get().items.map(i =>
            i.itemId === itemId ? { ...i, quantity } : i
          ),
        });
      },

      updateItemNote: (itemId: string, note: string) => {
        set({
          items: get().items.map(i =>
            i.itemId === itemId ? { ...i, notes: note } : i
          ),
        });
      },

      clear: () => set({ restaurantId: null, restaurantName: null, items: [], deliveryFee: 0, discount: 0 }),

      setDeliveryFee: (fee: number) => set({ deliveryFee: fee }),
      setDiscount: (discount: number) => set({ discount }),

      subtotal: () => get().items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),

      total: () => {
        const subtotal = get().subtotal();
        return Math.max(0, subtotal + get().deliveryFee - get().discount);
      },
    }),
    {
      name: 'cart-store',
      version: 2,
    }
  )
);