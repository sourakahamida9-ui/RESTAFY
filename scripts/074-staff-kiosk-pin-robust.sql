-- ============================================================================
-- RESTAFY 074 — PIN équipe : éviter les erreurs HTTP opaques (exceptions PG)
-- et détecter UPDATE 0 ligne. À exécuter sur Supabase si 072 a déjà été appliqué
-- sans ce bloc EXCEPTION / NOT FOUND.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.owner_set_staff_kiosk_pin(p_staff_id UUID, p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  rid UUID;
  clean TEXT;
BEGIN
  SELECT restaurant_id INTO rid FROM public.restaurant_staff WHERE id = p_staff_id;
  IF rid IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'staff_not_found');
  END IF;

  IF NOT kiosk_restaurant_can_manage_invites(rid) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'forbidden');
  END IF;

  clean := trim(p_pin);
  IF clean IS NULL OR length(clean) < 4 OR length(clean) > 8 OR clean !~ '^[0-9]+$' THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'pin_invalid');
  END IF;

  UPDATE public.restaurant_staff
  SET
    pin_hash = crypt(clean, gen_salt('bf')),
    access_token = COALESCE(access_token, gen_random_uuid())
  WHERE id = p_staff_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'update_failed',
      'detail', 'Aucune ligne mise à jour (membre introuvable ou accès refusé par la base).'
    );
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'db_error',
      'detail', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_set_staff_kiosk_pin(UUID, TEXT) TO authenticated;
