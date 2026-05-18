-- ════════════════════════════════════════════════════════════════════════════
-- SCRIPT 019 — Créer les tables manquantes : order_modes + payment_methods
-- ⚠️  CRITIQUE : Sans ces tables, le panier ne fonctionne PAS
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Table order_modes ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_modes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  description TEXT,
  icon        TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  config      JSONB       NOT NULL DEFAULT '{}'
);

-- Données par défaut : les 3 modes de commande
INSERT INTO order_modes (code, name, description, icon, is_active, sort_order) VALUES
  ('delivery', 'Livraison',   'Livraison à votre adresse',     'bike',          true, 1),
  ('dine_in',  'Sur place',   'Commande à table, sans frais',  'utensils',      true, 2),
  ('takeaway', 'À emporter',  'Récupération au restaurant',    'shopping-bag',  true, 3)
ON CONFLICT (code) DO NOTHING;

-- RLS : tout le monde peut lire les modes actifs
ALTER TABLE order_modes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_modes_public_read" ON order_modes;
CREATE POLICY "order_modes_public_read" ON order_modes
  FOR SELECT USING (is_active = true);

-- Seul le superadmin peut modifier (optionnel, décommenter si besoin)
-- DROP POLICY IF EXISTS "order_modes_admin_all" ON order_modes;
-- CREATE POLICY "order_modes_admin_all" ON order_modes
--   FOR ALL USING (
--     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
--   );


-- ── 2. Table payment_methods ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_methods (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT    NOT NULL UNIQUE,
  name            TEXT    NOT NULL,
  description     TEXT,
  icon            TEXT,
  ussd_template   TEXT,           -- ex: '*880*{amount}#'
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  config          JSONB   NOT NULL DEFAULT '{}'
);

-- Données par défaut : les 3 opérateurs Mobile Money du Bénin
INSERT INTO payment_methods (code, name, description, ussd_template, is_active, sort_order) VALUES
  ('mtn',     'MTN MoMo',     'Paiement MTN Mobile Money', '*880*{amount}#',       true, 1),
  ('moov',    'Moov Money',   'Paiement Moov Money',       '*155*1*1*{amount}#',   true, 2),
  ('celtiis', 'Celtiis Cash', 'Paiement Celtiis Cash',     '*123*1*{amount}#',     true, 3)
ON CONFLICT (code) DO NOTHING;

-- RLS : tout le monde peut lire les méthodes actives
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_methods_public_read" ON payment_methods;
CREATE POLICY "payment_methods_public_read" ON payment_methods
  FOR SELECT USING (is_active = true);


-- ── 3. Vérification ──────────────────────────────────────────────────────────
SELECT 'order_modes' AS table_name, COUNT(*) AS rows FROM order_modes
UNION ALL
SELECT 'payment_methods', COUNT(*) FROM payment_methods;
-- Doit retourner : order_modes → 3, payment_methods → 3