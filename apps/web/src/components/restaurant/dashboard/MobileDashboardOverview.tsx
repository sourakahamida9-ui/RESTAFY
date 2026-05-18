import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Bell,
  CreditCard,
  FileText,
  LayoutGrid,
  ShoppingBag,
  TrendingUp,
  BarChart3,
  Users,
  Clock3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RecentOrder = {
  id: string;
  order_number?: string;
  customer_name?: string | null;
  created_at: string;
  total_amount?: number | null;
  status?: string | null;
};

export type MobileDashboardStats = {
  salesTodayLabel: string;
  ordersToday: number;
  clientsServed: number;
  pendingCount: number;
  salesTrendLabel?: string;
};

export function MobileDashboardOverview({
  greetingName,
  restaurantName,
  stats,
  revenueSeries,
  recentOrders,
  onOpenNotifications,
}: {
  greetingName: string;
  restaurantName: string;
  stats: MobileDashboardStats;
  revenueSeries: number[];
  recentOrders: RecentOrder[];
  onOpenNotifications?: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="lg:hidden px-3 pt-3 pb-2 space-y-3">
      <MobileHeader
        restaurantName={restaurantName}
        greetingName={greetingName}
        onOpenNotifications={onOpenNotifications}
      />

      <SalesCard
        valueLabel={stats.salesTodayLabel}
        trendLabel={stats.salesTrendLabel}
        series={revenueSeries}
      />

      <div className="grid grid-cols-3 gap-2">
        <StatCard title="Commandes" value={stats.ordersToday} icon={ShoppingBag} />
        <StatCard
          title="Clients servis"
          value={stats.clientsServed}
          icon={Users}
          hint={stats.clientsServed > 0 ? '+12%' : undefined}
        />
        <StatCard
          title="En attente"
          value={stats.pendingCount}
          icon={Clock3}
          actionLabel={stats.pendingCount > 0 ? 'Voir plus' : undefined}
          onAction={() => navigate('/restaurant/dashboard/orders')}
        />
      </div>

      <QuickActions />

      <RecentActivity orders={recentOrders} />
    </div>
  );
}

