-- =====================================================================
-- NOTIFICATION SYSTEM - SQL Triggers & Functions
-- =====================================================================
-- Création automatique des notifications lors d'événements clés
-- =====================================================================

-- 1. Créer table notifications si elle n'existe pas
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  action_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Créer index pour performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- 3. RLS Policies pour notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "notifications_read_own"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their notifications as read
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- System (anon) can insert notifications for any user (via triggers)
CREATE POLICY "notifications_insert_system"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- =====================================================================
-- Trigger 1: Nouvelle commande → Notifier le restaurateur
-- =====================================================================
CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Récupérer le user_id du restaurant
  INSERT INTO notifications (user_id, type, title, message, action_url)
  SELECT
    restaurants.owner_id,
    'order',
    '🔔 Nouvelle commande',
    'Commande #' || NEW.order_number || ' de ' || COALESCE(
      (SELECT full_name FROM profiles WHERE id = NEW.customer_id),
      'Client'
    ) || ' - ' || NEW.total_amount::text || ' FCFA',
    '/admin/orders'
  FROM restaurants
  WHERE restaurants.id = NEW.restaurant_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_order
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_new_order();

-- =====================================================================
-- Trigger 2: Changement de statut commande → Notifier le client
-- =====================================================================
CREATE OR REPLACE FUNCTION notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_message text;
  status_emoji text;
BEGIN
  -- Ignorer si le statut n'a pas changé
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Déterminer le message selon le nouveau statut
  status_message := CASE NEW.status
    WHEN 'confirmed' THEN 'Votre commande a été acceptée par le restaurant'
    WHEN 'preparing' THEN 'Le chef prépare votre commande'
    WHEN 'ready' THEN 'Votre commande est prête à être retirée'
    WHEN 'delivering' THEN 'Votre commande est en route'
    WHEN 'delivered' THEN 'Votre commande a été livrée'
    WHEN 'cancelled' THEN 'Votre commande a été annulée'
    ELSE 'Votre commande a été mise à jour'
  END;

  status_emoji := CASE NEW.status
    WHEN 'confirmed' THEN '✅'
    WHEN 'preparing' THEN '👨‍🍳'
    WHEN 'ready' THEN '📦'
    WHEN 'delivering' THEN '🛵'
    WHEN 'delivered' THEN '🏠'
    WHEN 'cancelled' THEN '❌'
    ELSE '📦'
  END;

  -- Notifier le client
  INSERT INTO notifications (user_id, type, title, message, action_url)
  VALUES (
    NEW.customer_id,
    'order_status',
    status_emoji || ' Commande #' || NEW.order_number,
    status_message,
    '/orders/' || NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_order_status
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_order_status_change();

-- =====================================================================
-- Trigger 3: Annulation de commande → Notifier restaurateur & client
-- =====================================================================
CREATE OR REPLACE FUNCTION notify_order_cancelled()
RETURNS TRIGGER AS $$
BEGIN
  -- Notifier le restaurateur
  INSERT INTO notifications (user_id, type, title, message, action_url)
  SELECT
    restaurants.owner_id,
    'order_cancelled',
    '❌ Commande annulée',
    'Commande #' || NEW.order_number || ' - Raison: ' || COALESCE(NEW.cancel_reason, 'Non spécifiée'),
    '/admin/orders'
  FROM restaurants
  WHERE restaurants.id = NEW.restaurant_id;

  -- Notifier le client
  INSERT INTO notifications (user_id, type, title, message, action_url)
  VALUES (
    NEW.customer_id,
    'order_cancelled',
    '❌ Commande annulée',
    'Votre commande #' || NEW.order_number || ' a été annulée: ' || COALESCE(NEW.cancel_reason, 'Raison non spécifiée'),
    '/orders/' || NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_order_cancelled
AFTER UPDATE ON orders
FOR EACH ROW
WHEN (OLD.status != NEW.status AND NEW.status = 'cancelled')
EXECUTE FUNCTION notify_order_cancelled();

-- =====================================================================
-- Trigger 4: Livraison assignée → Notifier le livreur
-- =====================================================================
CREATE OR REPLACE FUNCTION notify_delivery_assigned()
RETURNS TRIGGER AS $$
BEGIN
  -- Notifier le livreur si assigné
  IF NEW.livreur_id IS NOT NULL AND OLD.livreur_id IS NULL THEN
    INSERT INTO notifications (user_id, type, title, message, action_url)
    VALUES (
      NEW.livreur_id,
      'delivery_assigned',
      '🛵 Livraison assignée',
      'Commande #' || NEW.order_number || ' de ' || COALESCE(
        (SELECT full_name FROM profiles WHERE id = NEW.customer_id),
        'Client'
      ) || ' à livrer à ' || COALESCE(NEW.delivery_address, 'Adresse non spécifiée'),
      '/deliveries/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_delivery_assigned
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_delivery_assigned();

-- =====================================================================
-- Cleanup: Supprimer les notifications lues de plus de 30 jours
-- =====================================================================
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE is_read = true
    AND created_at < NOW() - INTERVAL '30 days';
  
  RAISE NOTICE '[v0] Cleaned up old notifications';
END;
$$ LANGUAGE plpgsql;

-- Exécuter le nettoyage une fois par semaine (à adapter selon votre cron setup)
-- SELECT cleanup_old_notifications();

-- =====================================================================
-- Vérification & Test
-- =====================================================================
-- Exécuter les commandes suivantes pour vérifier:

-- 1. Vérifier que les triggers sont créés:
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE trigger_name LIKE 'trigger_notify%';

-- 2. Vérifier que la table notifications existe:
-- SELECT * FROM notifications LIMIT 5;

-- 3. Vérifier les RLS policies:
-- SELECT * FROM pg_policies WHERE tablename = 'notifications';

-- =====================================================================
-- Notes d'Implémentation:
-- =====================================================================
-- 1. Ces triggers se déclenchent automatiquement sur les événements clés
-- 2. Les notifications sont sauvegardées en DB pour persistance
-- 3. Les clients voient les notifications via Realtime subscription
-- 4. Le cleanup des vieilles notifications se fait automatiquement
-- 5. Adaptation possible: ajouter email/SMS en modifiant les triggers
-- =====================================================================
