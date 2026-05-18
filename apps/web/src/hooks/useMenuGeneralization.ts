import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

type Item = Database['public']['Tables']['items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

interface MenuDuplicationOptions {
  includeVariants?: boolean;
  mapCategories?: Record<string, string>; // old_id -> new_id
  priceMultiplier?: number;
  prefixName?: string;
}

interface MenuSnapshot {
  name: string;
  categories: Category[];
  items: Item[];
  variants: any[];
  notes?: string;
}

export const useMenuGeneralization = () => {
  /**
   * Duplique toutes les categories et items d'un restaurant vers un autre
   */
  const duplicateRestaurantMenu = async (
    sourceRestaurantId: string,
    targetRestaurantId: string,
    userId: string,
    options: MenuDuplicationOptions = {}
  ) => {
    
    try {
      // 1. Creer l'import record
      const { data: importRecord, error: importError } = await supabase
        .from('menu_imports')
        .insert([
          {
            restaurant_id: targetRestaurantId,
            source_restaurant_id: sourceRestaurantId,
            import_type: 'duplicate',
            status: 'in_progress',
            created_by: userId,
          },
        ])
        .select()
        .single();

      if (importError) throw importError;

      // 2. Charger categories et items source
      const [{ data: sourceCategories }, { data: sourceItems }] = await Promise.all([
        supabase.from('categories').select('*').eq('restaurant_id', sourceRestaurantId),
        supabase.from('items').select('*').eq('restaurant_id', sourceRestaurantId),
      ]);

      if (!sourceCategories || !sourceItems) throw new Error('Failed to fetch source menu');

      const { data: sourceVariants } = await supabase
        .from('item_variants')
        .select('*')
        .in('item_id', sourceItems.map((item) => item.id));

      // 3. Charger categories cibles existantes
      const { data: targetCategories } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', targetRestaurantId);

      // 4. Dupliquer les categories
      const categoryMap = new Map<string, string>();
      const newCategories = sourceCategories.map(cat => ({
        ...cat,
        id: undefined,
        restaurant_id: targetRestaurantId,
        created_at: new Date().toISOString(),
      }));

      const { data: createdCategories, error: catError } = await supabase
        .from('categories')
        .insert(newCategories)
        .select();

      if (catError) throw catError;

      // 5. Mapper ancien ID -> nouveau ID
      sourceCategories.forEach((old, idx) => {
        categoryMap.set(old.id, createdCategories[idx].id);
      });

      // 6. Dupliquer les items
      const newItems = sourceItems.map(item => ({
        ...item,
        id: undefined,
        restaurant_id: targetRestaurantId,
        category_id: categoryMap.get(item.category_id),
        source_restaurant_id: sourceRestaurantId,
        is_template: false,
        name: options.prefixName ? `${options.prefixName} - ${item.name}` : item.name,
        price: options.priceMultiplier ? item.price * options.priceMultiplier : item.price,
        created_at: new Date().toISOString(),
      }));

      const { data: createdItems, error: itemsError } = await supabase
        .from('items')
        .insert(newItems)
        .select();

      if (itemsError) throw itemsError;

      // 7. Dupliquer les variantes si demandé
      let createdVariants = [];
      if (options.includeVariants && sourceVariants) {
        const itemIdMap = new Map<string, string>();
        sourceItems.forEach((old, idx) => {
          itemIdMap.set(old.id, createdItems[idx].id);
        });

        const newVariants = sourceVariants
          .filter(v => itemIdMap.has(v.item_id))
          .map(v => ({
            ...v,
            id: undefined,
            item_id: itemIdMap.get(v.item_id),
            created_at: new Date().toISOString(),
          }));

        const { data: variants, error: variantsError } = await supabase
          .from('item_variants')
          .insert(newVariants)
          .select();

        if (variantsError) throw variantsError;
        createdVariants = variants;
      }

      // 8. Mettre a jour l'import record
      await supabase
        .from('menu_imports')
        .update({
          status: 'completed',
          imported_items: createdItems.length,
          completed_at: new Date().toISOString(),
        })
        .eq('id', importRecord.id);

      return {
        success: true,
        importId: importRecord.id,
        itemsCount: createdItems.length,
        categoriesCount: createdCategories.length,
        variantsCount: createdVariants.length,
      };
    } catch (err) {
      throw err;
    }
  };

  /**
   * Sauvegarde un snapshot du menu actuel
   */
  const saveMenuSnapshot = async (
    restaurantId: string,
    userId: string,
    name: string,
    notes?: string
  ) => {
    
    try {
      const [{ data: categories }, { data: items }] = await Promise.all([
        supabase.from('categories').select('*').eq('restaurant_id', restaurantId),
        supabase.from('items').select('*').eq('restaurant_id', restaurantId),
      ]);

      const { data: variants } = await supabase
        .from('item_variants')
        .select('*')
        .in('item_id', (items || []).map((item) => item.id));

      const { data, error } = await supabase
        .from('menu_snapshots')
        .insert([
          {
            restaurant_id: restaurantId,
            snapshot_name: name,
            categories_data: categories,
            items_data: items,
            variants_data: variants,
            notes,
            created_by: userId,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      throw err;
    }
  };

  /**
   * Restaure un menu a partir d'un snapshot
   */
  const restoreMenuSnapshot = async (
    snapshotId: string,
    restaurantId: string,
    userId: string
  ) => {
    
    try {
      // 1. Charger le snapshot
      const { data: snapshot, error: snapshotError } = await supabase
        .from('menu_snapshots')
        .select('*')
        .eq('id', snapshotId)
        .single();

      if (snapshotError) throw snapshotError;

      // 2. Supprimer les categories et items existants (les references seront nettoyees par les foreignkeys)
      await Promise.all([
        supabase.from('categories').delete().eq('restaurant_id', restaurantId),
        supabase.from('items').delete().eq('restaurant_id', restaurantId),
      ]);

      // 3. Recreer les categories
      const newCategories = (snapshot.categories_data || []).map((cat: any) => ({
        ...cat,
        id: undefined,
        restaurant_id: restaurantId,
        created_at: new Date().toISOString(),
      }));

      const { data: createdCategories, error: catError } = await supabase
        .from('categories')
        .insert(newCategories)
        .select();

      if (catError) throw catError;

      // 4. Recreer les items
      const categoryMap = new Map<string, string>();
      (snapshot.categories_data || []).forEach((old: any, idx: number) => {
        categoryMap.set(old.id, createdCategories[idx].id);
      });

      const newItems = (snapshot.items_data || []).map((item: any) => ({
        ...item,
        id: undefined,
        restaurant_id: restaurantId,
        category_id: categoryMap.get(item.category_id),
        created_at: new Date().toISOString(),
      }));

      const { data: createdItems, error: itemsError } = await supabase
        .from('items')
        .insert(newItems)
        .select();

      if (itemsError) throw itemsError;

      return {
        success: true,
        itemsCount: createdItems.length,
        categoriesCount: createdCategories.length,
      };
    } catch (err) {
      throw err;
    }
  };

  /**
   * Exporte le menu en JSON
   */
  const exportMenu = async (restaurantId: string) => {
    
    try {
      const [{ data: categories }, { data: items }] = await Promise.all([
        supabase.from('categories').select('*').eq('restaurant_id', restaurantId),
        supabase.from('items').select('*').eq('restaurant_id', restaurantId),
      ]);

      const { data: variants } = await supabase
        .from('item_variants')
        .select('*')
        .in('item_id', (items || []).map((item) => item.id));

      const menuExport = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        categories,
        items,
        variants,
      };

      return menuExport;
    } catch (err) {
      throw err;
    }
  };

  /**
   * Importe un menu depuis JSON
   */
  const importMenuFromJSON = async (
    restaurantId: string,
    userId: string,
    jsonData: any,
    options: MenuDuplicationOptions = {}
  ) => {
    
    try {
      const { categories = [], items = [], variants = [] } = jsonData;

      // 1. Dupliquer les categories
      const categoryMap = new Map<string, string>();
      const newCategories = categories.map((cat: any) => ({
        name: cat.name,
        description: cat.description,
        image_url: cat.image_url,
        restaurant_id: restaurantId,
        sort_order: cat.sort_order,
        is_active: cat.is_active !== false,
        created_at: new Date().toISOString(),
      }));

      const { data: createdCategories, error: catError } = await supabase
        .from('categories')
        .insert(newCategories)
        .select();

      if (catError) throw catError;

      categories.forEach((old: any, idx: number) => {
        categoryMap.set(old.id, createdCategories[idx].id);
      });

      // 2. Dupliquer les items
      const newItems = items.map((item: any) => ({
        name: options.prefixName ? `${options.prefixName} - ${item.name}` : item.name,
        description: item.description,
        image_url: item.image_url,
        price: options.priceMultiplier ? item.price * options.priceMultiplier : item.price,
        category_id: categoryMap.get(item.category_id),
        restaurant_id: restaurantId,
        is_available: item.is_available !== false,
        created_at: new Date().toISOString(),
      }));

      const { data: createdItems, error: itemsError } = await supabase
        .from('items')
        .insert(newItems)
        .select();

      if (itemsError) throw itemsError;

      return {
        success: true,
        itemsCount: createdItems.length,
        categoriesCount: createdCategories.length,
      };
    } catch (err) {
      throw err;
    }
  };

  /**
   * Charge les menus templates disponibles
   */
  const getMenuTemplates = async () => {
    
    try {
      const { data, error } = await supabase
        .from('menu_templates')
        .select('*')
        .eq('is_global', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      return [];
    }
  };

  return {
    duplicateRestaurantMenu,
    saveMenuSnapshot,
    restoreMenuSnapshot,
    exportMenu,
    importMenuFromJSON,
    getMenuTemplates,
  };
};
