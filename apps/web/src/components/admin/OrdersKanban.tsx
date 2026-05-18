// src/components/admin/OrdersKanban.tsx
// Order Inbox kanban — vue 5 colonnes pour le dashboard restaurant.
// Colonnes : Nouvelles · Acceptées · En cuisine · Prêtes · Livrées
// Interactions : (1) bouton « action suivante » sur chaque carte, (2) drag-and-drop entre colonnes.
// Source de vérité statut : RPC change_order_status (cf. scripts/102-oms-state-machine.sql).

import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bike, ShoppingBag, Utensils, Clock, CheckCircle2, Flame, Package, ArrowRight, Loader2, Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { changeOrderStatus } from '@/lib/changeOrderStatus';

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
}
export interface KanbanOrder {
  id: string;
  order_number: string;
  status: string;
  type: 'delivery' | 'dine_in' | 'takeaway' | string;
  total_amount: number | string;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  notes?: string | null;
  created_at: string;
  items: OrderItem[];
}

const TYPE_META: Record<string, { Icon: React.ElementType; color: string; label: string }> = {
  delivery: { Icon: Bike, color: 'text-purple-300', label: 'Livraison' },
  dine_in: { Icon: Utensils, color: 'text-emerald-300', label: 'Sur place' },
  takeaway: { Icon: ShoppingBag, color: 'text-blue-300', label: 'À emporter' },
};

interface ColumnDef {
  id: string;
  label: string;
  /** statuts qui entrent dans cette colonne */
  match: string[];
  /** statut cible si on dépose dans cette colonne */
  dropTarget: string;
  accent: string;
  border: string;
  badge: string;
  Icon: React.ElementType;
  buttonLabel?: string;
  /** statut auquel la carte transitionne via le bouton */
  buttonTarget?: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: 'new',
    label: 'Nouvelles',
    match: ['pending'],
    dropTarget: 'confirmed',
    accent: 'text-amber-300',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/15 text-amber-300',
    Icon: Clock,
    buttonLabel: 'Accepter',
    buttonTarget: 'confirmed',
  },
  {
    id: 'accepted',
    label: 'Acceptées',
    match: ['accepted', 'confirmed'],
    dropTarget: 'preparing',
    accent: 'text-blue-300',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/15 text-blue-300',
    Icon: CheckCircle2,
    buttonLabel: 'Démarrer',
    buttonTarget: 'preparing',
  },
  {
    id: 'cooking',
    label: 'En cuisine',
    match: ['preparing'],
    dropTarget: 'ready',
    accent: 'text-orange-300',
    border: 'border-orange-500/30',
    badge: 'bg-orange-500/15 text-orange-300',
    Icon: Flame,
    buttonLabel: 'Marquer prête',
    buttonTarget: 'ready',
  },
  {
    id: 'ready',
    label: 'Prêtes',
    match: ['ready'],
    dropTarget: 'delivering',
    accent: 'text-emerald-300',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/15 text-emerald-300',
    Icon: Package,
    buttonLabel: 'Envoyer',
    buttonTarget: 'delivering',
  },
  {
    id: 'delivered',
    label: 'Terminées',
    match: ['delivering', 'delivered'],
    dropTarget: 'delivered',
    accent: 'text-zinc-400',
    border: 'border-zinc-700/50',
    badge: 'bg-zinc-700/40 text-zinc-300',
    Icon: CheckCircle2,
    buttonLabel: 'Livrée',
    buttonTarget: 'delivered',
  },
];

