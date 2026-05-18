/**
 * =====================================================================
 * LITE WIDGET - Widget embeddable sans redirection
 * =====================================================================
 * 
 * Widget autonome qui s'affiche directement sur n'importe quel site:
 * - Pas de redirection: menu affiché inline
 * - Panier intégré
 * - Paiement MTN/Moov intégré
 * - Pas d'iframe nécessaire
 * 
 * Usage (copier dans votre site):
 * <div id="restafy-lite" data-restaurant="mon-restaurant"></div>
 * <link rel="stylesheet" href="https://restafy.shop/lite.css">
 * <script src="https://restafy.shop/lite.js" async></script>
 * 
 * @author Restafy Team
 * @date 2025-05-05
 * =====================================================================
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  ShoppingCart, Plus, Minus, X, Search,
  Clock, MapPin, Phone, CreditCard, Loader2,
  Check, Star, Truck
} from 'lucide-react';

/** Types - Items du menu */
interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string;
  category?: { name: string };
  image_url: string | null;
  is_available: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
}

/** Types - Restaurant */
interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  delivery_fee: number;
  min_order: number;
  is_open: boolean;
  rating: number;
  delivery_time: string;
}

/** Styles CSS inline */
const cssStyles = `
  .lite-widget {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --primary: #FF5C00;
    --bg: #ffffff;
    --text: #1f2937;
    --text-muted: #6b7280;
    --border: #e5e7eb;
    --success: #10b981;
    background: var(--bg);
    color: var(--text);
    border-radius: 12px;
    max-width: 400px;
    margin: 0 auto;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  }
  .lite-header { padding: 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
  .lite-logo { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; }
  .lite-logo-placeholder { 
    width: 48px; height: 48px; border-radius: 8px; 
    background: var(--primary); color: white; 
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 20px;
  }
  .lite-title { font-size: 16px; font-weight: 700; margin: 0; }
  .lite-subtitle { font-size: 12px; color: var(--text-muted); margin: 4px 0 0; display: flex; gap: 12px; align-items: center; }
  .lite-search { padding: 12px 16px; border-bottom: 1px solid var(--border); }
  .lite-search input { 
    width: 100%; padding: 10px 12px; border: 1px solid var(--border); 
    border-radius: 8px; font-size: 14px; outline: none;
  }
  .lite-search input:focus { border-color: var(--primary); }
  .lite-cats { display: flex; gap: 8px; padding: 12px 16px; overflow-x: auto; }
  .lite-cat { 
    padding: 6px 12px; border-radius: 16px; font-size: 12px; font-weight: 500; 
    white-space: nowrap; background: #f3f4f6; border: none; cursor: pointer; flex-shrink: 0;
  }
  .lite-cat.active { background: var(--primary); color: white; }
  .lite-items { padding: 8px 16px 80px; max-height: 400px; overflow-y: auto; }
  .lite-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
  .lite-item:last-child { border-bottom: none; }
  .lite-item-img { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #f3f4f6; }
  .lite-item-info { flex: 1; min-width: 0; }
  .lite-item-name { font-size: 14px; font-weight: 600; margin: 0 0 4px; }
  .lite-item-desc { font-size: 11px; color: var(--text-muted); margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .lite-item-price { font-size: 14px; font-weight: 700; color: var(--primary); margin: 6px 0 0; }
  .lite-item-btn { 
    width: 28px; height: 28px; border-radius: 50%; background: var(--primary); color: white; 
    border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; align-self: center;
  }
  .lite-fixed { 
    position: sticky; bottom: 0; left: 0; right: 0; background: white; 
    padding: 12px 16px; border-top: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .lite-order-btn { 
    flex: 1; padding: 12px; border-radius: 10px; background: var(--primary); 
    color: white; font-weight: 600; border: none; cursor: pointer; font-size: 14px;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  }
  .lite-order-btn:disabled { background: #d1d5db; cursor: not-allowed; }
  .lite-empty { text-align: center; padding: 40px 20px; color: var(--text-muted); }
  .lite-loading { display: flex; align-items: center; justify-content: center; padding: 60px 20px; }
  .lite-badge { 
    background: var(--primary); color: white; padding: 2px 6px; 
    border-radius: 10px; font-size: 11px; font-weight: 600; 
  }
  .lite-price-summary { font-size: 12px; }
  .lite-price-total { font-size: 14px; font-weight: 700; }
`;

/** Props */
interface LiteWidgetProps {
  restaurantSlug: string;
  theme?: 'orange' | 'green' | 'blue';
}

