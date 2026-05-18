'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  ShoppingBag, ChefHat, CheckCircle2, Banknote, Ticket, TrendingUp,
  ArrowRight, UtensilsCrossed, Users, ScanLine, Plus, Copy,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  AreaChart, Area, ResponsiveContainer,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ORDERS, MENU_ITEMS, MENU_CATEGORIES, TEAM_MEMBERS,
  ORDERS_SPARKLINE, formatFCFA, STATUS_LABELS, TYPE_LABELS,
  OrderStatus,
} from '@/lib/restafy-data'

type Section = string

// ── Quick KPI strip ───────────────────────────────────────────────────────────
function QuickKpi({
  label, value, sub, icon, color, spark,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ReactNode
  color: string
  spark?: boolean
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold text-foreground leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}18`, color }}>
          {icon}
        </div>
      </div>
      {spark && (
        <div className="mt-3 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ORDERS_SPARKLINE}>
              <defs>
                <linearGradient id={`spark-ov-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="orders" stroke={color} strokeWidth={2} fill={`url(#spark-ov-${color.replace('#', '')})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-300 group-hover:w-full" style={{ backgroundColor: color }} />
    </div>
  )
}

export default function DashboardOverview({ onNavigate }: { onNavigate: (s: Section) => void }) {
  const [orders, setOrders] = useState(ORDERS)

  const pending = orders.filter((o) => o.status === 'en_attente')
  const inKitchen = orders.filter((o) => o.status === 'en_preparation')
  const ready = orders.filter((o) => o.status === 'prete')

  const handleAction = (id: string, next: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: next } : o)))
    const order = orders.find((o) => o.id === id)
    if (order) toast.success(`${order.number} — ${STATUS_LABELS[next]}`)
  }

  const statusBadgeClass: Record<OrderStatus, string> = {
    en_attente: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    en_preparation: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    prete: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    livree: 'bg-muted text-muted-foreground',
  }

  const nextStatus: Record<OrderStatus, OrderStatus | null> = {
    en_attente: 'en_preparation',
    en_preparation: 'prete',
    prete: 'livree',
    livree: null,
  }

  const actionLabel: Record<OrderStatus, string> = {
    en_attente: 'Démarrer',
    en_preparation: 'Prête',
    prete: 'Livrée',
    livree: '',
  }

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <QuickKpi label="En attente" value={pending.length} sub="commandes" icon={<ShoppingBag size={20} />} color="#E86F3F" />
        <QuickKpi label="En cuisine" value={inKitchen.length} sub="en préparation" icon={<ChefHat size={20} />} color="#F3A739" />
        <QuickKpi label="Prêtes" value={ready.length} sub="à servir / livrer" icon={<CheckCircle2 size={20} />} color="#2A6B5E" />
        <QuickKpi label="CA aujourd'hui" value={formatFCFA(0)} sub="chiffre d'affaires" icon={<Banknote size={20} />} color="#E86F3F" spark />
        <QuickKpi label="Billets vendus" value={63} sub="événements actifs" icon={<Ticket size={20} />} color="#F3A739" />
        <QuickKpi label="Rev. événements" value="658 598 F" sub="total cumulé" icon={<TrendingUp size={20} />} color="#2A6B5E" />
      </div>

      {/* Main content: orders + sidebar widgets */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Orders preview */}
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Commandes actives</h2>
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-primary" onClick={() => onNavigate('commandes')}>
              Voir tout <ArrowRight size={13} />
            </Button>
          </div>

          <div className="space-y-3">
            {orders.filter((o) => o.status !== 'livree').slice(0, 5).map((order) => {
              const next = nextStatus[order.status]
              return (
                <div
                  key={order.id}
                  className="order-card flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">{order.number}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', statusBadgeClass[order.status])}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {TYPE_LABELS[order.type]} · {order.customer} · {formatFCFA(order.total)}
                    </p>
                  </div>
                  {next && (
                    <Button
                      size="sm"
                      className={cn(
                        'btn-micro shrink-0 rounded-xl text-xs',
                        order.status === 'en_attente' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-green-600 text-white hover:bg-green-700',
                      )}
                      onClick={() => handleAction(order.id, next)}
                    >
                      {actionLabel[order.status]}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right widgets */}
        <div className="flex flex-col gap-4">
          {/* Menu quick glance */}
          <div className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <UtensilsCrossed size={15} className="text-primary" />
                Menu
              </h3>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-primary p-0 h-auto" onClick={() => onNavigate('menu')}>
                Gérer <ArrowRight size={12} />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-xl font-bold text-foreground">{MENU_ITEMS.length}</p>
                <p className="text-[10px] text-muted-foreground font-medium">Plats</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-xl font-bold text-foreground">{MENU_CATEGORIES.length}</p>
                <p className="text-[10px] text-muted-foreground font-medium">Catégories</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MENU_CATEGORIES.map((cat) => (
                <span key={cat} className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Team quick glance */}
          <div className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users size={15} className="text-accent" />
                Équipe
              </h3>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-primary p-0 h-auto" onClick={() => onNavigate('equipe')}>
                Gérer <ArrowRight size={12} />
              </Button>
            </div>
            <div className="space-y-2">
              {TEAM_MEMBERS.filter((m) => m.active).slice(0, 3).map((m) => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-xs font-bold text-accent">
                    {m.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-tight">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground">{m.role}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ScanLine size={10} />
                    {m.usages}
                  </div>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" className="btn-micro mt-3 w-full gap-1.5 rounded-xl text-xs" onClick={() => onNavigate('equipe')}>
              <Plus size={12} />
              Nouvel accès scan
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
