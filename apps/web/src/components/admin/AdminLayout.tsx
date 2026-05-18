// src/components/admin/AdminLayout.tsx — Restafy Dashboard v4
// Afro-moderne design — sidebar claire, header épuré, palette terracotta-sauge

import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Utensils, BookOpen, Users,
  BarChart3, Tag, Link2, Settings, ShoppingCart, Store, Landmark,
  X, ListOrdered, ChefHat,
  Flame, Power, ChevronLeft, ChevronRight, Code2, LogOut,
  Grid3X3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { PWAInstallPrompt, useIsPWAInstalled } from '../PWAInstallPrompt';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRestaurantId } from '@/hooks/useAdminRestaurantId';
import {
  hasFullRestaurantNav,
  isKitchenStaffRole,
  isRestaurantOpsAllowedPath,
  isRestaurantOpsOnlyUser,
  normalizeDashboardRole,
} from '@/lib/restaurantAdminAccess';
import { getTeamRoleDefinition } from '@/lib/teamRoles';
import { supabase } from '@/lib/supabase';
import NotificationCenter from '../NotificationCenter';
import { RestaurantNavbar } from '@/components/restaurant/RestaurantNavbar';
import { RestaurantThemeProvider, useRestaurantTheme } from '@/context/RestaurantThemeContext';
import { RealtimeStatusProvider } from '@/context/RealtimeStatusContext';
import { RealtimeStatusBanner } from './RealtimeStatusBanner';
import { RestaurantThemeToggle } from './RestaurantThemeToggle';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Navigation principale — une seule entrée par destination.
 * Évite les doublons (anciennement "Commandes" + "Liste commandes", "Équipe" + "Scan Équipe").
 */
const NAV = [
  { to: '/restaurant/dashboard',              icon: LayoutDashboard, label: 'Vue d\u2019ensemble', exact: true },
  { to: '/restaurant/dashboard/orders',       icon: ListOrdered,     label: 'Commandes' },
  { to: '/restaurant/dashboard/pos',          icon: ShoppingCart,    label: 'Caisse' },
  { to: '/restaurant/dashboard/menu',         icon: Utensils,        label: 'Menu' },
  { to: '/restaurant/dashboard/reservations', icon: BookOpen,        label: 'Réservations' },
  { to: '/restaurant/dashboard/tables',       icon: Grid3X3,        label: 'Tables' },
  { to: '/restaurant/dashboard/team',         icon: Users,           label: 'Équipe' },
  { to: '/restaurant/dashboard/analytics',    icon: BarChart3,       label: 'Statistiques' },
  { to: '/restaurant/dashboard/payout',       icon: Landmark,        label: 'Revenus' },
  { to: '/restaurant/dashboard/promos',       icon: Tag,             label: 'Promos' },
  { to: '/restaurant/dashboard/slug',         icon: Link2,           label: 'Lien & QR' },
  { to: '/restaurant/dashboard/integration',  icon: Code2,           label: 'Intégration' },
  { to: '/restaurant/dashboard/settings',     icon: Settings,        label: 'Paramètres' },
];

/** Membres équipe (cuisine, salle, livreur) : flux commandes uniquement. */
const NAV_OPS: typeof NAV = [
  { to: '/restaurant/dashboard',        icon: LayoutDashboard, label: 'Commandes live', exact: true },
  { to: '/restaurant/dashboard/orders', icon: ListOrdered,     label: 'Toutes les commandes' },
  { to: '/restaurant/dashboard/pos',    icon: ShoppingCart,    label: 'Caisse' },
];

/** Membres équipe « cuisine » (chef / staff) : ajoute la Kitchen View. */
const NAV_OPS_KITCHEN: typeof NAV = [
  { to: '/restaurant/dashboard',         icon: LayoutDashboard, label: 'Commandes live', exact: true },
  { to: '/restaurant/dashboard/kitchen', icon: ChefHat,         label: 'Cuisine' },
  { to: '/restaurant/dashboard/orders',  icon: ListOrdered,     label: 'Toutes les commandes' },
  { to: '/restaurant/dashboard/pos',     icon: ShoppingCart,    label: 'Caisse' },
];

