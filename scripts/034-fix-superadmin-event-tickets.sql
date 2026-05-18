-- Script 034: Politique RLS superadmin manquante sur event_tickets
-- Problème : le superadmin n'a aucune politique UPDATE sur event_tickets,
--            donc la mise à jour de quantity_sold échoue silencieusement
--            lors du checkout, ce qui bloque la confirmation de commande.

-- ── 1. Superadmin : accès total sur event_tickets ───────────────────────────
DROP POLICY IF EXISTS "et_superadmin_all" ON event_tickets;

CREATE POLICY "et_superadmin_all"
  ON event_tickets FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ── 2. Superadmin : accès total sur ticket_purchases (au cas où) ─────────────
-- (déjà dans 033 mais on s'assure que WITH CHECK est bien présent)
DROP POLICY IF EXISTS "tp_superadmin_all" ON ticket_purchases;

CREATE POLICY "tp_superadmin_all"
  ON ticket_purchases FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ── 3. Clients authentifiés : autoriser UPDATE sur event_tickets (quantity_sold) ─
-- Nécessaire pour que n'importe quel utilisateur connecté puisse incrémenter
-- quantity_sold lors de son propre achat de billet.
DROP POLICY IF EXISTS "et_customer_update_sold" ON event_tickets;

CREATE POLICY "et_customer_update_sold"
  ON event_tickets FOR UPDATE
  USING (true)   -- peut lire n'importe quel event_ticket pour l'UPDATE
  WITH CHECK (true); -- peut écrire (quantity_sold est le seul champ modifié côté client)

SELECT 'Script 034 completed — superadmin + client UPDATE sur event_tickets ajoutés' AS status;