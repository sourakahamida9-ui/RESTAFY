/**
 * Hook pour l'authentification cross-subdomain
 * 
 * Gère:
 * 1. Synchronisation de session entre sous-domaines (via cookies httpOnly)
 * 2. Stockage local sécurisé (IndexedDB pour PWA offline)
 * 3. Rafraîchissement automatique des tokens
 * 4. Persistance login même après fermeture/reload
 * 5. Fallback gracieux si cookies indisponibles
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface CrossSubdomainUser {
  userId: string;
  sessionId: string;
  type: 'agent_scan' | 'manager' | 'admin' | 'client';
  permissions: string[];
  restaurantId?: string;
  eventId?: string;
  subdomain: 'scan' | 'app';
  expiresAt: number;
}

export interface UseCrossSubdomainAuthOptions {
  /**
   * Valider la session auprès du serveur au démarrage
   */
  autoValidate?: boolean;
  
  /**
   * Intervalle de validation périodique (en secondes)
   */
  validationInterval?: number;
  
  /**
   * Utiliser IndexedDB pour stockage offline (PWA)
   */
  useOfflineStorage?: boolean;
  
  /**
   * Callback quand la session est sur le point d'expirer
   */
  onSessionExpiring?: () => void;
  
  /**
   * URL de base du serveur (optionnel, utilise le domaine courant par défaut)
   */
  serverUrl?: string;
}

export interface UseCrossSubdomainAuthResult {
  // État
  user: CrossSubdomainUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (userId: string, sessionToken: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  
  // Infos
  sessionExpiresAt: Date | null;
  timeUntilExpiry: number; // en secondes
  isExpired: boolean;
  isExpiringSoon: boolean; // < 5 minutes
}

// ============================================================================
// CONSTANTES
// ============================================================================

const STORAGE_KEYS = {
  USER: 'cross-subdomain-user',
  SESSION_TOKEN: 'cross-subdomain-session',
  REFRESH_TOKEN: 'cross-subdomain-refresh',
  LAST_SYNC: 'cross-subdomain-last-sync',
} as const;

const VALIDATION_INTERVAL_DEFAULT = 300; // 5 minutes
const SESSION_CHECK_INTERVAL = 60; // Check tous les 60 secondes
const EXPIRING_SOON_THRESHOLD = 300; // 5 minutes avant expiration

// ============================================================================
// UTILITAIRES D'INDEXEDDB
// ============================================================================

async function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RestafyAuth', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'sessionId' });
      }
    };
  });
}

