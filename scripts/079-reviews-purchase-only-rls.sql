-- Avis : seul un client ayant une commande « livrée » chez CE restaurant peut insérer un avis.
-- - order_id obligatoire (lien à une commande réelle)
-- - orders.restaurant_id doit correspondre à reviews.restaurant_id (anti-fraude)

DROP POLICY IF EXISTS "reviews_customer_insert" ON reviews;

CREATE POLICY "reviews_customer_insert"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id
    AND order_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.id = order_id
        AND o.customer_id = auth.uid()
        AND o.restaurant_id = restaurant_id
        AND o.status = 'delivered'
    )
  );

SELECT 'Policy reviews_customer_insert mise à jour (achat / livraison vérifiés)' AS status;
