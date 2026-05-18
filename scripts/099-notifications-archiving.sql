-- 099-notifications-archiving.sql
-- ─────────────────────────────────────────────────────────────────────
-- PR C du chantier notifications : ajoute le support de l'archivage.
--
-- Pourquoi : la table notifications grossit indéfiniment (chaque commande,
-- chaque paiement, chaque event = une ligne). Sans archivage, le centre
-- de notifications devient lent et la pagination énorme.
--
-- Stratégie : on ne SUPPRIME pas — les notifications restent en DB pour
-- audit/historique, mais on les exclut du fetch par défaut au-delà de
-- 30 jours. Le restaurateur peut toujours les voir via un filtre
-- "Archivées" (à venir) ou via super-admin.
-- ─────────────────────────────────────────────────────────────────────

-- 1. Colonne is_archived (idempotent)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

-- 2. Index partiel : filtre rapide is_archived = false (le cas par défaut)
CREATE INDEX IF NOT EXISTS idx_notifications_unarchived
  ON notifications(user_id, created_at DESC)
  WHERE is_archived = false;

-- 3. Fonction d'archivage utilisée par le cron quotidien
--    Archive les notifications créées il y a > N jours (lues ou non).
--    On NE filtre PAS sur is_read=true volontairement : un restaurateur peut
--    avoir lu une notif récente sans vouloir qu'elle disparaisse du centre
--    le lendemain. Seul le critère temporel (N=30j) déclenche l'archivage.
--    Idempotent : un second appel ne change rien.
CREATE OR REPLACE FUNCTION archive_old_notifications(days_old integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE notifications
  SET
    is_archived = true,
    archived_at = now()
  WHERE is_archived = false
    AND created_at < now() - (days_old || ' days')::interval;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION archive_old_notifications(integer) TO service_role;

COMMENT ON FUNCTION archive_old_notifications(integer) IS
  'PR C notifications. Archive (is_archived=true) les notifs > N jours. Appelé par le cron Vercel /api/cron?job=archive_notifications. N=30 par défaut.';
