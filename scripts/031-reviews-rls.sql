-- Script 031: Add RLS policies for reviews table
-- Permet aux clients de laisser des avis et aux restaurants de voir leurs avis

-- Enable RLS on reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "reviews_public_read" ON reviews;
DROP POLICY IF EXISTS "reviews_customer_insert" ON reviews;
DROP POLICY IF EXISTS "reviews_customer_update" ON reviews;
DROP POLICY IF EXISTS "reviews_restaurant_reply" ON reviews;

-- Anyone can read published reviews
CREATE POLICY "reviews_public_read"
  ON reviews FOR SELECT
  USING (true);

-- Customers can create reviews pour une commande livrée du même restaurant (voir aussi 079)
CREATE POLICY "reviews_customer_insert"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id
    AND order_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id
        AND o.customer_id = auth.uid()
        AND o.restaurant_id = restaurant_id
        AND o.status = 'delivered'
    )
  );

-- Customers can update their own reviews
CREATE POLICY "reviews_customer_update"
  ON reviews FOR UPDATE
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

-- Restaurant owners can reply to reviews
CREATE POLICY "reviews_restaurant_reply"
  ON reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.restaurant_id = reviews.restaurant_id
    )
  );

-- Create function to update restaurant avg_rating when review is added
CREATE OR REPLACE FUNCTION update_restaurant_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE restaurants
  SET 
    avg_rating = (
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM reviews
      WHERE restaurant_id = NEW.restaurant_id
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM reviews
      WHERE restaurant_id = NEW.restaurant_id
    )
  WHERE id = NEW.restaurant_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_restaurant_rating_trigger ON reviews;
CREATE TRIGGER update_restaurant_rating_trigger
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_rating();

SELECT 'Reviews RLS policies created successfully' AS status;
