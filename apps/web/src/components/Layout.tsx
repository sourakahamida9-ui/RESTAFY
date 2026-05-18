// ✅ BUG FIX #4 : Responsive corrigé — plus de max-w-md qui centralisait en mode mobile sur desktop
// Le site est maintenant full-width sur desktop et centré en mobile-first
import React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Calendar, Ticket, Award, ShoppingBag,
  Bell, UtensilsCrossed, ShoppingCart, User, LogIn
} from 'lucide-react';
import { ClientNavbar } from './client/ClientNavbar';
import { useUserStore } from '../store/useUserStore';
import { useCartStore } from '../store/useCartStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import {
  preloadCart,
  preloadEventMarketplace,
  preloadHome,
  preloadLogin,
  preloadLoyalty,
  preloadMyTickets,
  preloadNotifications,
  preloadOrders,
  preloadProfile,
} from '@/lib/routePreloads';
import { OptimizedImg } from '@/components/OptimizedImg';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const prefetchByTo: Record<string, () => void> = {
  '/': preloadHome,
  // '/events': preloadEventMarketplace, // hidden — OMS focus
  '/mes-billets': preloadMyTickets,
  '/fidelite': preloadLoyalty,
  '/orders': preloadOrders,
  '/notifications': preloadNotifications,
  '/profile': preloadProfile,
  '/profil': preloadProfile,
  '/cart': preloadCart,
  '/login': preloadLogin,
};

