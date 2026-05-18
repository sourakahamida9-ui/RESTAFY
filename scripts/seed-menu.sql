-- Seed menu data for Restafy restaurants
-- This script creates categories and items for the demo restaurants

-- Get restaurant IDs
WITH restaurant_ids AS (
  SELECT id, slug FROM restaurants WHERE is_active = true
)

-- Insert categories for each restaurant
INSERT INTO categories (id, restaurant_id, name, description, sort_order, is_active)
SELECT 
  gen_random_uuid(),
  r.id,
  c.name,
  c.description,
  c.sort_order,
  true
FROM restaurant_ids r
CROSS JOIN (
  VALUES 
    ('Entrées', 'Nos délicieuses entrées', 1),
    ('Plats Principaux', 'Nos plats signatures', 2),
    ('Desserts', 'Pour terminer en douceur', 3),
    ('Boissons', 'Rafraîchissements', 4)
) AS c(name, description, sort_order)
ON CONFLICT DO NOTHING;

-- Now insert some items for each category
-- First, let's get the categories we just created
DO $$
DECLARE
  r RECORD;
  cat_entrees UUID;
  cat_plats UUID;
  cat_desserts UUID;
  cat_boissons UUID;
BEGIN
  FOR r IN SELECT id, slug, name FROM restaurants WHERE is_active = true LOOP
    -- Get category IDs for this restaurant
    SELECT id INTO cat_entrees FROM categories WHERE restaurant_id = r.id AND name = 'Entrées' LIMIT 1;
    SELECT id INTO cat_plats FROM categories WHERE restaurant_id = r.id AND name = 'Plats Principaux' LIMIT 1;
    SELECT id INTO cat_desserts FROM categories WHERE restaurant_id = r.id AND name = 'Desserts' LIMIT 1;
    SELECT id INTO cat_boissons FROM categories WHERE restaurant_id = r.id AND name = 'Boissons' LIMIT 1;
    
    -- Insert items based on restaurant type
    IF r.slug = 'chez-tantie-rose' OR r.slug = 'mama-africa' THEN
      -- Béninoise cuisine
      INSERT INTO items (id, restaurant_id, category_id, name, description, price, is_available, prep_time_min, image_url)
      VALUES
        (gen_random_uuid(), r.id, cat_entrees, 'Salade Avocat', 'Avocat frais avec vinaigrette maison', 1500, true, 10, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400'),
        (gen_random_uuid(), r.id, cat_entrees, 'Alloco', 'Bananes plantain frites croustillantes', 1000, true, 8, 'https://images.unsplash.com/photo-1528751014936-863e6e7a319c?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Atassi Complet', 'Riz et haricots avec poulet grillé', 3500, true, 25, 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Pâte Rouge', 'Pâte de maïs avec sauce tomate et poisson', 3000, true, 20, 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Poulet Braisé', 'Poulet mariné grillé au charbon', 4000, true, 30, 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Igname Pilée', 'Igname pilée avec sauce graine', 2500, true, 20, 'https://images.unsplash.com/photo-1546549032-9571cd6b27df?w=400'),
        (gen_random_uuid(), r.id, cat_desserts, 'Gâteau Coco', 'Gâteau à la noix de coco', 1500, true, 5, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400'),
        (gen_random_uuid(), r.id, cat_boissons, 'Jus de Bissap', 'Jus d''hibiscus frais', 800, true, 3, 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400'),
        (gen_random_uuid(), r.id, cat_boissons, 'Tchoukoutou', 'Bière traditionnelle de mil', 1000, true, 3, NULL)
      ON CONFLICT DO NOTHING;
      
    ELSIF r.slug = 'pizza-express' THEN
      -- Italian cuisine
      INSERT INTO items (id, restaurant_id, category_id, name, description, price, is_available, prep_time_min, image_url)
      VALUES
        (gen_random_uuid(), r.id, cat_entrees, 'Bruschetta', 'Tomates fraîches sur pain grillé', 2000, true, 10, 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=400'),
        (gen_random_uuid(), r.id, cat_entrees, 'Caprese', 'Mozzarella, tomates et basilic', 2500, true, 8, 'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Pizza Margherita', 'Tomate, mozzarella, basilic frais', 5000, true, 20, 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Pizza Quatre Fromages', 'Mozzarella, gorgonzola, parmesan, chèvre', 6500, true, 20, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Pizza Végétarienne', 'Légumes grillés et mozzarella', 5500, true, 20, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400'),
        (gen_random_uuid(), r.id, cat_desserts, 'Tiramisu', 'Dessert italien au café et mascarpone', 3000, true, 5, 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400'),
        (gen_random_uuid(), r.id, cat_boissons, 'Coca-Cola', 'Boisson gazeuse', 800, true, 2, NULL),
        (gen_random_uuid(), r.id, cat_boissons, 'Eau Minérale', 'Eau plate ou gazeuse', 500, true, 2, NULL)
      ON CONFLICT DO NOTHING;
      
    ELSIF r.slug = 'burger-house' THEN
      -- American cuisine
      INSERT INTO items (id, restaurant_id, category_id, name, description, price, is_available, prep_time_min, image_url)
      VALUES
        (gen_random_uuid(), r.id, cat_entrees, 'Nuggets de Poulet', '6 nuggets avec sauce', 2000, true, 10, 'https://images.unsplash.com/photo-1562967914-608f82629710?w=400'),
        (gen_random_uuid(), r.id, cat_entrees, 'Onion Rings', 'Rondelles d''oignon croustillantes', 1500, true, 8, 'https://images.unsplash.com/photo-1639024471283-03518883512d?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Classic Burger', 'Boeuf, salade, tomate, oignon', 4000, true, 15, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Cheese Burger', 'Boeuf avec double fromage', 4500, true, 15, 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Chicken Burger', 'Poulet croustillant avec sauce spéciale', 4000, true, 15, 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Frites Maison', 'Frites fraîches croustillantes', 1500, true, 10, 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400'),
        (gen_random_uuid(), r.id, cat_desserts, 'Milkshake', 'Chocolat, vanille ou fraise', 2000, true, 5, 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400'),
        (gen_random_uuid(), r.id, cat_boissons, 'Limonade Maison', 'Citron frais pressé', 1000, true, 3, NULL)
      ON CONFLICT DO NOTHING;
      
    ELSIF r.slug = 'sushi-zen' THEN
      -- Japanese cuisine
      INSERT INTO items (id, restaurant_id, category_id, name, description, price, is_available, prep_time_min, image_url)
      VALUES
        (gen_random_uuid(), r.id, cat_entrees, 'Edamame', 'Fèves de soja salées', 1500, true, 5, 'https://images.unsplash.com/photo-1564489563601-c53cfc451e93?w=400'),
        (gen_random_uuid(), r.id, cat_entrees, 'Gyoza', '5 raviolis japonais grillés', 2500, true, 10, 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Sushi Mix', '12 pièces variées', 8000, true, 20, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Sashimi Saumon', '8 tranches de saumon frais', 7000, true, 15, 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Ramen Tonkotsu', 'Nouilles au bouillon de porc', 5500, true, 20, 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400'),
        (gen_random_uuid(), r.id, cat_desserts, 'Mochi', '3 boules de glace japonaise', 2000, true, 5, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400'),
        (gen_random_uuid(), r.id, cat_boissons, 'Thé Vert', 'Thé vert japonais chaud', 800, true, 3, NULL),
        (gen_random_uuid(), r.id, cat_boissons, 'Sake', 'Vin de riz japonais', 3000, true, 2, NULL)
      ON CONFLICT DO NOTHING;
      
    ELSE
      -- French cuisine (default)
      INSERT INTO items (id, restaurant_id, category_id, name, description, price, is_available, prep_time_min, image_url)
      VALUES
        (gen_random_uuid(), r.id, cat_entrees, 'Soupe à l''Oignon', 'Gratinée au fromage', 2500, true, 15, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400'),
        (gen_random_uuid(), r.id, cat_entrees, 'Salade Niçoise', 'Salade fraîche méditerranéenne', 3000, true, 10, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Boeuf Bourguignon', 'Boeuf mijoté au vin rouge', 7500, true, 25, 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Coq au Vin', 'Poulet braisé au vin', 6500, true, 25, 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400'),
        (gen_random_uuid(), r.id, cat_plats, 'Steak Frites', 'Entrecôte avec frites maison', 8000, true, 20, 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=400'),
        (gen_random_uuid(), r.id, cat_desserts, 'Crème Brûlée', 'Dessert classique français', 2500, true, 5, 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=400'),
        (gen_random_uuid(), r.id, cat_boissons, 'Vin Rouge', 'Verre de Bordeaux', 3000, true, 2, NULL),
        (gen_random_uuid(), r.id, cat_boissons, 'Café Espresso', 'Café italien', 1000, true, 3, NULL)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Verify insertion
SELECT 
  r.name as restaurant, 
  c.name as category, 
  COUNT(i.id) as items_count
FROM restaurants r
LEFT JOIN categories c ON c.restaurant_id = r.id
LEFT JOIN items i ON i.category_id = c.id
WHERE r.is_active = true
GROUP BY r.name, c.name
ORDER BY r.name, c.name;
