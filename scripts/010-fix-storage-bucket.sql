-- ════════════════════════════════════════════════════════════════════════════
-- SCRIPT 010 — Créer le bucket Storage + policies pour l'upload d'images
-- À exécuter dans : Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Créer le bucket "restaurants" (public) ─────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurants',
  'restaurants',
  true,                          -- public = URLs accessibles sans auth
  5242880,                       -- 5 MB max par fichier
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880;

-- ── 2. Politique : tout le monde peut LIRE les images (public) ───────────
DROP POLICY IF EXISTS "storage_restaurants_public_read" ON storage.objects;
CREATE POLICY "storage_restaurants_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'restaurants');

-- ── 3. Politique : utilisateur connecté peut UPLOADER ────────────────────
DROP POLICY IF EXISTS "storage_restaurants_auth_insert" ON storage.objects;
CREATE POLICY "storage_restaurants_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'restaurants'
    AND auth.uid() IS NOT NULL
  );

-- ── 4. Politique : utilisateur connecté peut METTRE À JOUR ses fichiers ──
DROP POLICY IF EXISTS "storage_restaurants_auth_update" ON storage.objects;
CREATE POLICY "storage_restaurants_auth_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'restaurants'
    AND auth.uid() IS NOT NULL
  );

-- ── 5. Politique : utilisateur connecté peut SUPPRIMER ses fichiers ──────
DROP POLICY IF EXISTS "storage_restaurants_auth_delete" ON storage.objects;
CREATE POLICY "storage_restaurants_auth_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'restaurants'
    AND auth.uid() IS NOT NULL
  );

-- ── Vérification ──────────────────────────────────────────────────────────
SELECT id, name, public FROM storage.buckets WHERE id = 'restaurants';
-- Doit retourner : restaurants | restaurants | true
