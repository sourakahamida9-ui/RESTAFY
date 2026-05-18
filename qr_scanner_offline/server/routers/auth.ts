/**
 * Router d'authentification cross-subdomain
 * 
 * Endpoints:
 * - POST /api/auth/validate - Valide une session existante
 * - POST /api/auth/refresh - Rafraîchit un token expirant
 * - POST /api/auth/logout - Déconnecte l'utilisateur
 * - GET /api/auth/config - Retourne la configuration auth
 */

import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import {
  generateSessionToken,
  validateSessionToken,
  validateRefreshToken,
  SessionType,
  extractSessionFromRequest,
  getCrossSubdomainCookieOptions,
  getAuthConfig,
} from '../_core/crossSubdomainAuth';
import type { TrpcContext } from '../_core/context';
import { z } from 'zod';

// ============================================================================
// PROCÉDURES
// ============================================================================

export const authRouter = router({
  /**
   * Valide la session actuelle et retourne les informations utilisateur
   */
  validate: publicProcedure.query(async ({ ctx }) => {
    const result = await extractSessionFromRequest(ctx.req);

    if (!result.session) {
      return {
        valid: false,
        error: result.error || 'No session found',
      };
    }

    return {
      valid: true,
      user: result.session,
    };
  }),

  /**
   * Crée une nouvelle session pour l'utilisateur
   */
  createSession: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        type: z.nativeEnum(SessionType),
        permissions: z.array(z.string()),
        restaurantId: z.string().uuid().optional(),
        eventId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const duration = {
          [SessionType.AGENT_SCAN]: 8 * 60 * 60,
          [SessionType.MANAGER]: 12 * 60 * 60,
          [SessionType.ADMIN]: 24 * 60 * 60,
          [SessionType.CLIENT]: 7 * 24 * 60 * 60,
        }[input.type];

        const { token, refreshToken } = await generateSessionToken({
          userId: input.userId,
          type: input.type,
          permissions: input.permissions,
          restaurantId: input.restaurantId,
          eventId: input.eventId,
          expiresAt: now + duration,
          issuer: 'restafy-sso',
          audience: 'restafy-subdomain-auth',
          subdomain: ctx.req.hostname?.includes('scan') ? 'scan' : 'app',
          userAgent: ctx.req.headers['user-agent'],
          ipAddress: ctx.req.ip || ctx.req.headers['x-forwarded-for']?.toString(),
        });

        // Définir les cookies
        const cookieOptions = getCrossSubdomainCookieOptions(ctx.req);
        ctx.res.cookie('auth-session', token, cookieOptions);
        ctx.res.cookie('auth-refresh', refreshToken, {
          ...cookieOptions,
          // Refresh token a une durée de vie plus longue
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 jours
        });

        const sessionResult = await validateSessionToken(token);
        if (!sessionResult.session) {
          throw new Error('Failed to validate created session');
        }

        return {
          token,
          refreshToken,
          user: sessionResult.session,
        };
      } catch (error) {
        throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  /**
   * Rafraîchit un token expirant
   */
  refreshSession: publicProcedure
    .input(
      z.object({
        refreshToken: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const refreshResult = await validateRefreshToken(input.refreshToken);

        if (!refreshResult.valid || !refreshResult.userId) {
          throw new Error('Invalid refresh token');
        }

        // Récupérer la session originale depuis la base de données
        // (Dans une vraie app, chercher la session dans la DB)
        // Pour cet exemple, on génère une nouvelle session

        const now = Math.floor(Date.now() / 1000);
        const { token: newToken } = await generateSessionToken({
          userId: refreshResult.userId,
          type: SessionType.AGENT_SCAN,
          permissions: ['scan:qr'],
          expiresAt: now + 8 * 60 * 60,
          issuer: 'restafy-sso',
          audience: 'restafy-subdomain-auth',
          subdomain: ctx.req.hostname?.includes('scan') ? 'scan' : 'app',
          userAgent: ctx.req.headers['user-agent'],
          ipAddress: ctx.req.ip || ctx.req.headers['x-forwarded-for']?.toString(),
        });

        // Définir le nouveau token en cookie
        const cookieOptions = getCrossSubdomainCookieOptions(ctx.req);
        ctx.res.cookie('auth-session', newToken, cookieOptions);

        const sessionResult = await validateSessionToken(newToken);
        if (!sessionResult.session) {
          throw new Error('Failed to validate refreshed session');
        }

        ctx.res.set('X-Auth-Token-Refreshed', 'true');

        return {
          token: newToken,
          user: sessionResult.session,
        };
      } catch (error) {
        throw new Error(`Failed to refresh session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  /**
   * Déconnecte l'utilisateur
   */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    // Nettoyer les cookies
    const cookieOptions = getCrossSubdomainCookieOptions(ctx.req);
    ctx.res.clearCookie('auth-session', cookieOptions);
    ctx.res.clearCookie('auth-refresh', cookieOptions);

    return { success: true };
  }),

  /**
   * Obtient la configuration d'authentification
   */
  getConfig: publicProcedure.query(() => {
    return getAuthConfig();
  }),

  /**
   * Vérifie les permissions de l'utilisateur actuel
   */
  checkPermissions: protectedProcedure
    .input(
      z.object({
        requiredPermissions: z.array(z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const result = await extractSessionFromRequest(ctx.req);

      if (!result.session) {
        return {
          granted: false,
          reason: 'No active session',
        };
      }

      if (!input.requiredPermissions || input.requiredPermissions.length === 0) {
        return {
          granted: true,
          session: result.session,
        };
      }

      // Vérifier que l'utilisateur a au moins une des permissions
      const hasPermission = input.requiredPermissions.some(
        permission =>
          result.session!.permissions.includes('*') ||
          result.session!.permissions.includes(permission)
      );

      return {
        granted: hasPermission,
        reason: hasPermission ? undefined : 'Insufficient permissions',
        session: hasPermission ? result.session : undefined,
      };
    }),

  /**
   * Renouvelle les permissions de l'utilisateur
   */
  updatePermissions: protectedProcedure
    .input(
      z.object({
        permissions: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await extractSessionFromRequest(ctx.req);

      if (!result.session) {
        throw new Error('No active session');
      }

      // Générer une nouvelle session avec les permissions mises à jour
      const now = Math.floor(Date.now() / 1000);
      const duration = 8 * 60 * 60; // Durée par défaut

      const { token } = await generateSessionToken({
        userId: result.session.userId,
        type: result.session.type,
        permissions: input.permissions,
        restaurantId: result.session.restaurantId,
        eventId: result.session.eventId,
        expiresAt: now + duration,
        issuer: 'restafy-sso',
        audience: 'restafy-subdomain-auth',
        subdomain: result.session.subdomain,
        userAgent: ctx.req.headers['user-agent'],
        ipAddress: ctx.req.ip || ctx.req.headers['x-forwarded-for']?.toString(),
      });

      // Définir le nouveau token
      const cookieOptions = getCrossSubdomainCookieOptions(ctx.req);
      ctx.res.cookie('auth-session', token, cookieOptions);

      const sessionResult = await validateSessionToken(token);
      if (!sessionResult.session) {
        throw new Error('Failed to validate updated session');
      }

      return {
        token,
        user: sessionResult.session,
      };
    }),
});
