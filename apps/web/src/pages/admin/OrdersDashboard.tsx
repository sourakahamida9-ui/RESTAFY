// src/pages/admin/OrdersDashboard.tsx
// Design Signature Dark Mode - Premium Restaurant Dashboard
// Stats en temps reel, filtres avances, exports CSV/PDF

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Loader2, Volume2, VolumeX, SlidersHorizontal, Search, X,
  RefreshCw, FileSpreadsheet, Printer, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Ban, Phone, MapPin, Clock, Utensils,
  Bike, ShoppingBag, TrendingUp, Banknote, Package, UserPlus,
  MessageSquare, Timer, RotateCcw, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { fetchRestaurantOrdersWithItems } from '@/lib/restaurantOrdersQuery';
import { pickAvailableDeliveryDriver } from '@/lib/deliveryAssign';
import { changeOrderStatus } from '@/lib/changeOrderStatus';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRestaurantId } from '@/hooks/useAdminRestaurantId';
import { useOrderRealtime } from '@/hooks/useOrderRealtime';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { toast } from 'sonner';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import OrdersKanban from '@/components/admin/OrdersKanban';
import { LayoutGrid, List as ListIcon } from 'lucide-react';

// Types
interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string | null;
}

interface DeliveryDriver {
  id: string;
  name: string;
  phone: string;
  is_available: boolean;
}

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  status: 'pending' | 'accepted' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';
  type: 'delivery' | 'dine_in' | 'takeaway';
  delivery_address?: string | null;
  notes?: string | null;
  cancel_reason?: string | null;
  customer_id?: string | null;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  items: OrderItem[];
  driver_id?: string | null;
  driver?: DeliveryDriver | null;
  prep_time_min?: number | null;
  estimated_delivery?: string | null;
}

