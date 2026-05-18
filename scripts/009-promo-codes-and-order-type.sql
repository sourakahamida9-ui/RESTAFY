-- ════════════════════════════════════════════════════════════════════
-- RESTAFY — SQL : Codes promo + type de commande
-- À exécuter dans Supabase SQL Editor (dans l'ordre)
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Table promo_codes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID        NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  code              TEXT        NOT NULL,
  description       TEXT,
  discount_type     TEXT        NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value    NUMERIC     NOT NULL CHECK (discount_value > 0),
  min_order_amount  NUMERIC     DEFAULT 0,
  max_uses          INTEGER,                       -- NULL = illimité
  used_count        INTEGER     NOT NULL DEFAULT 0,
  expires_at        TIMESTAMPTZ,                   -- NULL = pas de limite
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour lookup rapide lors du passage de commande
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_restaurant_code
  ON promo_codes (restaurant_id, code);

CREATE INDEX IF NOT EXISTS idx_promo_active
  ON promo_codes (restaurant_id, is_active);

-- ── 2. Colonne order_type dans orders ────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'delivery';

-- Mettre à jour les anciennes commandes sans order_type
UPDATE orders SET order_type = 'delivery' WHERE order_type IS NULL;

-- ── 3. Colonne table_number (pour dine_in) ───────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS table_number TEXT;

-- ── 4. Colonne promo_code_id dans orders ────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promo_code TEXT;   -- stocker le code en clair au cas où

-- ── 5. RLS policies pour promo_codes ────────────────────────────────

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Lecture par le restaurant owner / manager
DROP POLICY IF EXISTS "promo_select_owner" ON promo_codes;
CREATE POLICY "promo_select_owner" ON promo_codes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND restaurant_id = promo_codes.restaurant_id
        AND role IN ('restaurant_owner', 'manager')
    )
  );

-- Lecture par n'importe quel client connecté (pour valider un code)
DROP POLICY IF EXISTS "promo_select_client" ON promo_codes;
CREATE POLICY "promo_select_client" ON promo_codes
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND is_active = true
  );

-- Insert / Update / Delete : owner seulement
DROP POLICY IF EXISTS "promo_insert_owner" ON promo_codes;
CREATE POLICY "promo_insert_owner" ON promo_codes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND restaurant_id = promo_codes.restaurant_id
        AND role IN ('restaurant_owner', 'manager')
    )
  );

DROP POLICY IF EXISTS "promo_update_owner" ON promo_codes;
CREATE POLICY "promo_update_owner" ON promo_codes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND restaurant_id = promo_codes.restaurant_id
        AND role IN ('restaurant_owner', 'manager')
    )
  );

DROP POLICY IF EXISTS "promo_delete_owner" ON promo_codes;
CREATE POLICY "promo_delete_owner" ON promo_codes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND restaurant_id = promo_codes.restaurant_id
        AND role IN ('restaurant_owner', 'manager')
    )
  );

-- ── 6. Policies pour restaurant creation ────────────────────────────

-- S'assurer que restaurant_owner peut insérer un restaurant
DROP POLICY IF EXISTS "owner_insert_restaurant" ON restaurants;
CREATE POLICY "owner_insert_restaurant" ON restaurants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- S'assurer que owner peut mettre à jour son profil pour lier restaurant_id
DROP POLICY IF EXISTS "profiles_own_update" ON profiles;
CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ── 7. Fonction utilitaire : valider un code promo ───────────────────
CREATE OR REPLACE FUNCTION validate_promo_code(
  p_restaurant_id UUID,
  p_code          TEXT,
  p_subtotal      NUMERIC
)
RETURNS TABLE (
  valid            BOOLEAN,
  discount_type    TEXT,
  discount_value   NUMERIC,
  discount_amount  NUMERIC,
  error_message    TEXT
) AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_promo
  FROM promo_codes
  WHERE restaurant_id = p_restaurant_id
    AND code = UPPER(p_code)
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, 'Code invalide ou inexistant';
    RETURN;
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < NOW() THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, 'Code expiré';
    RETURN;
  END IF;

  IF v_promo.max_uses IS NOT NULL AND v_promo.used_count >= v_promo.max_uses THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, 'Code épuisé';
    RETURN;
  END IF;

  IF COALESCE(v_promo.min_order_amount, 0) > p_subtotal THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC,
      'Commande minimale de ' || v_promo.min_order_amount || ' FCFA requise';
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true,
    v_promo.discount_type,
    v_promo.discount_value,
    CASE
      WHEN v_promo.discount_type = 'percent'
        THEN ROUND(p_subtotal * v_promo.discount_value / 100)
      ELSE v_promo.discount_value
    END,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
