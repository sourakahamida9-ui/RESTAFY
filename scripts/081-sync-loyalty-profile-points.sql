-- ════════════════════════════════════════════════════════════════
-- RESTAFY 081 — Fidélité : synchroniser profiles.loyalty_points
-- Problème : award_loyalty_points ne mettait à jour que loyalty_accounts.
-- L’app (LoyaltyDashboard / useGlobalLoyalty) lit profile.loyalty_points.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- Niveaux alignés sur src/hooks/useLoyalty.ts (LOYALTY_LEVELS)
CREATE OR REPLACE FUNCTION public.award_loyalty_points(
  p_order_id uuid,
  p_customer_id uuid,
  p_restaurant_id uuid,
  p_order_amount numeric
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_per_fcfa   numeric;
  v_loyalty_enabled   boolean;
  v_welcome_bonus     integer;
  v_points_earned     integer;
  v_welcome_applied   integer := 0;
  v_account_id        uuid;
  v_current_points    integer;
  v_new_level         text;
  v_delta_profile     integer := 0;
BEGIN
  SELECT
    COALESCE(r.loyalty_enabled, true),
    COALESCE(r.loyalty_points_per_fcfa, 0.01),
    COALESCE(r.loyalty_welcome_bonus, 0)::integer
  INTO v_loyalty_enabled, v_points_per_fcfa, v_welcome_bonus
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  IF NOT COALESCE(v_loyalty_enabled, true) THEN
    RETURN 0;
  END IF;

  v_points_earned := FLOOR(p_order_amount * COALESCE(v_points_per_fcfa, 0.01))::integer;

  SELECT la.id, la.points
  INTO v_account_id, v_current_points
  FROM public.loyalty_accounts la
  WHERE la.customer_id = p_customer_id
    AND la.restaurant_id = p_restaurant_id;

  IF v_account_id IS NULL THEN
    IF v_points_earned <= 0 AND v_welcome_bonus <= 0 THEN
      RETURN 0;
    END IF;
    v_welcome_applied := GREATEST(0, v_welcome_bonus);
    INSERT INTO public.loyalty_accounts (customer_id, restaurant_id, points, total_earned, level)
    VALUES (
      p_customer_id,
      p_restaurant_id,
      v_points_earned + v_welcome_applied,
      v_points_earned + v_welcome_applied,
      'bronze'
    )
    RETURNING id, points INTO v_account_id, v_current_points;

    v_delta_profile := v_points_earned + v_welcome_applied;

    IF v_points_earned > 0 THEN
      INSERT INTO public.loyalty_transactions (account_id, order_id, points, type, description)
      VALUES (
        v_account_id,
        p_order_id,
        v_points_earned,
        'earn',
        'Commande #' || COALESCE((SELECT o.order_number FROM public.orders o WHERE o.id = p_order_id), p_order_id::text)
      );
    END IF;

    IF v_welcome_applied > 0 THEN
      INSERT INTO public.loyalty_transactions (account_id, order_id, points, type, description)
      VALUES (
        v_account_id,
        NULL,
        v_welcome_applied,
        'bonus',
        'Bonus bienvenue partenaire'
      );
    END IF;
  ELSE
    IF v_points_earned <= 0 THEN
      RETURN 0;
    END IF;

    UPDATE public.loyalty_accounts la
    SET
      points = la.points + v_points_earned,
      total_earned = la.total_earned + v_points_earned,
      updated_at = now()
    WHERE la.id = v_account_id
    RETURNING la.points INTO v_current_points;

    v_delta_profile := v_points_earned;

    INSERT INTO public.loyalty_transactions (account_id, order_id, points, type, description)
    VALUES (
      v_account_id,
      p_order_id,
      v_points_earned,
      'earn',
      'Commande #' || COALESCE((SELECT o.order_number FROM public.orders o WHERE o.id = p_order_id), p_order_id::text)
    );
  END IF;

  v_new_level := CASE
    WHEN v_current_points >= 10000 THEN 'platinum'
    WHEN v_current_points >= 5000 THEN 'gold'
    WHEN v_current_points >= 1000 THEN 'silver'
    ELSE 'bronze'
  END;

  UPDATE public.loyalty_accounts la
  SET level = v_new_level
  WHERE la.id = v_account_id
    AND la.level IS DISTINCT FROM v_new_level;

  UPDATE public.orders o
  SET points_earned = v_points_earned
  WHERE o.id = p_order_id;

  IF v_delta_profile > 0 THEN
    UPDATE public.profiles p
    SET
      loyalty_points = COALESCE(p.loyalty_points, 0) + v_delta_profile,
      loyalty_level = CASE
        WHEN COALESCE(p.loyalty_points, 0) + v_delta_profile >= 10000 THEN 'diamond'
        WHEN COALESCE(p.loyalty_points, 0) + v_delta_profile >= 4000 THEN 'platinum'
        WHEN COALESCE(p.loyalty_points, 0) + v_delta_profile >= 1500 THEN 'gold'
        WHEN COALESCE(p.loyalty_points, 0) + v_delta_profile >= 500 THEN 'silver'
        ELSE 'bronze'
      END,
      updated_at = now()
    WHERE p.id = p_customer_id;
  END IF;

  RETURN v_points_earned + v_welcome_applied;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_customer_id uuid,
  p_restaurant_id uuid,
  p_points_to_redeem integer,
  p_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id     uuid;
  v_current_points integer;
  v_min_redeem     integer;
  v_discount_value numeric;
BEGIN
  SELECT COALESCE(r.loyalty_min_points_redeem, 100)
  INTO v_min_redeem
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id;

  SELECT la.id, la.points
  INTO v_account_id, v_current_points
  FROM public.loyalty_accounts la
  WHERE la.customer_id = p_customer_id
    AND la.restaurant_id = p_restaurant_id;

  IF v_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Compte fidelite introuvable');
  END IF;

  IF v_current_points < p_points_to_redeem THEN
    RETURN jsonb_build_object('success', false, 'error', 'Points insuffisants');
  END IF;

  IF p_points_to_redeem < COALESCE(v_min_redeem, 100) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum ' || v_min_redeem || ' points requis');
  END IF;

  v_discount_value := p_points_to_redeem * 10;

  UPDATE public.loyalty_accounts la
  SET
    points = la.points - p_points_to_redeem,
    total_redeemed = la.total_redeemed + p_points_to_redeem,
    updated_at = now()
  WHERE la.id = v_account_id;

  INSERT INTO public.loyalty_transactions (account_id, order_id, points, type, description)
  VALUES (
    v_account_id,
    p_order_id,
    -p_points_to_redeem,
    'redeem',
    'Utilisation de ' || p_points_to_redeem || ' points'
  );

  UPDATE public.profiles p
  SET
    loyalty_points = GREATEST(0, COALESCE(p.loyalty_points, 0) - p_points_to_redeem),
    loyalty_level = CASE
      WHEN GREATEST(0, COALESCE(p.loyalty_points, 0) - p_points_to_redeem) >= 10000 THEN 'diamond'
      WHEN GREATEST(0, COALESCE(p.loyalty_points, 0) - p_points_to_redeem) >= 4000 THEN 'platinum'
      WHEN GREATEST(0, COALESCE(p.loyalty_points, 0) - p_points_to_redeem) >= 1500 THEN 'gold'
      WHEN GREATEST(0, COALESCE(p.loyalty_points, 0) - p_points_to_redeem) >= 500 THEN 'silver'
      ELSE 'bronze'
    END,
    updated_at = now()
  WHERE p.id = p_customer_id;

  RETURN jsonb_build_object(
    'success', true,
    'discount', v_discount_value,
    'points_used', p_points_to_redeem,
    'remaining_points', v_current_points - p_points_to_redeem
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_loyalty_points(uuid, uuid, uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_points(uuid, uuid, integer, uuid) TO authenticated, service_role;

-- Rattrapage : total des comptes par restaurant = vérité, recopie sur le profil global
UPDATE public.profiles p
SET
  loyalty_points = t.sum_pts,
  loyalty_level = CASE
    WHEN t.sum_pts >= 10000 THEN 'diamond'
    WHEN t.sum_pts >= 4000 THEN 'platinum'
    WHEN t.sum_pts >= 1500 THEN 'gold'
    WHEN t.sum_pts >= 500 THEN 'silver'
    ELSE 'bronze'
  END,
  updated_at = now()
FROM (
  SELECT customer_id, SUM(points)::integer AS sum_pts
  FROM public.loyalty_accounts
  GROUP BY customer_id
) t
WHERE p.id = t.customer_id
  AND (
    COALESCE(p.loyalty_points, 0) IS DISTINCT FROM t.sum_pts
    OR p.loyalty_level IS DISTINCT FROM (
      CASE
        WHEN t.sum_pts >= 10000 THEN 'diamond'
        WHEN t.sum_pts >= 4000 THEN 'platinum'
        WHEN t.sum_pts >= 1500 THEN 'gold'
        WHEN t.sum_pts >= 500 THEN 'silver'
        ELSE 'bronze'
      END
    )
  );

COMMIT;

SELECT 'Script 081 OK — loyalty_points profil synchronisé avec loyalty_accounts' AS status;