function MobileHeader({
  greetingName,
  restaurantName,
  onOpenNotifications,
}: {
  greetingName: string;
  restaurantName: string;
  onOpenNotifications?: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-[#F97316] text-white flex items-center justify-center font-black">
            R
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black tracking-tight text-[color:var(--r-text,#111827)] truncate">
              Restafy
            </p>
            <p className="text-[11px] font-semibold text-[color:var(--r-text-muted,#6B7280)] truncate">
              Bonjour, {greetingName}
            </p>
          </div>
        </div>
        <p className="mt-1 text-[11px] font-medium text-[color:var(--r-text-subtle,#9CA3AF)] truncate">
          {restaurantName}
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenNotifications}
        className="w-10 h-10 rounded-2xl border flex items-center justify-center bg-white/70 backdrop-blur"
        style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-[color:var(--r-text,#111827)]" />
      </button>
    </div>
  );
}

function SalesCard({
  valueLabel,
  trendLabel,
  series,
}: {
  valueLabel: string;
  trendLabel?: string;
  series: number[];
}) {
  const points = useMemo(() => toSparklinePoints(series, 120, 44), [series]);

  return (
    <section className="relative overflow-hidden rounded-3xl p-4 text-white">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, #F97316 0%, #FB923C 55%, #F59E0B 100%)',
        }}
      />
      <div className="absolute inset-0 opacity-25">
        <svg viewBox="0 0 120 44" preserveAspectRatio="none" className="w-full h-full">
          <path
            d={points}
            fill="none"
            stroke="rgba(255,255,255,0.95)"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold opacity-90">Ventes du jour</p>
            <p className="text-2xl font-black tracking-tight mt-1">{valueLabel}</p>
            {trendLabel && (
              <p className="text-[11px] font-semibold opacity-90 mt-0.5 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                {trendLabel}
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section
      className="rounded-2xl border bg-white/60 backdrop-blur p-3"
      style={{ borderColor: 'rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold text-[color:var(--r-text-muted,#6B7280)]">
          {title}
        </p>
        <div className="w-8 h-8 rounded-xl bg-[rgba(249,115,22,0.12)] flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#F97316]" />
        </div>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-lg font-black text-[color:var(--r-text,#111827)]">{value}</p>
        {hint && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
            {hint}
          </span>
        )}
      </div>

      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 text-[11px] font-bold text-[#F97316] hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </section>
  );
}

function QuickActions() {
  const navigate = useNavigate();

  const items = [
    { label: 'Commandes', icon: ShoppingBag, to: '/restaurant/dashboard/orders' },
    { label: 'Paiements', icon: CreditCard, to: '/restaurant/dashboard/pos' },
    { label: 'Facturation', icon: FileText, to: '/restaurant/dashboard/payout' },
    { label: 'Analytics', icon: BarChart3, to: '/restaurant/dashboard/analytics' },
  ] as const;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-[color:var(--r-text,#111827)]">Accès rapides</p>
        <button
          type="button"
          onClick={() => navigate('/restaurant/dashboard/settings')}
          className="text-[11px] font-bold text-[color:var(--r-text-muted,#6B7280)]"
        >
          Gérer
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            onClick={() => navigate(it.to)}
            className={cn(
              'rounded-2xl border bg-white/60 backdrop-blur p-2.5 flex flex-col items-center justify-center gap-1.5 active:scale-95 transition',
            )}
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
          >
            <div className="w-10 h-10 rounded-2xl bg-[rgba(249,115,22,0.12)] flex items-center justify-center">
              <it.icon className="w-5 h-5 text-[#F97316]" />
            </div>
            <span className="text-[10px] font-bold text-[color:var(--r-text,#111827)]">
              {it.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function RecentActivity({ orders }: { orders: RecentOrder[] }) {
  const navigate = useNavigate();
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-[color:var(--r-text,#111827)]">Activité récente</p>
        <button
          type="button"
          onClick={() => navigate('/restaurant/dashboard/orders')}
          className="text-[11px] font-bold text-[#F97316]"
        >
          Voir tout
        </button>
      </div>

      <div className="space-y-2">
        {orders.length === 0 ? (
          <div
            className="rounded-2xl border bg-white/60 backdrop-blur p-4 text-center"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
          >
            <div className="w-10 h-10 rounded-2xl bg-[rgba(249,115,22,0.12)] mx-auto flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-[#F97316]" />
            </div>
            <p className="mt-2 text-sm font-bold text-[color:var(--r-text,#111827)]">Aucune activité</p>
            <p className="text-[11px] font-medium text-[color:var(--r-text-muted,#6B7280)]">
              Les nouvelles commandes apparaîtront ici.
            </p>
          </div>
        ) : (
          orders.slice(0, 3).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => navigate('/restaurant/dashboard/orders')}
              className="w-full text-left rounded-2xl border bg-white/60 backdrop-blur p-3 active:scale-[0.99] transition"
              style={{ borderColor: 'rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-[color:var(--r-text,#111827)] truncate">
                    {o.customer_name || 'Client'}{' '}
                    <span className="font-semibold text-[color:var(--r-text-muted,#6B7280)]">
                      #{o.order_number || o.id.slice(0, 6)}
                    </span>
                  </p>
                  <p className="text-[11px] font-semibold text-[color:var(--r-text-muted,#6B7280)]">
                    {new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {o.status ? ` • ${formatStatus(o.status)}` : ''}
                  </p>
                </div>
                <p className="text-sm font-black text-[color:var(--r-text,#111827)]">
                  {o.total_amount ? formatXof(o.total_amount) : '—'}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function toSparklinePoints(values: number[], w: number, h: number): string {
  const safe = values.length ? values : [0, 0, 0, 0, 0, 0, 0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const span = Math.max(1, max - min);

  const pts = safe.map((v, i) => {
    const x = (i / (safe.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 6) - 3;
    return { x, y };
  });

  return pts.reduce((d, p, i) => (i === 0 ? `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}` : `${d} L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`), '');
}

function formatXof(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

function formatStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === 'pending') return 'En attente';
  if (s === 'confirmed' || s === 'accepted') return 'Confirmée';
  if (s === 'preparing') return 'En cuisine';
  if (s === 'ready') return 'Prête';
  if (s === 'delivering') return 'En route';
  if (s === 'delivered') return 'Livrée';
  if (s === 'cancelled') return 'Annulée';
  return status;
}

