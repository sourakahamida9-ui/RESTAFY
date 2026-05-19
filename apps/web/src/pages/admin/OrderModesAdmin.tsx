import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

interface OrderMode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  config: Record<string, any>;
}

export default function OrderModesAdmin() {
  const { profile } = useAuth();
  const [modes, setModes] = useState<OrderMode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<OrderMode>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role !== 'super_admin') {
      setError('Accès refusé - Super Admin uniquement');
    }
  }, [profile]);

  useEffect(() => {
    const fetchModes = async () => {
      try {
        const { data, error: err } = await supabase
          .from('order_modes')
          .select('*')
          .order('sort_order', { ascending: true });

        if (err) throw err;
        setModes(data || []);
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error fetching modes:', err);
        setError('Impossible de charger les modes de commande');
      } finally {
        setLoading(false);
      }
    };

    fetchModes();
  }, []);

  const handleEdit = (mode: OrderMode) => {
    setEditing(mode.id);
    setFormData(mode);
    setError(null);
  };

  const handleSave = async () => {
    try {
      setError(null);
      if (!editing) return;

      const { error: err } = await supabase
        .from('order_modes')
        .update(formData)
        .eq('id', editing);

      if (err) throw err;

      setModes(modes.map(m => m.id === editing ? { ...m, ...formData } as OrderMode : m));
      setSuccess('Mode de commande mis à jour');
      setEditing(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error saving:', err);
      setError('Impossible de sauvegarder. Veuillez réessayer.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Êtes-vous sûr ?')) return;

    try {
      const { error: err } = await supabase
        .from('order_modes')
        .delete()
        .eq('id', id);

      if (err) throw err;

      setModes(modes.filter(m => m.id !== id));
      setSuccess('Mode supprimé');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[v0] Error deleting:', err);
      setError('Impossible de supprimer. Veuillez réessayer.');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error: err } = await supabase
        .from('order_modes')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (err) throw err;

      setModes(modes.map(m => 
        m.id === id ? { ...m, is_active: !currentStatus } : m
      ));
    } catch (err) {
      if (import.meta.env.DEV) console.error('[v0] Error toggling:', err);
      setError('Impossible de modifier le statut. Veuillez réessayer.');
    }
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="r-page-shell !max-w-none bg-red-50 p-8 flex items-center justify-center">
        <div className="max-w-md bg-white rounded-lg p-8 text-center shadow-lg border border-red-100">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Accès refusé</h1>
          <p className="text-gray-600">Seuls les super admins peuvent accéder à cette page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="r-page-shell !max-w-none bg-gray-50 p-8 flex items-center justify-center">
        <RestafyLoader fullscreen={false} message="Chargement des modes de commande…" size="md" />
      </div>
    );
  }

  return (
    <div className="r-page-shell !max-w-none bg-gray-50 p-8">
      <div className="w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Modes de Commande</h1>
            <p className="text-gray-600">Gérer les modes de livraison/retrait disponibles</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700">
            <Plus className="w-5 h-5" />
            Ajouter
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5" />
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-4 text-left font-bold">Code</th>
                  <th className="px-6 py-4 text-left font-bold">Nom</th>
                  <th className="px-6 py-4 text-left font-bold">Description</th>
                  <th className="px-6 py-4 text-left font-bold">Statut</th>
                  <th className="px-6 py-4 text-left font-bold">Ordre</th>
                  <th className="px-6 py-4 text-left font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {modes.map(mode => (
                  <tr key={mode.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-xs">{mode.code}</td>
                    <td className="px-6 py-4 font-bold">{mode.name}</td>
                    <td className="px-6 py-4 text-gray-500">{mode.description || '-'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(mode.id, mode.is_active)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                          mode.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {mode.is_active ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Actif
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" />
                            Inactif
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">{mode.sort_order}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(mode)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(mode.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <AnimatePresence>
          {editing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="bg-white rounded-lg p-6 max-w-md w-full"
              >
                <h2 className="text-xl font-bold mb-4">Modifier le mode</h2>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-bold mb-1">Nom</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Description</label>
                    <input
                      type="text"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Ordre de tri</label>
                    <input
                      type="number"
                      value={formData.sort_order || 0}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-bold hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700"
                  >
                    Enregistrer
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
