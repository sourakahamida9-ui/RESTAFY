/**
 * Système de token sécurisé pour QR Scanner Offline
 * Tokens JWT avec expiration, permissions et événements associés
 */

import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

// Types de tokens
export enum TokenType {
  EVENT_SCAN = 'event_scan',    // Scanner un événement spécifique
  TEMPORARY = 'temporary',       // Accès temporaire général
  ADMIN = 'admin',              // Accès admin complet
}

// Durées d'expiration (en secondes)
export const TOKEN_DURATIONS = {
  [TokenType.EVENT_SCAN]: 24 * 60 * 60,      // 24 heures
  [TokenType.TEMPORARY]: 2 * 60 * 60,         // 2 heures  
  [TokenType.ADMIN]: 7 * 24 * 60 * 60,        // 7 jours
};

// Schéma de validation pour token payload
export const TokenPayloadSchema = z.object({
  type: z.nativeEnum(TokenType),
  eventId: z.string().optional(),
  eventName: z.string().optional(),
  permissions: z.array(z.string()),
  issuedAt: z.number(),
  expiresAt: z.number(),
  issuer: z.string(),
  audience: z.string(),
  tokenId: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

// Configuration JWT
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
);

const JWT_ISSUER = process.env.JWT_ISSUER || 'restafy-qr-scanner';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'qr-scanner-app';

/**
 * Génère un token JWT sécurisé
 */
export async function generateToken(payload: Omit<TokenPayload, 'issuedAt' | 'tokenId'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenId = crypto.randomUUID();
  
  const fullPayload: TokenPayload = {
    ...payload,
    issuedAt: now,
    tokenId,
  };

  // Validation du payload
  const validated = TokenPayloadSchema.parse(fullPayload);

  return await new SignJWT(validated)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(validated.issuedAt)
    .setExpirationTime(validated.expiresAt)
    .setIssuer(validated.issuer)
    .setAudience(validated.audience)
    .setJti(validated.tokenId)
    .sign(JWT_SECRET);
}

/**
 * Valide et décode un token JWT
 */
export async function validateToken(token: string): Promise<{
  valid: boolean;
  payload?: TokenPayload;
  error?: string;
}> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    const validated = TokenPayloadSchema.parse(payload);

    // Vérification additionnelle de l'expiration
    const now = Math.floor(Date.now() / 1000);
    if (validated.expiresAt < now) {
      return { valid: false, error: 'Token expiré' };
    }

    return { valid: true, payload: validated };
  } catch (error) {
    console.error('[Token] Erreur validation:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        return { valid: false, error: 'Token expiré' };
      }
      if (error.message.includes('signature')) {
        return { valid: false, error: 'Signature invalide' };
      }
      if (error.message.includes('audience')) {
        return { valid: false, error: 'Audience invalide' };
      }
    }
    
    return { valid: false, error: 'Token invalide' };
  }
}

/**
 * Crée un token pour scanner un événement
 */
export async function createEventScanToken(
  eventId: string,
  eventName: string,
  customDuration?: number
): Promise<string> {
  const duration = customDuration || TOKEN_DURATIONS[TokenType.EVENT_SCAN];
  const expiresAt = Math.floor(Date.now() / 1000) + duration;

  return generateToken({
    type: TokenType.EVENT_SCAN,
    eventId,
    eventName,
    permissions: ['scan:qr', 'read:events', 'write:scans'],
    expiresAt,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    metadata: {
      purpose: 'event_scanning',
      version: '1.0',
    },
  });
}

/**
 * Crée un token temporaire pour test/démo
 */
export async function createTemporaryToken(
  permissions: string[] = ['scan:qr', 'read:events'],
  duration?: number
): Promise<string> {
  const tokenDuration = duration || TOKEN_DURATIONS[TokenType.TEMPORARY];
  const expiresAt = Math.floor(Date.now() / 1000) + tokenDuration;

  return generateToken({
    type: TokenType.TEMPORARY,
    permissions,
    expiresAt,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    metadata: {
      purpose: 'temporary_access',
      version: '1.0',
    },
  });
}

/**
 * Crée un token admin complet
 */
export async function createAdminToken(
  adminId: string,
  duration?: number
): Promise<string> {
  const tokenDuration = duration || TOKEN_DURATIONS[TokenType.ADMIN];
  const expiresAt = Math.floor(Date.now() / 1000) + tokenDuration;

  return generateToken({
    type: TokenType.ADMIN,
    permissions: ['*'], // Tous les droits
    expiresAt,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    metadata: {
      adminId,
      purpose: 'admin_access',
      version: '1.0',
    },
  });
}

/**
 * Extrait les informations d'un token pour l'affichage
 */
export function getTokenDisplayInfo(payload: TokenPayload): {
  title: string;
  description: string;
  type: TokenType;
  expiresAt: Date;
  remainingTime: string;
} {
  const expiresAt = new Date(payload.expiresAt * 1000);
  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  
  let remainingTime = '';
  if (diffMs > 0) {
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      remainingTime = `${days} jour(s) ${hours % 24}h`;
    } else if (hours > 0) {
      remainingTime = `${hours}h ${minutes}min`;
    } else {
      remainingTime = `${minutes} minutes`;
    }
  } else {
    remainingTime = 'Expiré';
  }

  let title = '';
  let description = '';
  
  switch (payload.type) {
    case TokenType.EVENT_SCAN:
      title = `Scanner: ${payload.eventName || 'Événement'}`;
      description = `Accès scan pour l'événement ${payload.eventId}`;
      break;
    case TokenType.TEMPORARY:
      title = 'Accès Temporaire';
      description = 'Accès limité pour test/démonstration';
      break;
    case TokenType.ADMIN:
      title = 'Accès Admin';
      description = 'Accès complet à toutes les fonctionnalités';
      break;
  }

  return {
    title,
    description,
    type: payload.type,
    expiresAt,
    remainingTime,
  };
}
