'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts'
import { ORDERS_SPARKLINE, PAYMENT_SPLIT, formatFCFA } from '@/lib/restafy-data'

const WEEKLY_REVENUE = [
  { day: 'Lun', revenue: 45000 },
  { day: 'Mar', revenue: 78000 },
  { day: 'Mer', revenue: 52000 },
  { day: 'Jeu', revenue: 91000 },
  { day: 'Ven', revenue: 120000 },
  { day: 'Sam', revenue: 148000 },
  { day: 'Dim', revenue: 88000 },
]

const TOP_DISHES = [
  { name: 'Thiéboudienne', orders: 42 },
  { name: 'Yassa poulet', orders: 35 },
  { name: 'Mafé bœuf', orders: 28 },
  { name: 'Poulet braisé', orders: 22 },
  { name: 'Kedjenou', orders: 19 },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
        <p className="font-semibold text-foreground mb-0.5">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name === 'revenue' ? formatFCFA(p.value) : `${p.value} commandes`}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function StatsSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Commandes 7 jours */}
        <div className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          <h3 className="text-sm font-bold text-foreground mb-4">Commandes — 7 derniers jours</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ORDERS_SPARKLINE} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E86F3F" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#E86F3F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="orders" name="orders" stroke="#E86F3F" strokeWidth={2.5} fill="url(#colorOrders)" dot={{ r: 4, fill: '#E86F3F', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenus 7 jours */}
        <div className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          <h3 className="text-sm font-bold text-foreground mb-4">Revenus — 7 derniers jours</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={WEEKLY_REVENUE} margin={{ top: 4, right: 4, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2A6B5E" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2A6B5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" name="revenue" stroke="#2A6B5E" strokeWidth={2.5} fill="url(#colorRevenue)" dot={{ r: 4, fill: '#2A6B5E', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment split */}
        <div className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          <h3 className="text-sm font-bold text-foreground mb-4">Modes de paiement</h3>
          <div className="flex items-center gap-6">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={PAYMENT_SPLIT}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {PAYMENT_SPLIT.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => [`${val}%`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-3 flex-1">
              {PAYMENT_SPLIT.map((p) => (
                <div key={p.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-foreground font-medium">{p.name}</span>
                    </div>
                    <span className="font-bold text-foreground">{p.value}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${p.value}%`, backgroundColor: p.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top plats */}
        <div className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          <h3 className="text-sm font-bold text-foreground mb-4">Plats les plus commandés</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TOP_DISHES} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={90} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="orders" name="orders" fill="#F3A739" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
