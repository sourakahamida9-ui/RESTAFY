/**
 * Cross-Subdomain Authentication System
 * 
 * Gère l'authentification SSO entre:
 * - scan.restafy.shop (PWA QR Scanner)
 * - app.restafy.shop (Main Application)
 * 
 * Architecture:
 * 1. Cookies HttpOnly avec domain=.restafy.shop (partagés entre sous-domaines)
 * 2. Tokens JWT sécurisés stockés côté serveur (sessions sécurisées)
 * 3. Validation cross-subdomain sur chaque requête
 * 4. Refresh tokens pour renouvellement automatique
 */

import { SignJWT, jwtVerify } from 'jose';
import type { Request, Response } from 'express';
import { z } from 'zod';

// ============================================================================
// TYPES ET SCHÉMAS
// ============================================================================

export enum SessionType {
  AGENT_SCAN = 'agent_scan',      // Vendeur QR Scanner
  MANAGER = 'manager',            // Manager restaurant  
  ADMIN = 'admin',                // Admin système
  CLIENT = 'client',              // Client/utilisateur final
}

export const CrossSubdomainSessionSchema = z.object({
  // Identité
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  
  // Type et droits
  type: z.nativeEnum(SessionType),
  permissions: z.array(z.string()),
  
  // Contexte métier
  restaurantId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  
  // Timing
  issuedAt: z.number(),
  expiresAt: z.number(),
  lastValidated: z.number().optional(),
  
  // Signature
  issuer: z.string(),
  audience: z.string(),
  nonce: z.string(),
  
  // Métadonnées
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  subdomain: z.enum(['scan', 'app']),
});

export type CrossSubdomainSession = z.infer<typeof CrossSubdomainSessionSchema>;

// ============================================================================
// CONFIGURATION
// ============================================================================

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'change-me-in-production-super-secret-key'
);

const JWT_ISSUER = 'restafy-sso';
const JWT_AUDIENCE = 'restafy-subdomain-auth';

// Durées de vie des tokens (en secondes)
export const SESSION_DURATIONS = {
  [SessionType.AGENT_SCAN]: 8 * 60 * 60,    // 8 heures
  [SessionType.MANAGER]: 12 * 60 * 60,      // 12 heures
  [SessionType.ADMIN]: 24 * 60 * 60,        // 24 heures
  [SessionType.CLIENT]: 7 * 24 * 60 * 60,   // 7 jours
};

// Refresh token expiration: 2x la durée de vie du session token
export const REFRESH_TOKEN_DURATION = 30 * 24 * 60 * 60; // 30 jours

// ============================================================================
// COOKIE CONFIGURATION POUR CROSS-SUBDOMAIN
// ============================================================================

/**
 * Configurations des cookies pour partage entre sous-domaines
 * - domain: .restafy.shop (permet tous les sous-domaines)
 * - httpOnly: true (sécurisé contre XSS)
 * - sameSite: 'none' (necessary pour cross-subdomain)
 * - secure: true (HTTPS only)
 */
export function getCrossSubdomainCookieOptions(req: Request) {
  const isSecure = req.protocol === 'https' || 
                   req.headers['x-forwarded-proto'] === 'https';
  
  return {
    httpOnly: true,           // Protection XSS
    path: '/',                // Valide pour toutes les routes
    domain: '.restafy.shop',  // Partagé entre scan.restafy.shop et app.restafy.shop
    sameSite: 'none' as const, // Nécessaire pour cross-subdomain
    secure: isSecure,         // HTTPS only en production
  };
}

// ============================================================================
// GÉNÉRATION ET VALIDATION DE TOKENS
// ============================================================================

/**
 * Génère un token de session JWT sécurisé
 */
export async function generateSessionToken(
  payload: Omit<CrossSubdomainSession, 'issuedAt' | 'sessionId' | 'nonce'>
): Promise<{ token: string; refreshToken: string }> {
  const now = Math.floor(Date.now() / 1000);
  const sessionId = crypto.randomUUID();
  const nonce = crypto.randomUUID();

  const session: CrossSubdomainSession = {
    ...payload,
    sessionId,
    nonce,
    issuedAt: now,
  };

  // Validation du schema
  const validated = CrossSubdomainSessionSchema.parse(session);

  // Token de session (courte durée)
  const token = await new SignJWT(validated)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(validated.issuedAt)
    .setExpirationTime(validated.expiresAt)
    .setIssuer(validated.issuer)
    .setAudience(validated.audience)
    .setJti(validated.sessionId)
    .sign(JWT_SECRET);

  // Refresh token (longue durée) - contient seulement l'ID de session
  const refreshToken = await new SignJWT({
    sessionId,
    userId: payload.userId,
    type: payload.type,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TOKEN_DURATION)
    .setIssuer(validated.issuer)
    .setAudience(validated.audience)
    .sign(JWT_SECRET);

  return { token, refreshToken };
}

/**
 * Valide un token de session JWT
 */
export async function validateSessionToken(token: string): Promise<{
  valid: boolean;
  session?: CrossSubdomainSession;
  error?: string;
}> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    const session = CrossSubdomainSessionSchema.parse(payload);

    // Vérification additionnelle de l'expiration
    const now = Math.floor(Date.now() / 1000);
    if (session.expiresAt < now) {
      return { valid: false, error: 'Session expirée' };
    }

    return { valid: true, session };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Token invalide';
    
    if (errorMsg.includes('expired')) {
      return { valid: false, error: 'Session expirée' };
    }
    if (errorMsg.includes('signature')) {
      return { valid: false, error: 'Signature invalide' };
    }
    if (errorMsg.includes('audience')) {
      return { valid: false, error: 'Audience invalide' };
    }

    return { valid: false, error: 'Token invalide' };
  }
}

