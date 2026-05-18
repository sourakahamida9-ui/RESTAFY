// src/context/SystemContext.tsx
// ✅ Typé strictement — zéro any

import React, { createContext, useContext, ReactNode } from 'react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { usePaymentMethods, type PaymentMethod } from '@/hooks/usePaymentMethods';
import { useOrderModes, type OrderMode } from '@/hooks/useOrderModes';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface SystemContextType {
  settings:         Record<string, unknown>;
  paymentMethods:   PaymentMethod[];
  orderModes:       OrderMode[];
  loading:          boolean;
  getSetting:       (key: string, defaultValue?: unknown) => unknown;
  getPaymentMethod: (code: string) => PaymentMethod | undefined;
  getOrderMode:     (code: string) => OrderMode | undefined;
}

const SystemContext = createContext<SystemContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export function SystemProvider({ children }: { children: ReactNode }) {
  const settingsHook = useSystemSettings();
  const paymentHook  = usePaymentMethods();
  const orderHook    = useOrderModes();

  const value: SystemContextType = {
    settings:         settingsHook.settings as Record<string, unknown>,
    paymentMethods:   paymentHook.methods,
    orderModes:       orderHook.modes,
    loading:          settingsHook.loading || paymentHook.loading || orderHook.loading,
    getSetting:       settingsHook.getSetting,
    getPaymentMethod: paymentHook.getMethodByCode,
    getOrderMode:     orderHook.getModeByCode,
  };

  return (
    <SystemContext.Provider value={value}>
      {children}
    </SystemContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useSystem(): SystemContextType {
  const context = useContext(SystemContext);
  if (!context) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
}
