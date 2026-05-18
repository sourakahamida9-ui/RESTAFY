-- ═══════════════════════════════════════════════════════════════════════════
-- RESTAFY 087 — GRANT INSERT service_role sur partner_join_requests
-- ═══════════════════════════════════════════════════════════════════════════
-- Si le formulaire vitrine renvoie une erreur alors que la table existe,
-- c’est souvent l’absence de privilège INSERT pour le rôle service_role
-- après REVOKE ALL … (script 083 exécuté avant cette ligne).
-- Idempotent : réexécuter sans risque.
-- ═══════════════════════════════════════════════════════════════════════════

GRANT INSERT ON public.partner_join_requests TO service_role;

-- Fin 087
