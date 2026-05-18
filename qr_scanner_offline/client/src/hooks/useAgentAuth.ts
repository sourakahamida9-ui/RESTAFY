// Hook complet pour l'authentification agent avec support offline

import { useState, useEffect, useCallback } from 'react';
import type { AgentCredentials, AgentSession, AgentToken, ValidationResult } from '@/types/agent';
import {
  saveAgentSession,
  getAgentSession,
  clearAgentSession,
  updateSessionOfflineStatus,
  saveTickets,
  getOfflineTickets,
  validateTicketOffline,
  saveRestaurantData,
  isOnline,
} from '@/services/offlineStorage';

interface AuthState {
  session: AgentSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOffline: boolean;
  error: string | null;
}

export function useAgentAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    isAuthenticated: false,
    isLoading: true,
    isOffline: !isOnline(),
    error: null,
  });

  // Vérifier la session existante au chargement
  useEffect(() => {
    const checkSession = async () => {
      const session = getAgentSession();
      const online = isOnline();
      
      setState(prev => ({
        ...prev,
        session,
        isAuthenticated: !!session,
        isLoading: false,
        isOffline: !online,
      }));
      
      // Si en ligne et session existe, essayer de synchroniser
      if (online && session) {
        syncData();
      }
    };
    
    checkSession();
    
    // Écouter les changements de connexion
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOffline: false }));
      updateSessionOfflineStatus(false);
      syncData();
    };
    
    const handleOffline = () => {
      setState(prev => ({ ...prev, isOffline: true }));
      updateSessionOfflineStatus(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Connexion avec email/password
  const loginWithCredentials = useCallback(async (
    credentials: AgentCredentials
  ): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // En ligne : appeler l'API
      if (isOnline()) {
        const response = await fetch('/api/auth/agent/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Échec de la connexion');
        }
        
        const data = await response.json();
        
        const session: AgentSession = {
          id: data.agent.id,
          email: data.agent.email,
          name: data.agent.name,
          restaurantId: data.restaurant.id,
          restaurantName: data.restaurant.name,
          token: data.token,
          permissions: data.agent.permissions,
          isOffline: false,
          lastSync: new Date(),
          expiresAt: new Date(data.expiresAt),
        };
        
        saveAgentSession(session);
        saveRestaurantData({
          id: data.restaurant.id,
          name: data.restaurant.name,
          eventName: data.event?.name,
          logo: data.restaurant.logo,
        });
        
        // Télécharger les tickets pour usage offline
        await downloadTickets(session.token);
        
        setState({
          session,
          isAuthenticated: true,
          isLoading: false,
          isOffline: false,
          error: null,
        });
        
        return true;
      } else {
        // Offline : vérifier si credentials correspondent à session stockée
        const existingSession = getAgentSession();
        if (existingSession && existingSession.email === credentials.email) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Mode offline : connexion limitée',
          }));
          return false;
        }
        
        throw new Error('Impossible de se connecter en mode offline sans session existante');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erreur de connexion',
      }));
      return false;
    }
  }, []);

  // Connexion avec token
  const loginWithToken = useCallback(async (token: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // En ligne : valider le token avec le serveur
      if (isOnline()) {
        const response = await fetch('/api/auth/agent/validate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Token invalide');
        }
        
        const data = await response.json();
        
        const session: AgentSession = {
          id: data.agent.id,
          email: data.agent.email || 'agent@restaurant.com',
          name: data.agent.name || 'Agent',
          restaurantId: data.restaurant.id,
          restaurantName: data.restaurant.name,
          token,
          permissions: data.agent.permissions,
          isOffline: false,
          lastSync: new Date(),
          expiresAt: new Date(data.expiresAt),
        };
        
        saveAgentSession(session);
        saveRestaurantData({
          id: data.restaurant.id,
          name: data.restaurant.name,
          eventName: data.event?.name,
          logo: data.restaurant.logo,
        });
        
        // Télécharger les tickets
        await downloadTickets(token);
        
        setState({
          session,
          isAuthenticated: true,
          isLoading: false,
          isOffline: false,
          error: null,
        });
        
        return true;
      } else {
        // Offline : vérifier si token correspond à session stockée
        const existingSession = getAgentSession();
        if (existingSession && existingSession.token === token) {
          setState({
            session: existingSession,
            isAuthenticated: true,
            isLoading: false,
            isOffline: true,
            error: null,
          });
          return true;
        }
        
        throw new Error('Mode offline : token non reconnu localement');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Erreur de validation du token',
      }));
      return false;
    }
  }, []);

  // Déconnexion
  const logout = useCallback(() => {
    clearAgentSession();
    setState({
      session: null,
      isAuthenticated: false,
      isLoading: false,
      isOffline: !isOnline(),
      error: null,
    });
  }, []);

  // Télécharger les tickets pour usage offline
  const downloadTickets = async (token: string) => {
    try {
      const response = await fetch('/api/tickets/event', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const tickets = await response.json();
        saveTickets(tickets);
      }
    } catch (error) {
      console.error('Erreur téléchargement tickets:', error);
    }
  };

  // Synchroniser les données
  const syncData = async () => {
    const session = getAgentSession();
    if (!session) return;
    
    // Synchroniser les validations en attente
    // TODO: implémenter la synchro vers le serveur
    
    // Re-télécharger les tickets
    await downloadTickets(session.token);
  };

  // Valider un ticket (offline ou online)
  const validateTicket = useCallback(async (code: string): Promise<ValidationResult> => {
    const session = getAgentSession();
    if (!session) {
      return {
        success: false,
        error: 'Non authentifié',
        isOffline: !isOnline(),
      };
    }
    
    // Si online, essayer d'abord le serveur
    if (isOnline()) {
      try {
        const response = await fetch('/api/tickets/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.token}`,
          },
          body: JSON.stringify({ code }),
        });
        
        if (response.ok) {
          const result = await response.json();
          return {
            success: result.success,
            ticket: result.ticket,
            isOffline: false,
          };
        }
      } catch (error) {
        console.warn('Validation online échouée, utilisation offline:', error);
      }
    }
    
    // Fallback offline
    return validateTicketOffline(code, session.id);
  }, []);

  // Recharger les tickets
  const refreshTickets = useCallback(async (): Promise<void> => {
    const session = getAgentSession();
    if (session && isOnline()) {
      await downloadTickets(session.token);
    }
  }, []);

  return {
    ...state,
    loginWithCredentials,
    loginWithToken,
    logout,
    validateTicket,
    refreshTickets,
    ticketCount: getOfflineTickets().length,
  };
}
