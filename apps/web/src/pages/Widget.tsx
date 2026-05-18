/**
 * Page Widget RESTAFY - Version embeddable pour iframes
 * Permet aux restaurants d'intégrer menu/commandes/réservations sur leur site
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getAppUrl } from '@/lib/appUrl';
import {
  ShoppingCart,
  Calendar,
  Clock,
  Phone,
  MapPin,
  Star,
  Plus,
  Minus,
  Heart,
  Share2,
  Filter,
  Search,
  X,
  Check,
  Loader2,
  User,
  CreditCard,
} from 'lucide-react';

// PostHog Analytics
declare global {
  interface Window {
    posthog: any;
  }
}

// Types
interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
  is_available: boolean;
  preparation_time?: number;
  ingredients?: string[];
  allergens?: string[];
  spicy_level?: number;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  order_index: number;
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string;
  phone: string;
  address: string;
  image_url?: string;
  rating: number;
  delivery_time: string;
  is_active: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
  notes?: string;
}

interface WidgetConfig {
  theme: 'light' | 'dark';
  lang: 'fr' | 'en';
  view: 'menu' | 'reservation' | 'commande';
  color: string;
}

export default function Widget() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  
  // Configuration du widget depuis les paramètres URL
  const [config, setConfig] = useState<WidgetConfig>({
    theme: (searchParams.get('theme') as 'light' | 'dark') || 'light',
    lang: (searchParams.get('lang') as 'fr' | 'en') || 'fr',
    view: (searchParams.get('view') as 'menu' | 'reservation' | 'commande') || 'menu',
    color: searchParams.get('color') || 'terracotta',
  });

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [reservationData, setReservationData] = useState({
    name: '',
    phone: '',
    email: '',
    date: '',
    time: '',
    guests: '2',
    notes: '',
  });

  // Appliquer la configuration CSS
  useEffect(() => {
    const root = document.documentElement;
    
    // Thème
    root.setAttribute('data-theme', config.theme);
    
    // Couleur personnalisée
    const colorMap: Record<string, string> = {
      terracotta: '#FF6B35',
      blue: '#3B82F6',
      green: '#10B981',
      purple: '#8B5CF6',
      orange: '#F97316',
    };
    
    root.style.setProperty('--widget-primary', colorMap[config.color] || colorMap.terracotta);
    
    // Langue
    root.setAttribute('lang', config.lang);
    
    // Mode vue
    root.setAttribute('data-view', config.view);
  }, [config]);

  const dataLoadedRef = useRef(false);

  const loadRestaurantData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Charger le restaurant
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (restaurantError || !restaurantData) {
        throw new Error('Restaurant non trouvé ou inactif');
      }

      setRestaurant(restaurantData);

      // Charger les catégories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantData.id)
        .order('order_index', { ascending: true });

      setCategories(categoriesData || []);

      // Charger les items du menu
      const { data: itemsData } = await supabase
        .from('items')
        .select('*')
        .eq('restaurant_id', restaurantData.id)
        .eq('is_available', true)
        .order('name', { ascending: true });

      setMenuItems(itemsData || []);

      // Tracker PostHog
      if (typeof window !== 'undefined' && (window as any).posthog) {
        (window as any).posthog.capture('widget_view', {
          restaurant_id: restaurantData.id,
          restaurant_slug: slug,
          source: 'iframe_embed',
          widget_config: config,
        });
      }
    } catch (error) {
      console.error('[Widget] Erreur chargement:', error);
      toast.error('Erreur chargement des données');
    } finally {
      setLoading(false);
    }
  }, [slug, config]);

  // Charger les données du restaurant une seule fois
  useEffect(() => {
    if (!slug || dataLoadedRef.current) return;
    dataLoadedRef.current = true;
    loadRestaurantData();
  }, [slug, loadRestaurantData]);

  // Filtrer les items
  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Gestion du panier
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.id === item.id);
      if (existing) {
        return prev.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });

    // Tracker PostHog
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('widget_add_to_cart', {
        restaurant_id: restaurant?.id,
        item_id: item.id,
        item_name: item.name,
        source: 'iframe_embed',
      });
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    
    setCart(prev => prev.map(item =>
      item.id === itemId ? { ...item, quantity } : item
    ));
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const startOrder = () => {
    if (cart.length === 0) {
      toast.error('Votre panier est vide');
      return;
    }

    // Tracker PostHog
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('widget_order_started', {
        restaurant_id: restaurant?.id,
        cart_total: getTotalPrice(),
        items_count: cart.length,
        source: 'iframe_embed',
      });
    }

    // Rediriger vers la page de commande complète
    const orderUrl = `${getAppUrl()}/commande/${restaurant?.slug}?widget=true&items=${encodeURIComponent(JSON.stringify(cart))}`;
    window.open(orderUrl, '_blank');
  };

  const submitReservation = async () => {
    try {
      // Validation basique
      if (!reservationData.name || !reservationData.phone || !reservationData.date || !reservationData.time) {
        toast.error('Veuillez remplir tous les champs obligatoires');
        return;
      }

      // Tracker PostHog
      if (typeof window !== 'undefined' && (window as any).posthog) {
        (window as any).posthog.capture('widget_reservation_started', {
          restaurant_id: restaurant?.id,
          reservation_date: reservationData.date,
          guests: reservationData.guests,
          source: 'iframe_embed',
        });
      }

      // TODO: Soumettre la réservation via API
      toast.success('Demande de réservation envoyée !');
      setShowReservationForm(false);
      
      // Reset formulaire
      setReservationData({
        name: '',
        phone: '',
        email: '',
        date: '',
        time: '',
        guests: '2',
        notes: '',
      });
    } catch (error) {
      console.error('[Widget] Erreur réservation:', error);
      toast.error('Erreur lors de la réservation');
    }
  };

  if (loading) {
    return (
      <div className="widget-loading">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--widget-primary)' }} />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="widget-error">
        <div className="text-center p-8">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Restaurant non trouvé</h2>
          <p className="text-gray-600">Ce restaurant n'est pas disponible ou n'existe pas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="widget-container" data-theme={config.theme}>
      {/* Header Widget */}
      <div className="widget-header">
        <div className="flex items-center gap-3">
          {restaurant.image_url && (
            <img 
              src={restaurant.image_url} 
              alt={restaurant.name}
              className="w-12 h-12 rounded-lg object-cover"
            />
          )}
          <div className="flex-1">
            <h1 className="widget-title">{restaurant.name}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                <span>{restaurant.rating.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{restaurant.delivery_time}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Navigation Widget */}
        <div className="widget-nav">
          <button
            onClick={() => setConfig(prev => ({ ...prev, view: 'menu' }))}
            className={`widget-nav-btn ${config.view === 'menu' ? 'active' : ''}`}
          >
            Menu
          </button>
          <button
            onClick={() => setConfig(prev => ({ ...prev, view: 'commande' }))}
            className={`widget-nav-btn ${config.view === 'commande' ? 'active' : ''}`}
          >
            Commande
          </button>
          <button
            onClick={() => setConfig(prev => ({ ...prev, view: 'reservation' }))}
            className={`widget-nav-btn ${config.view === 'reservation' ? 'active' : ''}`}
          >
            Réservation
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="widget-content">
        {config.view === 'menu' && (
          <div className="widget-menu">
            {/* Barre de recherche */}
            <div className="widget-search">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un plat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="widget-search-input"
                />
              </div>
            </div>

            {/* Filtres catégories */}
            <div className="widget-categories">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`widget-category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              >
                Tous
              </button>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`widget-category-btn ${selectedCategory === category.id ? 'active' : ''}`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* Grid des items */}
            <div className="widget-items-grid">
              {filteredItems.map(item => (
                <div key={item.id} className="widget-item-card">
                  {item.image_url && (
                    <img 
                      src={item.image_url} 
                      alt={item.name}
                      className="widget-item-image"
                    />
                  )}
                  <div className="widget-item-content">
                    <h3 className="widget-item-name">{item.name}</h3>
                    <p className="widget-item-description">{item.description}</p>
                    <div className="widget-item-footer">
                      <span className="widget-item-price">
                        {item.price.toLocaleString('fr-FR')} FCFA
                      </span>
                      <button
                        onClick={() => addToCart(item)}
                        className="widget-add-btn"
                        style={{ backgroundColor: 'var(--widget-primary)' }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {config.view === 'commande' && (
          <div className="widget-order">
            <h2 className="widget-section-title">Votre Commande</h2>
            
            {cart.length === 0 ? (
              <div className="widget-empty-cart">
                <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Votre panier est vide</p>
                <button
                  onClick={() => setConfig(prev => ({ ...prev, view: 'menu' }))}
                  className="widget-btn"
                  style={{ backgroundColor: 'var(--widget-primary)' }}
                >
                  Voir le menu
                </button>
              </div>
            ) : (
              <div className="widget-cart-items">
                {cart.map(item => (
                  <div key={item.id} className="widget-cart-item">
                    <div className="flex-1">
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-gray-600">
                        {(item.price * item.quantity).toLocaleString('fr-FR')} FCFA
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="widget-quantity-btn"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="widget-quantity-btn"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                <div className="widget-cart-summary">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-medium">Total:</span>
                    <span className="font-bold text-lg">
                      {getTotalPrice().toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                  <button
                    onClick={startOrder}
                    className="widget-btn w-full"
                    style={{ backgroundColor: 'var(--widget-primary)' }}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Passer la commande
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {config.view === 'reservation' && (
          <div className="widget-reservation">
            <h2 className="widget-section-title">Faire une Réservation</h2>
            
            <div className="widget-reservation-form">
              <div className="widget-form-group">
                <label>Nom complet</label>
                <input
                  type="text"
                  value={reservationData.name}
                  onChange={(e) => setReservationData(prev => ({ ...prev, name: e.target.value }))}
                  className="widget-input"
                  placeholder="Votre nom"
                />
              </div>
              
              <div className="widget-form-group">
                <label>Téléphone</label>
                <input
                  type="tel"
                  value={reservationData.phone}
                  onChange={(e) => setReservationData(prev => ({ ...prev, phone: e.target.value }))}
                  className="widget-input"
                  placeholder="+229 XX XX XX XX"
                />
              </div>
              
              <div className="widget-form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={reservationData.email}
                  onChange={(e) => setReservationData(prev => ({ ...prev, email: e.target.value }))}
                  className="widget-input"
                  placeholder="votre@email.com"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="widget-form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={reservationData.date}
                    onChange={(e) => setReservationData(prev => ({ ...prev, date: e.target.value }))}
                    className="widget-input"
                  />
                </div>
                
                <div className="widget-form-group">
                  <label>Heure</label>
                  <input
                    type="time"
                    value={reservationData.time}
                    onChange={(e) => setReservationData(prev => ({ ...prev, time: e.target.value }))}
                    className="widget-input"
                  />
                </div>
              </div>
              
              <div className="widget-form-group">
                <label>Nombre de personnes</label>
                <select
                  value={reservationData.guests}
                  onChange={(e) => setReservationData(prev => ({ ...prev, guests: e.target.value }))}
                  className="widget-input"
                >
                  <option value="1">1 personne</option>
                  <option value="2">2 personnes</option>
                  <option value="3">3 personnes</option>
                  <option value="4">4 personnes</option>
                  <option value="5">5 personnes</option>
                  <option value="6">6 personnes</option>
                  <option value="7">7 personnes</option>
                  <option value="8">8 personnes</option>
                </select>
              </div>
              
              <div className="widget-form-group">
                <label>Notes (optionnel)</label>
                <textarea
                  value={reservationData.notes}
                  onChange={(e) => setReservationData(prev => ({ ...prev, notes: e.target.value }))}
                  className="widget-textarea"
                  placeholder="Demandes spéciales..."
                  rows={3}
                />
              </div>
              
              <button
                onClick={submitReservation}
                className="widget-btn w-full"
                style={{ backgroundColor: 'var(--widget-primary)' }}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Confirmer la réservation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Widget */}
      <div className="widget-footer">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Propulsé par</span>
            <span className="font-medium" style={{ color: 'var(--widget-primary)' }}>RESTAFY</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const currentTheme = config.theme === 'light' ? 'dark' : 'light';
                setConfig(prev => ({ ...prev, theme: currentTheme }));
              }}
              className="widget-theme-toggle"
            >
              {config.theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
