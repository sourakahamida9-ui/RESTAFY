/**
 * API Routes pour la gestion des tokens de scanner QR
 * Endpoints pour créer, valider et gérer les tokens
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { publicProcedure, router, adminProcedure } from '../_core/trpc';
import type { TrpcContext } from '../types';
import { 
  generateToken, 
  validateToken, 
  createEventScanToken, 
  createTemporaryToken, 
  createAdminToken,
  getTokenDisplayInfo,
  TokenType,
  TokenPayload 
} from '../../shared/token';
import type { TokenInput, TokenValidationInput, TokenListInput, TokenRevokeInput, QRCodeInput } from '../types';

// Types pour les réponses
const TokenResponseSchema = z.object({
  token: z.string(),
  displayInfo: z.object({
    title: z.string(),
    description: z.string(),
    type: z.nativeEnum(TokenType),
    expiresAt: z.date(),
    remainingTime: z.string(),
  }),
  qrCode: z.string().optional(), // Base64 QR code
  shortUrl: z.string().optional(), // URL raccourcie pour partage
});

export const tokenRouter = router({
  /**
   * Génère un nouveau token pour scanner un événement
   */
  createEventToken: adminProcedure
    .input(z.object({
      eventId: z.string().uuid(),
      eventName: z.string().min(1),
      duration: z.number().min(300).max(86400 * 7).optional(), // 5min à 7 jours
      metadata: z.record(z.string(), z.any()).optional(),
    }))
    .output(TokenResponseSchema)
    .mutation(async ({ input, ctx }: { input: TokenInput; ctx: TrpcContext }) => {
      try {
        // Vérifier que l'événement existe
        const event = await ctx.db.query.events.findFirst({
          where: (events: any, { eq }: { eq: any }) => eq(events.id, input.eventId),
        });

        if (!event) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Événement non trouvé',
          });
        }

        // Générer le token
        const token = await createEventScanToken(
          input.eventId,
          input.eventName,
          input.duration
        );

        // Générer les infos d'affichage
        const payload = await validateToken(token);
        if (!payload.valid || !payload.payload) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur génération token',
          });
        }

        const displayInfo = getTokenDisplayInfo(payload.payload);

        // TODO: Générer QR code et URL raccourcie
        const qrCode = await generateQRCode(token);
        const shortUrl = await generateShortUrl(token);

        return {
          token,
          displayInfo,
          qrCode,
          shortUrl,
        };
      } catch (error) {
        console.error('[Token] Erreur création token événement:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur création token',
        });
      }
    }),

  /**
   * Génère un token temporaire
   */
  createTemporaryToken: adminProcedure
    .input(z.object({
      permissions: z.array(z.string()).optional(),
      duration: z.number().min(300).max(86400 * 7).optional(),
      purpose: z.string().optional(),
    }))
    .output(TokenResponseSchema)
    .mutation(async ({ input }: { input: any }) => {
      try {
        const token = await createTemporaryToken(
          input.permissions || ['scan:qr', 'read:events'],
          input.duration
        );

        const payload = await validateToken(token);
        if (!payload.valid || !payload.payload) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Erreur génération token',
          });
        }

        const displayInfo = getTokenDisplayInfo(payload.payload);
        const qrCode = await generateQRCode(token);
        const shortUrl = await generateShortUrl(token);

        return {
          token,
          displayInfo,
          qrCode,
          shortUrl,
        };
      } catch (error) {
        console.error('[Token] Erreur création token temporaire:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur création token',
        });
      }
    }),

  /**
   * Valide un token (endpoint public pour le scanner)
   */
  validateToken: publicProcedure
    .input(z.object({
      token: z.string().min(1),
    }))
    .output(z.object({
      valid: z.boolean(),
      payload: z.any().optional(),
      error: z.string().optional(),
    }))
    .query(async ({ input }: { input: TokenValidationInput }) => {
      try {
        const result = await validateToken(input.token);
        return result;
      } catch (error) {
        console.error('[Token] Erreur validation:', error);
        return {
          valid: false,
          error: 'Erreur validation token',
        };
      }
    }),

  /**
   * Liste tous les tokens actifs (admin seulement)
   */
  listActiveTokens: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      type: z.nativeEnum(TokenType).optional(),
    }))
    .query(async ({ input, ctx }: { input: TokenListInput; ctx: TrpcContext }) => {
      try {
        // TODO: Implémenter la persistance des tokens en base
        // Pour l'instant, retourner une structure vide
        
        return {
          tokens: [],
          total: 0,
          hasMore: false,
        };
      } catch (error) {
        console.error('[Token] Erreur listing tokens:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur récupération tokens',
        });
      }
    }),

  /**
   * Révoque un token (admin seulement)
   */
  revokeToken: adminProcedure
    .input(z.object({
      tokenId: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }: { input: TokenRevokeInput; ctx: TrpcContext }) => {
      try {
        // TODO: Implémenter la révocation en base
        // Pour l'instant, juste logging
        
        console.log(`[Token] Token révoqué: ${input.tokenId}`, { reason: input.reason });
        
        return { success: true };
      } catch (error) {
        console.error('[Token] Erreur révocation token:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur révocation token',
        });
      }
    }),

  /**
   * Génère un QR code pour un token
   */
  generateQRCode: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      size: z.number().min(100).max(500).default(200),
    }))
    .output(z.object({
      qrCode: z.string(), // Base64 image
      success: z.boolean(),
    }))
    .mutation(async ({ input }: { input: QRCodeInput }) => {
      try {
        const qrCode = await generateQRCode(input.token, input.size);
        return {
          qrCode,
          success: true,
        };
      } catch (error) {
        console.error('[Token] Erreur génération QR code:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erreur génération QR code',
        });
      }
    }),
});

/**
 * Génère un QR code en base64 pour un token
 */
async function generateQRCode(token: string, size: number = 200): Promise<string> {
  const QRCode = await import('qrcode');
  
  try {
    const qrDataUrl = await QRCode.toDataURL(token, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    
    return qrDataUrl;
  } catch (error) {
    console.error('[QR] Erreur génération QR code:', error);
    throw new Error('Impossible de générer le QR code');
  }
}

/**
 * Génère une URL raccourcie pour le partage
 */
async function generateShortUrl(token: string): Promise<string> {
  // TODO: Implémenter un service de short URL
  // Pour l'instant, retourner l'URL directe
  const baseUrl = process.env.SCANNER_APP_URL || 'https://scanner.restafy.shop';
  return `${baseUrl}/?token=${encodeURIComponent(token)}`;
}
