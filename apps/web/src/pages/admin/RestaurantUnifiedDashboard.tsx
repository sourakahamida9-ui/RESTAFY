/**
 * =====================================================================
 * RESTAFY RESTAURANT UNIFIED DASHBOARD
 * =====================================================================
 * 
 * Vue principale ultra-épurée pour restaurateurs - mobile-first
 * 
 * FONCTIONNALITÉS:
 * - Gestion ouvert/fermé en un tap
 * - Suivi commandes temps réel (pending → preparing → ready → delivered)
 * - KPIs rapides (attente, cuisine, prêts, CA)
 * - Gestion menu rapide (activation/disactivation/plats)
 * - Alertes commandes urgentes (>20min)
 * 
 * @author Restafy Team
 * @date 2025-05-05
 * =====================================================================
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRestaurantId } from '@/hooks/useAdminRestaurantId';
import { useRestaurantOrders } from '@/hooks/useRestaurantAdmin';
import { useOrderRealtime } from '@/hooks/useOrderRealtime';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { supabase } from '@/lib/supabase';
import { pickAvailableDeliveryDriver } from '@/lib/deliveryAssign';
import { getRestaurantUrl } from '@/lib/appUrl';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

// Icons
import {
  ShoppingBag, ChefHat, CheckCircle2, Banknote,
  RefreshCw, AlertCircle, Zap, ExternalLink,
  Volume2, VolumeX, Clock, Bike, Utensils,
  DollarSign, Loader2, Plus, Minus,
  Home, Search, Filter, Settings,
  UtensilsCrossed, Sparkles,
} from 'lucide-react';

import { RestafyLoader } from '@/components/ui/RestafyLoader';
import { RestaurantAvatar } from '@/components/ui/RestaurantAvatar';
import { MobileDashboardOverview } from '@/components/restaurant/dashboard/MobileDashboardOverview';

// =====================================================================
// TYPES - Définitions des données
// =====================================================================

/** Statut possible d'une commande */
type OrderStatus = 
  | 'pending' 
  | 'accepted' 
  | 'confirmed' 
  | 'preparing' 
  | 'ready' 
  | 'delivering' 
  | 'delivered' 
  | 'cancelled';

/** Type de commande (aligné sur le schéma DB : inclut pickup/sur_place pour compat) */
type OrderType = 'delivery' | 'dine_in' | 'takeaway' | 'pickup' | 'sur_place';

/** Article dans une commande */
interface OrderItem {
  id: string;
  item_name?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string | null;
}

/** Commande client */
interface Order {
  id: string;
  order_number?: string;
  status: OrderStatus;
  type: OrderType;
  total_amount: number;
  delivery_address?: string | null;
  notes?: string | null;
  table_number?: string | null;
  created_at: string;
  updated_at?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  driver_id?: string | null;
  order_items?: OrderItem[];
}

/** Restaurant */
interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  is_open: boolean;
  owner_id: string | null;
}

/** Article du menu */
interface MenuItem {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
  category_id: string | null;
  image_url?: string | null;
}

/** Catégorie de menu */
interface MenuCategory {
  id: string;
  name: string;
}

// =====================================================================
// CONSTANTES - Configuration
// =====================================================================

/** Configuration des statuts de commande */
const ORDER_STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Nouvelle',   color: '#F59E0B', bg: 'bg-amber-500/15' },
  accepted:  { label: 'Acceptée',   color: '#3B82F6', bg: 'bg-blue-500/15' },
  confirmed: { label: 'Confirmée', color: '#3B82F6', bg: 'bg-blue-500/15' },
  preparing:{ label: 'En cuisine', color: '#F97316', bg: 'bg-orange-500/15' },
  ready:    { label: 'Prête',      color: '#22C55E', bg: 'bg-emerald-500/15' },
  delivering:{ label: 'En route',  color: '#8B5CF6', bg: 'bg-violet-500/15' },
  delivered:{ label: 'Livrée',    color: '#71717A', bg: 'bg-zinc-500/15' },
  cancelled:{ label: 'Annulée',    color: '#EF4444', bg: 'bg-red-500/15' },
};

