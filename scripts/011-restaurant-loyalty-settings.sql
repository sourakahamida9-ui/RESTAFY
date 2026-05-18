-- Migration: Restaurant Loyalty Settings
-- Chaque restaurant peut definir ses propres regles de fidelite

-- 1. Ajouter les colonnes de configuration fidelite aux restaurants
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS loyalty_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS loyalty_points_per_fcfa numeric DEFAULT 0.01,
ADD COLUMN IF NOT EXISTS loyalty_min_points_redeem integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS loyalty_welcome_bonus integer DEFAULT 50;

-- 2. Creer ou remplacer la fonction d'attribution de points
CREATE OR REPLACE FUNCTION award_loyalty_points(
  p_order_id uuid,
  p_customer_id uuid,
  p_restaurant_id uuid,
  p_order_amount numeric
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_points_per_fcfa numeric;
  v_loyalty_enabled boolean;
  v_points_earned integer;
  v_account_id uuid;
  v_current_points integer;
  v_new_level text;
BEGIN
  -- Recuperer les settings du restaurant
  SELECT loyalty_enabled, loyalty_points_per_fcfa
  INTO v_loyalty_enabled, v_points_per_fcfa
  FROM restaurants
  WHERE id = p_restaurant_id;

  -- Si fidelite desactivee, retourner 0
  IF NOT v_loyalty_enabled THEN
    RETURN 0;
  END IF;

  -- Calculer les points gagnes
  v_points_earned := FLOOR(p_order_amount * COALESCE(v_points_per_fcfa, 0.01));

  IF v_points_earned <= 0 THEN
    RETURN 0;
  END IF;

  -- Trouver ou creer le compte fidelite
  SELECT id, points INTO v_account_id, v_current_points
  FROM loyalty_accounts
  WHERE customer_id = p_customer_id AND restaurant_id = p_restaurant_id;

  IF v_account_id IS NULL THEN
    -- Creer le compte avec bonus de bienvenue
    INSERT INTO loyalty_accounts (customer_id, restaurant_id, points, total_earned, level)
    VALUES (p_customer_id, p_restaurant_id, v_points_earned, v_points_earned, 'bronze')
    RETURNING id, points INTO v_account_id, v_current_points;
  ELSE
    -- Mettre a jour le compte existant
    UPDATE loyalty_accounts
    SET points = points + v_points_earned,
        total_earned = total_earned + v_points_earned,
        updated_at = now()
    WHERE id = v_account_id
    RETURNING points INTO v_current_points;
  END IF;

  -- Determiner le nouveau niveau
  v_new_level := CASE
    WHEN v_current_points >= 10000 THEN 'platinum'
    WHEN v_current_points >= 5000 THEN 'gold'
    WHEN v_current_points >= 1000 THEN 'silver'
    ELSE 'bronze'
  END;

  -- Mettre a jour le niveau si change
  UPDATE loyalty_accounts
  SET level = v_new_level
  WHERE id = v_account_id AND level != v_new_level;

  -- Enregistrer la transaction
  INSERT INTO loyalty_transactions (account_id, order_id, points, type, description)
  VALUES (v_account_id, p_order_id, v_points_earned, 'earn', 
          'Commande #' || COALESCE((SELECT order_number FROM orders WHERE id = p_order_id), p_order_id::text));

  -- Mettre a jour la commande avec les points gagnes
  UPDATE orders
  SET points_earned = v_points_earned
  WHERE id = p_order_id;

  RETURN v_points_earned;
END;
$$;

-- 3. Fonction pour utiliser des points
CREATE OR REPLACE FUNCTION redeem_loyalty_points(
  p_customer_id uuid,
  p_restaurant_id uuid,
  p_points_to_redeem integer,
  p_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account_id uuid;
  v_current_points integer;
  v_min_redeem integer;
  v_discount_value numeric;
BEGIN
  -- Recuperer le minimum de points pour redemption
  SELECT loyalty_min_points_redeem INTO v_min_redeem
  FROM restaurants WHERE id = p_restaurant_id;

  -- Verifier le compte
  SELECT id, points INTO v_account_id, v_current_points
  FROM loyalty_accounts
  WHERE customer_id = p_customer_id AND restaurant_id = p_restaurant_id;

  IF v_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Compte fidelite introuvable');
  END IF;

  IF v_current_points < p_points_to_redeem THEN
    RETURN jsonb_build_object('success', false, 'error', 'Points insuffisants');
  END IF;

  IF p_points_to_redeem < COALESCE(v_min_redeem, 100) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum ' || v_min_redeem || ' points requis');
  END IF;

  -- Calculer la reduction (1 point = 10 FCFA)
  v_discount_value := p_points_to_redeem * 10;

  -- Deduire les points
  UPDATE loyalty_accounts
  SET points = points - p_points_to_redeem,
      total_redeemed = total_redeemed + p_points_to_redeem,
      updated_at = now()
  WHERE id = v_account_id;

  -- Enregistrer la transaction
  INSERT INTO loyalty_transactions (account_id, order_id, points, type, description)
  VALUES (v_account_id, p_order_id, -p_points_to_redeem, 'redeem', 
          'Utilisation de ' || p_points_to_redeem || ' points');

  RETURN jsonb_build_object(
    'success', true, 
    'discount', v_discount_value,
    'points_used', p_points_to_redeem,
    'remaining_points', v_current_points - p_points_to_redeem
  );
END;
$$;

-- 4. Fonction pour obtenir le compte fidelite client
CREATE OR REPLACE FUNCTION get_customer_loyalty(
  p_customer_id uuid,
  p_restaurant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account jsonb;
  v_restaurant jsonb;
BEGIN
  -- Infos du compte
  SELECT jsonb_build_object(
    'account_id', la.id,
    'points', COALESCE(la.points, 0),
    'level', COALESCE(la.level, 'bronze'),
    'total_earned', COALESCE(la.total_earned, 0),
    'total_redeemed', COALESCE(la.total_redeemed, 0)
  ) INTO v_account
  FROM loyalty_accounts la
  WHERE la.customer_id = p_customer_id AND la.restaurant_id = p_restaurant_id;

  -- Config du restaurant
  SELECT jsonb_build_object(
    'loyalty_enabled', COALESCE(r.loyalty_enabled, true),
    'points_per_fcfa', COALESCE(r.loyalty_points_per_fcfa, 0.01),
    'min_points_redeem', COALESCE(r.loyalty_min_points_redeem, 100),
    'restaurant_name', r.name
  ) INTO v_restaurant
  FROM restaurants r
  WHERE r.id = p_restaurant_id;

  RETURN jsonb_build_object(
    'account', COALESCE(v_account, jsonb_build_object('points', 0, 'level', 'bronze', 'total_earned', 0)),
    'config', v_restaurant
  );
END;
$$;

-- 5. RLS policies pour loyalty_accounts
DROP POLICY IF EXISTS loyalty_customer_own ON loyalty_accounts;
CREATE POLICY loyalty_customer_own ON loyalty_accounts
  FOR ALL USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS loyalty_restaurant_manage ON loyalty_accounts;
CREATE POLICY loyalty_restaurant_manage ON loyalty_accounts
  FOR ALL USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE id IN (
        SELECT restaurant_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
