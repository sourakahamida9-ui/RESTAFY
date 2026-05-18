import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMenuGeneralization } from '@/hooks/useMenuGeneralization';
import { supabase } from '@/lib/supabase';
import {
  Copy,
  Download,
  Upload,
  Save,
  RotateCcw,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MenuSnapshot {
  id: string;
  snapshot_name: string;
  created_at: string;
  notes?: string;
}

export default function MenuGeneralization() {
  const { profile } = useAuth();
  const restaurantId = profile?.restaurant_id;
  const {
    duplicateRestaurantMenu,
    saveMenuSnapshot,
    restoreMenuSnapshot,
    exportMenu,
    importMenuFromJSON,
  } = useMenuGeneralization();

  const [snapshots, setSnapshots] = useState<MenuSnapshot[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [snapshotName, setSnapshotName] = useState('');
  const [priceMultiplier, setPriceMultiplier] = useState(1);
  const [includeVariants, setIncludeVariants] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    loadSnapshots();
    loadRestaurants();
  }, [restaurantId]);

  const loadSnapshots = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_snapshots')
        .select('id, snapshot_name, created_at, notes')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSnapshots(data || []);
    } catch (err) {
      console.error('[v0] Error loading snapshots:', err);
    }
  };

  const loadRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name')
        .neq('id', restaurantId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setRestaurants(data || []);
    } catch (err) {
      console.error('[v0] Error loading restaurants:', err);
    }
  };

  const handleDuplicateMenu = async () => {
    if (!selectedRestaurant) {
      setMessage({ type: 'error', text: 'Selectionnez un restaurant' });
      return;
    }

    setLoading(true);
    try {
      await duplicateRestaurantMenu(selectedRestaurant, restaurantId, profile?.id, {
        priceMultiplier,
        includeVariants,
      });
      setMessage({ type: 'success', text: 'Menu duplique avec succes!' });
      setShowModal(null);
      setSelectedRestaurant('');
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la duplication' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSnapshot = async () => {
    if (!snapshotName.trim()) {
      setMessage({ type: 'error', text: 'Entrez un nom pour le snapshot' });
      return;
    }

    setLoading(true);
    try {
      await saveMenuSnapshot(restaurantId, profile?.id, snapshotName);
      setMessage({ type: 'success', text: 'Snapshot sauvegarde!' });
      setSnapshotName('');
      setShowModal(null);
      loadSnapshots();
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (!confirm('Etes-vous sur? Cela remplacera le menu actuel.')) return;

    setLoading(true);
    try {
      await restoreMenuSnapshot(snapshotId, restaurantId, profile?.id);
      setMessage({ type: 'success', text: 'Menu restaure!' });
      loadSnapshots();
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la restauration' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportMenu = async () => {
    setLoading(true);
    try {
      const menuData = await exportMenu(restaurantId);
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(menuData, null, 2)));
      element.setAttribute('download', `menu_${restaurantId}_${new Date().toISOString().split('T')[0]}.json`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      setMessage({ type: 'success', text: 'Menu exporte!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de l\'export' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setShowModal('duplicate')}
          className="p-6 bg-blue-50 hover:bg-blue-100 rounded-xl transition flex flex-col items-center gap-3"
        >
          <Copy className="w-8 h-8 text-blue-600" />
          <div className="text-center">
            <p className="font-bold text-blue-900">Dupliquer</p>
            <p className="text-xs text-blue-700">Menu d'un autre restaurant</p>
          </div>
        </button>

        <button
          onClick={() => setShowModal('snapshot')}
          className="p-6 bg-purple-50 hover:bg-purple-100 rounded-xl transition flex flex-col items-center gap-3"
        >
          <Save className="w-8 h-8 text-purple-600" />
          <div className="text-center">
            <p className="font-bold text-purple-900">Sauvegarder</p>
            <p className="text-xs text-purple-700">Snapshot actuel</p>
          </div>
        </button>

        <button
          onClick={handleExportMenu}
          disabled={loading}
          className="p-6 bg-green-50 hover:bg-green-100 rounded-xl transition flex flex-col items-center gap-3 disabled:opacity-50"
        >
          <Download className="w-8 h-8 text-green-600" />
          <div className="text-center">
            <p className="font-bold text-green-900">Exporter</p>
            <p className="text-xs text-green-700">En JSON</p>
          </div>
        </button>

        <button
          onClick={() => setShowModal('import')}
          className="p-6 bg-orange-50 hover:bg-orange-100 rounded-xl transition flex flex-col items-center gap-3"
        >
          <Upload className="w-8 h-8 text-orange-600" />
          <div className="text-center">
            <p className="font-bold text-orange-900">Importer</p>
            <p className="text-xs text-orange-700">Depuis JSON</p>
          </div>
        </button>
      </div>

      {/* Snapshots */}
      <div>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Snapshots sauvegardés ({snapshots.length})
        </h3>
        
        <div className="space-y-2">
          {snapshots.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun snapshot. Cliquez sur "Sauvegarder" pour en creer un.</p>
          ) : (
            snapshots.map(snapshot => (
              <div key={snapshot.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-bold">{snapshot.snapshot_name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(snapshot.created_at).toLocaleDateString()}
                  </p>
                  {snapshot.notes && <p className="text-sm text-gray-600 mt-1">{snapshot.notes}</p>}
                </div>
                <button
                  onClick={() => handleRestoreSnapshot(snapshot.id)}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restaurer
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showModal === 'duplicate' && (
          <Modal
            title="Dupliquer menu"
            onClose={() => setShowModal(null)}
            onSubmit={handleDuplicateMenu}
            loading={loading}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">Restaurant source</label>
                <select
                  value={selectedRestaurant}
                  onChange={e => setSelectedRestaurant(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="">Selectionnez un restaurant</option>
                  {restaurants.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeVariants}
                  onChange={e => setIncludeVariants(e.target.checked)}
                />
                <span className="text-sm">Inclure les variantes</span>
              </label>

              <div>
                <label className="block text-sm font-bold mb-2">Multiplicateur de prix</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={priceMultiplier}
                  onChange={e => setPriceMultiplier(parseFloat(e.target.value))}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>
          </Modal>
        )}

        {showModal === 'snapshot' && (
          <Modal
            title="Sauvegarder snapshot"
            onClose={() => setShowModal(null)}
            onSubmit={handleSaveSnapshot}
            loading={loading}
          >
            <input
              type="text"
              value={snapshotName}
              onChange={e => setSnapshotName(e.target.value)}
              placeholder="Nom du snapshot"
              className="w-full p-2 border rounded-lg"
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  children: React.ReactNode;
}

function Modal({ title, onClose, onSubmit, loading, children }: ModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl p-6 max-w-md w-full mx-4"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">{children}</div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Traitement...' : 'Confirmer'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
