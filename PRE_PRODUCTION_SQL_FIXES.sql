-- =================================================================
-- RESTAFY PRE-PRODUCTION SQL FIXES
-- Exécuter dans l'ordre ci-dessous
-- =================================================================

-- ─────────────────────────────────────────────────────────────────
-- BUG #4: Rendre le bucket Supabase public pour les images
-- ─────────────────────────────────────────────────────────────────
UPDATE storage.buckets SET public = true 
WHERE id IN ('restaurants', 'menu-items', 'events');

-- Créer les policies de lecture publique
CREATE POLICY "Public read restaurants" ON storage.objects
FOR SELECT USING (bucket_id = 'restaurants');

CREATE POLICY "Public read menu-items" ON storage.objects
FOR SELECT USING (bucket_id = 'menu-items');

CREATE POLICY "Public read events" ON storage.objects
FOR SELECT USING (bucket_id = 'events');

-- ─────────────────────────────────────────────────────────────────
-- BUG #2: Normaliser les rôles super_admin dans la DB
-- ─────────────────────────────────────────────────────────────────
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"super_admin"'::jsonb
)
WHERE raw_user_meta_data->>'role' = 'superadmin';

UPDATE profiles 
SET role = 'super_admin' 
WHERE role = 'superadmin';

-- ─────────────────────────────────────────────────────────────────
-- BUG #13: Ajouter colonne order_number générée automatiquement
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_number TEXT 
GENERATED ALWAYS AS ('CMD-' || UPPER(SUBSTR(id::text, 1, 8))) STORED;

-- ─────────────────────────────────────────────────────────────────
-- BUG #12: Créer table livreurs manquante
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS livreurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  vehicle TEXT, -- 'motorcycle', 'scooter', 'car', 'bicycle'
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline')),
  rating DECIMAL(3,2) DEFAULT 5.0,
  total_deliveries INT DEFAULT 0,
  location POINT, -- coordinates (latitude, longitude)
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_livreurs_restaurant ON livreurs(restaurant_id);
CREATE INDEX idx_livreurs_user ON livreurs(user_id);
CREATE INDEX idx_livreurs_status ON livreurs(status);

-- ─────────────────────────────────────────────────────────────────
-- BUG #9: Améliorer les queries order_items pour inclure les détails
-- ─────────────────────────────────────────────────────────────────
-- La query doit être modifiée dans le code TypeScript/React :
-- supabase.from('order_items')
--   .select('*, items(name, price, description)')
--   .eq('order_id', orderId)
-- Pas de changement SQL nécessaire, déjà dans la structure

-- ─────────────────────────────────────────────────────────────────
-- BUG #11: Vérifier qu'il n'existe pas de récursion dans les policies
-- ─────────────────────────────────────────────────────────────────
-- À exécuter pour vérifier (voir résultats ci-dessous)
SELECT policyname, tablename, qual
FROM pg_policies
WHERE tablename = 'profiles' 
AND qual LIKE '%profiles%';

-- Si résultats retournés : corriger en editant les policies via Supabase Dashboard
-- Supprimer les policies récursives et les recréer sans auto-référence

-- ─────────────────────────────────────────────────────────────────
-- VÉRIFICATION FINALE : Checklists exécution
-- ─────────────────────────────────────────────────────────────────

-- Vérifier que les buckets sont publics
SELECT id, name, public FROM storage.buckets;
-- ✓ Doit retourner : restaurants (public), menu-items (public), events (public)

-- Vérifier aucun rôle 'superadmin' restant
SELECT COUNT(*) FROM profiles WHERE role = 'superadmin';
-- ✓ Doit retourner : 0

-- Vérifier que order_number est générée
SELECT id, order_number FROM orders LIMIT 1;
-- ✓ order_number doit afficher 'CMD-' + 8 caractères

-- Vérifier table livreurs créée
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name = 'livreurs';
-- ✓ Doit retourner : 1

-- Vérifier zéro récursion dans profiles policies
SELECT COUNT(*) FROM pg_policies
WHERE tablename = 'profiles' AND qual LIKE '%profiles%';
-- ✓ Doit retourner : 0