async function saveSessionToIndexedDB(user: CrossSubdomainUser, token: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');

    await new Promise((resolve, reject) => {
      const request = store.put({ ...user, token, savedAt: Date.now() });
      request.onsuccess = () => resolve(undefined);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[UseCrossSubdomainAuth] IndexedDB save failed:', error);
  }
}

async function getSessionFromIndexedDB(): Promise<{ user: CrossSubdomainUser; token: string } | null> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction('sessions', 'readonly');
    const store = tx.objectStore('sessions');

    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const sessions = (request.result as any[]) || [];
        // Retourner la session la plus récente
        if (sessions.length > 0) {
          const latest = sessions.sort((a, b) => b.savedAt - a.savedAt)[0];
          resolve({ user: latest, token: latest.token });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.warn('[UseCrossSubdomainAuth] IndexedDB read failed:', error);
    return null;
  }
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useCrossSubdomainAuth(
  options: UseCrossSubdomainAuthOptions = {}
): UseCrossSubdomainAuthResult {
  const {
    autoValidate = true,
    validationInterval = VALIDATION_INTERVAL_DEFAULT,
    useOfflineStorage = true,
    onSessionExpiring,
    serverUrl,
  } = options;

  // État
  const [user, setUser] = useState<CrossSubdomainUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs pour éviter les re-renders inutiles
  const validationTimerRef = useRef<NodeJS.Timeout>();
  const expiryTimerRef = useRef<NodeJS.Timeout>();
  const lastValidationRef = useRef<number>(0);

  // ========================================================================
  // UTILITAIRES
  // ========================================================================

  const getServerUrl = useCallback(() => {
    if (serverUrl) return serverUrl;
    
    // Déterminer l'URL du serveur basée sur le sous-domaine courant
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // Production: scan.restafy.shop → https://api.restafy.shop ou http://scan.restafy.shop:3001
    // Développement: localhost → http://localhost:3000
    
    if (hostname.includes('restafy.shop')) {
      // En production, utiliser l'API centralisée
      return `${protocol}//api.restafy.shop`;
    }

    // En développement local, utiliser le port API
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const port = window.location.port === '3000' ? '3001' : window.location.port;
      return `${protocol}//${hostname}:${port}`;
    }

    return `${protocol}//${hostname}`;
  }, [serverUrl]);

  const calculateTimeUntilExpiry = useCallback((): number => {
    if (!user) return 0;
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = user.expiresAt - now;
    return Math.max(0, timeLeft);
  }, [user]);

  // ========================================================================
  // OPÉRATIONS SERVEUR
  // ========================================================================

  /**
   * Valide la session auprès du serveur
   */
  const validateSessionOnServer = useCallback(async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`${getServerUrl()}/api/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include', // Important: inclure les cookies
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return false;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as { user: CrossSubdomainUser };
      setUser(data.user);
      setError(null);

      // Sauvegarder en cas de besoin offline
      if (useOfflineStorage) {
        await saveSessionToIndexedDB(data.user, token);
      }

      return true;
    } catch (err) {
      console.error('[UseCrossSubdomainAuth] Server validation failed:', err);
      return false;
    }
  }, [getServerUrl, useOfflineStorage]);

  /**
   * Rafraîchit le token via le refresh token
   */
  const refreshSessionToken = useCallback(async (): Promise<boolean> => {
    try {
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${getServerUrl()}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as {
        token: string;
        user: CrossSubdomainUser;
      };

      localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, data.token);
      setUser(data.user);
      setError(null);

      if (useOfflineStorage) {
        await saveSessionToIndexedDB(data.user, data.token);
      }

      return true;
    } catch (err) {
      console.error('[UseCrossSubdomainAuth] Token refresh failed:', err);
      setError('Session refresh failed');
      return false;
    }
  }, [getServerUrl, useOfflineStorage]);

  // ========================================================================
  // ACTIONS UTILISATEUR
  // ========================================================================

  /**
   * Connecte l'utilisateur avec un token
   */
  const login = useCallback(async (userId: string, sessionToken: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const success = await validateSessionOnServer(sessionToken);

      if (success) {
        localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, sessionToken);
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, String(Date.now()));
        return true;
      } else {
        setError('Invalid session token');
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [validateSessionOnServer]);

  /**
   * Déconnecte l'utilisateur
   */
  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
      
      if (token) {
        // Optionnel: notifier le serveur de la déconnexion
        try {
          await fetch(`${getServerUrl()}/api/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
          });
        } catch (err) {
          // Continuer même si le logout serveur échoue
          console.warn('[UseCrossSubdomainAuth] Server logout failed:', err);
        }
      }

      // Nettoyer le localStorage
      localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);

      setUser(null);
      setError(null);
    } catch (err) {
      console.error('[UseCrossSubdomainAuth] Logout failed:', err);
    }
  }, [getServerUrl]);

  /**
   * Rafraîchit manuellement la session
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    const token = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
    if (!token) return false;

    return validateSessionOnServer(token);
  }, [validateSessionOnServer]);

  // ========================================================================
  // INITIALISATION
  // ========================================================================

  /**
   * Charge la session au démarrage
   */
  useEffect(() => {
    const initSession = async () => {
      setIsLoading(true);

      try {
        // 1. Vérifier si un token est dans l'URL (partage de lien)
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('session_token');

        if (urlToken) {
          // Nettoyer l'URL
          window.history.replaceState({}, document.title, window.location.pathname);

          // Valider et sauvegarder
          const success = await validateSessionOnServer(urlToken);
          if (success) {
            localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, urlToken);
          }
          setIsLoading(false);
          return;
        }

        // 2. Vérifier le localStorage (session actuelle)
        const storedToken = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
        if (storedToken) {
          const success = await validateSessionOnServer(storedToken);
          if (success) {
            setIsLoading(false);
            return;
          }
        }

        // 3. Fallback: IndexedDB (offline cache)
        if (useOfflineStorage) {
          const offlineSession = await getSessionFromIndexedDB();
          if (offlineSession) {
            setUser(offlineSession.user);
            console.info('[UseCrossSubdomainAuth] Loaded from offline storage');
          }
        }
      } catch (err) {
        console.error('[UseCrossSubdomainAuth] Init failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [validateSessionOnServer, useOfflineStorage]);

  // ========================================================================
  // VALIDATION PÉRIODIQUE
  // ========================================================================

  /**
   * Valide périodiquement la session
   */
  useEffect(() => {
    if (!autoValidate || !user) return;

    const validate = async () => {
      const token = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
      if (token) {
        const success = await validateSessionOnServer(token);
        
        if (!success) {
          // Essayer le refresh token
          await refreshSessionToken();
        }
      }
    };

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastValidationRef.current > validationInterval * 1000) {
        validate();
        lastValidationRef.current = now;
      }
    }, SESSION_CHECK_INTERVAL * 1000);

    return () => clearInterval(interval);
  }, [autoValidate, user, validateSessionOnServer, refreshSessionToken, validationInterval]);

  // ========================================================================
  // NOTIFICATION EXPIRATION
  // ========================================================================

  /**
   * Notifie avant l'expiration de la session
   */
  useEffect(() => {
    if (!user || !onSessionExpiring) return;

    const checkExpiry = () => {
      const timeLeft = calculateTimeUntilExpiry();

      // Si < 5 minutes, notifier
      if (timeLeft > 0 && timeLeft < EXPIRING_SOON_THRESHOLD) {
        onSessionExpiring();

        // Rafraîchir automatiquement si possible
        if (timeLeft < 60) {
          refreshSessionToken();
        }
      }

      // Si expiré, déconnecter
      if (timeLeft <= 0) {
        logout();
      }
    };

    const interval = setInterval(checkExpiry, 10000); // Check tous les 10s

    return () => clearInterval(interval);
  }, [user, onSessionExpiring, calculateTimeUntilExpiry, refreshSessionToken, logout]);

  // ========================================================================
  // NETTOYAGE
  // ========================================================================

  useEffect(() => {
    return () => {
      if (validationTimerRef.current) clearInterval(validationTimerRef.current);
      if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
    };
  }, []);

  // ========================================================================
  // RÉSULTAT
  // ========================================================================

  const timeUntilExpiry = calculateTimeUntilExpiry();

  return {
    // État
    user,
    isAuthenticated: user !== null,
    isLoading,
    error,

    // Actions
    login,
    logout,
    refreshSession,

    // Infos
    sessionExpiresAt: user ? new Date(user.expiresAt * 1000) : null,
    timeUntilExpiry,
    isExpired: timeUntilExpiry <= 0,
    isExpiringSoon: timeUntilExpiry > 0 && timeUntilExpiry < EXPIRING_SOON_THRESHOLD,
  };
}