/**
 * Valide un refresh token et génère une nouvelle session
 */
export async function validateRefreshToken(token: string): Promise<{
  valid: boolean;
  sessionId?: string;
  userId?: string;
  error?: string;
}> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = typeof payload.exp === 'number' ? payload.exp : 0;

    if (expiresAt < now) {
      return { valid: false, error: 'Refresh token expiré' };
    }

    return {
      valid: true,
      sessionId: payload.sessionId as string,
      userId: payload.userId as string,
    };
  } catch (error) {
    return { valid: false, error: 'Refresh token invalide' };
  }
}

// ============================================================================
// EXTRACTION DE SESSION DEPUIS REQUEST
// ============================================================================

/**
 * Extrait la session depuis les cookies ou headers Authorization
 */
export async function extractSessionFromRequest(
  req: Request
): Promise<{
  session?: CrossSubdomainSession;
  error?: string;
}> {
  try {
    // 1. Chercher le token dans les cookies (par défaut)
    const cookieToken = req.cookies?.['auth-session'];
    
    // 2. Fallback sur Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    const headerToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : null;

    const token = cookieToken || headerToken;

    if (!token) {
      return { error: 'Aucune session trouvée' };
    }

    const result = await validateSessionToken(token);
    
    if (!result.valid) {
      return { error: result.error };
    }

    return { session: result.session };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erreur extraction session';
    return { error: msg };
  }
}

// ============================================================================
// MIDDLEWARE AUTHENTIFICATION
// ============================================================================

export async function authenticateRequest(
  req: Request,
  res: Response
): Promise<CrossSubdomainSession | null> {
  const result = await extractSessionFromRequest(req);

  if (!result.session) {
    return null;
  }

  // Optionnel: mettre à jour lastValidated dans la session
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = result.session.expiresAt - now;

  // Si proche de l'expiration (< 5 min), le client devrait rafraîchir
  if (timeUntilExpiry < 300) {
    res.set('X-Session-Expiring-Soon', 'true');
  }

  return result.session;
}

// ============================================================================
// PERMUTATION ET VALIDATION DE PERMISSIONS
// ============================================================================

/**
 * Vérifie si une session a une permission donnée
 */
export function hasPermission(
  session: CrossSubdomainSession | null,
  requiredPermission: string
): boolean {
  if (!session) return false;
  
  // Admin a tous les droits
  if (session.permissions.includes('*')) return true;
  
  return session.permissions.includes(requiredPermission);
}

/**
 * Vérifie si une session peut accéder à un restaurant spécifique
 */
export function canAccessRestaurant(
  session: CrossSubdomainSession | null,
  restaurantId: string
): boolean {
  if (!session) return false;
  
  // Admin peut accéder à tous les restaurants
  if (session.permissions.includes('*')) return true;
  
  // Vérifier si le restaurantId correspond
  if (session.restaurantId && session.restaurantId === restaurantId) {
    return session.permissions.includes('restaurant:read');
  }

  return false;
}

/**
 * Vérifie si une session peut scanner pour un événement spécifique
 */
export function canScanEvent(
  session: CrossSubdomainSession | null,
  eventId: string
): boolean {
  if (!session) return false;

  // Admin peut scanner tous les événements
  if (session.permissions.includes('*')) return true;

  // Vérifier si c'est un agent de scan pour cet événement
  if (session.eventId && session.eventId === eventId) {
    return session.permissions.includes('event:scan');
  }

  return false;
}

// ============================================================================
// HELPERS DE DEBUGGING/MONITORING
// ============================================================================

/**
 * Formatte les informations de session pour les logs
 */
export function formatSessionInfo(session: CrossSubdomainSession): string {
  const expiresAt = new Date(session.expiresAt * 1000);
  const now = new Date();
  const timeLeft = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  const timeLeftStr = `${Math.floor(timeLeft / 3600)}h ${Math.floor((timeLeft % 3600) / 60)}min`;

  return (
    `[Session] ` +
    `user=${session.userId.slice(0, 8)} ` +
    `type=${session.type} ` +
    `expires=${timeLeftStr}`
  );
}

/**
 * Exporte la configuration pour le frontend
 */
export function getAuthConfig(): {
  issuer: string;
  audience: string;
  cookieName: string;
  refreshCookieName: string;
  sessionDurations: typeof SESSION_DURATIONS;
  refreshTokenDuration: number;
} {
  return {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    cookieName: 'auth-session',
    refreshCookieName: 'auth-refresh',
    sessionDurations: SESSION_DURATIONS,
    refreshTokenDuration: REFRESH_TOKEN_DURATION,
  };
}
