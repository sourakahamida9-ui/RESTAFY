/**
 * Hook pour la gestion de l'authentification par token dans le scanner QR
 * Validation, stockage et rafraîchissement des tokens
 */

import { useState, useEffect, useCallback } from 'react';
import { validateToken, type TokenPayload } from '../../../shared/token';

interface TokenAuthState {
  isAuthenticated: boolean;
  token: string | null;
  payload: TokenPayload | null;
  error: string | null;
  loading: boolean;
  lastValidated: Date | null;
}

interface UseTokenAuthOptions {
  autoValidate?: boolean;
  validateInterval?: number; // en secondes
  persistToken?: boolean;
}

const TOKEN_STORAGE_KEY = 'qr_scanner_token';
const TOKEN_PAYLOAD_KEY = 'qr_scanner_payload';

export function useTokenAuth(options: UseTokenAuthOptions = {}) {
  const {
    autoValidate = true,
    validateInterval = 300, // 5 minutes
    persistToken = true,
  } = options;

  const [state, setState] = useState<TokenAuthState>({
    isAuthenticated: false,
    token: null,
    payload: null,
    error: null,
    loading: true,
    lastValidated: null,
  });

  // Charger le token depuis le stockage local
  const loadStoredToken = useCallback(() => {
    if (!persistToken) return null;
    
    try {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      const storedPayload = localStorage.getItem(TOKEN_PAYLOAD_KEY);
      
      if (stored && storedPayload) {
        return {
          token: stored,
          payload: JSON.parse(storedPayload) as TokenPayload,
        };
      }
    } catch (error) {
      console.error('[TokenAuth] Erreur chargement token stocké:', error);
      clearStoredToken();
    }
    
    return null;
  }, [persistToken]);

  // Sauvegarder le token localement
  const saveToken = useCallback((token: string, payload: TokenPayload) => {
    if (!persistToken) return;
    
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(TOKEN_PAYLOAD_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('[TokenAuth] Erreur sauvegarde token:', error);
    }
  }, [persistToken]);

  // Nettoyer le token stocké
  const clearStoredToken = useCallback(() => {
    if (!persistToken) return;
    
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_PAYLOAD_KEY);
    } catch (error) {
      console.error('[TokenAuth] Erreur nettoyage token:', error);
    }
  }, [persistToken]);

  // Valider un token
  const validateTokenAsync = useCallback(async (token: string): Promise<{
    valid: boolean;
    payload?: TokenPayload;
    error?: string;
  }> => {
    try {
      // D'abord validation côté client
      const clientResult = await validateToken(token);
      
      if (!clientResult.valid) {
        return clientResult;
      }

      // Ensuite validation côté serveur (optionnel pour vérifier la révocation)
      try {
        const serverResponse = await fetch('/api/auth/agent/validate-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        if (!serverResponse.ok) {
          return { valid: false, error: 'Erreur serveur validation' };
        }

        const serverResult = await serverResponse.json();
        
        if (!serverResult || serverResult.error) {
          return { valid: false, error: serverResult?.error || 'Token révoqué' };
        }

        return {
          valid: true,
          payload: clientResult.payload,
        };
      } catch (serverError) {
        console.warn('[TokenAuth] Erreur validation serveur, utilisation résultat client:', serverError);
        // En cas d'erreur réseau, on fait confiance à la validation cliente
        return clientResult;
      }
    } catch (error) {
      console.error('[TokenAuth] Erreur validation token:', error);
      return { valid: false, error: 'Erreur validation token' };
    }
  }, []);

  // Authentifier avec un token
  const authenticate = useCallback(async (token: string): Promise<boolean> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await validateTokenAsync(token);
      
      if (result.valid && result.payload) {
        setState({
          isAuthenticated: true,
          token,
          payload: result.payload,
          error: null,
          loading: false,
          lastValidated: new Date(),
        });
        
        saveToken(token, result.payload);
        return true;
      } else {
        setState({
          isAuthenticated: false,
          token: null,
          payload: null,
          error: result.error || 'Token invalide',
          loading: false,
          lastValidated: null,
        });
        
        clearStoredToken();
        return false;
      }
    } catch (error) {
      setState({
        isAuthenticated: false,
        token: null,
        payload: null,
        error: 'Erreur authentification',
        loading: false,
        lastValidated: null,
      });
      
      clearStoredToken();
      return false;
    }
  }, [validateTokenAsync, saveToken, clearStoredToken]);

  // Déconnexion
  const logout = useCallback(() => {
    setState({
      isAuthenticated: false,
      token: null,
      payload: null,
      error: null,
      loading: false,
      lastValidated: null,
    });
    
    clearStoredToken();
  }, [clearStoredToken]);

  // Vérifier si le token a les permissions requises
  const hasPermission = useCallback((permission: string): boolean => {
    if (!state.payload) return false;
    
    return state.payload.permissions.includes('*') || 
           state.payload.permissions.includes(permission);
  }, [state.payload]);

  // Vérifier si le token est pour un événement spécifique
  const canScanEvent = useCallback((eventId: string): boolean => {
    if (!state.payload) return false;
    
    return state.payload.type === 'event_scan' && 
           state.payload.eventId === eventId &&
           hasPermission('scan:qr');
  }, [state.payload, hasPermission]);

  // Rafraîchir la validation du token
  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (!state.token) return false;
    
    return authenticate(state.token);
  }, [state.token, authenticate]);

  // Initialisation au montage
  useEffect(() => {
    const init = async () => {
      setState(prev => ({ ...prev, loading: true }));
      
      // Vérifier si un token est dans l'URL
      // Skip sur /team (flux restaScan staff utilise un token+PIN distinct, pas un JWT agent)
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      const isTeamScanRoute = window.location.pathname.startsWith('/team');

      if (urlToken && !isTeamScanRoute) {
        // Nettoyer l'URL
        window.history.replaceState({}, document.title, window.location.pathname);

        // Authentifier avec le token de l'URL
        await authenticate(urlToken);
        return;
      }
      
      // Sinon, essayer le token stocké
      const stored = loadStoredToken();
      if (stored) {
        await authenticate(stored.token);
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    };
    
    init();
  }, [authenticate, loadStoredToken]);

  // Validation périodique
  useEffect(() => {
    if (!autoValidate || !state.token || !state.isAuthenticated) return;
    
    const interval = setInterval(async () => {
      const result = await validateTokenAsync(state.token!);
      
      if (!result.valid) {
        logout();
      } else {
        setState(prev => ({ 
          ...prev, 
          lastValidated: new Date(),
          payload: result.payload || prev.payload 
        }));
      }
    }, validateInterval * 1000);
    
    return () => clearInterval(interval);
  }, [autoValidate, validateInterval, state.token, state.isAuthenticated, validateTokenAsync, logout]);

  // Validation avant expiration
  useEffect(() => {
    if (!state.payload || !state.isAuthenticated) return;
    
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = state.payload.expiresAt;
    const timeUntilExpiry = expiresAt - now;
    
    // Rafraîchir 5 minutes avant expiration
    const refreshTime = Math.max(0, timeUntilExpiry - 300);
    
    if (refreshTime > 0) {
      const timeout = setTimeout(() => {
        refreshToken();
      }, refreshTime * 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [state.payload, state.isAuthenticated, refreshToken]);

  return {
    // État
    ...state,
    
    // Actions
    authenticate,
    logout,
    refreshToken,
    
    // Utilitaires
    hasPermission,
    canScanEvent,
    
    // Informations sur le token
    tokenType: state.payload?.type,
    eventName: state.payload?.eventName,
    eventId: state.payload?.eventId,
    expiresAt: state.payload ? new Date(state.payload.expiresAt * 1000) : null,
    isExpired: state.payload ? state.payload.expiresAt < Math.floor(Date.now() / 1000) : false,
    timeUntilExpiry: state.payload ? state.payload.expiresAt - Math.floor(Date.now() / 1000) : 0,
  };
}
