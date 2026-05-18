import React from 'react';
import {
  House,
  QrCode,
  ShoppingCart,
  ClipboardText,
  User,
} from '@phosphor-icons/react';
import { NavItem } from '@/components/ui/NavItem';
import { useCartStore } from '@/store/useCartStore';
import { useAuth } from '@/hooks/useAuth';

export function ClientNavbar() {
  const { user } = useAuth();
  const cartCount = useCartStore((s) => s.items.reduce((acc, i) => acc + i.quantity, 0));

  return (
    <>
      {/* Spacer */}
      <div
        className="lg:hidden"
        style={{ height: 'calc(52px + env(safe-area-inset-bottom, 0px))' }}
      />

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
        aria-label="Navigation principale"
      >
        <div
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          className="border-t bg-white dark:bg-[#0E0E0E]"
        >
          <div className="flex items-stretch h-[52px] max-w-lg mx-auto"
            style={{ borderColor: 'var(--nav-border, rgba(0,0,0,0.06))' }}
          >
            <NavItem to="/" icon={House} label="Accueil" exact />
            <NavItem to="/scan" icon={QrCode} label="Scanner" />
            <NavItem
              to="/cart"
              icon={ShoppingCart}
              label="Panier"
              badge={cartCount > 0}
            />
            <NavItem
              to={user ? '/orders' : '/login'}
              icon={ClipboardText}
              label="Commandes"
            />
            <NavItem
              to={user ? '/profil' : '/login'}
              icon={User}
              label="Profil"
            />
          </div>
        </div>
      </nav>
    </>
  );
}

export default ClientNavbar;
