// src/pages/superadmin/OrderEvents.tsx
// V3.3 — Audit log des transitions de commandes (super-admin uniquement).
// Source : table public.order_events (cf. scripts/077-order-events-minimal.sql + 102 V1).
// La RLS limite déjà l'accès aux super-admins (policy `superadmin_read_all_order_events`).

import React, { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, Search, Smartphone, Monitor, ChefHat, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

interface OrderEvent {
  id: string;
  order_id: string;
  event_type?: string | null;
  from_status?: string | null;
  to_status: string;
  staff_id?: string | null;
  device_type?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

const PAGE_SIZE = 50;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  accepted: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  confirmed: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  preparing: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  ready: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  delivering: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  delivered: 'bg-zinc-700/40 text-zinc-300 border-zinc-700/60',
  cancelled: 'bg-red-500/15 text-red-300 border-red-500/30',
  payment_failed: 'bg-red-500/15 text-red-300 border-red-500/30',
};

function StatusPill({ s }: { s: string | null | undefined }) {
  if (!s) return <span className="text-zinc-600">—</span>;
  const cls = STATUS_COLORS[s] ?? 'bg-zinc-700/40 text-zinc-300 border-zinc-700/60';
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>
      {s}
    </span>
  );
}

function DeviceBadge({ d }: { d: string | null | undefined }) {
  if (!d) return <span className="text-zinc-600 text-xs">—</span>;
  const Icon = d === 'mobile' ? Smartphone : d === 'kitchen' ? ChefHat : Monitor;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
      <Icon className="w-3 h-3" />
      {d}
    </span>
  );
}

export default function OrderEvents() {
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDevice, setFilterDevice] = useState<string>('all');
  const [page, setPage] = useState(1);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('order_events')
        .select('id, order_id, event_type, from_status, to_status, staff_id, device_type, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (err) throw err;
      setEvents((data || []) as OrderEvent[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEvents();
  }, []);

  const filtered = useMemo(() => {
    let list = events;
    if (filterStatus !== 'all') list = list.filter((e) => e.to_status === filterStatus);
    if (filterDevice !== 'all') list = list.filter((e) => (e.device_type ?? 'unknown') === filterDevice);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        (e.order_id || '').toLowerCase().includes(q) ||
        (e.staff_id || '').toLowerCase().includes(q) ||
        (e.event_type || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [events, filterStatus, filterDevice, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [filterStatus, filterDevice, search]);

  const stats = useMemo(() => {
    const distinct = new Set<string>();
    let cancelled = 0;
    let mobile = 0;
    let desktop = 0;
    for (const e of events) {
      distinct.add(e.order_id);
      if (e.to_status === 'cancelled') cancelled += 1;
      if (e.device_type === 'mobile') mobile += 1;
      else if (e.device_type === 'desktop') desktop += 1;
    }
    return { total: events.length, distinct: distinct.size, cancelled, mobile, desktop };
  }, [events]);

  if (loading) return <RestafyLoader message="Chargement de l'audit log…" />;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-zinc-100 tracking-tight">Audit log commandes</h1>
          <p className="text-zinc-500 text-sm">Transitions de statut tracées via le trigger Postgres.</p>
        </div>
        <button
          onClick={() => void fetchEvents()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Rafraîchir
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
          <strong>Erreur :</strong> {error}
          <p className="text-xs text-red-400/70 mt-1">
            Si la table <code>order_events</code> n'existe pas, exécutez{' '}
            <code className="bg-red-500/15 px-1 rounded">scripts/077-order-events-minimal.sql</code>{' '}
            puis <code className="bg-red-500/15 px-1 rounded">scripts/102-oms-state-machine.sql</code>.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Événements', value: stats.total, color: 'text-zinc-100' },
          { label: 'Commandes uniques', value: stats.distinct, color: 'text-orange-400' },
          { label: 'Annulations', value: stats.cancelled, color: stats.cancelled > 0 ? 'text-red-400' : 'text-zinc-100' },
          { label: 'Mobile', value: stats.mobile, color: 'text-blue-400' },
          { label: 'Desktop', value: stats.desktop, color: 'text-purple-400' },
        ].map((s) => (
          <div key={s.label} className="r-admin-card p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{s.label}</div>
            <div className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher order_id, staff_id, event_type…"
            className="w-full bg-zinc-900/70 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/40"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-zinc-900/70 border border-zinc-800 rounded-xl px-2 py-1.5 text-sm text-zinc-200"
        >
          <option value="all">Tous statuts</option>
          {['pending', 'accepted', 'confirmed', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled', 'payment_failed'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filterDevice}
          onChange={(e) => setFilterDevice(e.target.value)}
          className="bg-zinc-900/70 border border-zinc-800 rounded-xl px-2 py-1.5 text-sm text-zinc-200"
        >
          <option value="all">Tous devices</option>
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
          <option value="kitchen">Kitchen</option>
          <option value="unknown">Inconnu</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-zinc-900/70 text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Quand</th>
                <th className="text-left px-3 py-2 font-semibold">Order ID</th>
                <th className="text-left px-3 py-2 font-semibold">Transition</th>
                <th className="text-left px-3 py-2 font-semibold">Type</th>
                <th className="text-left px-3 py-2 font-semibold">Staff</th>
                <th className="text-left px-3 py-2 font-semibold">Device</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-500 text-sm">
                    <Activity className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
                    Aucun événement {events.length > 0 ? 'pour ces filtres' : ''}.
                  </td>
                </tr>
              )}
              {paginated.map((e) => (
                <tr key={e.id} className="border-t border-zinc-800/60 hover:bg-zinc-900/40">
                  <td className="px-3 py-2 text-xs text-zinc-300 tabular-nums whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-zinc-400">
                    {e.order_id.slice(0, 8)}…
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <StatusPill s={e.from_status} />
                      <span className="text-zinc-600">→</span>
                      <StatusPill s={e.to_status} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-400">
                    {e.event_type || '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-zinc-400">
                    {e.staff_id ? e.staff_id.slice(0, 8) + '…' : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <DeviceBadge d={e.device_type} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-zinc-800/60 text-xs text-zinc-500">
            <span>{filtered.length} événements · page {page} / {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
              >
                Préc.
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40"
              >
                Suiv.
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
