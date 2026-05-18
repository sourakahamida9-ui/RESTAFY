import { create } from 'zustand';

export interface OrderItem {
  id: string;
  restaurantId: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  restaurantId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'confirmed' | 'failed';
  paymentMethod: 'ussd' | 'cash' | 'card';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderStoreState {
  orders: Order[];
  currentOrder: Order | null;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  setCurrentOrder: (order: Order | null) => void;
  getOrdersByStatus: (status: Order['status']) => Order[];
}

export const useOrderStore = create<OrderStoreState>((set, get) => ({
  orders: [],
  currentOrder: null,
  addOrder: (order) =>
    set((state) => ({
      orders: [order, ...state.orders],
    })),
  updateOrder: (id, updates) =>
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === id ? { ...o, ...updates, updatedAt: new Date() } : o
      ),
    })),
  setCurrentOrder: (order) => set({ currentOrder: order }),
  getOrdersByStatus: (status) => get().orders.filter((o) => o.status === status),
}));