// Config statuts - Dark mode optimized
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; icon: LucideIcon }> = {
  pending: { label: 'Nouvelle', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-500', icon: Clock },
  accepted: { label: 'Acceptee', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-500', icon: CheckCircle2 },
  confirmed: { label: 'Confirmee', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-500', icon: CheckCircle2 },
  preparing: { label: 'En cuisine', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', dot: 'bg-orange-500', icon: Utensils },
  ready: { label: 'Prete', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-500', icon: Package },
  delivering: { label: 'Livraison', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', dot: 'bg-purple-500', icon: Bike },
  delivered: { label: 'Livree', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20', dot: 'bg-zinc-500', icon: CheckCircle2 },
  cancelled: { label: 'Annulee', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-500', icon: X },
};

const NEXT_STATUS: Partial<Record<string, string>> = {
  pending: 'confirmed', accepted: 'preparing', confirmed: 'preparing',
  preparing: 'ready', ready: 'delivering', delivering: 'delivered',
};
const NEXT_LABEL: Partial<Record<string, string>> = {
  pending: 'Accepter', accepted: 'Preparer', confirmed: 'Preparer',
  preparing: 'Prete', ready: 'Envoyer', delivering: 'Livree',
};

const TYPE_CONFIG: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  delivery: { label: 'Livraison', icon: Bike, color: 'text-purple-400' },
  dine_in: { label: 'Sur place', icon: Utensils, color: 'text-emerald-400' },
  takeaway: { label: 'A emporter', icon: ShoppingBag, color: 'text-blue-400' },
};

const CANCEL_REASONS = [
  'Articles indisponibles', 'Restaurant ferme',
  'Zone non couverte', 'Probleme technique', 'Autre',
];

const PAGE_SIZE = 20;

// Export CSV
function exportCSV(orders: Order[], name: string) {
  const header = ['N Commande', 'Date', 'Heure', 'Statut', 'Type', 'Client', 'Telephone', 'Adresse', 'Articles', 'Total (FCFA)', 'Note'];
  const rows = orders.map(o => {
    const d = new Date(o.created_at);
    const articles = o.items.map(i => `${i.quantity}x ${i.item_name}`).join(' | ');
    return [
      `#${o.order_number}`, d.toLocaleDateString('fr-FR'),
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      STATUS_CONFIG[o.status]?.label || o.status, TYPE_CONFIG[o.type]?.label || o.type,
      o.customer_name || '', o.customer_phone || '', o.delivery_address || '',
      articles, Number(o.total_amount).toFixed(0), o.notes || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`);
  });

  const csv = '\uFEFF' + [header.map(h => `"${h}"`), ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `commandes_${name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${orders.length} commandes exportees`);
}

// Export PDF
function exportPDF(orders: Order[], name: string) {
  const now = new Date().toLocaleString('fr-FR');
  const totalCA = orders.reduce((s, o) => s + Number(o.total_amount), 0);
  const nbDelivered = orders.filter(o => o.status === 'delivered').length;
  const nbCancelled = orders.filter(o => o.status === 'cancelled').length;

  const rows = orders.map(o => {
    const d = new Date(o.created_at);
    const dt = `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    const articles = o.items.map(i => `${i.quantity}x ${i.item_name}`).join(', ') || '-';
    return `<tr>
      <td><strong>#${o.order_number}</strong></td>
      <td>${dt}</td>
      <td>${STATUS_CONFIG[o.status]?.label || o.status}</td>
      <td>${TYPE_CONFIG[o.type]?.label || o.type}</td>
      <td>${o.customer_name || '-'}</td>
      <td>${articles}</td>
      <td style="text-align:right;font-weight:900">${Number(o.total_amount).toLocaleString('fr-FR')} F</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Rapport - ${name}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:system-ui,sans-serif; font-size:11px; color:#111; padding:24px; background:#fff; }
  h1 { font-size:22px; font-weight:900; color:#f97316; }
  .sub { color:#777; font-size:10px; margin-top:2px; margin-bottom:20px; }
  .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
  .kpi { background:#f9f9f9; border:1px solid #eee; border-radius:8px; padding:12px; text-align:center; }
  .kpi-v { font-size:22px; font-weight:900; }
  .kpi-l { font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:#888; margin-top:3px; }
  table { width:100%; border-collapse:collapse; }
  th { background:#111; color:#fff; padding:8px 6px; text-align:left; font-size:9px; text-transform:uppercase; }
  td { padding:7px 6px; border-bottom:1px solid #f0f0f0; vertical-align:top; }
  tr:nth-child(even) td { background:#fafafa; }
  tfoot td { background:#111; color:#fff; font-weight:900; padding:9px 6px; }
  @media print { @page { margin:12mm; } }
</style></head><body>
  <h1>Rapport des commandes</h1>
  <p class="sub">Restaurant : <strong>${name}</strong> - ${now}</p>
  <div class="kpis">
    <div class="kpi"><div class="kpi-v">${orders.length}</div><div class="kpi-l">Total</div></div>
    <div class="kpi"><div class="kpi-v">${nbDelivered}</div><div class="kpi-l">Livrees</div></div>
    <div class="kpi"><div class="kpi-v">${nbCancelled}</div><div class="kpi-l">Annulees</div></div>
    <div class="kpi"><div class="kpi-v">${totalCA.toLocaleString('fr-FR')} F</div><div class="kpi-l">CA</div></div>
  </div>
  <table>
    <thead><tr><th>N</th><th>Date</th><th>Statut</th><th>Type</th><th>Client</th><th>Articles</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="6">TOTAL - ${orders.length} commandes</td><td style="text-align:right">${totalCA.toLocaleString('fr-FR')} F</td></tr></tfoot>
  </table>
  <script>setTimeout(()=>{window.print();},500);</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=1000,height=750');
  if (!w) { toast.error('Autorisez les popups pour exporter'); return; }
  w.document.write(html);
  w.document.close();
  toast.success('Rapport PDF ouvert');
}

// Order Card Component
function OrderCard({ order, onUpdate, onCancel, onAssignDriver, onSetPrepTime, drivers }: {
  order: Order;
  onUpdate: (id: string, status: string) => void;
  onCancel: (id: string) => void;
  onAssignDriver: (orderId: string, driverId: string | null) => void;
  onSetPrepTime: (orderId: string, minutes: number) => void;
  drivers: DeliveryDriver[];
}) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const typeConfig = TYPE_CONFIG[order.type] || TYPE_CONFIG.delivery;
  const next = NEXT_STATUS[order.status];
  const nextLbl = NEXT_LABEL[order.status];
  const age = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const isNew = age < 2;
  const isUrgent = ['pending', 'accepted', 'confirmed'].includes(order.status) && age > 5;
  const [open, setOpen] = useState(['pending', 'accepted', 'confirmed'].includes(order.status));
  const [showDriverSelect, setShowDriverSelect] = useState(false);
  const [showPrepTimeSelect, setShowPrepTimeSelect] = useState(false);

  return (
    <motion.div 
      layout 
      initial={{ opacity: 0, y: 8 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, scale: 0.97 }}
      className={`rounded-2xl border overflow-hidden transition-all ${cfg.bg} ${isUrgent ? 'ring-2 ring-red-500/50' : ''}`}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer gap-3" 
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot} ${order.status === 'pending' ? 'animate-pulse' : ''}`} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-[color:var(--r-text)]">#{order.order_number}</span>
              {isNew && <span className="text-[9px] font-black bg-emerald-500 text-[color:var(--r-text)] px-1.5 py-0.5 rounded-full animate-pulse">NEW</span>}
              {isUrgent && <span className="text-[9px] font-black bg-red-500 text-[color:var(--r-text)] px-1.5 py-0.5 rounded-full animate-pulse">URGENT</span>}
            </div>
            <p className="text-xs text-zinc-500 truncate">
              {order.customer_name || 'Client'} - {age < 60 ? `${age} min` : `${Math.floor(age / 60)}h${String(age % 60).padStart(2, '0')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="font-black text-[color:var(--r-text)]">{Number(order.total_amount).toLocaleString('fr-FR')} F</p>
            <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </div>

      {/* Details */}
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} 
            className="overflow-hidden border-t border-white/5"
          >
            <div className="px-4 pb-4 pt-3 space-y-3">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`flex items-center gap-1.5 text-[10px] font-bold bg-white/5 px-2.5 py-1 rounded-lg ${typeConfig.color}`}>
                  <typeConfig.icon className="w-3 h-3" />
                  {typeConfig.label}
                </span>
                {order.customer_phone && (
                  <a 
                    href={`tel:${order.customer_phone}`} 
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-[10px] font-bold bg-white/5 px-2.5 py-1 rounded-lg text-zinc-400 hover:bg-white/10 transition-colors"
                  >
                    <Phone className="w-3 h-3" /> {order.customer_phone}
                  </a>
                )}
                {order.delivery_address && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold bg-white/5 px-2.5 py-1 rounded-lg text-zinc-400">
                    <MapPin className="w-3 h-3" /> {order.delivery_address}
                  </span>
                )}
              </div>

              {/* Articles */}
              {order.items.length > 0 && (
                <div className="bg-white/5 rounded-xl p-3 space-y-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Articles</p>
                  {order.items.map(item => (
                    <div key={item.id}>
                      <div className="flex justify-between">
                        <span className="text-sm font-bold text-[color:var(--r-text)]">{item.quantity}x {item.item_name}</span>
                        <span className="text-sm font-black text-[color:var(--r-text)]">{Number(item.subtotal).toLocaleString('fr-FR')} F</span>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-amber-400 bg-amber-500/10 rounded-lg px-2 py-1 mt-1">{item.notes}</p>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-white/5">
                    <span className="text-xs text-zinc-500 font-bold">Total</span>
                    <span className="text-sm font-black text-[color:var(--r-text)]">{Number(order.total_amount).toLocaleString('fr-FR')} F</span>
                  </div>
                </div>
              )}

              {order.notes && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                  <p className="text-[9px] font-black text-amber-400 mb-0.5">NOTE CLIENT</p>
                  <p className="text-sm text-amber-300">{order.notes}</p>
                </div>
              )}

              {order.status === 'cancelled' && order.cancel_reason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  <p className="text-xs font-bold text-red-400">Motif : {order.cancel_reason}</p>
                </div>
              )}

              {/* Driver Assignment for delivery orders */}
              {order.type === 'delivery' && ['confirmed', 'preparing', 'ready'].includes(order.status) && (
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Livreur assigne</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowDriverSelect(!showDriverSelect); }}
                      className="text-[10px] font-bold text-orange-400 hover:underline"
                    >
                      {order.driver ? 'Changer' : 'Assigner'}
                    </button>
                  </div>
                  {order.driver ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Bike className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[color:var(--r-text)]">{order.driver.name}</p>
                        <a href={`tel:${order.driver.phone}`} className="text-xs text-zinc-500 hover:text-purple-400">{order.driver.phone}</a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">Aucun livreur assigne</p>
                  )}
                  {showDriverSelect && (
                    <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
                      {drivers.length === 0 ? (
                        <p className="text-xs text-zinc-500">Aucun livreur disponible</p>
                      ) : (
                        drivers.map(d => (
                          <button
                            key={d.id}
                            onClick={(e) => { e.stopPropagation(); onAssignDriver(order.id, d.id); setShowDriverSelect(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                              order.driver_id === d.id ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                            }`}
                          >
                            <Bike className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold">{d.name}</span>
                            {d.is_available && <span className="ml-auto w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                          </button>
                        ))
                      )}
                      {order.driver_id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onAssignDriver(order.id, null); setShowDriverSelect(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">Retirer le livreur</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Prep Time */}
              {['pending', 'confirmed', 'preparing'].includes(order.status) && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowPrepTimeSelect(!showPrepTimeSelect); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-zinc-400 hover:bg-white/10 transition-all"
                  >
                    <Timer className="w-3.5 h-3.5" />
                    {order.prep_time_min ? `${order.prep_time_min} min` : 'Temps prep.'}
                  </button>
                  {showPrepTimeSelect && (
                    <div className="flex flex-wrap gap-1">
                      {[15, 20, 30, 45, 60].map(min => (
                        <button
                          key={min}
                          onClick={(e) => { e.stopPropagation(); onSetPrepTime(order.id, min); setShowPrepTimeSelect(false); }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            order.prep_time_min === min ? 'bg-orange-500 text-[color:var(--r-text)]' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                          }`}
                        >
                          {min}m
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {!['delivered', 'cancelled'].includes(order.status) && (
                <div className="flex gap-2 pt-1">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onCancel(order.id); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold hover:bg-red-500/20 transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5" /> Annuler
                  </button>
                  {next && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onUpdate(order.id, next); }}
                      className="flex-1 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-[color:var(--r-text)] rounded-xl text-xs font-black transition-all"
                    >
                      {nextLbl}
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Cancel Modal
function CancelModal({ onConfirm, onClose }: { onConfirm: (r: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: 40 }} 
        animate={{ y: 0 }} 
        exit={{ y: 40 }}
        className="bg-[#1A1A1A] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4" 
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-black text-[color:var(--r-text)]">Annuler la commande</h3>
        <div className="space-y-2">
          {CANCEL_REASONS.map(r => (
            <button 
              key={r} 
              onClick={() => setReason(r)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                reason === r 
                  ? 'border-red-500 bg-red-500/10 text-red-400' 
                  : 'border-white/10 text-zinc-400 hover:border-white/20'
              }`}
            >
              {r}
            </button>
          ))}
          <input 
            value={reason} 
            onChange={e => setReason(e.target.value)} 
            placeholder="Autre raison..."
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-[color:var(--r-text)] placeholder-zinc-600 focus:outline-none focus:border-red-500/50" 
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 border border-white/10 rounded-xl text-sm font-bold text-zinc-400 hover:bg-white/5 transition-colors">
            Retour
          </button>
          <button 
            onClick={() => onConfirm(reason || 'Annulee par le restaurant')}
            className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-[color:var(--r-text)] rounded-xl text-sm font-black transition-colors"
          >
            Confirmer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Main Component
export default function OrdersDashboard() {
  const restaurantId = useAdminRestaurantId();

  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [restaurantName, setRestaurantName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { prefs: notifPrefs, update: updateNotifPrefs } = useNotificationPreferences();
  const soundEnabled = notifPrefs.soundEnabled;
  const setSoundEnabled = (next: boolean | ((prev: boolean) => boolean)) =>
    updateNotifPrefs({
      soundEnabled: typeof next === 'function' ? next(notifPrefs.soundEnabled) : next,
    });
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [fType, setFType] = useState('all');
  const [fView, setFView] = useState<'active' | 'today' | 'week' | 'all'>('active');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Vue : kanban (Order Inbox temps réel) ou liste (filtres avancés / export).
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(() => {
    if (typeof window === 'undefined') return 'kanban';
    return (localStorage.getItem('restafy:orders-view') as 'kanban' | 'list') || 'kanban';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('restafy:orders-view', viewMode);
  }, [viewMode]);

  // Fetch drivers
  const fetchDrivers = useCallback(async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('delivery_drivers')
      .select('id, name, phone, is_available')
      .eq('restaurant_id', restaurantId)
      .order('name');
    if (data) setDrivers(data);
  }, [restaurantId]);

  // Fetch
  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const rows = await fetchRestaurantOrdersWithItems(restaurantId, 500);

      const custIds = [...new Set(rows.filter((o) => o.customer_id).map((o) => o.customer_id!))];
      let cmap: Record<string, { full_name?: string; phone?: string }> = {};
      if (custIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name, phone').in('id', custIds);
        if (profs) cmap = Object.fromEntries(profs.map((p) => [p.id, p]));
      }

      const { data: driverData } = await supabase
        .from('delivery_drivers')
        .select('id, name, phone, is_available')
        .eq('restaurant_id', restaurantId);
      const driverMap: Record<string, DeliveryDriver> = {};
      (driverData || []).forEach((d) => {
        driverMap[d.id] = d;
      });
      setDrivers(driverData || []);

      setOrders(
        rows.map((o) => ({
          id: o.id,
          order_number: o.order_number ?? o.id.slice(0, 8),
          total_amount: Number(o.total_amount ?? 0),
          status: o.status as Order['status'],
          type: (o.type || 'delivery') as Order['type'],
          delivery_address: o.delivery_address,
          notes: o.notes,
          cancel_reason: o.cancel_reason,
          customer_id: o.customer_id,
          created_at: o.created_at,
          driver_id: o.driver_id,
          prep_time_min: o.prep_time_min,
          estimated_delivery: o.estimated_delivery,
          customer_name:
            (o as { customer_name?: string | null }).customer_name ||
            cmap[o.customer_id || '']?.full_name ||
            (o as { customer_email?: string | null }).customer_email ||
            'Client',
          customer_phone:
            (o as { customer_phone?: string | null }).customer_phone ||
            cmap[o.customer_id || '']?.phone ||
            undefined,
          customer_email: (o as { customer_email?: string | null }).customer_email || undefined,
          items: (o.order_items || []) as OrderItem[],
          driver: o.driver_id ? driverMap[o.driver_id] || null : null,
        })),
      );
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useOrderRealtime(
    restaurantId || null,
    useCallback(() => {
      void fetchOrders();
    }, [fetchOrders]),
    soundEnabled,
    notifPrefs.vibrationEnabled,
  );

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    fetchOrders();
    supabase.from('restaurants').select('name').eq('id', restaurantId).single()
      .then(({ data }) => { if (data?.name) setRestaurantName(data.name); });
    const iv = setInterval(fetchOrders, 30000);
    return () => clearInterval(iv);
  }, [restaurantId, fetchOrders]);

  // Update status via RPC change_order_status (state machine + log staff/device)
  const handleUpdate = async (orderId: string, newStatus: string) => {
    const order = orders.find((x) => x.id === orderId);
    const prev = orders;
    let picked: { id: string; name: string } | null = null;

    // Driver assignment is non-status field — pre-update separately.
    if (newStatus === 'delivering' && order?.type === 'delivery' && restaurantId && !order.driver_id) {
      picked = await pickAvailableDeliveryDriver(restaurantId);
      if (picked) {
        const { error: drvErr } = await supabase
          .from('orders')
          .update({ driver_id: picked.id, driver_assigned_at: new Date().toISOString() })
          .eq('id', orderId);
        if (drvErr) {
          toast.error('Erreur assignation livreur: ' + drvErr.message);
          return;
        }
      } else {
        toast.message(
          'Aucun livreur marqué disponible (delivery_drivers). Assignez manuellement ou ajoutez un livreur.',
          { duration: 6500 },
        );
      }
    }

    const driverForState: DeliveryDriver | null = picked
      ? (drivers.find((d) => d.id === picked!.id) || {
          id: picked!.id,
          name: picked!.name,
          phone: '',
          is_available: true,
        })
      : null;

    setOrders((o) =>
      o.map((x) =>
        x.id === orderId
          ? {
              ...x,
              status: newStatus as Order['status'],
              ...(driverForState ? { driver_id: driverForState.id, driver: driverForState } : {}),
            }
          : x,
      ),
    );

    const result = await changeOrderStatus(orderId, newStatus, 'desktop');
    if (!result.ok) {
      setOrders(prev);
      if (result.error === 'invalid_transition') {
        toast.error(`Transition impossible: ${result.from} → ${result.to}`);
      } else {
        toast.error('Erreur: ' + (result.error ?? 'unknown'));
      }
      return;
    }
    if (picked) toast.success(`Statut mis à jour — ${picked.name} assigné`);
    else toast.success('Statut mis à jour');
  };

  // Cancel — passe par la RPC + écrit cancel_reason en pré-update
  const handleCancel = async (reason: string) => {
    if (!cancelTarget) return;
    const id = cancelTarget; setCancelTarget(null);
    setOrders(o => o.map(x => x.id === id ? { ...x, status: 'cancelled', cancel_reason: reason } : x));

    // Pre-update cancel_reason (non-status field) avant la RPC qui change le statut.
    const { error: reasonErr } = await supabase.from('orders')
      .update({ cancel_reason: reason }).eq('id', id);
    if (reasonErr) {
      toast.error('Erreur: ' + reasonErr.message);
      return;
    }

    const cancelResult = await changeOrderStatus(id, 'cancelled', 'desktop');
    if (!cancelResult.ok) {
      toast.error('Erreur: ' + (cancelResult.error ?? 'unknown'));
    } else {
      toast.success('Commande annulée');
    }
  };

  // Assign driver
  const handleAssignDriver = async (orderId: string, driverId: string | null) => {
    const driver = driverId ? drivers.find(d => d.id === driverId) || null : null;
    setOrders(o => o.map(x => x.id === orderId ? { ...x, driver_id: driverId, driver } : x));
    const { error: e } = await supabase.from('orders')
      .update({ driver_id: driverId, driver_assigned_at: driverId ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (e) toast.error('Erreur: ' + e.message);
    else toast.success(driverId ? 'Livreur assigne' : 'Livreur retire');
  };

  // Set prep time
  const handleSetPrepTime = async (orderId: string, minutes: number) => {
    const estimated = new Date(Date.now() + minutes * 60000).toISOString();
    setOrders(o => o.map(x => x.id === orderId ? { ...x, prep_time_min: minutes, estimated_delivery: estimated } : x));
    const { error: e } = await supabase.from('orders')
      .update({ prep_time_min: minutes, estimated_delivery: estimated, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (e) toast.error('Erreur: ' + e.message);
    else toast.success(`Temps de preparation: ${minutes} min`);
  };

  // Filter
  const filtered = useMemo(() => {
    let list = orders;

    if (fView === 'active') list = list.filter(o => !['delivered', 'cancelled'].includes(o.status));
    else if (fView === 'today') {
      const t = new Date(); t.setHours(0, 0, 0, 0);
      list = list.filter(o => new Date(o.created_at) >= t);
    } else if (fView === 'week') {
      list = list.filter(o => new Date(o.created_at) >= new Date(Date.now() - 7 * 86400000));
    }

    if (fStatus !== 'all') {
      list = list.filter(o => fStatus === 'confirmed' ? ['confirmed', 'accepted'].includes(o.status) : o.status === fStatus);
    }
    if (fType !== 'all') list = list.filter(o => o.type === fType);
    if (dateFrom) list = list.filter(o => new Date(o.created_at) >= new Date(dateFrom));
    if (dateTo) {
      const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
      list = list.filter(o => new Date(o.created_at) <= end);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.order_number || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_phone || '').includes(q) ||
        (o.delivery_address || '').toLowerCase().includes(q) ||
        o.items.some(i => (i.item_name ?? '').toLowerCase().includes(q))
      );
    }
    return list;
  }, [orders, fView, fStatus, fType, dateFrom, dateTo, search]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [fView, fStatus, fType, search, dateFrom, dateTo]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return {
      pending: orders.filter(o => o.status === 'pending').length,
      active: orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length,
      todayCount: orders.filter(o => new Date(o.created_at) >= today).length,
      caToday: orders.filter(o => new Date(o.created_at) >= today && o.status === 'delivered')
        .reduce((s, o) => s + Number(o.total_amount), 0),
      caFiltered: filtered.reduce((s, o) => s + Number(o.total_amount), 0),
    };
  }, [orders, filtered]);

  const hasActiveFilters = search || fStatus !== 'all' || fType !== 'all' || dateFrom || dateTo;

  return (
    <div className="min-h-full">
      {/* Header */}
      <div
        className="sticky top-0 z-20 backdrop-blur-xl border-b w-full min-w-0 mb-4 rounded-2xl sm:rounded-none sm:mx-0 overflow-hidden border-white/10"
        style={{
          backgroundColor: 'var(--r-header-bg)',
          borderColor: 'var(--r-header-border)',
        }}
      >
        <div className="r-page-shell !py-4 !px-3 sm:!px-4">
          {/* Title + Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-[color:var(--r-text)]">Commandes</h1>
              {restaurantName && <p className="text-[10px] text-zinc-500 font-medium truncate">{restaurantName}</p>}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-start sm:justify-end">
              {/* Toggle vue Kanban / Liste */}
              <div className="inline-flex rounded-xl bg-white/5 p-0.5">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                    viewMode === 'kanban'
                      ? 'bg-orange-500/30 text-orange-300'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  title="Vue Kanban (Order Inbox)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Kanban</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                    viewMode === 'list'
                      ? 'bg-orange-500/30 text-orange-300'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  title="Vue liste (filtres + export)"
                >
                  <ListIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Liste</span>
                </button>
              </div>
              <button 
                onClick={() => setSoundEnabled(v => !v)}
                className={`p-2 rounded-xl transition-colors ${soundEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-500'}`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button 
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                  showFilters ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-zinc-400'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Filtres</span>
                {hasActiveFilters && <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />}
              </button>
              <button 
                onClick={() => { if (filtered.length === 0) { toast.error('Aucune commande'); return; } exportCSV(filtered, restaurantName || 'Restaurant'); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/30 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button 
                onClick={() => { if (filtered.length === 0) { toast.error('Aucune commande'); return; } exportPDF(filtered, restaurantName || 'Restaurant'); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 text-zinc-400 rounded-xl text-xs font-bold hover:bg-white/10 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button 
                onClick={() => { setLoading(true); fetchOrders(); }}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Nouvelles', val: stats.pending, color: 'from-amber-500 to-orange-600', textColor: 'text-amber-400', pulse: stats.pending > 0 },
              { label: 'En cours', val: stats.active, color: 'from-blue-500 to-cyan-600', textColor: 'text-blue-400' },
              { label: 'Auj.', val: stats.todayCount, color: 'from-purple-500 to-violet-600', textColor: 'text-purple-400' },
              { label: 'CA', val: stats.caToday >= 1000 ? `${(stats.caToday / 1000).toFixed(0)}k` : `${stats.caToday}`, color: 'from-emerald-500 to-green-600', textColor: 'text-emerald-400', suffix: 'F' },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5 text-center relative overflow-hidden group hover:border-white/10 transition-all">
                <div className={`absolute top-0 right-0 w-12 h-12 bg-gradient-to-br ${s.color} opacity-10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2 group-hover:opacity-20 transition-opacity`} />
                <p className={`text-lg sm:text-xl font-black ${s.textColor} flex items-center justify-center gap-1`}>
                  {s.val}{s.suffix && <span className="text-xs font-bold">{s.suffix}</span>}
                  {s.pulse && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />}
                </p>
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Quick Views */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {([
              { id: 'active', label: 'En cours' },
              { id: 'today', label: "Aujourd'hui" },
              { id: 'week', label: '7 jours' },
              { id: 'all', label: 'Tout' },
            ] as const).map(f => (
              <button 
                key={f.id} 
                onClick={() => setFView(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all ${
                  fView === f.id 
                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-[color:var(--r-text)]' 
                    : 'bg-white/5 text-zinc-500 hover:bg-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="max-w-4xl mx-auto px-4 py-4 border-t border-white/5 space-y-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input 
                    type="text" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher commande, client, article..."
                    className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-[color:var(--r-text)] placeholder-zinc-600 focus:outline-none focus:border-orange-500/50" 
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="w-4 h-4 text-zinc-500" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select 
                    value={fStatus} 
                    onChange={e => setFStatus(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-[color:var(--r-text)] focus:outline-none"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="pending">Nouvelles</option>
                    <option value="confirmed">Acceptees</option>
                    <option value="preparing">En cuisine</option>
                    <option value="ready">Pretes</option>
                    <option value="delivering">Livraison</option>
                    <option value="delivered">Livrees</option>
                    <option value="cancelled">Annulees</option>
                  </select>

                  <select 
                    value={fType} 
                    onChange={e => setFType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-[color:var(--r-text)] focus:outline-none"
                  >
                    <option value="all">Tous les types</option>
                    <option value="delivery">Livraison</option>
                    <option value="dine_in">Sur place</option>
                    <option value="takeaway">A emporter</option>
                  </select>

                  <input 
                    type="date" 
                    value={dateFrom} 
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-[color:var(--r-text)] focus:outline-none" 
                  />
                  <input 
                    type="date" 
                    value={dateTo} 
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-[color:var(--r-text)] focus:outline-none" 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-zinc-500">
                    <span className="text-[color:var(--r-text)]">{filtered.length}</span> commande{filtered.length !== 1 ? 's' : ''} - 
                    CA : <span className="text-emerald-400">{stats.caFiltered.toLocaleString('fr-FR')} F</span>
                  </p>
                  {hasActiveFilters && (
                    <button 
                      onClick={() => { setSearch(''); setFStatus('all'); setFType('all'); setDateFrom(''); setDateTo(''); }}
                      className="text-xs font-bold text-orange-400 hover:underline"
                    >
                      Reinitialiser
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Body */}
      <div className="r-page-shell !py-3 !px-3 sm:!px-4 space-y-3 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:pb-8">
        {loading && (
          <div className="flex justify-center py-12 min-h-[240px] items-center">
            <RestafyLoader fullscreen={false} message="Chargement des commandes…" size="md" />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-red-400 text-sm">Impossible de charger les commandes</p>
              <p className="text-xs text-red-400/70 mt-1">{error}</p>
              {error.includes('trop longue') ? (
                <p className="text-[11px] text-red-400/50 mt-2 leading-relaxed">
                  Connexion lente ou base surchargée : réessayez. Si ça continue, exécutez{' '}
                  <code className="font-mono bg-red-500/15 px-1 rounded">scripts/075-fix-orders-rls-roles.sql</code> sur Supabase et vérifiez{' '}
                  <code className="font-mono bg-red-500/15 px-1 rounded">profiles.restaurant_id</code>.
                </p>
              ) : (
                <p className="text-[11px] text-red-400/50 mt-2 leading-relaxed">
                  Vérifiez les droits RLS (script 075) et que votre compte a un restaurant lié.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void fetchOrders();
              }}
              className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/35 text-red-300 text-xs font-bold hover:bg-red-500/30"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && paginated.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="font-bold text-zinc-400">
              {fView === 'active' ? 'Aucune commande en cours' : 'Aucune commande trouvee'}
            </p>
            {hasActiveFilters && (
              <button 
                onClick={() => { setSearch(''); setFStatus('all'); setFType('all'); setDateFrom(''); setDateTo(''); }}
                className="mt-4 text-sm text-orange-400 font-bold hover:underline"
              >
                Effacer les filtres
              </button>
            )}
          </motion.div>
        )}

        {!loading && !error && paginated.length > 0 && viewMode === 'list' && (
          <AnimatePresence mode="popLayout">
            {paginated.map(order => (
              <OrderCard 
                              key={order.id} 
                              order={order} 
                              onUpdate={handleUpdate} 
                              onCancel={id => setCancelTarget(id)} 
                              onAssignDriver={handleAssignDriver}
                              onSetPrepTime={handleSetPrepTime}
                              drivers={drivers}
                            />
            ))}
          </AnimatePresence>
        )}

        {!loading && !error && filtered.length > 0 && viewMode === 'kanban' && (
          <OrdersKanban
            orders={filtered as unknown as Parameters<typeof OrdersKanban>[0]['orders']}
            onChanged={() => { void fetchOrders(); }}
            onLocalUpdate={(orderId, newStatus) => {
              setOrders((prev) =>
                prev.map((x) => (x.id === orderId ? { ...x, status: newStatus as Order['status'] } : x)),
              );
            }}
          />
        )}

        {/* Pagination — n'apparaît qu'en vue liste */}
        {viewMode === 'list' && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-6">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-zinc-400 disabled:opacity-40 hover:bg-white/10 transition-colors"
            >
              Prec.
            </button>
            <span className="text-sm font-bold text-zinc-500">
              {page} / {totalPages}
            </span>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-zinc-400 disabled:opacity-40 hover:bg-white/10 transition-colors"
            >
              Suiv.
            </button>
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      <AnimatePresence>
        {cancelTarget && <CancelModal onConfirm={handleCancel} onClose={() => setCancelTarget(null)} />}
      </AnimatePresence>
    </div>
  );
}
