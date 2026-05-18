// src/pages/admin/MenuManagement.tsx
// ✅ BUG CORRIGÉ #1 — handleAddItem faisait toujours un INSERT même en mode édition
//    → maintenant : INSERT si nouveau plat, UPDATE si editingItem !== null
// ✅ BUG CORRIGÉ #2 — bouton Modifier (Edit2) existait dans les imports mais
//    n'était PAS rendu sur les cartes plats → bouton ajouté avec pré-remplissage
// ✅ BUG CORRIGÉ #3 — image_url non gérée dans le formulaire → champ ajouté
// ✅ AMÉLIORATION — affichage de l'image sur la carte si image_url présente

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  LayoutGrid,
  List as ListIcon,
  Eye,
  EyeOff,
  FolderPlus,
  X,
  ImageIcon,
  Loader2,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Database } from '@/lib/supabase';
import { toast } from 'sonner';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

type Item = Database['public']['Tables']['items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export default function MenuManagement() {
  const { profile } = useAuth();
  const restaurantId = profile?.restaurant_id;

  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingItem, setSavingItem] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category_id: '',
    is_available: true,
    image_url: '',
  });

  // ── Fetch menu ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const fetchMenu = async () => {
      try {
        const [itemsData, categoriesData] = await Promise.all([
          supabase.from('items').select('id,name,description,price,category_id,is_available,image_url').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }),
          supabase.from('categories').select('id,name,sort_order').eq('restaurant_id', restaurantId).order('sort_order', { ascending: true }),
        ]);
        if (itemsData.error) throw itemsData.error;
        if (categoriesData.error) throw categoriesData.error;
        setItems((itemsData.data || []) as Item[]);
        setCategories((categoriesData.data || []) as Category[]);
        if (categoriesData.data?.[0]) setSelectedCategory(categoriesData.data[0].id);
      } catch (error) {
        if (import.meta.env.DEV) console.error('[MenuManagement] Erreur fetch:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [restaurantId]);

  // ── Ouvrir le formulaire d'édition avec pré-remplissage ───────────────────
  const openEditForm = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: typeof item.price === 'string' ? parseFloat(item.price) : item.price,
      category_id: item.category_id,
      is_available: item.is_available,
      image_url: item.image_url || '',
    });
    setShowForm(true);
  };

  // ── Ouvrir le formulaire de création ──────────────────────────────────────
  const openAddForm = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      category_id: categories[0]?.id || '',
      is_available: true,
      image_url: '',
    });
    setShowForm(true);
  };

  // ── BUG CORRIGÉ #1 — Save = INSERT ou UPDATE selon editingItem ────────────
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !formData.name || !formData.category_id) {
      toast.error('Veuillez remplir tous les champs obligatoires (nom + catégorie)');
      return;
    }
    setSavingItem(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: formData.price.toString(),
        category_id: formData.category_id,
        is_available: formData.is_available,
        image_url: formData.image_url.trim() || null,
      };

      if (editingItem) {
        // ── UPDATE ─────────────────────────────────────────────────────────
        const { data, error } = await supabase
          .from('items')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingItem.id)
          .select()
          .single();
        if (error) throw error;
        setItems(items.map(i => i.id === editingItem.id ? data : i));
      } else {
        // ── INSERT ─────────────────────────────────────────────────────────
        const { data, error } = await supabase
          .from('items')
          .insert([{ restaurant_id: restaurantId, ...payload }])
          .select()
          .single();
        if (error) throw error;
        setItems([data, ...items]);
      }

      setShowForm(false);
      setEditingItem(null);
    } catch (error) {
      if (import.meta.env.DEV) console.error('[MenuManagement] Erreur save item:', error);
      toast.error('Erreur lors de la sauvegarde du plat');
    } finally {
      setSavingItem(false);
    }
  };

  const handleAddCategory = async () => {
    if (!restaurantId || !newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{ restaurant_id: restaurantId, name: newCategoryName.trim() }])
        .select()
        .single();
      if (error) throw error;
      setCategories([...categories, data]);
      setSelectedCategory(data.id);
      setNewCategoryName('');
      setShowCategoryForm(false);
    } catch (error) {
      if (import.meta.env.DEV) console.error('[MenuManagement] Erreur add category:', error);
      toast.error('Erreur lors de la création de la catégorie');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm('Supprimer cette catégorie ? Les plats liés seront détachés.')) return;
    const { error } = await supabase.from('categories').delete().eq('id', catId);
    if (!error) {
      const updated = categories.filter(c => c.id !== catId);
      setCategories(updated);
      if (selectedCategory === catId) setSelectedCategory(updated[0]?.id || null);
      setItems(items.filter(i => i.category_id !== catId));
    }
  };

  const handleToggleAvailability = async (itemId: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from('items')
        .update({ is_available: !current })
        .eq('id', itemId);
      if (error) throw error;
      setItems(items.map(item => item.id === itemId ? { ...item, is_available: !current } : item));
    } catch (error) {
      if (import.meta.env.DEV) console.error('[MenuManagement] Erreur toggle availability:', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Supprimer ce plat ?')) return;
    try {
      const { error } = await supabase.from('items').delete().eq('id', itemId);
      if (error) throw error;
      setItems(items.filter(i => i.id !== itemId));
    } catch (error) {
      if (import.meta.env.DEV) console.error('[MenuManagement] Erreur delete item:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  // ── Filtrage ──────────────────────────────────────────────────────────────
  const filteredItems = items.filter(item => {
    const matchCategory = !selectedCategory || item.category_id === selectedCategory;
    const matchSearch = !searchQuery ||
      (item.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RestafyLoader fullscreen={false} message="Chargement du menu…" size="md" />
      </div>
    );
  }

  return (
    <div className="r-page-shell pb-24 lg:pb-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-100 tracking-tight">Menu</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {items.length} plat{items.length !== 1 ? 's' : ''} &middot; {categories.length} cat&eacute;gorie{categories.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/restaurant/dashboard/menu-import-photo"
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-violet-200 bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 hover:border-violet-500/50 transition-colors"
            title="Importer un menu depuis une photo (IA Gemini)"
          >
            <Sparkles className="w-4 h-4" />
            Importer un menu
          </Link>
          <button
            onClick={() => setShowCategoryForm(true)}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--restaurant-card-border)] rounded-xl font-bold text-sm text-zinc-300 hover:bg-[var(--r-surface-hover)] transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            Cat&eacute;gorie
          </button>
          <button
            onClick={openAddForm}
            disabled={categories.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold text-sm hover:from-orange-400 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-4 h-4" />
            Ajouter un plat
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="r-kpi-grid">
        {[
          { label: 'Plats', value: items.length, icon: <Plus className="w-4 h-4" />, accent: 'text-orange-300 bg-orange-500/20' },
          { label: 'Disponibles', value: items.filter(i => i.is_available).length, icon: <Eye className="w-4 h-4" />, accent: 'text-sky-300 bg-sky-500/20' },
          { label: 'Cat\u00e9gories', value: categories.length, icon: <FolderPlus className="w-4 h-4" />, accent: 'text-emerald-300 bg-emerald-500/20' },
          { label: 'Prix moy.', value: `${items.length > 0 ? Math.round(items.reduce((sum, i) => sum + (typeof i.price === 'string' ? parseFloat(i.price) : i.price), 0) / items.length) : 0} F`, icon: <DollarSign className="w-4 h-4" />, accent: 'text-violet-300 bg-violet-500/20' },
        ].map((kpi) => (
          <div key={kpi.label} className="r-admin-card p-3 sm:p-4 flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${kpi.accent}`}>
              <div>{kpi.icon}</div>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide truncate">{kpi.label}</p>
              <p className="text-xl font-black text-zinc-100 leading-tight">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 ? (
        <div className="r-admin-card border-dashed !border-orange-500/20 p-12 text-center">
          <div className="w-14 h-14 bg-orange-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderPlus className="w-7 h-7 text-orange-400" />
          </div>
          <h3 className="font-bold text-lg text-zinc-200 mb-2">Commencez par cr&eacute;er une cat&eacute;gorie</h3>
          <p className="text-zinc-500 text-sm mb-6">Ex: Entr&eacute;es, Plats, Desserts, Boissons...</p>
          <button
            onClick={() => setShowCategoryForm(true)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:from-orange-400 hover:to-orange-500 transition-all shadow-lg shadow-orange-500/20"
          >
            Cr&eacute;er une cat&eacute;gorie
          </button>
        </div>
      ) : (
        <>
          {/* ── Catégories ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-1 group">
                <button
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedCategory === cat.id
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                      : 'border border-[var(--restaurant-card-border)] text-zinc-400 hover:text-zinc-200 hover:bg-[var(--r-surface-hover)]'
                    }`}
                >
                  {cat.name}
                  <span className="ml-2 text-xs opacity-60">
                    {items.filter(i => i.category_id === cat.id).length}
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  title="Supprimer la catégorie"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* ── Barre de recherche + vue ─────────────────────────────────── */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Rechercher un plat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all text-[color:var(--r-text)] placeholder:text-[color:var(--r-input-placeholder)]"
                style={{ backgroundColor: 'var(--r-input-bg)', borderWidth: 1, borderColor: 'var(--r-input-border)' }}
              />
            </div>
            <div className="flex items-center gap-1 bg-[var(--r-surface)] border border-[var(--restaurant-card-border)] rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-orange-500 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Grille des plats ─────────────────────────────────────────── */}
          <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
            <AnimatePresence mode="popLayout">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 col-span-full">
                  {items.length === 0
                    ? 'Aucun plat — cliquez sur "Ajouter un plat" pour commencer'
                    : 'Aucun plat ne correspond \u00e0 la recherche'}
                </div>
              ) : (
                filteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`r-admin-card overflow-hidden hover:shadow-lg hover:shadow-black/30 transition-shadow ${viewMode === 'list' ? 'flex gap-4 p-4' : ''
                      }`}
                  >
                    {/* Image du plat */}
                    {item.image_url ? (
                      <div className={`bg-[var(--restaurant-inset-bg)] overflow-hidden flex-shrink-0 ${viewMode === 'grid' ? 'h-40 w-full' : 'w-20 h-20 rounded-xl'}`}>
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.parentElement!.style.display = 'none'; }}
                        />
                      </div>
                    ) : viewMode === 'grid' ? (
                      <div className="h-24 w-full bg-gradient-to-br from-orange-500/10 to-amber-500/10 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-orange-400/40" />
                      </div>
                    ) : null}

                    <div className={`${viewMode === 'grid' ? 'p-4' : 'flex-1'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-zinc-100 truncate">{item.name}</h3>
                          {item.description && (
                            <p className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{item.description}</p>
                          )}
                        </div>
                        {/* ── BUG CORRIGÉ #2 — bouton Edit2 maintenant rendu ──── */}
                        <button
                          onClick={() => openEditForm(item)}
                          className="ml-2 p-1.5 text-zinc-500 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors flex-shrink-0"
                          title="Modifier le plat"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[var(--restaurant-card-border)]">
                        <span className="font-black text-orange-400">
                          {Number(item.price).toLocaleString('fr-FR')} ₣
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleAvailability(item.id, item.is_available)}
                            className={`p-1.5 rounded-lg transition-colors ${item.is_available
                                ? 'text-emerald-400 hover:bg-emerald-500/10'
                                : 'text-zinc-600 hover:bg-zinc-500/10'
                              }`}
                            title={item.is_available ? 'Marquer indisponible' : 'Marquer disponible'}
                          >
                            {item.is_available ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Supprimer le plat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <span className={`inline-block mt-2 text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest ${item.is_available ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        }`}>
                        {item.is_available ? '● Disponible' : '● Indisponible'}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* ── Modal Nouvelle catégorie ────────────────────────────────────────── */}
      <AnimatePresence>
        {showCategoryForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowCategoryForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-zinc-100">Nouvelle cat\u00e9gorie</h2>
                <button onClick={() => setShowCategoryForm(false)} className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                placeholder="Ex: Entr\u00e9es, Plats, Desserts..."
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 mb-4 text-[color:var(--r-text)] placeholder:text-[color:var(--r-input-placeholder)]"
                style={{ backgroundColor: 'var(--r-input-bg)', borderWidth: 1, borderColor: 'var(--r-input-border)' }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCategoryForm(false)}
                  className="flex-1 px-4 py-2.5 border border-zinc-700 rounded-xl font-bold text-sm text-zinc-300 hover:bg-white/5 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim() || savingCategory}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold text-sm hover:from-orange-400 hover:to-orange-500 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                >
                  {savingCategory && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Cr\u00e9er
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Ajouter / Modifier plat ──────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <h2 className="text-lg font-black text-zinc-100">
                  {editingItem ? `Modifier "${editingItem.name}"` : 'Ajouter un plat'}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveItem} className="p-6 space-y-4">
                {/* Nom */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1.5 block">
                    Nom du plat *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Poulet DG, Alloco-poisson..."
                    required
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 text-[color:var(--r-text)] placeholder:text-[color:var(--r-input-placeholder)]"
                    style={{ backgroundColor: 'var(--r-input-bg)', borderWidth: 1, borderColor: 'var(--r-input-border)' }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1.5 block">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ingr\u00e9dients, accompagnements..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/30 text-[color:var(--r-text)] placeholder:text-[color:var(--r-input-placeholder)]"
                    style={{ backgroundColor: 'var(--r-input-bg)', borderWidth: 1, borderColor: 'var(--r-input-border)' }}
                  />
                </div>

                {/* Prix + Catégorie */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1.5 block">
                      Prix (FCFA) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      required
                      className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 text-[color:var(--r-text)] placeholder:text-[color:var(--r-input-placeholder)]"
                      style={{ backgroundColor: 'var(--r-input-bg)', borderWidth: 1, borderColor: 'var(--r-input-border)' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1.5 block">
                      Cat\u00e9gorie *
                    </label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      required
                      className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 text-[color:var(--r-text)]"
                      style={{ backgroundColor: 'var(--r-input-bg)', borderWidth: 1, borderColor: 'var(--r-input-border)' }}
                    >
                      <option value="">Choisir...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* BUG CORRIGÉ #3 — URL image */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-1.5 block">
                    URL de l'image (optionnel)
                  </label>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 text-[color:var(--r-text)] placeholder:text-[color:var(--r-input-placeholder)]"
                    style={{ backgroundColor: 'var(--r-input-bg)', borderWidth: 1, borderColor: 'var(--r-input-border)' }}
                  />
                  {formData.image_url && (
                    <div className="mt-2 w-16 h-16 rounded-xl overflow-hidden border border-zinc-700">
                      <img
                        src={formData.image_url}
                        alt="Aperçu"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.parentElement!.style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>

                {/* Disponibilité */}
                <div className="flex items-center justify-between p-4 bg-[var(--r-surface)] rounded-xl border border-[var(--restaurant-card-border)]">
                  <div>
                    <p className="text-sm font-bold text-zinc-200">Disponible \u00e0 la commande</p>
                    <p className="text-xs text-zinc-500">Les clients peuvent commander ce plat</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_available: !formData.is_available })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${formData.is_available ? 'bg-orange-500' : 'bg-zinc-700'
                      }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.is_available ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-4 py-3 border border-zinc-700 rounded-xl font-bold text-sm text-zinc-300 hover:bg-white/5 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!formData.name || !formData.category_id || savingItem}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold text-sm hover:from-orange-400 hover:to-orange-500 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                  >
                    {savingItem && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingItem ? 'Mettre à jour' : 'Ajouter le plat'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
