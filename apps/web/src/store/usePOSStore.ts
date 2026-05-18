import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  MenuItem,
} from '@restafy/shared/types';

// Simple localStorage-based order storage for offline POS
const LOCAL_ORDERS_KEY = 'restafy-pos-orders';

// ===== INTERFACES =====
interface LocalPOSOrder extends Partial<Order> {
  id: string;
  items: OrderItem[];
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  createdAt: string;
  cashierId?: string;
  cashierName?: string;
  synced: boolean;
}

const getLocalOrders = (): LocalPOSOrder[] => {
  try {
    const stored = localStorage.getItem(LOCAL_ORDERS_KEY);
    return stored ? (JSON.parse(stored) as LocalPOSOrder[]) : [];
  } catch {
    return [];
  }
};

const saveLocalOrder = (order: LocalPOSOrder) => {
  const orders = getLocalOrders();
  orders.push(order);
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
};

const markOrderSynced = (orderId: string) => {
  const orders = getLocalOrders();
  const updated = orders.map(o => o.id === orderId ? { ...o, synced: true } : o);
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(updated));
};

interface POSSession {
  cashierId: string;
  cashierName: string;
  startTime: string;
  lastActive: string;
}

interface POSState {
  session: POSSession | null;
  currentOrder: Partial<Order>;
  cart: OrderItem[];
  selectedCategory: string | null;
  isOffline: boolean;
  
  // Actions
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  updateActivity: () => void;
  
  /** Seuls id / name / price sont utilisés pour le ticket. */
  addToCart: (item: Pick<MenuItem, 'id' | 'name' | 'price'>) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  updateItemNotes: (itemId: string, notes: string) => void;
  
  setOrderType: (type: OrderType) => void;
  setTableNumber: (table: string) => void;
  setCategory: (category: string | null) => void;
  
  clearOrder: () => void;
  completeOrder: (paymentMethod: PaymentMethod, amountReceived?: number) => Promise<string>;
  
  setOffline: (status: boolean) => void;
  syncOrders: () => Promise<void>;
}

// Mock cashiers for demo
const CASHIERS = [
  { id: '1', name: 'Moussa', pin: '1234' },
  { id: '2', name: 'Fatou', pin: '0000' },
  { id: '3', name: 'Koffi', pin: '8888' },
];

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      session: null,
      currentOrder: {
        type: 'dine-in',
        status: 'pending',
        paymentStatus: 'pending',
      },
      cart: [],
      selectedCategory: null,
      isOffline: !navigator.onLine,

      login: async (pin) => {
        const cashier = CASHIERS.find(c => c.pin === pin);
        if (cashier) {
          set({
            session: {
              cashierId: cashier.id,
              cashierName: cashier.name,
              startTime: new Date().toISOString(),
              lastActive: new Date().toISOString(),
            }
          });
          return true;
        }
        return false;
      },

      logout: () => set({ session: null, cart: [], currentOrder: { type: 'dine-in' } }),

      updateActivity: () => {
        const { session } = get();
        if (session) {
          set({ session: { ...session, lastActive: new Date().toISOString() } });
        }
      },

      addToCart: (item) => {
        set((state) => {
          const existing = state.cart.find((i) => i.id === item.id);
          if (existing) {
            return {
              cart: state.cart.map((i) =>
                i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
              ),
            };
          }
          return {
            cart: [
              ...state.cart,
              {
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: 1,
                notes: '',
              },
            ],
          };
        });
      },

      removeFromCart: (itemId) => {
        set((state) => ({
          cart: state.cart.filter(i => i.id !== itemId)
        }));
      },

      updateQuantity: (itemId, delta) => {
        set((state) => ({
          cart: state.cart.map(i => {
            if (i.id === itemId) {
              const newQty = Math.max(1, i.quantity + delta);
              return { ...i, quantity: newQty };
            }
            return i;
          })
        }));
      },

      updateItemNotes: (itemId, notes) => {
        set((state) => ({
          cart: state.cart.map(i => 
            i.id === itemId ? { ...i, notes } : i
          )
        }));
      },

      setOrderType: (type) => set((state) => ({ 
        currentOrder: { ...state.currentOrder, type } 
      })),

      setTableNumber: (tableNumber) => set((state) => ({ 
        currentOrder: { ...state.currentOrder, tableNumber } 
      })),

      setCategory: (selectedCategory) => set({ selectedCategory }),

      clearOrder: () => set({ 
        cart: [], 
        currentOrder: { type: 'dine-in', status: 'pending', paymentStatus: 'pending' } 
      }),

      completeOrder: async (paymentMethod, amountReceived) => {
        const { cart, currentOrder, session, isOffline } = get();
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        const orderId = `POS-${Date.now()}`;
        const newOrder: LocalPOSOrder = {
          ...currentOrder,
          id: orderId,
          items: cart,
          total,
          paymentMethod,
          paymentStatus: paymentMethod === 'cash' ? 'paid' : 'pending',
          status: 'pending',
          createdAt: new Date().toISOString(),
          cashierId: session?.cashierId,
          cashierName: session?.cashierName,
          synced: !isOffline,
        };

        // Save to localStorage for offline support
        saveLocalOrder(newOrder);

        // TODO: If online, also send to Supabase
        
        get().clearOrder();
        return orderId;
      },

      setOffline: (isOffline) => set({ isOffline }),

      syncOrders: async () => {
        const orders = getLocalOrders();
        const unsynced = orders.filter(o => !o.synced);
        if (unsynced.length > 0) {
          if (import.meta.env.DEV) console.log(`Syncing ${unsynced.length} orders...`);
          // TODO: Send to Supabase API
          for (const order of unsynced) {
            markOrderSynced(order.id);
          }
        }
      }
    }),
    {
      name: 'restafy-pos-storage',
      partialize: (state) => ({ session: state.session }),
    }
  )
);