function AdminLayoutShell() {
  const { theme } = useRestaurantTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [pending, setPending] = useState(0);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const location = useLocation();
  const navigate = useNavigate();
  const isPWA = useIsPWAInstalled();
  const { user, profile, staffInfo, signOut } = useAuth();
  const restaurantId = useAdminRestaurantId();
  const opsOnly = isRestaurantOpsOnlyUser(profile?.role, !!staffInfo?.restaurant_id, staffInfo?.role);
  const kitchenAccess = isKitchenStaffRole(staffInfo?.role);
  const activeNav = opsOnly ? (kitchenAccess ? NAV_OPS_KITCHEN : NAV_OPS) : NAV;
  const primaryNavCount = opsOnly ? activeNav.length : 6;

  const roleLabel = useMemo(() => {
    if (!profile) return 'Équipe';
    if (profile.role === 'restaurant_owner') return 'Propriétaire';
    const nr = normalizeDashboardRole(profile.role);
    if (nr === 'caissier') return 'Caissier';
    if (hasFullRestaurantNav(profile.role)) return 'Gérant';
    if (staffInfo?.role) return getTeamRoleDefinition(staffInfo.role).label;
    if (nr === 'livreur') return 'Livreur';
    return 'Équipe';
  }, [profile, staffInfo?.role]);

  useEffect(() => {
    if (!opsOnly) return;
    if (!isRestaurantOpsAllowedPath(location.pathname)) {
      navigate('/restaurant/dashboard', { replace: true });
    }
  }, [opsOnly, location.pathname, navigate]);

  // Manifest PWA
  useEffect(() => {
    document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/manifest-restaurant.json');
  }, []);

  // Statut + nom restaurant
  useEffect(() => {
    if (!restaurantId) return;
    supabase.from('restaurants').select('is_open, name').eq('id', restaurantId).single()
      .then(({ data }) => {
        if (data) { setIsOpen(data.is_open ?? false); setRestaurantName(data.name || ''); }
      });
  }, [restaurantId]);

  // Commandes en attente
  useEffect(() => {
    if (!restaurantId) return;
    const fetch = async () => {
      const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId).eq('status', 'pending');
      setPending(count || 0);
    };
    fetch();
    const t = setInterval(fetch, 30000);
    return () => clearInterval(t);
  }, [restaurantId]);

  const toggleOpen = async () => {
    if (!restaurantId || opsOnly) return;
    setToggling(true);
    const next = !isOpen;
    await supabase.from('restaurants').update({ is_open: next, updated_at: new Date().toISOString() }).eq('id', restaurantId);
    setIsOpen(next);
    setToggling(false);
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Gestionnaire';
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0]?.toUpperCase() || 'G');
  // ── Sidebar Content ──────────────────────────────────────────────────────
  const SidebarContent = ({ isCollapsed = false }: { isCollapsed?: boolean }) => (
    <div className="flex flex-col h-full">

      {/* Logo Restafy */}
      <div
        className="flex items-center gap-3 border-b px-5 h-16 flex-shrink-0"
        style={{ borderColor: 'var(--r-sidebar-border)' }}
      >
        {/* Store icon terracotta */}
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E86F3F] to-[#D4572E] flex items-center justify-center shadow-lg shadow-orange-500/25 transition-shadow duration-300 hover:shadow-orange-500/40">
            <Store className="w-5 h-5 text-white" />
          </div>
          {/* Halo pulsant si ouvert */}
          {isOpen && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 animate-pulse"
              style={{ borderColor: 'var(--r-logo-ring)' }}
            />
          )}
        </div>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              className="flex flex-col min-w-0">
              <span className="font-display font-black text-base tracking-tight leading-tight text-[color:var(--r-text)]">
                RESTAFY<span className="text-orange-500">.</span>
              </span>
              <span className="text-[10px] font-medium tracking-widest uppercase truncate text-[color:var(--r-text-subtle)]">
                {restaurantName || 'Tableau de bord'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          className="ml-auto p-1.5 rounded-lg lg:hidden transition-colors hover:bg-[var(--r-surface)] text-[color:var(--r-nav-idle)] hover:text-[color:var(--r-nav-hover)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Statut ouvert/fermé — réservé aux gérants (pas équipe cuisine / salle) */}
      {!isCollapsed && !opsOnly && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--r-sidebar-border)' }}>
          <button onClick={toggleOpen} disabled={toggling}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all',
              isOpen
                ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20'
                : 'text-[color:var(--r-nav-idle)] hover:bg-[var(--r-surface)]'
            )}>
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-[var(--r-text-subtle)]')} />
            <span>{toggling ? '…' : isOpen ? 'Restaurant ouvert' : 'Restaurant fermé'}</span>
            <Power className="w-3.5 h-3.5 ml-auto opacity-60" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">

        {/* Séparateur section principale */}
        {!isCollapsed && (
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] px-3 pb-2 pt-1 text-[color:var(--r-text-subtle)]">Principal</p>
        )}

        {activeNav.slice(0, primaryNavCount).map(item => (
          <NavItem
            key={item.to}
            item={item}
            collapsed={isCollapsed}
            pending={item.to.includes('dashboard') && item.exact ? pending : 0}
          />
        ))}

        {!opsOnly && (
          <>
            {!isCollapsed && (
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] px-3 pb-2 pt-4 text-[color:var(--r-text-subtle)]">Gestion</p>
            )}
            {!isCollapsed && <div className="h-px mx-2 my-1 bg-[var(--r-sidebar-border)] opacity-60" />}

            {activeNav.slice(primaryNavCount).map(item => (
              <NavItem key={item.to} item={item} collapsed={isCollapsed} pending={0} />
            ))}
          </>
        )}
      </nav>

      {/* Profil bas */}
      <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'var(--r-sidebar-border)' }}>
        {isCollapsed ? (
          <div className="flex justify-center">
            <div className="w-9 h-9 rounded-xl bg-[#E86F3F]/20 flex items-center justify-center">
              <span className="text-[#E86F3F] font-black text-sm">{initials}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-2.5 rounded-xl transition-colors group hover:bg-[var(--r-surface)]">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={displayName} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[#E86F3F]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[#E86F3F] font-black text-xs">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate leading-tight text-[color:var(--r-text)]">{displayName}</p>
              <p className="text-[10px] uppercase tracking-widest text-[color:var(--r-text-subtle)]">{roleLabel}</p>
            </div>
            <button onClick={() => signOut?.()} title="Se déconnecter"
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all hover:bg-[var(--r-surface-hover)] text-[color:var(--r-nav-idle)] hover:text-[color:var(--r-nav-hover)]">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      data-restaurant-theme={theme}
      className={cn(
        'h-screen overflow-hidden flex font-sans bg-[var(--restaurant-main-bg)] text-[color:var(--r-text)]',
        theme === 'dark' && 'dark',
      )}
    >

      {/* ── Sidebar desktop ── */}
      <aside className={cn(
        'hidden lg:flex flex-col flex-shrink-0 sticky top-0 h-screen transition-all duration-300 ease-in-out relative',
        collapsed ? 'w-[68px]' : 'w-[220px]'
      )} style={{ background: 'var(--sidebar-bg)' }}>
        {/* Right border accent */}
        <div className="absolute top-0 right-0 bottom-0 w-px bg-[var(--r-sidebar-border)]" />
        <SidebarContent isCollapsed={collapsed} />

        {/* Toggle collapse */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 z-10 shadow-lg hover:scale-110 text-[color:var(--r-nav-idle)] hover:text-[color:var(--r-nav-hover)]"
          style={{
            backgroundColor: 'var(--r-collapse-btn-bg)',
            borderWidth: 1,
            borderColor: 'var(--r-collapse-btn-border)',
          }}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header
          className="h-16 backdrop-blur-xl border-b px-4 lg:px-6 flex items-center justify-between flex-shrink-0 sticky top-0 z-30"
          style={{
            backgroundColor: 'var(--r-header-bg)',
            borderColor: 'var(--r-header-border)',
          }}
        >
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Titre page : visible sur mobile (tronqué) + desktop */}
            <div className="flex items-center gap-2 text-sm min-w-0 flex-1 lg:flex-initial">
              <span className="font-black font-display text-[color:var(--r-text)] truncate">
                {activeNav.find(n => (n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to)))?.label
                  || (location.pathname.includes('/orders') ? 'Liste commandes' : 'Tableau de bord')}
              </span>
            </div>

          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5 min-w-0 max-w-full sm:max-w-none sm:flex-nowrap">
            <RestaurantThemeToggle className="hidden sm:flex" />
            {!isPWA && <PWAInstallPrompt variant="button" className="hidden lg:flex text-xs py-1.5 px-3" />}
            <NotificationCenter />

            {/* Divider */}
            <div className="hidden sm:block w-px h-6 bg-[var(--r-sidebar-border)]" />

            {/* Avatar header */}
            <div className="flex items-center gap-2.5 pl-1">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold leading-tight text-[color:var(--r-text)]">{displayName}</p>
                <p className="text-[10px] uppercase tracking-widest text-[color:var(--r-text-muted)]">{roleLabel}</p>
              </div>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="w-8 h-8 rounded-xl object-cover ring-2 ring-[#E86F3F]/30 hover:ring-[#E86F3F]/50 transition-all" />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#E86F3F] to-[#D4572E] flex items-center justify-center ring-2 ring-[#E86F3F]/30 hover:ring-[#E86F3F]/50 transition-all">
                  <span className="text-white font-black text-xs">{initials}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Bandeau global d'état de la connexion temps réel.
            Affiché uniquement quand le statut n'est pas 'connected'. */}
        <RealtimeStatusBanner />

        {/* Content */}
        <main className="restaurant-admin-main flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              className="min-h-0 max-w-full"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <ErrorBoundary level="section">
                <Outlet />
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <div className="lg:hidden">
        <RestaurantNavbar pendingCount={pending} opsOnly={opsOnly} kitchenAccess={kitchenAccess} />
      </div>

      <PWAInstallPrompt variant="modal" />
    </div>
  );
}

