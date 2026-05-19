// src/pages/RestaurantPreview.tsx
// ✅ Colonnes alignées sur useRestaurant.ts (confirmées sur la home)
// ✅ Timeout 8s anti-freeze
// ✅ Tous les champs cart corrigés (itemId/itemName/unitPrice)

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useCartStore } from '@/hooks/useOrderCart';
import {
  Plus, Minus, ShoppingCart, ExternalLink,
  MapPin, Clock, Star, UtensilsCrossed, ArrowRight,
  AlertCircle, RefreshCw,
} from 'lucide-react';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import { supabase } from '@/lib/supabase';
import { swrFetch } from '@/lib/swrCache';

interface Restaurant {
  id: string; name: string; slug: string | null;
  logo_url: string | null; banner_url: string | null;
  cuisine_type: string | null; description: string | null;
  city: string | null; address: string | null; phone: string | null;
  avg_rating: number | null; total_reviews: number | null;
  delivery_time_min: number | null; delivery_time_max: number | null;
  delivery_fee: number | null; min_order: number | null;
  is_open: boolean | null; is_active: boolean | null;
}
interface Category { id: string; name: string; sort_order: number | null; }
interface MenuItem {
  id: string; name: string; description: string | null;
  price: number; category_id: string | null;
  image_url: string | null; is_available: boolean;
}

function fmt(p: number) {
  return `${Math.round(p).toLocaleString('fr-FR')} FCFA`;
}

// Timeout helper — évite le freeze infini si Supabase répond pas
function withTimeout<T>(promise: Promise<T>, ms = 22_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms)
    ),
  ]);
}

const RESERVED_RESTAURANT_SEGMENTS: Record<string, string> = {
  r: '/',
  dashboard: '/restaurant/dashboard',
  login: '/restaurant/login',
  signup: '/restaurant/signup',
};

