-- ════════════════════════════════════════════════════════════════
-- RESTAFY — Script 054 : FIX DÉFINITIF RLS (à exécuter en dernier)
-- Corrige les régressions introduites par scripts 040 et 053
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- PARTIE 1 : Fonctions SECURITY DEFINER sans récursion
-- Ces fonctions lisent directement dans profiles en bypassant RLS
-- grâce à SECURITY DEFINER (s'exécute avec les droits postgres)
-- ────────────────────────────────────────────────────────────────

-- Récupère le rôle de l'utilisateur connecté (sans passer par RLS)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated, anon;

-- Récupère le restaurant_id de l'utilisateur connecté (sans passer par RLS)
-- ✅ FIX : évite la récursion dans profiles_restaurant_read (script 040)
CREATE OR REPLACE FUNCTION get_my_restaurant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION get_my_restaurant_id() TO authenticated, anon;


-- ────────────────────────────────────────────────────────────────
-- PARTIE 2 : Recréer les policies PROFILES sans aucune récursion
-- ────────────────────────────────────────────────────────────────

-- Supprimer toutes les policies existantes sur profiles
DROP POLICY IF EXISTS "profiles_own"                   ON profiles;
DROP POLICY IF EXISTS "profiles_own_read"              ON profiles;
DROP POLICY IF EXISTS "profiles_own_update"            ON profiles;
DROP POLICY IF EXISTS "profiles_insert"                ON profiles;
DROP POLICY IF EXISTS "profiles_restaurant_staff"      ON profiles;
DROP POLICY IF EXISTS "profiles_restaurant_read"       ON profiles;
DROP POLICY IF EXISTS "profiles_superadmin"            ON profiles;
DROP POLICY IF EXISTS "profiles_superadmin_all"        ON profiles;
DROP POLICY IF EXISTS "profiles_delete_superadmin"     ON profiles;
DROP POLICY IF EXISTS "profiles_staff_read"            ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by owner" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by their owner" ON profiles;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur lit/modifie son propre profil
CREATE POLICY "profiles_own_read"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_own_update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Inscription : le trigger crée le profil, mais on garde cette policy au cas où
CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ✅ FIX CRITIQUE (régression script 040) :
-- Utiliser get_my_restaurant_id() au lieu de SELECT FROM profiles
-- L'ancienne version faisait SELECT FROM profiles dans une policy sur profiles → récursion
CREATE POLICY "profiles_restaurant_read"
  ON profiles FOR SELECT
  USING (
    restaurant_id IS NOT NULL
    AND restaurant_id = get_my_restaurant_id()
  );

-- Super admin voit et modifie tout — utilise get_my_role() → zéro récursion
CREATE POLICY "profiles_superadmin_all"
  ON profiles FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- Suppression par super admin uniquement, jamais un autre super_admin
CREATE POLICY "profiles_delete_superadmin"
  ON profiles FOR DELETE
  USING (
    get_my_role() = 'super_admin'
    AND role::TEXT != 'super_admin'
  );


-- ────────────────────────────────────────────────────────────────
-- PARTIE 3 : Policies ORDERS — ✅ FIX régression script 053
-- Le script 053 était revenu à EXISTS(SELECT FROM profiles)
-- au lieu de get_my_role() → risque de récursion indirecte
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "orders_superadmin_all"       ON orders;
DROP POLICY IF EXISTS "orders_superadmin"           ON orders;
DROP POLICY IF EXISTS "orders_customer_read"        ON orders;
DROP POLICY IF EXISTS "orders_customer_insert"      ON orders;
DROP POLICY IF EXISTS "orders_insert_own"           ON orders;
DROP POLICY IF EXISTS "orders_select_customer"      ON orders;
DROP POLICY IF EXISTS "orders_select_restaurant"    ON orders;
DROP POLICY IF EXISTS "orders_restaurant_read"      ON orders;
DROP POLICY IF EXISTS "orders_restaurant_update"    ON orders;
DROP POLICY IF EXISTS "orders_update_restaurant"    ON orders;
DROP POLICY IF EXISTS "Orders viewable by owner"    ON orders;
DROP POLICY IF EXISTS "Orders visible to owners and staff" ON orders;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Un client connecté peut créer sa commande
CREATE POLICY "orders_insert_own" ON orders
  FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

-- Un client voit SES commandes
CREATE POLICY "orders_select_customer" ON orders
  FOR SELECT
  USING (auth.uid() = customer_id);

-- Le restaurant voit les commandes qui lui sont destinées
-- ✅ Utilise get_my_restaurant_id() pour éviter JOIN sur profiles
CREATE POLICY "orders_select_restaurant" ON orders
  FOR SELECT
  USING (
    restaurant_id = get_my_restaurant_id()
    AND get_my_role() IN ('restaurant_owner', 'manager', 'staff', 'livreur')
  );

-- Le restaurant peut mettre à jour le statut d'une commande
CREATE POLICY "orders_update_restaurant" ON orders
  FOR UPDATE
  USING (
    restaurant_id = get_my_restaurant_id()
    AND get_my_role() IN ('restaurant_owner', 'manager', 'staff', 'livreur')
  );

-- ✅ FIX DÉFINITIF : super admin via get_my_role() (pas EXISTS SELECT FROM profiles)
CREATE POLICY "orders_superadmin_all" ON orders
  FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');


-- ────────────────────────────────────────────────────────────────
-- PARTIE 4 : Aligner toutes les autres tables sur get_my_role()
-- Pour éviter qu'une future régression réintroduise des SELECT FROM profiles
-- ────────────────────────────────────────────────────────────────

-- RESTAURANTS
DROP POLICY IF EXISTS "restaurants_superadmin_all" ON restaurants;
DROP POLICY IF EXISTS "restaurants_superadmin"     ON restaurants;
CREATE POLICY "restaurants_superadmin_all"
  ON restaurants FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- EVENTS
DROP POLICY IF EXISTS "events_superadmin_all" ON events;
DROP POLICY IF EXISTS "events_superadmin"     ON events;
CREATE POLICY "events_superadmin_all"
  ON events FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- TICKET_PURCHASES
DROP POLICY IF EXISTS "tp_superadmin_all"    ON ticket_purchases;
DROP POLICY IF EXISTS "tp_superadmin"        ON ticket_purchases;
CREATE POLICY "tp_superadmin_all"
  ON ticket_purchases FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- EVENT_TICKETS
DROP POLICY IF EXISTS "event_tickets_superadmin_all" ON event_tickets;
DROP POLICY IF EXISTS "event_tickets_superadmin"     ON event_tickets;
CREATE POLICY "event_tickets_superadmin_all"
  ON event_tickets FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- ITEMS
DROP POLICY IF EXISTS "items_superadmin_all" ON items;
DROP POLICY IF EXISTS "items_superadmin"     ON items;
CREATE POLICY "items_superadmin_all"
  ON items FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- CATEGORIES
DROP POLICY IF EXISTS "categories_superadmin_all" ON categories;
DROP POLICY IF EXISTS "categories_superadmin"     ON categories;
CREATE POLICY "categories_superadmin_all"
  ON categories FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

-- ORDER_ITEMS : remplacer WITH CHECK (true) du script 007
DROP POLICY IF EXISTS "order_items_insert"      ON order_items;
DROP POLICY IF EXISTS "order_items_insert_own"  ON order_items;
DROP POLICY IF EXISTS "order_items_customer_insert" ON order_items;
CREATE POLICY "order_items_insert_own" ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.customer_id = auth.uid()
    )
  );

COMMIT;

-- ────────────────────────────────────────────────────────────────
-- VÉRIFICATION — s'affiche après l'exécution
-- ────────────────────────────────────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  LEFT(qual, 80) AS condition
FROM pg_policies
WHERE tablename IN ('profiles', 'orders', 'restaurants', 'ticket_purchases', 'order_items')
ORDER BY tablename, policyname;

SELECT 'Script 054 OK — RLS définitivement corrigé' AS status;