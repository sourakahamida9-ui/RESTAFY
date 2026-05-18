-- ============================================================================
-- DELIVERY DRIVERS SYSTEM - Gestion des livreurs par restaurant
-- ============================================================================

-- 1. Table delivery_drivers
CREATE TABLE IF NOT EXISTS delivery_drivers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL, -- Format: +229XXXXXXXX
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT phone_format CHECK (phone ~ '^\+229[0-9]{8}$' OR phone ~ '^00229[0-9]{8}$')
);

-- Index pour recherche rapide
CREATE INDEX idx_delivery_drivers_restaurant ON delivery_drivers(restaurant_id);
CREATE INDEX idx_delivery_drivers_available ON delivery_drivers(restaurant_id, is_available);

-- 2. Ajouter colonnes à la table orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES delivery_drivers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS driver_assigned_at TIMESTAMP;

CREATE INDEX idx_orders_driver ON orders(driver_id);

-- 3. RLS POLICIES pour delivery_drivers

-- Enable RLS
ALTER TABLE delivery_drivers ENABLE ROW LEVEL SECURITY;

-- Restaurants peuvent voir leurs propres livreurs
-- (rs.role::text : compatible enum user_role ou colonne TEXT — voir scripts/084)
CREATE POLICY "restaurant_view_own_drivers" ON delivery_drivers
  FOR SELECT
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM restaurant_staff rs
      WHERE rs.restaurant_id = delivery_drivers.restaurant_id
        AND rs.profile_id = auth.uid()
        AND rs.role::text IN ('manager', 'staff')
    )
  );

-- Restaurants peuvent ajouter livreurs
CREATE POLICY "restaurant_insert_drivers" ON delivery_drivers
  FOR INSERT
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM restaurant_staff rs
      WHERE rs.restaurant_id = delivery_drivers.restaurant_id
        AND rs.profile_id = auth.uid()
        AND rs.role::text IN ('manager')
    )
  );

-- Restaurants peuvent modifier (disponibilité) leurs livreurs
CREATE POLICY "restaurant_update_drivers" ON delivery_drivers
  FOR UPDATE
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM restaurant_staff rs
      WHERE rs.restaurant_id = delivery_drivers.restaurant_id
        AND rs.profile_id = auth.uid()
        AND rs.role::text IN ('manager', 'staff')
    )
  );

-- Restaurants peuvent supprimer livreurs
CREATE POLICY "restaurant_delete_drivers" ON delivery_drivers
  FOR DELETE
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM restaurant_staff rs
      WHERE rs.restaurant_id = delivery_drivers.restaurant_id
        AND rs.profile_id = auth.uid()
        AND rs.role::text = 'manager'
    )
  );

-- 4. RLS UPDATE pour orders (permettre d'assigner un livreur)
-- Cette politique doit être ajoutée aux existantes
CREATE POLICY "restaurant_assign_driver" ON orders
  FOR UPDATE
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM restaurant_staff rs
      WHERE rs.restaurant_id = orders.restaurant_id
        AND rs.profile_id = auth.uid()
        AND rs.role::text IN ('manager', 'staff')
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants
      WHERE owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM restaurant_staff rs
      WHERE rs.restaurant_id = orders.restaurant_id
        AND rs.profile_id = auth.uid()
        AND rs.role::text IN ('manager', 'staff')
    )
  );

-- 5. Fonction pour marquer un livreur comme occupé après assignation
CREATE OR REPLACE FUNCTION assign_driver_to_order(
  p_order_id UUID,
  p_driver_id UUID
) RETURNS void AS $$
BEGIN
  -- Assigner le livreur
  UPDATE orders
  SET driver_id = p_driver_id,
      driver_assigned_at = now()
  WHERE id = p_order_id;
  
  -- Optionnel: marquer comme indisponible (à désactiver si tu veux gérer manuellement)
  -- UPDATE delivery_drivers
  -- SET is_available = false
  -- WHERE id = p_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION assign_driver_to_order TO authenticated;