export default function RestaurantPreview() {
  const params = useParams<{ id?: string; slug?: string }>();
  const identifier = params.id ?? params.slug ?? '';
  const navigate = useNavigate();
  const reservedRedirect =
    params.id != null && params.id !== ''
      ? RESERVED_RESTAURANT_SEGMENTS[params.id.toLowerCase()]
      : undefined;

  // Legacy /@slug (un seul segment) → page complète /r/slug
  useEffect(() => {
    if (identifier.startsWith('@')) {
      navigate(`/r/${identifier.slice(1)}`, { replace: true });
    }
  }, [identifier, navigate]);
  const { addItem, updateItemQuantity, setRestaurant, items: cartItems } = useCartStore();

  const [restaurant, setResto] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    if (params.id && RESERVED_RESTAURANT_SEGMENTS[params.id.toLowerCase()]) {
      setLoading(false);
      return;
    }
    if (!identifier) {
      setLoading(false);
      return;
    }
    if (identifier.startsWith('@')) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setLoading(true);

    (async () => {
      try {
        // ✅ Colonnes exactes de useRestaurant.ts — confirmées fonctionnelles sur la home
        const COLS = 'id,name,slug,logo_url,banner_url,cuisine_type,description,phone,avg_rating,delivery_time_min,delivery_time_max,delivery_fee,min_order,is_active,total_reviews,address,city,is_open';
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        let rest: Restaurant | null = null;

        if (uuidRe.test(identifier)) {
          try {
            rest = await swrFetch<Restaurant | null>(
              `restaurant:id:${identifier}`,
              async () => {
                const { data, error: e } = await withTimeout(
                  Promise.resolve(
                    supabase.from('restaurants').select(COLS).eq('id', identifier).maybeSingle(),
                  ),
                );
                if (e) throw new Error(e.message);
                return (data as Restaurant | null) ?? null;
              },
              { ttlMs: 60_000, staleMs: 600_000 },
            );
          } catch (e) {
            console.warn('[Preview] by id:', (e as Error).message);
          }
        }

        if (!rest) {
          try {
            rest = await swrFetch<Restaurant | null>(
              `restaurant:slug:${identifier}`,
              async () => {
                const { data, error: e } = await withTimeout(
                  Promise.resolve(
                    supabase.from('restaurants').select(COLS).eq('slug', identifier).maybeSingle(),
                  ),
                );
                if (e) throw e;
                return (data as Restaurant | null) ?? null;
              },
              { ttlMs: 60_000, staleMs: 600_000 },
            );
          } catch (err) {
            const e = err as { code?: string; message?: string };
            if (!cancelled) {
              setError(`Erreur chargement restaurant (${e.code ?? e.message ?? 'unknown'})`);
              setLoading(false);
            }
            return;
          }
        }

        if (cancelled) return;
        if (!rest) { setLoading(false); return; }
        setResto(rest);

        const restoId = rest.id;
        const [cats, items] = await Promise.all([
          swrFetch<Category[]>(
            `menu:categories:${restoId}`,
            async () => {
              const { data, error: e } = await withTimeout(
                Promise.resolve(
                  supabase
                    .from('categories')
                    .select('id,name,sort_order')
                    .eq('restaurant_id', restoId)
                    .order('sort_order'),
                ),
              );
              // throw plutôt que data ?? [] pour ne PAS cacher un [] de fallback :
              // swrFetch ne cache pas les rejections, le caller voit l'erreur
              // et l'utilisateur peut retry au lieu d'avoir un menu vide pendant 10 min.
              if (e) throw e;
              return (data ?? []) as Category[];
            },
            { ttlMs: 60_000, staleMs: 600_000 },
          ),
          swrFetch<MenuItem[]>(
            `menu:items:${restoId}`,
            async () => {
              const { data, error: e } = await withTimeout(
                Promise.resolve(
                  supabase
                    .from('items')
                    .select('id,name,description,price,category_id,image_url,is_available')
                    .eq('restaurant_id', restoId)
                    .eq('is_available', true)
                    .order('created_at'),
                ),
              );
              if (e) throw e;
              return (data ?? []) as MenuItem[];
            },
            { ttlMs: 60_000, staleMs: 600_000 },
          ),
        ]);

        if (cancelled) return;
        setCategories(cats);
        setMenuItems(items);
        if (cats.length > 0) setActiveCategory(cats[0].id);

      } catch (err: unknown) {
        if (import.meta.env.DEV) console.error('[Preview] error:', err);
        if (!cancelled) setError('Impossible de charger le restaurant');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [identifier]);

  if (reservedRedirect) return <Navigate to={reservedRedirect} replace />;

  if (loading) return <RestafyLoader />;

  if (error) return (
    <div className="h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="text-center space-y-4 max-w-sm">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <p className="text-zinc-700 font-semibold">Impossible de charger le restaurant</p>
        <p className="text-xs text-zinc-400 font-mono bg-zinc-100 px-3 py-2 rounded-lg break-all">{error}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setError(null); setLoading(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600">
            <RefreshCw size={14} /> Réessayer
          </button>
          <button onClick={() => navigate('/')}
            className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-semibold hover:bg-zinc-200">
            Accueil
          </button>
        </div>
      </div>
    </div>
  );

  if (!restaurant) return (
    <div className="h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="text-center space-y-3">
        <UtensilsCrossed className="w-12 h-12 text-zinc-300 mx-auto" />
        <p className="text-zinc-700 font-semibold">Restaurant introuvable</p>
        <p className="text-xs text-zinc-400">Aucun restaurant avec le lien <span className="font-mono">@{identifier}</span></p>
        <button onClick={() => navigate('/')} className="text-orange-600 hover:underline text-sm font-medium">
          Retour à l'accueil
        </button>
      </div>
    </div>
  );

  const getQty = (itemId: string) => cartItems.find(i => i.itemId === itemId)?.quantity ?? 0;
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const catWithItems = categories.filter(c => menuItems.some(m => m.category_id === c.id));
  const visibleItems = activeCategory ? menuItems.filter(m => m.category_id === activeCategory) : menuItems;
  const slug = restaurant.slug || restaurant.id;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col" style={{ maxWidth: 640, margin: '0 auto' }}>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        {restaurant.logo_url ? (
          <img src={restaurant.logo_url} alt={restaurant.name}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-zinc-100" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-black flex-shrink-0 text-sm">
            {restaurant.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-zinc-900 truncate text-sm">{restaurant.name}</h2>
          {restaurant.cuisine_type && <p className="text-xs text-zinc-400 truncate">{restaurant.cuisine_type}</p>}
        </div>
        <button onClick={() => navigate(`/r/${slug}`)}
          className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-zinc-100 hover:bg-orange-100 text-zinc-500 hover:text-orange-600 rounded-full transition-colors"
          title="Voir la page complète">
          <ExternalLink size={16} />
        </button>
      </div>

      {/* Cover */}
      {restaurant.banner_url && (
        <div className="relative h-36 overflow-hidden flex-shrink-0">
          <img src={restaurant.banner_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      )}

      {/* Infos (données réelles Supabase) */}
      <div className="bg-white px-4 py-2.5 flex items-center gap-4 text-xs text-zinc-500 border-b border-zinc-100 flex-wrap flex-shrink-0">
        {(restaurant.avg_rating ?? 0) > 0 && (
          <span className="flex items-center gap-1 font-semibold text-amber-600">
            <Star className="w-3.5 h-3.5 fill-amber-400" />{(restaurant.avg_rating ?? 0).toFixed(1)}
          </span>
        )}
        {restaurant.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{restaurant.city}</span>}
        {restaurant.delivery_time_min != null && restaurant.delivery_time_max != null && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />{restaurant.delivery_time_min}–{restaurant.delivery_time_max} min
          </span>
        )}
        {typeof restaurant.delivery_fee === 'number' && (
          <span className={restaurant.delivery_fee === 0 ? 'text-emerald-600 font-semibold' : ''}>
            {restaurant.delivery_fee === 0 ? 'Livraison gratuite' : `+ ${fmt(restaurant.delivery_fee)} livr.`}
          </span>
        )}
        <span className={`ml-auto font-semibold ${restaurant.is_open === false ? 'text-red-500' : 'text-emerald-500'}`}>
          ● {restaurant.is_open === false ? 'Fermé' : 'Ouvert'}
        </span>
      </div>
      {restaurant.description && (
        <p className="px-4 py-2 text-xs text-zinc-600 bg-white border-b border-zinc-100 leading-relaxed line-clamp-3">
          {restaurant.description}
        </p>
      )}

      {/* Catégories */}
      {catWithItems.length > 0 && (
        <div className="sticky top-[57px] z-30 bg-white border-b border-zinc-100 overflow-x-auto flex gap-1.5 px-3 py-2 flex-shrink-0"
          style={{ scrollbarWidth: 'none' }}>
          {catWithItems.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeCategory === cat.id ? 'bg-orange-500 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}>
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Items */}
      <div className="flex-1 p-4 space-y-3 pb-32">
        {visibleItems.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucun plat disponible</p>
          </div>
        ) : visibleItems.map(item => {
          const qty = getQty(item.id);
          return (
            <div key={item.id} className="bg-white rounded-2xl border border-zinc-100 flex gap-3 p-3 shadow-sm hover:shadow-md transition-shadow">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name}
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0" loading="lazy" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 flex-shrink-0 flex items-center justify-center">
                  <UtensilsCrossed className="w-7 h-7 text-zinc-300" />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <p className="font-semibold text-zinc-900 text-sm leading-tight">{item.name}</p>
                  {item.description && <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{item.description}</p>}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="font-bold text-orange-600 text-sm">{fmt(item.price)}</p>
                  {qty === 0 ? (
                    <button onClick={() => {
                      setRestaurant({ restaurantId: restaurant.id, restaurantName: restaurant.name });
                      addItem({ itemId: item.id, itemName: item.name, unitPrice: item.price, quantity: 1 });
                    }} className="w-8 h-8 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-colors shadow-sm">
                      <Plus size={15} />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateItemQuantity(item.id, qty - 1)}
                        className="w-7 h-7 bg-zinc-100 hover:bg-zinc-200 rounded-full flex items-center justify-center">
                        <Minus size={13} />
                      </button>
                      <span className="text-sm font-bold text-zinc-900 w-5 text-center">{qty}</span>
                      <button onClick={() => addItem({ itemId: item.id, itemName: item.name, unitPrice: item.price, quantity: 1 })}
                        className="w-7 h-7 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center">
                        <Plus size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <button onClick={() => navigate(`/r/${slug}`)}
          className="flex items-center justify-between w-full px-5 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/25 hover:opacity-95 transition-opacity mt-4">
          <div>
            <p className="text-sm font-black">Voir le menu complet</p>
            <p className="text-xs text-orange-100 font-normal mt-0.5">Avis, réservations, horaires & plus</p>
          </div>
          <ArrowRight className="w-5 h-5 flex-shrink-0" />
        </button>
      </div>

      {/* Panier */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full z-50 px-4" style={{ maxWidth: 640 }}>
          <button onClick={() => navigate('/cart')}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-4 rounded-2xl font-bold flex items-center justify-between px-5 shadow-xl transition-colors">
            <span className="flex items-center gap-2">
              <ShoppingCart size={18} />
              <span className="text-sm">{cartCount} article{cartCount > 1 ? 's' : ''}</span>
            </span>
            <span className="text-sm font-bold">{fmt(cartTotal)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