function elapsedMin(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

interface OrdersKanbanProps {
  orders: KanbanOrder[];
  onChanged?: () => void;
  /** appelé après transition réussie (statut local) */
  onLocalUpdate?: (orderId: string, newStatus: string) => void;
}

export default function OrdersKanban({ orders, onChanged, onLocalUpdate }: OrdersKanbanProps) {
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, KanbanOrder[]> = {};
    for (const c of COLUMNS) map[c.id] = [];
    for (const o of orders) {
      const col = COLUMNS.find((c) => c.match.includes(o.status));
      if (col) map[col.id].push(o);
    }
    // sort: oldest first within each column (priority)
    for (const id of Object.keys(map)) {
      map[id].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return map;
  }, [orders]);

  const callRpc = useCallback(
    async (orderId: string, newStatus: string) => {
      if (busy[orderId]) return;
      setBusy((b) => ({ ...b, [orderId]: true }));
      onLocalUpdate?.(orderId, newStatus);
      const result = await changeOrderStatus(orderId, newStatus, 'desktop');
      if (!result.ok) {
        if (result.error === 'invalid_transition') {
          toast.error(`Transition impossible: ${result.from} → ${result.to}`);
        } else {
          toast.error('Erreur: ' + (result.error ?? 'unknown'));
        }
        // ask parent to refetch (revert visual)
        onChanged?.();
      } else {
        toast.success('Statut mis à jour');
        onChanged?.();
      }
      setBusy((b) => ({ ...b, [orderId]: false }));
    },
    [busy, onChanged, onLocalUpdate],
  );

  const onDragStart = useCallback((e: React.DragEvent, orderId: string) => {
    setDraggingId(orderId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', orderId);
  }, []);

  const onDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverCol(null);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colId) setDragOverCol(colId);
  }, [dragOverCol]);

  const onDrop = useCallback(
    (e: React.DragEvent, colId: string) => {
      e.preventDefault();
      const orderId = e.dataTransfer.getData('text/plain') || draggingId;
      setDragOverCol(null);
      setDraggingId(null);
      if (!orderId) return;
      const order = orders.find((o) => o.id === orderId);
      const col = COLUMNS.find((c) => c.id === colId);
      if (!order || !col) return;
      // already in this column? noop.
      if (col.match.includes(order.status)) return;
      void callRpc(orderId, col.dropTarget);
    },
    [orders, callRpc, draggingId],
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {COLUMNS.map((col) => {
        const items = grouped[col.id] ?? [];
        const isOver = dragOverCol === col.id;
        return (
          <div
            key={col.id}
            onDragOver={(e) => onDragOver(e, col.id)}
            onDrop={(e) => onDrop(e, col.id)}
            className={`rounded-2xl bg-zinc-900/40 border ${col.border} ${
              isOver ? 'ring-2 ring-orange-500/60 bg-orange-500/5' : ''
            } p-2.5 sm:p-3 flex flex-col min-h-[260px]`}
          >
            {/* Column header */}
            <div className="flex items-center justify-between gap-2 px-1 mb-2.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <col.Icon className={`w-4 h-4 ${col.accent}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${col.accent} truncate`}>
                  {col.label}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${col.badge}`}>
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 flex-1">
              <AnimatePresence>
                {items.map((o) => {
                  const min = elapsedMin(o.created_at);
                  const TypeIcon = TYPE_META[o.type]?.Icon ?? Utensils;
                  const isLate = min > 20 && col.id !== 'delivered';
                  const isDragging = draggingId === o.id;
                  return (
                    <motion.div
                      layout
                      key={o.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      draggable
                      onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, o.id)}
                      onDragEnd={onDragEnd}
                      className={`group relative rounded-xl bg-zinc-900/80 border ${
                        isLate ? 'border-red-500/40' : 'border-zinc-800'
                      } p-2.5 cursor-grab active:cursor-grabbing hover:border-zinc-700 transition-colors`}
                    >
                      {/* Top row */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] min-w-0">
                          <TypeIcon className={`w-3.5 h-3.5 ${TYPE_META[o.type]?.color ?? 'text-zinc-400'}`} />
                          <span className="truncate">{TYPE_META[o.type]?.label ?? o.type}</span>
                        </div>
                        <div className={`flex items-center gap-1 text-[11px] tabular-nums font-bold ${
                          isLate ? 'text-red-400' : 'text-zinc-400'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {min}m
                        </div>
                      </div>

                      {/* Order # + total */}
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-base font-bold text-zinc-100 truncate">#{o.order_number}</span>
                        <span className="text-xs font-bold text-orange-300 tabular-nums shrink-0">
                          {Number(o.total_amount).toLocaleString('fr-FR')} F
                        </span>
                      </div>

                      {/* Customer */}
                      {(o.customer_name || o.customer_phone) && (
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-1.5 truncate">
                          {o.customer_name && <span className="truncate">{o.customer_name}</span>}
                          {o.customer_phone && (
                            <a
                              href={`tel:${o.customer_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-0.5 text-emerald-400 shrink-0 hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              {o.customer_phone}
                            </a>
                          )}
                        </div>
                      )}

                      {/* Items preview (max 3) */}
                      <div className="text-[11px] text-zinc-300 leading-snug mb-2">
                        {o.items.slice(0, 3).map((it) => (
                          <div key={it.id} className="truncate">
                            <span className="text-orange-300 font-bold">{it.quantity}×</span>{' '}
                            {it.item_name}
                          </div>
                        ))}
                        {o.items.length > 3 && (
                          <div className="text-zinc-500 italic">+{o.items.length - 3} autres</div>
                        )}
                      </div>

                      {/* Action button */}
                      {col.buttonLabel && col.buttonTarget && col.id !== 'delivered' && (
                        <button
                          disabled={busy[o.id]}
                          onClick={() => void callRpc(o.id, col.buttonTarget!)}
                          className={`w-full mt-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                            col.id === 'cooking'
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950'
                              : col.id === 'accepted'
                              ? 'bg-orange-500 hover:bg-orange-400 text-orange-950'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                          } disabled:opacity-50`}
                        >
                          {busy[o.id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              {col.buttonLabel} <ArrowRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {items.length === 0 && (
                <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-center text-[11px] text-zinc-600">
                  —
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
