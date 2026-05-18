'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Clock, ChefHat, CheckCircle2, Bike, ShoppingBag, Utensils,
  Play, CheckCheck, Eye, AlertCircle, StickyNote,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Order, OrderStatus, OrderType,
  STATUS_LABELS, TYPE_LABELS, formatFCFA,
  ORDERS,
} from '@/lib/restafy-data'

// ── Badge helpers ─────────────────────────────────────────────────────────────
function statusClass(status: OrderStatus) {
  switch (status) {
    case 'en_attente': return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300'
    case 'en_preparation': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
    case 'prete': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300'
    case 'livree': return 'bg-muted text-muted-foreground'
  }
}

function StatusIcon({ status }: { status: OrderStatus }) {
  switch (status) {
    case 'en_attente': return <Clock size={13} />
    case 'en_preparation': return <ChefHat size={13} />
    case 'prete': return <CheckCircle2 size={13} />
    case 'livree': return <CheckCheck size={13} />
  }
}

function TypeIcon({ type }: { type: OrderType }) {
  switch (type) {
    case 'a_emporter': return <ShoppingBag size={13} />
    case 'livraison': return <Bike size={13} />
    case 'sur_place': return <Utensils size={13} />
  }
}

// ── Single Order Card ─────────────────────────────────────────────────────────
function OrderCard({
  order,
  onAction,
  isSelected,
  onSelect,
}: {
  order: Order
  onAction: (id: string, next: OrderStatus) => void
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const nextStatus: Record<OrderStatus, OrderStatus | null> = {
    en_attente: 'en_preparation',
    en_preparation: 'prete',
    prete: 'livree',
    livree: null,
  }

  const actionLabels: Record<OrderStatus, string> = {
    en_attente: 'Démarrer la préparation',
    en_preparation: 'Marquer prête',
    prete: 'Marquer livrée',
    livree: '',
  }

  const next = nextStatus[order.status]

  return (
    <div
      className={cn(
        'order-card cursor-pointer rounded-2xl border bg-card p-4 transition-all',
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
      )}
      onClick={() => onSelect(order.id)}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground">{order.number}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <TypeIcon type={order.type} />
              {TYPE_LABELS[order.type]}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{order.customer}</span>
          </div>
        </div>
        <span className={cn(
          'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
          statusClass(order.status),
        )}>
          <StatusIcon status={order.status} />
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* Items */}
      <div className="mt-3 space-y-1 border-t border-border pt-3">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-foreground">
              <span className="font-semibold text-primary">{item.qty}×</span> {item.name}
            </span>
            <span className="text-muted-foreground">{formatFCFA(item.price * item.qty)}</span>
          </div>
        ))}
      </div>

      {/* Note */}
      {order.note && (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5">
          <StickyNote size={11} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-xs text-amber-700 dark:text-amber-300">{order.note}</span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-base font-bold text-foreground">{formatFCFA(order.total)}</span>
        {next && (
          <Button
            size="sm"
            className={cn(
              'btn-micro gap-1.5 rounded-xl text-xs font-semibold',
              order.status === 'en_attente'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : order.status === 'en_preparation'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-muted text-foreground hover:bg-muted/80',
            )}
            onClick={(e) => {
              e.stopPropagation()
              onAction(order.id, next)
            }}
          >
            <Play size={11} />
            {actionLabels[order.status]}
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Detail Panel ─────────────────────────────────────────────────────────────
function OrderDetail({ order }: { order: Order | null }) {
  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground rounded-2xl border border-dashed border-border">
        <Eye size={32} strokeWidth={1.5} />
        <p className="text-sm font-medium">Sélectionner une commande</p>
        <p className="text-xs text-center px-6">Cliquez sur une commande pour voir ses détails ici</p>
      </div>
    )
  }

  const timeAgo = (() => {
    const diff = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)
    if (diff < 60) return `Il y a ${diff} min`
    return `Il y a ${Math.floor(diff / 60)}h${diff % 60 > 0 ? ` ${diff % 60}min` : ''}`
  })()

  return (
    <div className="rounded-2xl border border-border bg-card p-6 h-full" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-lg font-bold text-foreground">{order.number}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{timeAgo}</p>
        </div>
        <span className={cn(
          'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
          statusClass(order.status),
        )}>
          <StatusIcon status={order.status} />
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Client</p>
          <p className="text-sm font-medium text-foreground">{order.customer}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <TypeIcon type={order.type} />
            {TYPE_LABELS[order.type]}
          </div>
        </div>

        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Articles</p>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span><span className="font-bold text-primary">{item.qty}×</span> {item.name}</span>
                <span className="font-semibold">{formatFCFA(item.price * item.qty)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-border pt-3 flex justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Total</span>
            <span className="text-base font-bold text-foreground">{formatFCFA(order.total)}</span>
          </div>
        </div>

        {order.note && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
              <AlertCircle size={12} /> Note
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300">{order.note}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Column header ─────────────────────────────────────────────────────────────
function ColumnHeader({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="text-sm font-bold text-foreground">{label}</h3>
      </div>
      <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: color }}>
        {count}
      </span>
    </div>
  )
}

// ── Main Section ──────────────────────────────────────────────────────────────
export default function OrdersSection() {
  const [orders, setOrders] = useState<Order[]>(ORDERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const pending = orders.filter((o) => o.status === 'en_attente')
  const inKitchen = orders.filter((o) => o.status === 'en_preparation')
  const ready = orders.filter((o) => o.status === 'prete')
  const selected = orders.find((o) => o.id === selectedId) ?? null

  const handleAction = (id: string, next: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: next } : o)),
    )
    const order = orders.find((o) => o.id === id)
    if (order) {
      const msg =
        next === 'en_preparation'
          ? `Commande ${order.number} en préparation`
          : next === 'prete'
          ? `Commande ${order.number} marquée prête`
          : `Commande ${order.number} livrée`
      toast.success(msg, { duration: 3000 })
    }
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Kanban-style columns */}
      <div className="flex-1 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* En attente */}
        <div className="flex flex-col">
          <ColumnHeader label="En attente" count={pending.length} color="#E86F3F" />
          <div className="flex flex-col gap-3 overflow-y-auto pr-1 max-h-[600px]">
            {pending.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Aucune commande en attente
              </p>
            ) : (
              pending.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onAction={handleAction}
                  isSelected={selectedId === o.id}
                  onSelect={setSelectedId}
                />
              ))
            )}
          </div>
        </div>

        {/* En préparation */}
        <div className="flex flex-col">
          <ColumnHeader label="En préparation" count={inKitchen.length} color="#3B82F6" />
          <div className="flex flex-col gap-3 overflow-y-auto pr-1 max-h-[600px]">
            {inKitchen.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Aucune commande en cuisine
              </p>
            ) : (
              inKitchen.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onAction={handleAction}
                  isSelected={selectedId === o.id}
                  onSelect={setSelectedId}
                />
              ))
            )}
          </div>
        </div>

        {/* Prêtes */}
        <div className="flex flex-col">
          <ColumnHeader label="Prêtes" count={ready.length} color="#2A6B5E" />
          <div className="flex flex-col gap-3 overflow-y-auto pr-1 max-h-[600px]">
            {ready.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Aucune commande prête
              </p>
            ) : (
              ready.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onAction={handleAction}
                  isSelected={selectedId === o.id}
                  onSelect={setSelectedId}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Detail panel — desktop only */}
      <div className="hidden xl:flex w-80 shrink-0">
        <OrderDetail order={selected} />
      </div>
    </div>
  )
}
