'use client'

import {
  ShoppingBag, ChefHat, CheckCircle2, Banknote, Ticket, TrendingUp,
} from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts'
import { formatFCFA, ORDERS_SPARKLINE, PAYMENT_SPLIT } from '@/lib/restafy-data'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  sub: string
  icon: React.ReactNode
  accent: string
  sparkData?: { day: string; orders: number }[]
  trend?: string
  trendUp?: boolean
}

function KpiCard({ title, value, sub, icon, accent, sparkData, trend, trendUp }: KpiCardProps) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="mt-1.5 text-3xl font-bold text-foreground leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          {icon}
        </div>
      </div>

      {trend && (
        <div className={cn(
          'mt-3 flex items-center gap-1 text-xs font-medium',
          trendUp ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
        )}>
          <TrendingUp size={12} />
          <span>{trend}</span>
        </div>
      )}

      {sparkData && (
        <div className="mt-3 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={`spark-${accent.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accent} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="orders"
                stroke={accent}
                strokeWidth={2}
                fill={`url(#spark-${accent.replace('#', '')})`}
                dot={false}
              />
              <Tooltip
                contentStyle={{ display: 'none' }}
                cursor={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Accent line */}
      <div
        className="absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-300 group-hover:w-full"
        style={{ backgroundColor: accent }}
      />
    </div>
  )
}

interface KpiCardsProps {
  pendingCount: number
  inKitchenCount: number
  readyCount: number
  caToday: number
  ticketsSold: number
  revenusEvenements: number
}

export default function KpiCards({
  pendingCount,
  inKitchenCount,
  readyCount,
  caToday,
  ticketsSold,
  revenusEvenements,
}: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        title="En attente"
        value={pendingCount}
        sub="commandes"
        icon={<ShoppingBag size={20} />}
        accent="#E86F3F"
        trend="+3 depuis hier"
        trendUp={true}
      />
      <KpiCard
        title="En cuisine"
        value={inKitchenCount}
        sub="en préparation"
        icon={<ChefHat size={20} />}
        accent="#F3A739"
        trend="Moy. 18 min"
      />
      <KpiCard
        title="Prêtes"
        value={readyCount}
        sub="à servir / livrer"
        icon={<CheckCircle2 size={20} />}
        accent="#2A6B5E"
        trend="Livraison en attente"
      />
      <KpiCard
        title="CA aujourd'hui"
        value={formatFCFA(caToday)}
        sub="chiffre d'affaires"
        icon={<Banknote size={20} />}
        accent="#E86F3F"
        sparkData={ORDERS_SPARKLINE}
        trend="+12% vs hier"
        trendUp={true}
      />
      <KpiCard
        title="Billets vendus"
        value={ticketsSold}
        sub="événements à venir"
        icon={<Ticket size={20} />}
        accent="#F3A739"
        trend="2 événements actifs"
        trendUp={true}
      />
      <div
        className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md col-span-2 lg:col-span-1"
        style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Revenus événements
        </p>
        <p className="mt-1.5 text-xl font-bold text-foreground leading-none">
          {formatFCFA(revenusEvenements)}
        </p>
        <div className="mt-3 h-20 flex items-center justify-center">
          <ResponsiveContainer width={80} height={80}>
            <PieChart>
              <Pie
                data={PAYMENT_SPLIT}
                cx="50%"
                cy="50%"
                innerRadius={22}
                outerRadius={36}
                paddingAngle={3}
                dataKey="value"
              >
                {PAYMENT_SPLIT.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="ml-3 flex flex-col gap-1.5">
            {PAYMENT_SPLIT.map((p) => (
              <div key={p.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-[10px] text-muted-foreground">{p.name}</span>
                <span className="text-[10px] font-semibold text-foreground ml-auto">{p.value}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-300 group-hover:w-full bg-primary" />
      </div>
    </div>
  )
}