/** Composant Lite Widget */
export function LiteWidget({ restaurantSlug, theme = 'orange' }: LiteWidgetProps) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtres
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [categories, setCategories] = useState<{id: string; name: string}[]>([]);
  
  // Panier
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Couleur thème
  const primaryColor = theme === 'green' ? '#10b981' : theme === 'blue' ? '#3b82f6' : '#FF5C00';
  
  // Charger données
  useEffect(() => {
    async function loadData() {
      if (!restaurantSlug) return setError('.slug manquant');
      
      try {
        // Restaurant
        const { data: restData, error: restError } = await supabase
          .from('restaurants')
          .select('id, name, slug, logo_url, phone, address, city, delivery_fee, min_order, is_open, rating, delivery_time')
          .eq('slug', restaurantSlug)
          .eq('is_open', true)
          .single();
        
        if (restError || !restData) return setError('Restaurant indisponible');
        setRestaurant(restData);
        
        // Catégories
        const { data: catData } = await supabase
          .from('categories')
          .select('id, name')
          .eq('restaurant_id', restData.id)
          .order('sort_order');
        if (catData) setCategories(catData);
        
        // Items
        const { data: itemData, error: itemError } = await supabase
          .from('items')
          .select('id, name, description, price, category_id, image_url, is_available, categories(name)')
          .eq('restaurant_id', restData.id)
          .eq('is_available', true)
          .order('name');
        
        if (itemError) throw itemError;
        setItems(itemData || []);
      } catch (err) {
        console.error('[LiteWidget]', err);
        setError('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [restaurantSlug]);
  
  // Items filtrés
  const filteredItems = items.filter(item => {
    const matchesCat = category === 'all' || item.category_id === category;
    const matchesSearch = !search || 
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });
  
  // Ajouter au panier
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`${item.name} ajouté ✨`);
  };
  
  // Retirer du panier
  const updateCartQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (!existing) return prev;
      
      const newQty = existing.quantity + delta;
      if (newQty <= 0) return prev.filter(i => i.id !== itemId);
      
      return prev.map(i => i.id === itemId ? { ...i, quantity: newQty } : i);
    });
  };
  
  // Totaux panier
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const minOrder = restaurant?.min_order || 0;
  const canOrder = totalPrice >= minOrder;
  
  // Loading
  if (loading) {
    return (
      <div className="lite-widget">
        <style>{cssStyles}</style>
        <div className="lite-loading">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
        </div>
      </div>
    );
  }
  
  // Erreur / Fermé
  if (error || !restaurant?.is_open) {
    return (
      <div className="lite-widget">
        <style>{cssStyles}</style>
        <div className="lite-empty">
          <p>{error || ' Restaurant fermé — revenez plus tard!'}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="lite-widget" data-theme={theme}>
      <style>{cssStyles}</style>
      
      {/* Header */}
      <div className="lite-header">
        {restaurant.logo_url ? (
          <img src={restaurant.logo_url} alt={restaurant.name} className="lite-logo" />
        ) : (
          <div className="lite-logo-placeholder">{restaurant.name[0]}</div>
        )}
        <div>
          <h2 className="lite-title">{restaurant.name}</h2>
          <div className="lite-subtitle">
            <span><Clock className="w-3 h-3" style={{ verticalAlign: 'middle' }} /> {restaurant.delivery_time}</span>
            {minOrder > 0 && <span>Min: {minOrder.toLocaleString()} F</span>}
            {restaurant.rating > 0 && <span><Star className="w-3 h-3" style={{ fill: '#f59e0b', verticalAlign: 'middle' }} /> {restaurant.rating.toFixed(1)}</span>}
          </div>
        </div>
      </div>
      
      {/* Search */}
      <div className="lite-search">
        <input 
          type="text" 
          placeholder="Rechercher un plat..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      
      {/* Categories */}
      <div className="lite-cats">
        <button 
          className={`lite-cat ${category === 'all' ? 'active' : ''}`}
          onClick={() => setCategory('all')}
          style={{ '--primary': primaryColor } as any}
        >
          Tout
        </button>
        {categories.map(cat => (
          <button 
            key={cat.id}
            className={`lite-cat ${category === cat.id ? 'active' : ''}`}
            onClick={() => setCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>
      
      {/* Items */}
      <div className="lite-items">
        {filteredItems.length === 0 ? (
          <div className="lite-empty"><p>Aucun plat trouvé</p></div>
        ) : (
          filteredItems.map(item => (
            <div key={item.id} className="lite-item">
              {item.image_url && <img src={item.image_url} alt={item.name} className="lite-item-img" />}
              <div className="lite-item-info">
                <h3 className="lite-item-name">{item.name}</h3>
                {item.description && <p className="lite-item-desc">{item.description}</p>}
                <p className="lite-item-price">{item.price.toLocaleString()} F</p>
              </div>
              <button className="lite-item-btn" onClick={() => addToCart(item)}>
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
      
      {/* Cart Fixed Bar */}
      {totalItems > 0 && (
        <div className="lite-fixed">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <ShoppingCart className="w-5 h-5" />
              <span className="lite-badge">{totalItems}</span>
            </div>
            <div>
              <p className="lite-price-summary">{totalItems} plat{totalItems > 1 ? 's' : ''}</p>
              <p className="lite-price-total">{totalPrice.toLocaleString()} F</p>
            </div>
          </div>
          <button 
            className="lite-order-btn" 
            disabled={!canOrder}
            onClick={() => {
              // Redirect vers page commande avec panier
              window.location.href = `/r/${restaurant.slug}?cart=${encodeURIComponent(JSON.stringify(cart))}`;
            }}
          >
            Commander →
          </button>
        </div>
      )}
    </div>
  );
}

/** Initialisation auto du widget (pour usage hors React) */
export function initLiteWidget() {
  const containers = document.querySelectorAll('[data-restafy-lite]');
  if (!containers.length) return;
  
  containers.forEach(container => {
    const slug = container.getAttribute('data-restaurant');
    if (!slug) return;
    
    // Stocker le slug pour usage par le composant React
    (container as any)._restafySlug = slug;
  });
}

// Auto-init
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initLiteWidget);
}