// src/components/superadmin/SuperAdminLayout.tsx
// ✅ FIX: Ajout responsivité mobile (hamburger + drawer overlay)
// ✅ FIX: h-screen overflow-hidden sur la racine (évite le double scroll)
// ✅ CONSERVÉ: toute la logique nav et routes existantes intactes

import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Store, Users, DollarSign, Database,
  Activity, LogOut, Shield, Bell, Link as LinkIcon,
  Menu, X, ChevronRight, Mail, Handshake, ScrollText,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const NAV = [
  { to: '/superadmin', icon: LayoutDashboard, label: 'Vue globale', exact: true },
  { to: '/superadmin/restaurants', icon: Store, label: 'Restaurants' },
  { to: '/superadmin/users', icon: Users, label: 'Utilisateurs' },
  { to: '/superadmin/finances', icon: DollarSign, label: 'Finances' },
  { to: '/superadmin/invites', icon: LinkIcon, label: 'Invitations' },
  { to: '/superadmin/partner-requests', icon: Handshake, label: 'Demandes partenaires' },
  { to: '/superadmin/emails', icon: Mail, label: 'Campagnes Email' },
  { to: '/superadmin/data', icon: Database, label: 'IA & Data' },
  { to: '/superadmin/monitoring', icon: Activity, label: 'Monitoring' },
  { to: '/superadmin/order-events', icon: ScrollText, label: 'Audit log commandes' },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleQuit = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      <div className="p-6 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
            <Shield className="text-white w-5 h-5" />
          </div>
          <div>
            <p className="font-black text-sm tracking-tight text-white">RESTAFY</p>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Super Admin</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            onClick={onClose}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all',
              isActive
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white'
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5 flex-shrink-0">
        <button
          onClick={handleQuit}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <LogOut className="w-4 h-4" /> Déconnexion
        </button>
      </div>
    </>
  );
}

export default function SuperAdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { profile } = useAuth();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const currentLabel = NAV.find(n =>
    n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to)
  )?.label || 'Super Admin';

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'SA';

  return (
    <div className="h-screen overflow-hidden bg-[#0D0D0D] flex font-sans text-white">

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar DESKTOP */}
      <aside className="hidden lg:flex w-64 bg-[#111] border-r border-white/5 flex-col h-full flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Drawer MOBILE */}
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 w-72 bg-[#111] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        <header className="bg-[#111] border-b border-white/5 px-4 lg:px-8 py-4 flex items-center justify-between flex-shrink-0 z-30">
          <div className="flex items-center gap-3">
            {/* Hamburger mobile */}
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors lg:hidden"
            >
              <Menu className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest hidden sm:block">Panneau de contrôle</p>
              <h1 className="font-black text-lg lg:text-xl">{currentLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-xl text-xs font-bold">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="hidden md:inline">Système opérationnel</span>
            </div>
            <button className="relative p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
              <Bell className="w-5 h-5 text-zinc-400" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-[9px] flex items-center justify-center font-bold">3</span>
            </button>
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-orange-600 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0">
              {initials}
            </div>
          </div>
        </header>

        {/* Seule zone scrollable */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <ErrorBoundary level="section">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