/** Transitions de statut autorisées */
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus | undefined> = {
  pending: 'confirmed',
  accepted: 'preparing',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'delivering',
  delivering: 'delivered',
  delivered: undefined,
  cancelled: undefined,
};

/** Labels des boutons d'action */
const ACTION_LABELS: Record<OrderStatus, string> = {
  pending: 'Confirmer',
  accepted: 'Préparer',
  confirmed: 'Préparer',
  preparing: 'Terminer',
  ready: 'Expédier',
  delivering: 'Livrée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

// =====================================================================
// UTILITAIRES - Fonctions helpers
// =====================================================================

/**
 * Formatage montant en Fcfa
 * @param amount - Montant en Fcfa
 * @returns Chaîne formatée ex: "5 000 F"
 */
function formatFCFA(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' F';
}

/**
 * Calcule le temps écoulé depuis une date
 * @param createdAt - Date ISO de création
 * @returns Format: "5 min" ou "1h25"
 */
function elapsedTime(createdAt: string): string {
  const minutes = Math.round((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins.toString().padStart(2, '0')}`;
}

/**
 * Détermine si une commande est urgente (>20min sans traitement)
 */
function isUrgent(order: Order): boolean {
  if (['delivered', 'cancelled'].includes(order.status)) return false;
  const mins = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);
  return mins > 20;
}

// =====================================================================
// TYPES pour les onglets
// =====================================================================

/** Type pour les onglets */
type Tab = 'orders' | 'menu' | 'analytics';

/** Type pour les filtres de statut */
type StatusFilter = 'active' | 'all' | OrderStatus;

// =====================================================================
// ANALYTICS IA - Fonctions d'analyse intelligente
// =====================================================================

/**
 * Calcule les revenus des N derniers jours
 * @param orders - Liste des commandes
 * @param days - Nombre de jours
 * @returns Tableau de revenus par jour
 */
function calculateDailyRevenue(orders: Order[], days: number): number[] {
  const result: number[] = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const dayOrders = orders.filter(o => {
      const orderDate = new Date(o.created_at);
      return orderDate >= date && orderDate < nextDate && o.status === 'delivered';
    });
    
    result.push(dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0));
  }
  
  return result;
}

/**
 * Trouve les articles les plus commandés
 * @param orders - Liste des commandes
 * @returns top 5 des articles
 */
function getTopItems(orders: Order[]): { name: string; count: number }[] {
  const itemCounts: Record<string, number> = {};
  
  orders.forEach(order => {
    order.order_items?.forEach(item => {
      const name = item.item_name;
      itemCounts[name] = (itemCounts[name] || 0) + item.quantity;
    });
  });
  
  return Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
}

/**
 * Calcule le temps moyen de préparation
 * @param orders - Liste des commandes
 * @returns Temps moyen en minutes
 */
function getAveragePrepTime(orders: Order[]): number {
  const completed = orders.filter(o => 
    ['ready', 'delivered', 'delivering'].includes(o.status) && o.created_at
  );
  
  if (completed.length === 0) return 0;
  
  const totalMinutes = completed.reduce((sum, order) => {
    const created = new Date(order.created_at).getTime();
    const ready = order.updated_at ? new Date(order.updated_at).getTime() : Date.now();
    return sum + (ready - created) / 60000;
  }, 0);
  
  return Math.round(totalMinutes / completed.length);
}

/**
 * Prédit les heures de pointe basées sur l'historique
 * @param orders - Liste des commandes
 * @returns Heures optimales
 */
function predictBusyHours(orders: Order[]): number[] {
  const hourCounts: Record<number, number> = {};
  
  orders.forEach(order => {
    const hour = new Date(order.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  // Retourne les 3 heures les plus occupées
  return Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));
}

/**
 * Génère des suggestions intelligentes
 * @param orders - Liste des commandes
 * @param menuItems - Articles du menu
 * @returns Suggestions pour le restaurateur
 */
function getAISuggestions(orders: Order[], menuItems: MenuItem[]): string[] {
  const suggestions: string[] = [];
  
  // Suggestion 1: Temps de préparation
  const avgPrepTime = getAveragePrepTime(orders);
  if (avgPrepTime > 20) {
    suggestions.push(`⏱️ Temps de préparation: ${avgPrepTime} min. Considerez embaucher un aide-cuisinier.`);
  }
  
  // Suggestion 2: Heures de pointe
  const busyHours = predictBusyHours(orders);
  if (busyHours.length > 0) {
    suggestions.push(`🕐 Heures de pointe prevues: ${busyHours.map(h => `${h}h`).join(', ')}`);
  }
  
  // Suggestion 3: Articles populaires
  const topItems = getTopItems(orders);
  if (topItems.length > 0) {
    suggestions.push(`⭐ Best-seller: ${topItems[0].name} (${topItems[0].count} ventes)`);
  }
  
  // Suggestion 4: Fidélité client
  const uniqueClients = new Set(orders.map(o => o.customer_phone)).size;
  if (uniqueClients > 10) {
    suggestions.push(`👥 ${uniqueClients} clients cette semaine — Programmez des offres fidélité!`);
  }
  
  return suggestions;
}

// =====================================================================
// COMPOSANT PRINCIPAL
// =====================================================================

export default function RestaurantUnifiedDashboard() {
  const navigate = useNavigate();
  
  // =====================================================================
  // AUTH & CONTEXTE
  // =====================================================================
  const { profile, user } = useAuth();
  const restaurantId = useAdminRestaurantId();

  const mobileGreetingName = useMemo(() => {
    const base = (profile?.full_name || user?.email?.split('@')[0] || 'Manager').trim();
    return base.split(' ')[0] || base;
  }, [profile?.full_name, user?.email]);
  
  // =====================================================================
  // ÉTAT - Restaurant
  // =====================================================================
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);

  // =====================================================================
  // ÉTAT - Commandes
  // =====================================================================
  const { orders, loading: ordersLoading, error, refetch: refetchOrders } = useRestaurantOrders(restaurantId);
  const { prefs, update: updatePrefs } = useNotificationPreferences();
  const { stopAlerts } = useOrderRealtime(restaurantId, refetchOrders, prefs.soundEnabled, prefs.vibrationEnabled);

  // =====================================================================
  // ÉTAT - UI
  // =====================================================================
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  // =====================================================================
  // ÉTAT - Menu
  // =====================================================================
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // =====================================================================
  // ÉTAT - KPIs
  // =====================================================================
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);

  // =====================================================================
  // EFFETS - Chargement données
  // =====================================================================

  /** Charge les infos du restaurant */
  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    supabase
      .from('restaurants')
      .select('id,name,slug,logo_url,is_open,owner_id')
      .eq('id', restaurantId)
      .single()
      .then(({ data }) => {
        if (data) {
          setRestaurant(data);
          setIsOpen(data.is_open ?? false);
        }
        setLoading(false);
      });
  }, [restaurantId]);

  /** Charge les KPIs du jour */
  useEffect(() => {
    if (!restaurantId || orders.length === 0) return;
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const deliveredOrders = orders.filter(
      o => o.status === 'delivered' && new Date(o.created_at) >= todayStart
    );
    
    setTodayRevenue(deliveredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0));
    setTodayOrders(deliveredOrders.length);
  }, [restaurantId, orders]);

  /** Charge le menu (onglet menu uniquement) */
  useEffect(() => {
    if (!restaurantId || activeTab !== 'menu') return;
    
    setMenuLoading(true);
    
    Promise.all([
      supabase
        .from('items')
        .select('id,name,price,is_available,category_id,image_url')
        .eq('restaurant_id', restaurantId)
        .order('name'),
      supabase
        .from('categories')
        .select('id,name')
        .eq('restaurant_id', restaurantId)
        .order('sort_order'),
    ]).then(([itemsRes, catsRes]) => {
      if (itemsRes.data) setMenuItems(itemsRes.data as MenuItem[]);
      if (catsRes.data) setCategories(catsRes.data as MenuCategory[]);
      setMenuLoading(false);
    });
  }, [restaurantId, activeTab]);

  /** Focus input prix après ouverture */
  useEffect(() => {
    if (editingPrice && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingPrice]);

  // =====================================================================
  // HANDLERS - Actions
  // =====================================================================

  /** Bascule ouvert/fermé */
  const handleToggleOpen = useCallback(async () => {
    if (!restaurant) return;
    
    setTogglingOpen(true);
    const newValue = !isOpen;
    
    const { error } = await supabase
      .from('restaurants')
      .update({ is_open: newValue })
      .eq('id', restaurant.id);
    
    if (!error) {
      setIsOpen(newValue);
      toast.success(newValue ? '✅ Restaurant ouvert' : '🔒 Restaurant fermé');
    } else {
      toast.error('Erreur lors de la mise à jour');
    }
    
    setTogglingOpen(false);
  }, [restaurant, isOpen]);

  /** Met à jour le statut d'une commande */
  const handleUpdateOrderStatus = useCallback(async (orderId: string, newStatus: OrderStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const payload: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    // Auto-assigner un livreur pour livraison
    if (newStatus === 'delivering' && order.type === 'delivery' && !order.driver_id && restaurantId) {
      const driver = await pickAvailableDeliveryDriver(restaurantId);
      if (driver) {
        payload.driver_id = driver.id;
        payload.driver_assigned_at = new Date().toISOString();
        toast.success(`🚴 ${driver.name} assigné à la livraison`);
      } else {
        toast.message('Aucun livreur disponible');
      }
    }

    const { error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', orderId);

    if (!error) {
      toast.success(`Commande ${ACTION_LABELS[newStatus] || 'mise à jour'}`);
      stopAlerts();
    } else {
      toast.error('Erreur: ' + error.message);
    }
  }, [orders, restaurantId, stopAlerts]);

  /** Bascule disponibilité article */
  const handleToggleItem = useCallback(async (itemId: string, currentAvailable: boolean) => {
    const newAvailable = !currentAvailable;
    
    const { error } = await supabase
      .from('items')
      .update({ is_available: newAvailable })
      .eq('id', itemId);
    
    if (!error) {
      setMenuItems(items => items.map(item => 
        item.id === itemId ? { ...item, is_available: newAvailable } : item
      ));
      toast.success(newAvailable ? '✅ Article activé' : '❌ Article désactivé');
    } else {
      toast.error('Erreur lors de la mise à jour');
    }
  }, []);

  /** Sauvegarde nouveau prix */
  const handleSavePrice = useCallback(async (itemId: string) => {
    const price = parseFloat(editPriceValue);
    
    if (isNaN(price) || price < 0) {
      toast.error('Prix invalide');
      return;
    }

    const { error } = await supabase
      .from('items')
      .update({ price })
      .eq('id', itemId);

    if (!error) {
      setMenuItems(items => items.map(item =>
        item.id === itemId ? { ...item, price } : item
      ));
      toast.success('Prix mis à jour');
      setEditingPrice(null);
    } else {
      toast.error('Erreur lors de la mise à jour');
    }
  }, [editPriceValue]);

  // =====================================================================
  // COMPUTED - Données dérivées
  // =====================================================================

  /** Commandes en attente */
  const pendingCount = useMemo(() => 
    orders.filter(o => o.status === 'pending').length,
    [orders]
  );

  const sales7d = useMemo(() => calculateDailyRevenue(orders, 7), [orders]);

  const clientsServedToday = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const deliveredToday = orders.filter(
      (o) => o.status === 'delivered' && new Date(o.created_at) >= todayStart,
    );
    const set = new Set(
      deliveredToday
        .map((o) => (o.customer_phone || o.customer_name || '').trim())
        .filter(Boolean),
    );
    return set.size;
  }, [orders]);

  const recentOrders = useMemo(() => {
    return [...orders]
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3)
      .map((o) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        created_at: o.created_at,
        total_amount: o.total_amount,
        status: o.status,
      }));
  }, [orders]);

  /** Commandes en cours */
  const inProgressCount = useMemo(() => 
    orders.filter(o => ['accepted', 'confirmed', 'preparing'].includes(o.status)).length,
    [orders]
  );

  /** Commandes prêtes */
  const readyCount = useMemo(() => 
    orders.filter(o => o.status === 'ready').length,
    [orders]
  );

  /** Commandes urgentes */
  const urgentCount = useMemo(() => 
    orders.filter(isUrgent).length,
    [orders]
  );

  /** Commandes filtrées */
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Filtre statut
    if (statusFilter === 'active') {
      result = result.filter(o => !['delivered', 'cancelled'].includes(o.status));
    } else if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }

    // Filtre recherche
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.order_number?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.table_number?.toLowerCase().includes(q)
      );
    }

    // Tri par date (plus anciennes en premier)
    return result.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [orders, statusFilter, searchQuery]);

  // =====================================================================
  // RENDU - States finals
  // =====================================================================

  /** Chargement initial */
  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <RestafyLoader fullscreen={false} message="Chargement..." size="md" />
      </div>
    );
  }

  /** Aucun restaurant lié */
  if (!restaurantId || !restaurant) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl p-8 text-center space-y-4"
             style={{ background: 'var(--restaurant-card)', border: '1px solid var(--restaurant-card-border)' }}>
          <div className="w-14 h-14 bg-amber-500/15 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--r-text)' }}>
            Aucun restaurant lié
          </h1>
          <p className="text-sm" style={{ color: 'var(--r-text-subtle)' }}>
            Votre compte n'est pas encore lié à un restaurant.
          </p>
        </div>
      </div>
    );
  }

  // =====================================================================
  // RENDU - Interface principale
  // =====================================================================

  return (
    <div className="min-h-full w-full min-w-0 pb-8 space-y-3 sm:space-y-4">

      {/* Mobile home — layout aligné sur le design */}
      <MobileDashboardOverview
        greetingName={mobileGreetingName}
        restaurantName={restaurant.name}
        stats={{
          salesTodayLabel: `${todayRevenue.toLocaleString('fr-FR')} FCFA`,
          ordersToday: todayOrders,
          clientsServed: clientsServedToday,
          pendingCount,
          salesTrendLabel:
            sales7d.length >= 2 && sales7d[sales7d.length - 2] > 0
              ? `${Math.round(
                  ((sales7d[sales7d.length - 1] - sales7d[sales7d.length - 2]) /
                    sales7d[sales7d.length - 2]) *
                    100,
                )}% vs hier`
              : undefined,
        }}
        revenueSeries={sales7d}
        recentOrders={recentOrders}
      />

      {/* =====================================================================
          HEADER - Restaurant info + quick actions
      ===================================================================== */}
      <header className="relative overflow-hidden rounded-2xl hidden lg:block"
              style={{ background: 'var(--restaurant-card)', border: '1px solid var(--restaurant-card-border)' }}>
        
        {/* Bandeau dégradé-orange */}
        <div className="absolute top-0 left-0 right-0 h-1" 
             style={{ background: 'linear-gradient(90deg, #F97316, #F59E0B, #F97316)' }} />
        
        <div className="relative px-4 py-3.5 sm:px-5 sm:py-4 flex items-center gap-3">
          
          {/* Avatar restaurant avec bordun dégradé */}
          <div className="relative shrink-0">
            <div className="p-[2px] rounded-xl" style={{ background: 'linear-gradient(135deg, #F97316, #F59E0B)' }}>
              <RestaurantAvatar src={restaurant.logo_url} name={restaurant.name} className="w-10 h-10 rounded-[10px]" />
            </div>
            {/* Indicateur ouvert/fermé animé */}
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 transition-all ${
              isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
            }`} style={{ borderColor: 'var(--restaurant-card)' }} />
          </div>

          {/* Nom restaurant (tronqué si nécessaire) */}
          <div className="flex-1 min-w-0">
            <h1 className="font-extrabold text-base sm:text-lg leading-tight truncate" style={{ color: 'var(--r-text)' }}>
              {restaurant.name}
            </h1>
          </div>

          {/* Actions rapides */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Lien page publique (masqué mobile) */}
            {restaurant.slug && (
              <a href={getRestaurantUrl(restaurant.slug)} target="_blank" rel="noopener noreferrer"
                 className="hidden sm:flex items-center gap-1 text-[11px] font-semibold px-3 py-2 rounded-xl transition-colors"
                 style={{ color: 'var(--r-text-muted)', border: '1px solid var(--restaurant-card-border)' }}>
                <ExternalLink className="w-3 h-3" /> Voir
              </a>
            )}

            {/* Toggle ouvert/fermé - ACTION PRINCIPALE */}
            <button 
              onClick={handleToggleOpen} 
              disabled={togglingOpen}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isOpen 
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' 
                  : 'border bg-transparent'
              }`}
              style={!isOpen ? { borderColor: 'var(--restaurant-card-border)', color: 'var(--r-text-muted)' } : undefined}>
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
              {togglingOpen ? '...' : isOpen ? '✅ Ouvert' : '🔒 Fermé'}
            </button>

            {/* Toggle son notifications */}
            <button 
              onClick={() => { updatePrefs({ soundEnabled: !prefs.soundEnabled }); stopAlerts(); }}
              className="p-2 rounded-xl transition-colors"
              style={{ color: 'var(--r-text-subtle)' }}
              title={prefs.soundEnabled ? 'Couper le son' : 'Activer le son'}>
              {prefs.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <div className="hidden lg:block">
        {/* =====================================================================
            ALERTE URGENTES (>20min)
        ===================================================================== */}
        <AnimatePresence>
          {urgentCount > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -6 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Zap className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs font-bold text-red-300">
                {urgentCount} commande{urgentCount > 1 ? 's' : ''} en attente depuis {'>'}20 min
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* =====================================================================
          KPIs RAPIDES - 4 cartes compactes (desktop)
      ===================================================================== */}
      <div className="hidden lg:grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: 'Attente', value: pendingCount, color: '#F59E0B', icon: ShoppingBag },
          { label: 'Cuisine', value: inProgressCount, color: '#F97316', icon: ChefHat },
          { label: 'Prêtes', value: readyCount, color: '#22C55E', icon: CheckCircle2 },
          { label: 'CA jour', value: formatFCFA(todayRevenue), color: '#F97316', icon: Banknote },
        ].map(kpi => (
          <div 
            key={kpi.label} 
            className="relative overflow-hidden rounded-xl p-2.5 sm:p-3 text-center"
            style={{ background: 'var(--restaurant-card)', border: '1px solid var(--restaurant-card-border)' }}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
            </div>
            <p className="text-lg sm:text-xl font-extrabold leading-none" style={{ color: 'var(--r-text)' }}>
              {kpi.value}
            </p>
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--r-text-muted)' }}>
              {kpi.label}
            </p>
          </div>
        ))}
      </div>

      {/* =====================================================================
          ONGLETS - Commandes / Menu / Analytics (desktop)
      ===================================================================== */}
      <div className="hidden lg:flex gap-1 p-1 rounded-xl" style={{ background: 'var(--r-surface)' }}>
        {[
          { key: 'orders' as Tab, label: 'Commandes', count: filteredOrders.length },
          { key: 'menu' as Tab, label: 'Menu', count: menuItems.length },
          { key: 'analytics' as Tab, label: 'IA', count: 0 },
        ].map(tab => (
          <button 
            key={tab.key} 
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.key ? 'bg-white shadow-sm' : ''
            }`}
            style={{ color: activeTab === tab.key ? 'var(--r-text)' : 'var(--r-text-muted)' }}>
            <span>{tab.label}</span>
            {tab.key !== 'analytics' && (
              <span 
                className="px-1.5 py-0.5 rounded-full text-[10px]" 
                style={{ 
                  background: activeTab === tab.key ? 'var(--r-primary)' : 'var(--r-surface)', 
                  color: activeTab === tab.key ? 'white' : 'var(--r-text-muted)' 
                }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* =====================================================================
          RECHERCHE & FILTRES (Commandes seulement)
      ===================================================================== */}
      {activeTab === 'orders' && orders.length > 0 && (
        <div className="hidden lg:flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'var(--r-surface)', border: '1px solid var(--r-input-border)', color: 'var(--r-text)' }} 
            />
          </div>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--r-surface)', border: '1px solid var(--r-input-border)', color: 'var(--r-text)' }}>
            <option value="active">Actives</option>
            <option value="all">Toutes</option>
            <option value="pending">En attente</option>
            <option value="preparing">En cuisine</option>
            <option value="ready">Prêtes</option>
          </select>
        </div>
      )}

      {/* =====================================================================
          LISTE COMMANDES
      ===================================================================== */}
      {activeTab === 'orders' && (
        <div className="hidden lg:block space-y-2">
          
          {/* Aucune commande */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--r-text-muted)' }}>
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Aucune commande</p>
            </div>
          ) : (
            /* Liste des commandes */
            filteredOrders.map(order => {
              const statusConfig = ORDER_STATUS_CONFIG[order.status];
              const nextStatus = STATUS_TRANSITIONS[order.status];
              const canAdvance = nextStatus && !['delivered', 'cancelled'].includes(order.status);
              
              return (
                <div 
                  key={order.id}
                  className={`relative overflow-hidden rounded-xl p-4 ${
                    isUrgent(order) ? 'ring-2 ring-red-500/30' : ''
                  }`}
                  style={{ background: 'var(--restaurant-card)', border: '1px solid var(--restaurant-card-border)' }}>
                  
                  {/* Header commande - Numéro + Client + Temps */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-zinc-900">#{order.order_number || order.id.slice(0, 6)}</p>
                      <p className="text-xs" style={{ color: 'var(--r-text-muted)' }}>
                        {order.customer_name || 'Client'} • {elapsedTime(order.created_at)}
                        {order.table_number && ` • Table ${order.table_number}`}
                      </p>
                    </div>
                    {/* Badge statut */}
                    <span 
                      className={`px-2 py-1 rounded-full text-[10px] font-bold ${statusConfig.bg}`}
                      style={{ color: statusConfig.color }}>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Articles commandés */}
                  <div className="space-y-1 mb-3">
                    {order.order_items?.slice(0, 3).map(item => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span style={{ color: 'var(--r-text)' }}>
                          {item.quantity}x {item.item_name}
                        </span>
                        <span className="font-medium" style={{ color: 'var(--r-text-muted)' }}>
                          {formatFCFA(item.subtotal)}
                        </span>
                      </div>
                    ))}
                    {order.order_items && order.order_items.length > 3 && (
                      <p className="text-xs" style={{ color: 'var(--r-text-muted)' }}>
                        +{order.order_items.length - 3} autres articles
                      </p>
                    )}
                  </div>

                  {/* Footer - Total + Bouton action */}
                  <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: 'var(--restaurant-card-border)' }}>
                    <p className="font-bold text-lg" style={{ color: 'var(--r-text)' }}>
                      {formatFCFA(order.total_amount || 0)}
                    </p>
                    
                    {/* Bouton avancer statut */}
                    {canAdvance && (
                      <button 
                        onClick={() => handleUpdateOrderStatus(order.id, nextStatus)}
                        className="px-4 py-2 rounded-xl text-xs font-bold"
                        style={{ background: statusConfig.color, color: 'white' }}>
                        {ACTION_LABELS[nextStatus]}
                      </button>
                    )}
                  </div>

                  {/* Indicateur urgent (dot rouge animée) */}
                  {isUrgent(order) && (
                    <div className="absolute top-2 right-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =====================================================================
          LISTE MENU
      ===================================================================== */}
      {activeTab === 'menu' && (
        <div className="hidden lg:block space-y-2">
          
          {/* Chargement */}
          {menuLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : menuItems.length === 0 ? (
            /* Menu vide */
            <div className="text-center py-12" style={{ color: 'var(--r-text-muted)' }}>
              <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Aucun article</p>
              <p className="text-sm mt-1">Ajoutez des articles dans Menu</p>
            </div>
          ) : (
            /* Liste des articles */
            menuItems.map(item => (
              <div 
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'var(--restaurant-card)', border: '1px solid var(--restaurant-card-border)' }}>
                
                {/* Image ou placeholder */}
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-zinc-100 flex items-center justify-center">
                    <UtensilsCrossed className="w-6 h-6 text-zinc-400" />
                  </div>
                )}

                {/* Détails article */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ color: 'var(--r-text)' }}>
                    {item.name}
                  </p>
                  <p className="text-sm font-bold" style={{ color: 'var(--r-text-muted)' }}>
                    {formatFCFA(item.price)}
                  </p>
                </div>

                {/* Toggle disponibilité */}
                <button 
                  onClick={() => handleToggleItem(item.id, item.is_available)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    item.is_available ? 'bg-emerald-100' : 'bg-zinc-100'
                  }`}>
                  {item.is_available ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <span className="w-5 h-5 rounded-full border-2 border-zinc-300" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      )}
{/* =====================================================================
          ANALYTIQUE IA
      ===================================================================== */}
      {activeTab === 'analytics' && (
        <div className="hidden lg:block space-y-4">
          {/* Suggestions IA */}
          <div 
            className="p-4 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)', color: 'white' }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-bold">Analyse IA</h3>
            </div>
            
            {(() => {
              const suggestions = getAISuggestions(orders, menuItems);
              return suggestions.length > 0 ? (
                <div className="space-y-2">
                  {suggestions.map((suggestion, idx) => (
                    <p key={idx} className="text-sm opacity-90">{suggestion}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm opacity-75">
                  Collectez plus de données pour activer l'analyse IA.
                </p>
              );
            })()}
          </div>

          {/* Top Articles */}
          <div className="p-4 rounded-xl" style={{ background: 'var(--restaurant-card)', border: '1px solid var(--restaurant-card-border)' }}>
            <h3 className="font-bold mb-3" style={{ color: 'var(--r-text)' }}>⭐ Articles populaires</h3>
            {(() => {
              const topItems = getTopItems(orders);
              return topItems.length > 0 ? (
                <div className="space-y-2">
                  {topItems.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span style={{ color: 'var(--r-text)' }}>
                        {idx + 1}. {item.name}
                      </span>
                      <span className="font-bold" style={{ color: 'var(--r-text-muted)' }}>
                        {item.count} ventes
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--r-text-muted)' }}>
                 Aucune donnée disponible
                </p>
              );
            })()}
          </div>

          {/* KPIs avancées */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl" style={{ background: 'var(--restaurant-card)', border: '1px solid var(--restaurant-card-border)' }}>
              <p className="text-xs" style={{ color: 'var(--r-text-muted)' }}>Temps moyen prep.</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--r-text)' }}>
                {getAveragePrepTime(orders)} min
              </p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'var(--restaurant-card)', border: '1px solid var(--restaurant-card-border)' }}>
              <p className="text-xs" style={{ color: 'var(--r-text-muted)' }}>Clients uniques</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--r-text)' }}>
                {new Set(orders.map(o => o.customer_phone)).size}
              </p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'var(--restaurant-card)', border: '1px solid var(--restaurant-card-border)' }}>
              <p className="text-xs" style={{ color: 'var(--r-text-muted)' }}>Panier moyen</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--r-text)' }}>
                {orders.length > 0 
                  ? formatFCFA(orders.reduce((s, o) => s + (o.total_amount || 0), 0) / orders.length)
                  : '0 F'}
              </p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: 'var(--restaurant-card)', border: '1px solid var(--restaurant-card-border)' }}>
              <p className="text-xs" style={{ color: 'var(--r-text-muted)' }}>Total commandes</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--r-text)' }}>
                {orders.length}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}