export default function Layout() {
  const location = useUserStore((s) => s.location);
  const cartItems = useCartStore((s) => s.items);
  const cartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);
  const unreadCount = useNotificationStore((s) => s.unreadCount());
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const currentLocation = useLocation();

  const isCartPage = currentLocation.pathname === '/cart';
  const isRestaurantDetail = /^\/(r\/[^/]+|restaurant\/[^/]+)/.test(currentLocation.pathname);
  const showFloatingCart = cartCount > 0 && !isCartPage && !isRestaurantDetail;

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  return (
    // Padding bas : nav mobile (+ safe area) ; si panier flottant, place pour la barre au-dessus de la nav
    <div
      className={cn(
        'min-h-screen bg-paper',
        showFloatingCart
          ? 'pb-[max(11rem,calc(10rem+env(safe-area-inset-bottom,0px)))] lg:pb-36'
          : 'pb-[max(5.5rem,calc(4.75rem+env(safe-area-inset-bottom,0px)))] lg:pb-8',
      )}
    >

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-100">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-3 flex items-center justify-between">
          {/* Logo + localisation */}
          <div className="flex items-center gap-4 lg:gap-8">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2 min-h-11 py-1 cursor-pointer text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Restafy — retour à l’accueil"
            >
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/20">
                <UtensilsCrossed className="text-white w-4 h-4" aria-hidden />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 leading-none">
                  Découvrir à
                </span>
                <span className="text-sm font-bold truncate max-w-[160px]">{location}</span>
              </div>
            </button>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1">
              <NavLink
                to="/"
                end
                onMouseEnter={() => prefetchByTo['/']?.()}
                className={({ isActive }) =>
                  cn('px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                    isActive ? 'bg-primary/10 text-primary' : 'text-zinc-600 hover:bg-zinc-100')
                }
              >
                Restaurants
              </NavLink>
              <NavLink
                to="/scan"
                className={({ isActive }) =>
                  cn('px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                    isActive ? 'bg-primary/10 text-primary' : 'text-zinc-600 hover:bg-zinc-100')
                }
              >
                Scanner
              </NavLink>
              {user && (
                <>
                  <NavLink
                    to="/mes-billets"
                    onMouseEnter={() => prefetchByTo['/mes-billets']?.()}
                    className={({ isActive }) =>
                      cn('px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'text-zinc-600 hover:bg-zinc-100')
                    }
                  >
                    Mes Billets
                  </NavLink>
                  <NavLink
                    to="/fidelite"
                    onMouseEnter={() => prefetchByTo['/fidelite']?.()}
                    className={({ isActive }) =>
                      cn('px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'text-zinc-600 hover:bg-zinc-100')
                    }
                  >
                    Fidelite
                  </NavLink>
                  <NavLink
                    to="/orders"
                    onMouseEnter={() => prefetchByTo['/orders']?.()}
                    className={({ isActive }) =>
                      cn('px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                        isActive ? 'bg-primary/10 text-primary' : 'text-zinc-600 hover:bg-zinc-100')
                    }
                  >
                    Mes Commandes
                  </NavLink>
                </>
              )}
            </nav>
          </div>

          {/* Actions header */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <NavLink
                  to="/notifications"
                  onMouseEnter={() => prefetchByTo['/notifications']?.()}
                  className="relative inline-flex items-center justify-center w-11 h-11 bg-zinc-100 rounded-full"
                  aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : 'Notifications'}
                >
                  <Bell className="w-5 h-5 text-zinc-600" aria-hidden />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </NavLink>
                <NavLink
                  to="/cart"
                  onMouseEnter={() => prefetchByTo['/cart']?.()}
                  className="relative inline-flex items-center justify-center w-11 h-11 bg-zinc-100 rounded-full"
                  aria-label={cartCount > 0 ? `Panier, ${cartCount} article${cartCount > 1 ? 's' : ''}` : 'Panier'}
                >
                  <ShoppingCart className="w-5 h-5 text-zinc-600" aria-hidden />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                      {cartCount}
                    </span>
                  )}
                </NavLink>
                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  onMouseEnter={() => prefetchByTo['/profile']?.()}
                  aria-label="Mon profil"
                  className="w-11 h-11 bg-gradient-to-br from-primary to-orange-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm hover:opacity-90 transition-opacity overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {profile?.avatar_url ? (
                    <OptimizedImg
                      src={profile.avatar_url}
                      alt=""
                      sizes="32px"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitials()
                  )}
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to="/cart"
                  onMouseEnter={() => prefetchByTo['/cart']?.()}
                  className="relative inline-flex items-center justify-center w-11 h-11 bg-zinc-100 rounded-full"
                  aria-label={cartCount > 0 ? `Panier, ${cartCount} article${cartCount > 1 ? 's' : ''}` : 'Panier'}
                >
                  <ShoppingCart className="w-5 h-5 text-zinc-600" aria-hidden />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                      {cartCount}
                    </span>
                  )}
                </NavLink>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-1.5 min-h-11 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-full hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <LogIn className="w-4 h-4 shrink-0" aria-hidden />
                  <span>Connexion</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Contenu principal ─────────────────────────────────────────── */}
      {/*
        ✅ FIX RESPONSIVE :
        - Mobile  (<640px)  : pleine largeur, pas de padding horizontal
        - Tablet  (640-1024): padding horizontal raisonnable, max-w-2xl
        - Desktop (>1024px) : max-w-screen-xl centré, padding confortable
        Plus de max-w-md fixe qui rendait le site comme une app mobile sur desktop !
      */}
      <main className="w-full max-w-screen-xl mx-auto px-0 sm:px-4 lg:px-8">
        <ErrorBoundary level="section">
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* ── Barre de panier flottante (mobile : au-dessus de la tab bar ; z-index < nav pour ne pas la masquer) ── */}
      {showFloatingCart && (
        <div
          className={cn(
            'fixed left-0 right-0 z-40 px-4',
            // Au-dessus de la nav (~4.5–5rem) + encoche iPhone / Android
            'max-lg:[bottom:max(5.75rem,calc(4.85rem+env(safe-area-inset-bottom,0px)))]',
            'lg:bottom-8 lg:z-50',
          )}
        >
          <div className="max-w-screen-xl mx-auto">
            <button
              type="button"
              aria-label={`Ouvrir le panier, ${cartCount} article${cartCount > 1 ? 's' : ''}`}
              onClick={() => navigate('/cart')}
              onMouseEnter={() => prefetchByTo['/cart']?.()}
              className="w-full cursor-pointer rounded-2xl border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
            <div className="bg-slate-800 text-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-xl ring-1 ring-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center" aria-hidden>
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wide">Votre panier</span>
                  <p className="text-sm font-medium">{cartCount} article{cartCount > 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-primary font-bold text-lg">
                  {cartItems.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0).toLocaleString('fr-FR')} F
                </span>
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white text-xl font-bold">›</span>
                </div>
              </div>
            </div>
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom Navigation (MOBILE ONLY) ── */}
      <ClientNavbar />
    </div>
  );
}
