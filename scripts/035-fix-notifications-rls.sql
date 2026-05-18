-- Script 035: Notifications RLS propre + visibilité ticket_purchases clients
-- Problèmes corrigés :
--   1. Les clients ne pouvaient pas toujours créer leurs propres notifications
--   2. La RLS SELECT sur notifications n'était pas propre (doublons de policies)
--   3. Les clients ne pouvaient pas voir leurs billets 'pending' (query filtrée sur 'confirmed')

-- ── 1. Notifications : RLS propre sans doublons ──────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_own"               ON notifications;
DROP POLICY IF EXISTS "notifications_own"        ON notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_any" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;

-- Lire ses propres notifications
CREATE POLICY "notif_select_own"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Tout utilisateur authentifié peut créer une notification
-- (utile pour les notifications cross-user : restaurant → client)
CREATE POLICY "notif_insert_authenticated"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Marquer comme lue (UPDATE) ses propres notifications
CREATE POLICY "notif_update_own"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- SuperAdmin : tout voir
CREATE POLICY "notif_superadmin_all"
  ON notifications FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ── 2. Vérification : ticket_purchases SELECT autorise 'pending' + 'confirmed' ─
-- La policy existante "tp_customer_read" utilise USING (auth.uid() = customer_id)
-- ce qui couvre tous les statuts — pas besoin de changer la RLS.
-- Le problème était dans la query côté client (filtrée sur 'confirmed' seulement).
-- Ce script ne touche pas cette policy.

SELECT 'Script 035 completed — notifications RLS propre' AS status;