// src/context/RealtimeStatusContext.tsx
//
// Diffuse l'état de la connexion Supabase Realtime à toute l'arbre admin.
// Permet aux hooks consommateurs (useOrderRealtime) de basculer en polling
// quand status === 'degraded', et au banner global de l'afficher.

import React, { createContext, useContext } from 'react';
import { useRealtimeConnection, type RealtimeConnectionStatus } from '@/hooks/useRealtimeConnection';

interface RealtimeStatusValue {
  status: RealtimeConnectionStatus;
  lastErrorAt: number | null;
}

const Ctx = createContext<RealtimeStatusValue>({ status: 'connected', lastErrorAt: null });

export const RealtimeStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useRealtimeConnection();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useRealtimeStatus(): RealtimeStatusValue {
  return useContext(Ctx);
}
