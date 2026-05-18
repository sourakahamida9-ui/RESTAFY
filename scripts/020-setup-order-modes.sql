-- Setup order modes in order_modes table
-- Assurez-vous que les modes utilisés dans le code existent

DELETE FROM order_modes;

INSERT INTO order_modes (id, code, name, description, icon, is_active, sort_order, config)
VALUES
  (gen_random_uuid(), 'delivery', 'Livraison', 'Livraison a domicile', '🚚', TRUE, 1, '{"requires_address": true}'),
  (gen_random_uuid(), 'dine_in', 'Sur place', 'Manger au restaurant', '🍽️', TRUE, 2, '{"requires_table": true}'),
  (gen_random_uuid(), 'pickup', 'Retrait', 'Retrait au restaurant', '👜', TRUE, 3, '{}'),
  (gen_random_uuid(), 'takeaway', 'Emporter', 'Prendre et partir', '📦', TRUE, 4, '{}');
