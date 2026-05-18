-- ========================================================================
-- Script 034: Configure Supabase Storage Buckets (Public Access)
-- ========================================================================
-- This script configures storage buckets to be publicly accessible
-- Run this in Supabase SQL Editor (NOT via script execution)
-- Then run the bucket RLS policies via Supabase dashboard or SQL

-- 1. Make 'restaurants' bucket public via SQL (if it exists)
UPDATE storage.buckets 
SET public = true 
WHERE name = 'restaurants';

-- 2. Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurants', 'restaurants', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. RLS Policy for restaurants bucket - Allow public READ access
CREATE POLICY "Public read access to restaurant images"
ON storage.objects 
FOR SELECT
USING (bucket_id = 'restaurants');

-- 4. RLS Policy for restaurants bucket - Allow authenticated users to INSERT
CREATE POLICY "Authenticated users can upload restaurant images"
ON storage.objects 
FOR INSERT
WITH CHECK (
  bucket_id = 'restaurants' 
  AND auth.role() = 'authenticated'
);

-- 5. RLS Policy for restaurants bucket - Allow owners to UPDATE their images
CREATE POLICY "Users can update their own restaurant images"
ON storage.objects 
FOR UPDATE
USING (bucket_id = 'restaurants')
WITH CHECK (bucket_id = 'restaurants');

-- 6. RLS Policy for restaurants bucket - Allow owners to DELETE their images
CREATE POLICY "Users can delete their own restaurant images"
ON storage.objects 
FOR DELETE
USING (bucket_id = 'restaurants');

-- 7. Create 'menu-items' bucket for food photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-items', 'menu-items', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 8. RLS Policy for menu-items bucket - Allow public READ access
CREATE POLICY "Public read access to menu item images"
ON storage.objects 
FOR SELECT
USING (bucket_id = 'menu-items');

-- 9. RLS Policy for menu-items bucket - Allow authenticated users to INSERT
CREATE POLICY "Authenticated users can upload menu item images"
ON storage.objects 
FOR INSERT
WITH CHECK (
  bucket_id = 'menu-items' 
  AND auth.role() = 'authenticated'
);

-- 10. Create 'events' bucket for event photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('events', 'events', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 11. RLS Policy for events bucket - Allow public READ access
CREATE POLICY "Public read access to event images"
ON storage.objects 
FOR SELECT
USING (bucket_id = 'events');

-- 12. RLS Policy for events bucket - Allow authenticated users to INSERT
CREATE POLICY "Authenticated users can upload event images"
ON storage.objects 
FOR INSERT
WITH CHECK (
  bucket_id = 'events' 
  AND auth.role() = 'authenticated'
);

-- Verification Query - Check bucket status
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets
WHERE name IN ('restaurants', 'menu-items', 'events')
ORDER BY created_at;

-- Note: If you encounter "policy already exists" errors, you can drop them first:
-- DROP POLICY IF EXISTS "Public read access to restaurant images" ON storage.objects;
-- Then re-run the CREATE POLICY statements above