export default function AdminLayout() {
  return (
    <RestaurantThemeProvider>
      <RealtimeStatusProvider>
        <AdminLayoutShell />
      </RealtimeStatusProvider>
    </RestaurantThemeProvider>
  );
}

// ── NavItem ──────────────────────────────────────────────────────────────────
function NavItem({ item, collapsed, pending }: { item: typeof NAV[0]; collapsed: boolean; pending: number }) {
  return (
    <NavLink to={item.to} end={item.exact}
      className={({ isActive }) => cn(
        'flex items-center gap-3 rounded-xl transition-all duration-200 relative group',
        collapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5',
        isActive
          ? 'bg-[#E86F3F]/15 text-[#E86F3F] shadow-sm shadow-[#E86F3F]/10'
          : 'text-[color:var(--r-nav-idle)] hover:text-[color:var(--r-nav-hover)] hover:bg-[var(--r-surface)] nav-item-afro'
      )}
      title={collapsed ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          {/* Accent bar gauche si actif */}
          {isActive && !collapsed && (
            <motion.span
              layoutId="nav-active-bar"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-[#E86F3F] to-[#D4572E] rounded-full"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}

          <item.icon className={cn('flex-shrink-0 transition-all duration-200 group-hover:scale-110',
            collapsed ? 'w-5 h-5' : 'w-4 h-4',
            isActive ? 'text-[#E86F3F]' : ''
          )} />

          {!collapsed && (
            <span className="font-semibold text-sm leading-none">{item.label}</span>
          )}

          {/* Badge pending */}
          {pending > 0 && (
            <span className={cn(
              'font-black text-[10px] bg-gradient-to-br from-[#E86F3F] to-[#D4572E] text-white rounded-full leading-none flex items-center justify-center shadow-sm shadow-[#E86F3F]/30',
              collapsed ? 'absolute top-1 right-1 w-4 h-4' : 'ml-auto w-5 h-5'
            )}>
              {pending > 9 ? '9+' : pending}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
