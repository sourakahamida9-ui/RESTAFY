/**
 * =====================================================================
 * USE CART STORE (COMPATIBILITÉ)
 * =====================================================================
 * 
 * Ce fichier est maintenu pour la backwards兼容ibilité.
 * Tous les nouveaux composants DOIVENT importer directement depuis:
 *   import { useCartStore } from '@/hooks/useOrderCart';
 * 
 * @deprecated Utiliser @/hooks/useOrderCart à la place
 * @author Restafy Team
 * @date 2025-05-05
 * =====================================================================
 */

// Ré-exporte depuis le nouveau store
export { useCartStore } from '@/hooks/useOrderCart';
export type { CartItem } from '@/hooks/useOrderCart';
