-- Menu Templates et Generalization System
-- Permet duplication, import/export et templates de menus

-- 1. Table de templates de menus (optionnel, pre-configured)
CREATE TABLE IF NOT EXISTS menu_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cuisine_type TEXT,
  preview_data JSONB,
  is_global BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Table d'historique de menus (pour versioning/undo)
CREATE TABLE IF NOT EXISTS menu_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  snapshot_name VARCHAR(255),
  categories_data JSONB,
  items_data JSONB,
  variants_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- 3. Colonne dans items pour metadata (template, source, etc.)
ALTER TABLE items ADD COLUMN IF NOT EXISTS source_restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS template_tags JSONB DEFAULT '[]'::jsonb;

-- 4. Table pour l'import en masse
CREATE TABLE IF NOT EXISTS menu_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  source_restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  import_type TEXT NOT NULL, -- 'duplicate', 'import', 'template'
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, failed
  total_items INTEGER DEFAULT 0,
  imported_items INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- 5. Index pour performance
CREATE INDEX IF NOT EXISTS idx_items_source_restaurant ON items(source_restaurant_id);
CREATE INDEX IF NOT EXISTS idx_items_is_template ON items(is_template);
CREATE INDEX IF NOT EXISTS idx_menu_snapshots_restaurant ON menu_snapshots(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_imports_restaurant ON menu_imports(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_templates_cuisine ON menu_templates(cuisine_type);

-- 6. RLS pour menu_snapshots
ALTER TABLE menu_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_snapshots_restaurant_all" ON menu_snapshots;
CREATE POLICY "menu_snapshots_restaurant_all" ON menu_snapshots FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles WHERE profiles.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "menu_snapshots_superadmin" ON menu_snapshots;
CREATE POLICY "menu_snapshots_superadmin" ON menu_snapshots FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

-- 7. RLS pour menu_imports
ALTER TABLE menu_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_imports_restaurant_all" ON menu_imports;
CREATE POLICY "menu_imports_restaurant_all" ON menu_imports FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM profiles WHERE profiles.id = auth.uid()
    )
  );

-- 8. RLS pour menu_templates (lecture seule, admin only pour creation)
ALTER TABLE menu_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_templates_read_all" ON menu_templates;
CREATE POLICY "menu_templates_read_all" ON menu_templates FOR SELECT
  USING (is_global = true);

DROP POLICY IF EXISTS "menu_templates_admin_all" ON menu_templates;
CREATE POLICY "menu_templates_admin_all" ON menu_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin')));
