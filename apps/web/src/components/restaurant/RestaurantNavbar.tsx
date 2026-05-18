import React from 'react';
import {
  SquaresFour,
  ClipboardText,
  CreditCard,
  ChartBar,
  GearSix,
  CookingPot,
} from '@phosphor-icons/react';
import { NavItem } from '@/components/ui/NavItem';

interface RestaurantNavbarProps {
  pendingCount?: number;
  opsOnly?: boolean;
  /** Si true, ajoute « Cuisine » dans la barre (rôle chef / staff). */
  kitchenAccess?: boolean;
}

const ACCENT = '#F97316'; // Orange Restafy

export function RestaurantNavbar({ pendingCount = 0, opsOnly = false, kitchenAccess = false }: RestaurantNavbarProps) {
  if (opsOnly) {
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl"
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'var(--r-mobile-nav-bg, rgba(255,255,255,0.96))',
          borderTop: '1px solid var(--r-mobile-nav-border, rgba(0,0,0,0.06))',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        }}
        aria-label="Navigation restaurant"
      >
        <div className="flex items-stretch h-[56px] max-w-lg mx-auto px-2">
          <NavItem
            to="/restaurant/dashboard"
            icon={SquaresFour}
            label="Live"
            exact
            accentColor={ACCENT}
            badge={pendingCount > 0}
          />
          <NavItem
            to="/restaurant/dashboard/orders"
            icon={ClipboardText}
            label="Commandes"
            accentColor={ACCENT}
          />
          {kitchenAccess && (
            <NavItem
              to="/restaurant/dashboard/kitchen"
              icon={CookingPot}
              label="Cuisine"
              accentColor={ACCENT}
            />
          )}
          <NavItem
            to="/restaurant/dashboard/pos"
            icon={CreditCard}
            label="Caisse"
            accentColor={ACCENT}
          />
        </div>
      </nav>
    );
  }

  return (
    <>
      {/* Spacer */}
      <div style={{ height: 'calc(56px + env(safe-area-inset-bottom, 0px))' }} />

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl"
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'var(--r-mobile-nav-bg, rgba(255,255,255,0.96))',
          borderTop: '1px solid var(--r-mobile-nav-border, rgba(0,0,0,0.06))',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        }}
        aria-label="Navigation restaurant"
      >
        <div className="flex items-stretch h-[56px] max-w-lg mx-auto px-2">
          <NavItem
            to="/restaurant/dashboard"
            icon={SquaresFour}
            label="Accueil"
            exact
            accentColor={ACCENT}
          />
          <NavItem
            to="/restaurant/dashboard/orders"
            icon={ClipboardText}
            label="Commandes"
            accentColor={ACCENT}
            badge={pendingCount > 0}
          />
          <NavItem
            to="/restaurant/dashboard/pos"
            icon={CreditCard}
            label="Caisse"
            accentColor={ACCENT}
          />
          <NavItem
            to="/restaurant/dashboard/analytics"
            icon={ChartBar}
            label="Stats"
            accentColor={ACCENT}
          />
          <NavItem
            to="/restaurant/dashboard/settings"
            icon={GearSix}
            label="Réglages"
            accentColor={ACCENT}
          />
        </div>
      </nav>
    </>
  );
}

export default RestaurantNavbar;
