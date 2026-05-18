// Ce fichier ré-exporte uniquement les types supplémentaires non couverts par types/base.ts
// Les types Order, MenuItem, Category, UserProfile, Restaurant etc. viennent de types/base.ts

export interface TeamMember {
  id: string;
  name: string;
  role: 'Manager' | 'Cuisinier' | 'Serveur' | 'Livreur' | 'Caissier';
  status: 'Actif' | 'En Pause' | 'Absent';
  shift: string;
  avatar: string;
}

// POS-specific types (used only in POS.tsx with local state)
export type POSOrderType = 'dine-in' | 'takeaway' | 'delivery';
export type POSPaymentMethod = 'ussd' | 'cash' | 'card' | 'ussd-mtn' | 'ussd-moov' | 'ussd-celtiis';

export interface POSOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface POSOrder {
  id?: string;
  orderNumber?: string;
  customerName?: string;
  items: POSOrderItem[];
  total: number;
  status: 'new' | 'preparing' | 'ready' | 'delivered' | 'pending';
  paymentMethod: POSPaymentMethod;
  paymentStatus: 'pending' | 'confirmed' | 'paid';
  type: POSOrderType;
  tableNumber?: string;
  createdAt: string | Date;
  timeElapsed?: number;
  cashierId?: string;
  cashierName?: string;
}
