export type OrderStatus = 'new' | 'preparing' | 'ready' | 'delivered' | 'pending';
export type OrderType = 'dine-in' | 'takeaway' | 'delivery';
export type PaymentMethod = 'ussd' | 'cash' | 'card' | 'ussd-mtn' | 'ussd-moov' | 'ussd-celtiis';
export type PaymentStatus = 'pending' | 'confirmed' | 'paid';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface Order {
  id?: string;
  orderNumber?: string;
  customerName?: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  type: OrderType;
  tableNumber?: string;
  createdAt: string | Date;
  timeElapsed?: number;
  cashierId?: string;
  cashierName?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  available: boolean;
  rating?: number;
  reviews?: number;
  prepTime?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: 'Manager' | 'Cuisinier' | 'Serveur' | 'Livreur' | 'Caissier';
  status: 'Actif' | 'En Pause' | 'Absent';
  shift: string;
  avatar: string;
}
