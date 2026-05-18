// src/pages/admin/TablesManagement.tsx
// Gestion des tables avec QR codes personnalisés et haute résolution
// Génère des QR codes magnifiques avec le design du restaurant

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRestaurantId } from '@/hooks/useAdminRestaurantId';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Edit2, Download, QrCode, Loader2,
  Maximize2, Users, Copy, Check, X, RefreshCw,
  Grid3X3, LayoutGrid, UtensilsCrossed, ChefHat,
  ArrowLeft, Download as DownloadIcon, Printer,
} from 'lucide-react';
import { PremiumQRCode } from '@/components/ui/PremiumQRCode';
import { getAppUrl } from '@/lib/appUrl';

interface TableRow {
  id: string;
  restaurant_id: string;
  table_number: string;
  capacity: number;
  position_x: number | null;
  position_y: number | null;
  is_active: boolean;
  qr_code_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_open: boolean;
}

const TABLE_CAPACITIES = [2, 4, 6, 8, 10, 12, 15, 20];

// Génère les QR codes pour toutes les tables d'un restaurant
function getQrBaseUrl(): string {
  const appUrl = getAppUrl();
  if (/localhost|127\.0\.0\.1|vercel\.app/.test(appUrl)) {
    return 'https://app.restafy.shop';
  }
  return appUrl;
}

function generateTableQRUrl(restaurantSlug: string, tableNumber: string): string {
  return `${getQrBaseUrl()}/r/${restaurantSlug}?table=${encodeURIComponent(tableNumber)}`;
}

