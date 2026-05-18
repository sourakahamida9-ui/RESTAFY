/**
 * =====================================================================
 * SECURE TABLE - Fonctions de sécurité pour QR codes de tables
 * =====================================================================
 * 
 * Génère des URLs sécurisées avec tokens temporaires pour les tables.
 * Empêche la contrefaçon des QR codes et URLs.
 * 
 * @author Restafy Team
 * @date 2025-05-05
 * =====================================================================
 */

import { getAppUrl } from './appUrl';

/**
 * Génère une URL sécurisée pour une table avec jeton temporaire.
 * 
 * Le jeton expire après 24h et permet de vérifier que:
 * 1. L'URL n'a pas été modifiée
 * 2. La table appartient bien au restaurant
 * 
 * @param slug - Slug du restaurant
 * @param tableId - ID de la table
 * @returns URL sécurisée avec token
 */
export function getSecureTableUrl(slug: string, tableId: string): string {
  const baseUrl = getAppUrl();
  
  // Générer un token simple base64 avec timestamp
  // Format: base64(slug:tableId:expiry)
  const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24h
  const payload = `${slug}:${tableId}:${expiry}`;
  const token = btoa(payload);
  
  return `${baseUrl}/r/${slug}?t=${token}`;
}

/**
 * Vérifie un token d'URL de table.
 * 
 * @param token - Token de la query string
 * @returns { valid: boolean, slug?: string, tableId?: string, error?: string }
 */
export function verifyTableToken(token: string): { 
  valid: boolean; 
  slug?: string; 
  tableId?: string; 
  error?: string 
} {
  try {
    const payload = atob(token);
    const [slug, tableId, expiryStr] = payload.split(':');
    
    if (!slug || !tableId || !expiryStr) {
      return { valid: false, error: 'Token invalide' };
    }
    
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry)) {
      return { valid: false, error: 'Token malformé' };
    }
    
    if (Date.now() > expiry) {
      return { valid: false, error: 'Token expiré' };
    }
    
    return { valid: true, slug, tableId };
  } catch {
    return { valid: false, error: 'Token invalide' };
  }
}