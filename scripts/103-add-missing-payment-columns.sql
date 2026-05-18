-- =====================================================
-- 103 — Ajout colonnes manquantes pour la confirmation de paiement
-- =====================================================
-- Bug observé : le webhook Kkiapay (api/webhooks/index.ts), la RPC
-- confirm_payment (script 094/100) et le polling de vérif
-- (api/payments/initiate.ts) tentent tous d'écrire `paid_at` sur
-- `orders` et `ticket_orders`, plus `payment_method` sur `orders`
-- (CaissePOS.tsx pour les paiements cash). Aucune migration n'a
-- jamais ajouté ces colonnes au schéma initial (01-create-schema.sql),
-- donc chaque tentative de confirmation échoue avec
--   ERROR: column "paid_at" of relation "orders" does not exist
-- → la commande reste bloquée en `pending` même après paiement validé.
--
-- Cette migration est IDEMPOTENTE (ADD COLUMN IF NOT EXISTS) et
-- 100 % additive — aucune donnée existante n'est touchée.
-- =====================================================

BEGIN;

-- ── orders ─────────────────────────────────────────────────────────
-- Horodatage du paiement (utilisé par confirm_payment, webhook Kkiapay,
-- le polling /api/payments/initiate?action=verify et la Caisse).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Méthode de paiement (cash | kkiapay | wave | …). La Caisse
-- (CaissePOS.tsx) écrit 'cash' au moment de confirmer un paiement
-- en espèces. Volontairement TEXT et pas l'ENUM `payment_method`
-- existant (qui ne contient que les codes USSD historiques).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- ── ticket_orders ──────────────────────────────────────────────────
-- Même logique que `orders.paid_at` mais pour les commandes de billets
-- d'événements. Référencé par api/webhooks/index.ts:447 et 1119,
-- api/payments/initiate.ts:607, et par les RPC confirm_payment.
ALTER TABLE public.ticket_orders
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Index utile : retrouver rapidement les commandes confirmées
-- (utilisé par le dashboard resto et le rapport hebdo).
CREATE INDEX IF NOT EXISTS idx_orders_paid_at
  ON public.orders(paid_at DESC)
  WHERE paid_at IS NOT NULL;

COMMIT;

-- =====================================================
-- Vérification rapide (optionnel — décommenter pour exécuter dans le
-- SQL Editor Supabase et confirmer que les colonnes existent bien) :
-- =====================================================
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name IN ('orders', 'ticket_orders')
--    AND column_name IN ('paid_at', 'payment_method')
--  ORDER BY table_name, column_name;