export default function TablesManagement() {
  const { profile, user } = useAuth();
  const restaurantId = useAdminRestaurantId();
  const [restaurant, setRestaurant] = useState<RestaurantRow | null>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal d'édition
  const [editingTable, setEditingTable] = useState<TableRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // QR Code preview
  const [selectedTableForQR, setSelectedTableForQR] = useState<TableRow | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);

  // Couleur d'accent du restaurant (par défaut orange terracotta)
  const accentColor = '#F97316';

  // ── Fetch restaurant ──
  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    supabase
      .from('restaurants')
      .select('id,name,slug,logo_url,is_open')
      .eq('id', restaurantId)
      .single()
      .then(({ data }) => {
        if (data) setRestaurant(data);
        setLoading(false);
      });
  }, [restaurantId]);

  // ── Fetch tables ──
  const fetchTables = useCallback(() => {
    if (!restaurantId) return;
    supabase
      .from('restaurant_tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('table_number')
      .then(({ data, error }) => {
        if (error) {
          console.warn('[Tables] fetch error (table may not exist):', error.message);
          setTables([]);
          return;
        }
        if (data) setTables(data as TableRow[]);
      });
  }, [restaurantId]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // ── Ajouter une table ──
  const handleAddTable = async () => {
    if (!restaurantId || !restaurant) return;

    // Trouver le prochain numéro
    const existingNumbers = tables.map(t => t.table_number);
    let newNumber = '1';
    for (let i = 1; i <= 100; i++) {
      if (!existingNumbers.includes(String(i))) {
        newNumber = String(i);
        break;
      }
    }

    const newTable: Partial<TableRow> = {
      restaurant_id: restaurantId,
      table_number: newNumber,
      capacity: 4,
      is_active: true,
    };

    setSaving(true);
    const { data, error } = await supabase
      .from('restaurant_tables')
      .insert([newTable])
      .select()
      .single();

    if (error) {
      toast.error('Impossible d\'ajouter la table. Veuillez réessayer.');
    } else if (data) {
      setTables(prev => [...prev, data as TableRow]);
      toast.success(`Table ${newNumber} ajoutée`);
    }
    setSaving(false);
  };

  // ── Mettre à jour une table ──
  const handleUpdateTable = async (table: TableRow) => {
    const { error } = await supabase
      .from('restaurant_tables')
      .update({
        table_number: table.table_number,
        capacity: table.capacity,
        is_active: table.is_active,
        notes: table.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', table.id);

    if (error) {
      toast.error('Impossible de modifier la table. Veuillez réessayer.');
      return false;
    }

    setTables(prev => prev.map(t => t.id === table.id ? { ...t, updated_at: new Date().toISOString() } : t));
    return true;
  };

  // ── Supprimer une table ──
  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('Supprimer cette table ? Le QR code associé ne fonctionnera plus.')) return;

    const { error } = await supabase
      .from('restaurant_tables')
      .delete()
      .eq('id', tableId);

    if (error) {
      toast.error('Impossible de supprimer la table. Veuillez réessayer.');
      return;
    }

    setTables(prev => prev.filter(t => t.id !== tableId));
    toast.success('Table supprimée');
  };

  // ── Sauver modification ──
  const handleSaveEdit = async () => {
    if (!editingTable) return;
    setSaving(true);
    const success = await handleUpdateTable(editingTable);
    setSaving(false);
    if (success) {
      setIsModalOpen(false);
      setEditingTable(null);
    }
  };

  // ── Générer tous les QR codes en PNG ──
  const handleDownloadAllQRCodes = async () => {
    if (!restaurant) return;

    try {
      const { default: html2canvas } = await import('html2canvas');

      for (const table of tables) {
        if (!table.is_active) continue;

        // Créer un conteneur temporaire
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        document.body.appendChild(container);

        // Rendre le QR code
        const qrUrl = generateTableQRUrl(restaurant.slug, table.table_number);
        const tempDiv = document.createElement('div');
        container.appendChild(tempDiv);

        // Créer le QR avec PremiumQRCode (simplifié pour le rendu)
        tempDiv.innerHTML = `
          <div style="padding: 24px; background: linear-gradient(135deg, #F97316dd, #F9731608, transparent); border-radius: 24px; border: 2px solid #F9731640; display: inline-block;">
            <div style="background: white; border-radius: 16px; padding: 16px;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrUrl)}&color=1a1a1a" 
                   style="width: 200px; height: 200px; border-radius: 8px;" alt="QR Table ${table.table_number}" />
            </div>
            <div style="margin-top: 12px; text-align: center;">
              <p style="font-size: 14px; font-weight: bold; color: #F97316;">${restaurant.name}</p>
              <p style="font-size: 11px; color: #71717a;">Table ${table.table_number}</p>
            </div>
          </div>
        `;

        await new Promise(r => setTimeout(r, 100));

        const canvas = await html2canvas(container, {
          backgroundColor: null,
          scale: 3,
        });

        const link = document.createElement('a');
        link.download = `${restaurant.name.replace(/\s+/g, '-')}-table-${table.table_number}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        document.body.removeChild(container);
      }

      toast.success(`${tables.filter(t => t.is_active).length} QR codes téléchargés`);
    } catch (err) {
      console.error('Error generating QR codes:', err);
      toast.error('Erreur lors de la génération');
    }
  };

  // ── Générer une page A4 imprimable avec tous les QR codes ──
  const handlePrintA4Sheet = () => {
    if (!restaurant) return;
    const active = tables.filter(t => t.is_active);
    if (active.length === 0) {
      toast.error('Ajoutez au moins une table active avant d\u2019imprimer');
      return;
    }

    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) {
      toast.error('Veuillez autoriser les popups pour imprimer');
      return;
    }

    const restoName = restaurant.name;
    const cells = active.map(t => {
      const url = generateTableQRUrl(restaurant.slug, t.table_number);
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=0&data=${encodeURIComponent(url)}`;
      return `
        <div class="cell">
          <div class="brand">${restoName}</div>
          <div class="qr"><img src="${qrSrc}" alt="QR ${t.table_number}" /></div>
          <div class="table-label">Table ${t.table_number}</div>
          <div class="hint">Scannez pour commander sur place</div>
        </div>
      `;
    }).join('\n');

    w.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>QR codes tables — ${restoName}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: #111; }
    .page {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8mm;
      padding: 4mm;
    }
    .cell {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1.5px dashed #e5e5e5;
      border-radius: 6mm;
      padding: 8mm 4mm;
      text-align: center;
      background: #fff;
    }
    .brand { font-size: 11pt; font-weight: 700; color: #f97316; letter-spacing: 0.02em; margin-bottom: 4mm; text-transform: uppercase; }
    .qr img { width: 60mm; height: 60mm; display: block; margin: 0 auto; }
    .table-label { margin-top: 4mm; font-size: 18pt; font-weight: 900; color: #111; }
    .hint { margin-top: 2mm; font-size: 9pt; color: #6b7280; }
    @media print {
      .toolbar { display: none; }
    }
    .toolbar {
      position: sticky; top: 0;
      background: #fff;
      border-bottom: 1px solid #eee;
      padding: 12px 16px;
      display: flex; justify-content: space-between; align-items: center;
      z-index: 10;
    }
    .toolbar button {
      background: #f97316; color: white; border: 0; padding: 10px 16px;
      font-size: 14px; font-weight: 700; border-radius: 10px; cursor: pointer;
    }
    .toolbar .meta { font-size: 13px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="meta">${active.length} QR codes · ${restoName}</div>
    <button onclick="window.print()">Imprimer</button>
  </div>
  <div class="page">
    ${cells}
  </div>
</body>
</html>`);
    w.document.close();
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!restaurantId || !restaurant) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="text-center">
          <UtensilsCrossed className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-500">Aucun restaurant lié</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full pb-8">
      {/* ═══ HEADER ═══ */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/admin/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-zinc-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-zinc-600" />
            </a>
            <div>
              <h1 className="text-lg font-extrabold text-zinc-900">Tables & QR Codes</h1>
              <p className="text-xs text-zinc-500">{tables.length} table(s) • {restaurant.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {tables.length > 0 && (
              <>
                <button
                  onClick={handlePrintA4Sheet}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                  title="Imprimer une feuille A4 avec tous les QR codes"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer A4
                </button>
                <button
                  onClick={handleDownloadAllQRCodes}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Tout télécharger
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ═══ CONTENU ═══ */}
      <div className="p-4 space-y-4">
        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl p-4 border border-orange-200/50">
            <p className="text-2xl font-black text-orange-600">{tables.length}</p>
            <p className="text-xs font-medium text-orange-700/70">Tables</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl p-4 border border-emerald-200/50">
            <p className="text-2xl font-black text-emerald-600">{tables.filter(t => t.is_active).length}</p>
            <p className="text-xs font-medium text-emerald-700/70">Actives</p>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-2xl p-4 border border-violet-200/50">
            <p className="text-2xl font-black text-violet-600">
              {tables.reduce((a, t) => a + t.capacity, 0)}
            </p>
            <p className="text-xs font-medium text-violet-700/70">Places</p>
          </div>
        </div>

        {/* Ajout rapide */}
        <button
          onClick={handleAddTable}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold border-2 border-dashed border-zinc-300 text-zinc-500 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50/50 transition-all"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Ajouter une table
            </>
          )}
        </button>

        {/* Liste des tables */}
        {tables.length === 0 ? (
          <div className="text-center py-12">
            <Grid3X3 className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
            <p className="text-zinc-500 font-medium">Aucune table créée</p>
            <p className="text-xs text-zinc-400 mt-1">Cliquez ci-dessus pour ajouter votre première table</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {tables.map(table => (
              <motion.div
                key={table.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative rounded-2xl p-4 border transition-all hover:shadow-lg ${
                  table.is_active
                    ? 'bg-white border-zinc-200 hover:border-orange-300'
                    : 'bg-zinc-50 border-zinc-100 opacity-60'
                }`}
              >
                {/* Numéro de table */}
                <div className="text-center">
                  <p className="text-3xl font-black text-zinc-800">{table.table_number}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Users className="w-3 h-3 text-zinc-400" />
                    <span className="text-xs font-medium text-zinc-500">{table.capacity} places</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => {
                      setEditingTable(table);
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 transition-colors"
                  >
                    <Edit2 className="w-3 h-3 text-zinc-600" />
                  </button>
                  <button
                    onClick={() => setSelectedTableForQR(table)}
                    className="p-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 transition-colors"
                  >
                    <QrCode className="w-3 h-3 text-orange-600" />
                  </button>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDeleteTable(table.id)}
                  className="absolute bottom-2 right-2 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3 h-3 text-zinc-300 hover:text-red-500" />
                </button>

                {/* Status indicator */}
                <div className={`absolute top-2 left-2 w-2 h-2 rounded-full ${
                  table.is_active ? 'bg-emerald-400' : 'bg-zinc-300'
                }`} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200">
          <h3 className="text-sm font-bold text-zinc-900 mb-2">💡 Comment utiliser</h3>
          <ul className="text-xs text-zinc-600 space-y-1.5">
            <li>1. Créez vos tables avec les numéros (1, 2, 3... ou A1, A2...)</li>
            <li>2. Téléchargez les QR codes et collez-les sur chaque table</li>
            <li>3. Le client scanne et commande directement avec son numéro de table</li>
            <li>4. Vous voyez la commande avec le bon numéro de table 💙</li>
          </ul>
        </div>
      </div>

      {/* ═══ MODAL D'ÉDITION ═══ */}
      <AnimatePresence>
        {isModalOpen && editingTable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-extrabold text-zinc-900">Modifier table {editingTable.table_number}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-zinc-100">
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-700">Numéro de table</label>
                  <input
                    type="text"
                    value={editingTable.table_number}
                    onChange={e => setEditingTable({ ...editingTable, table_number: e.target.value })}
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-300 font-bold text-lg"
                    placeholder="Ex: 1, 2, A1, VIP..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700">Capacité</label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {TABLE_CAPACITIES.map(cap => (
                      <button
                        key={cap}
                        onClick={() => setEditingTable({ ...editingTable, capacity: cap })}
                        className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                          editingTable.capacity === cap
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'border-zinc-200 text-zinc-600 hover:border-orange-300'
                        }`}
                      >
                        {cap}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700">Notes</label>
                  <textarea
                    value={editingTable.notes || ''}
                    onChange={e => setEditingTable({ ...editingTable, notes: e.target.value })}
                    className="w-full mt-1 px-4 py-3 rounded-xl border border-zinc-300 text-sm"
                    placeholder="Ex: Table fenêtre, Réservée groupe..."
                    rows={2}
                  />
                </div>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTable.is_active}
                    onChange={e => setEditingTable({ ...editingTable, is_active: e.target.checked })}
                    className="w-5 h-5 rounded text-orange-500"
                  />
                  <span className="text-sm font-medium">Table active</span>
                </label>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl font-bold border border-zinc-300 text-zinc-600"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl font-bold bg-orange-500 text-white"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Sauvegarder'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ MODAL QR CODE ═══ */}
      <AnimatePresence>
        {selectedTableForQR && restaurant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelectedTableForQR(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <button
                onClick={() => setSelectedTableForQR(null)}
                className="absolute top-4 right-4 p-2 rounded-xl hover:bg-zinc-100"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>

              <div className="text-center mb-4">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Table</p>
                <p className="text-4xl font-black text-orange-600">{selectedTableForQR.table_number}</p>
              </div>

              <PremiumQRCode
                value={generateTableQRUrl(restaurant.slug, selectedTableForQR.table_number)}
                restaurantName={restaurant.name}
                tableName={`Table ${selectedTableForQR.table_number}`}
                size={180}
                accentColor={accentColor}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
