'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote,
  Smartphone, Check, X, Receipt, Search, ChevronDown,
  Printer, RotateCcw, Tag, Percent, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MENU_ITEMS, MenuItem } from '@/lib/restafy-data'

/* ─── Types ─────────────────────────────────────────────── */
interface CartItem {
  item: MenuItem
  qty: number
  note?: string
}

type PaymentMethod = 'especes' | 'wave' | 'orange' | 'carte'

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'especes',  label: 'Espèces',      icon: <Banknote size={16} />,    color: '#2A6B5E' },
  { id: 'wave',     label: 'Wave',         icon: <Smartphone size={16} />,  color: '#1A6FFF' },
  { id: 'orange',   label: 'Orange Money', icon: <Smartphone size={16} />,  color: '#FF6600' },
  { id: 'carte',    label: 'Carte',        icon: <CreditCard size={16} />,  color: '#5B6E6A' },
]

const TABLE_OPTIONS = ['Sur place – Table 1','Sur place – Table 2','Sur place – Table 3','À emporter','Livraison']

interface CompletedSale {
  id: string
  items: CartItem[]
  total: number
  discount: number
  method: PaymentMethod
  table: string
  time: string
  cashGiven?: number
}

/* ─── Recent Sales Ticker ───────────────────────────────── */
const RECENT_SALES: CompletedSale[] = [
  { id: 'S001', items: [], total: 8000,  discount: 0, method: 'especes', table: 'Table 1', time: '09:12', cashGiven: 10000 },
  { id: 'S002', items: [], total: 5700,  discount: 0, method: 'wave',    table: 'À emporter', time: '09:28' },
  { id: 'S003', items: [], total: 14100, discount: 500, method: 'especes', table: 'Table 3', time: '09:44', cashGiven: 15000 },
]

/* ─── Cart Item Row ─────────────────────────────────────── */
function CartRow({
  entry, onInc, onDec, onRemove,
}: {
  entry: CartItem
  onInc: () => void
  onDec: () => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5 transition-all hover:bg-muted/40">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground line-clamp-1">{entry.item.name}</p>
        <p className="text-xs text-muted-foreground">{entry.item.price.toLocaleString('fr-FR')} FCFA × {entry.qty}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onDec} className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-border transition-colors">
          <Minus size={11} />
        </button>
        <span className="w-5 text-center text-sm font-bold tabular-nums text-foreground">{entry.qty}</span>
        <button onClick={onInc} className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          <Plus size={11} />
        </button>
      </div>
      <p className="w-20 text-right text-sm font-bold text-foreground shrink-0">
        {(entry.item.price * entry.qty).toLocaleString('fr-FR')} F
      </p>
      <button onClick={onRemove} className="ml-1 shrink-0 rounded-md p-1 text-muted-foreground hover:text-red-500 transition-colors">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

/* ─── Receipt Modal ─────────────────────────────────────── */
function ReceiptModal({ sale, onClose }: { sale: CompletedSale; onClose: () => void }) {
  const change = sale.cashGiven ? sale.cashGiven - (sale.total - sale.discount) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-6 py-5 text-center text-white">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
            <Check size={22} />
          </div>
          <p className="text-lg font-black">Paiement validé</p>
          <p className="text-sm text-white/80">{sale.time} — #{sale.id}</p>
        </div>

        {/* Ticket body */}
        <div className="p-5 font-mono text-sm">
          <div className="mb-3 border-b border-dashed border-border pb-3 text-center">
            <p className="text-base font-black text-foreground">RESTAFY</p>
            <p className="text-[11px] text-muted-foreground">Dakar, Plateau — Tel: +221 77 000 0000</p>
          </div>

          <div className="space-y-1 text-xs">
            {sale.items.map((e, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-muted-foreground">{e.qty}x {e.item.name}</span>
                <span className="text-foreground">{(e.item.price * e.qty).toLocaleString('fr-FR')} F</span>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-1.5 border-t border-dashed border-border pt-3 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Sous-total</span>
              <span>{sale.total.toLocaleString('fr-FR')} F</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Remise</span>
                <span>-{sale.discount.toLocaleString('fr-FR')} F</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-foreground">
              <span>TOTAL</span>
              <span>{(sale.total - sale.discount).toLocaleString('fr-FR')} F</span>
            </div>
          </div>

          {sale.cashGiven && (
            <div className="mt-3 space-y-1 border-t border-dashed border-border pt-3 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Espèces reçues</span>
                <span>{sale.cashGiven.toLocaleString('fr-FR')} F</span>
              </div>
              <div className="flex justify-between font-bold text-foreground">
                <span>Monnaie rendue</span>
                <span>{change.toLocaleString('fr-FR')} F</span>
              </div>
            </div>
          )}

          <div className="mt-3 border-t border-dashed border-border pt-3 text-center text-[10px] text-muted-foreground">
            <p>Paiement : {PAYMENT_METHODS.find((m) => m.id === sale.method)?.label}</p>
            <p>{sale.table}</p>
            <p className="mt-2">Merci de votre visite !</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-border p-4">
          <Button variant="outline" className="flex-1 gap-1.5 text-xs" size="sm" onClick={() => toast.success('Impression envoyée')}>
            <Printer size={13} /> Imprimer
          </Button>
          <Button className="flex-1 gap-1.5 text-xs" size="sm" style={{ background: '#E86F3F' }} onClick={onClose}>
            <RotateCcw size={13} /> Nouvelle vente
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Main POS ───────────────────────────────────────────── */
export default function CaisseSection() {
  const [cart, setCart]               = useState<CartItem[]>([])
  const [search, setSearch]           = useState('')
  const [activeCategory, setCategory] = useState('Tous')
  const [selectedMethod, setMethod]   = useState<PaymentMethod>('especes')
  const [selectedTable, setTable]     = useState(TABLE_OPTIONS[0])
  const [showTableMenu, setTableMenu] = useState(false)
  const [discountPct, setDiscountPct] = useState(0)
  const [cashGiven, setCashGiven]     = useState('')
  const [completedSale, setCompleted] = useState<CompletedSale | null>(null)
  const [recentSales, setRecentSales] = useState<CompletedSale[]>(RECENT_SALES)

  const categories = ['Tous', ...Array.from(new Set(MENU_ITEMS.map((m) => m.category)))]

  const filtered = MENU_ITEMS.filter((m) => {
    const matchCat = activeCategory === 'Tous' || m.category === activeCategory
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch && m.available
  })

  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((e) => e.item.id === item.id)
      if (existing) return prev.map((e) => e.item.id === item.id ? { ...e, qty: e.qty + 1 } : e)
      return [...prev, { item, qty: 1 }]
    })
  }, [])

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => {
      const next = prev.map((e) => e.item.id === id ? { ...e, qty: e.qty + delta } : e)
      return next.filter((e) => e.qty > 0)
    })
  }

  const removeItem = (id: string) => setCart((prev) => prev.filter((e) => e.item.id !== id))

  const subtotal      = cart.reduce((s, e) => s + e.item.price * e.qty, 0)
  const discountAmt   = Math.round(subtotal * discountPct / 100)
  const total         = subtotal - discountAmt
  const change        = cashGiven ? Math.max(0, Number(cashGiven) - total) : 0
  const cartCount     = cart.reduce((s, e) => s + e.qty, 0)

  const handlePay = () => {
    if (cart.length === 0) { toast.error('Le panier est vide'); return }
    if (selectedMethod === 'especes' && cashGiven && Number(cashGiven) < total) {
      toast.error(`Montant insuffisant — manque ${(total - Number(cashGiven)).toLocaleString('fr-FR')} FCFA`)
      return
    }
    const sale: CompletedSale = {
      id: `S${String(recentSales.length + 4).padStart(3, '0')}`,
      items: cart,
      total: subtotal,
      discount: discountAmt,
      method: selectedMethod,
      table: selectedTable,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      cashGiven: cashGiven ? Number(cashGiven) : undefined,
    }
    setCompleted(sale)
    setRecentSales((prev) => [sale, ...prev])
  }

  const resetSale = () => {
    setCart([])
    setCompleted(null)
    setCashGiven('')
    setDiscountPct(0)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Caisse — POS</h2>
          <p className="mt-1 text-sm text-muted-foreground">Point de vente — encaissement rapide</p>
        </div>
        {/* Table selector */}
        <div className="relative">
          <button
            onClick={() => setTableMenu((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-muted transition-colors"
          >
            <Users size={14} className="text-muted-foreground" />
            {selectedTable}
            <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', showTableMenu && 'rotate-180')} />
          </button>
          {showTableMenu && (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border bg-card shadow-lg">
              {TABLE_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => { setTable(t); setTableMenu(false) }}
                  className={cn('flex w-full items-center px-3 py-2 text-sm transition-colors hover:bg-muted', selectedTable === t ? 'font-bold text-primary' : 'text-foreground')}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        {/* ── Left: Menu grid ── */}
        <div className="flex flex-col gap-3 xl:col-span-3">
          {/* Search + category */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un plat..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                  activeCategory === cat
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-border hover:text-foreground',
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Menu grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((item) => {
              const inCart = cart.find((e) => e.item.id === item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={cn(
                    'relative flex flex-col items-start gap-1.5 overflow-hidden rounded-2xl border p-3 text-left transition-all hover:shadow-md active:scale-95',
                    inCart ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
                  )}
                >
                  {inCart && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                      {inCart.qty}
                    </span>
                  )}
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-white text-xs font-black',
                    item.category === 'Plats principaux' ? 'bg-primary' :
                    item.category === 'Entrées' ? 'bg-accent' :
                    item.category === 'Desserts' ? 'bg-secondary' : 'bg-muted-foreground',
                  )}>
                    {item.name.charAt(0)}
                  </div>
                  <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{item.name}</p>
                  <p className="text-xs font-bold text-primary">{item.price.toLocaleString('fr-FR')} F</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right: Cart + payment ── */}
        <div className="flex flex-col gap-3 xl:col-span-2">
          {/* Cart */}
          <div className="flex-1 rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <ShoppingCart size={15} className="text-muted-foreground" />
                <span className="text-sm font-bold text-foreground">Panier</span>
                {cartCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </div>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs text-muted-foreground hover:text-red-500 transition-colors">
                  Vider
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <ShoppingCart size={28} className="opacity-20" />
                <p className="text-xs">Ajoutez des articles depuis le menu</p>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto p-2 space-y-1.5">
                {cart.map((e) => (
                  <CartRow
                    key={e.item.id}
                    entry={e}
                    onInc={() => updateQty(e.item.id, 1)}
                    onDec={() => updateQty(e.item.id, -1)}
                    onRemove={() => removeItem(e.item.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Discount */}
          <div className="rounded-2xl border bg-card px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Percent size={13} className="text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Remise</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 5, 10, 15, 20].map((p) => (
                <button
                  key={p}
                  onClick={() => setDiscountPct(p)}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-xs font-bold transition-all',
                    discountPct === p ? 'bg-accent text-white' : 'bg-muted text-muted-foreground hover:bg-border',
                  )}
                >
                  {p === 0 ? 'Aucune' : `${p}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-2xl border bg-card px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Sous-total</span>
              <span className="font-semibold text-foreground">{subtotal.toLocaleString('fr-FR')} FCFA</span>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1"><Tag size={11} /> Remise {discountPct}%</span>
                <span>-{discountAmt.toLocaleString('fr-FR')} FCFA</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-black text-foreground">
              <span>TOTAL</span>
              <span>{total.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="rounded-2xl border bg-card px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mode de paiement</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all',
                    selectedMethod === m.id
                      ? 'border-transparent text-white shadow-sm'
                      : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted',
                  )}
                  style={selectedMethod === m.id ? { background: m.color } : {}}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cash input (especes only) */}
          {selectedMethod === 'especes' && (
            <div className="rounded-2xl border bg-card px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Montant reçu</p>
              <Input
                type="number"
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                placeholder={`Min. ${total.toLocaleString('fr-FR')} FCFA`}
                className="font-mono text-sm"
              />
              {cashGiven && Number(cashGiven) >= total && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-green-50 dark:bg-green-900/20 px-3 py-2">
                  <span className="text-xs text-green-700 dark:text-green-400">Monnaie à rendre</span>
                  <span className="text-sm font-black text-green-700 dark:text-green-400">{change.toLocaleString('fr-FR')} FCFA</span>
                </div>
              )}
            </div>
          )}

          {/* Pay button */}
          <Button
            className="h-14 w-full gap-2 text-base font-black tracking-wide shadow-md transition-all active:scale-98"
            style={{ background: cart.length > 0 ? '#E86F3F' : undefined }}
            disabled={cart.length === 0}
            onClick={handlePay}
          >
            <Check size={18} />
            Encaisser — {total.toLocaleString('fr-FR')} FCFA
          </Button>
        </div>
      </div>

      {/* Recent sales */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Receipt size={14} className="text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">Ventes récentes</p>
        </div>
        <div className="divide-y divide-border">
          {recentSales.slice(0, 5).map((s) => {
            const m = PAYMENT_METHODS.find((p) => p.id === s.method)
            return (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <Check size={13} className="text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">#{s.id} — {s.table}</p>
                  <p className="text-xs text-muted-foreground">{s.time} · {m?.label}</p>
                </div>
                {s.discount > 0 && (
                  <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400">
                    -{s.discount.toLocaleString('fr-FR')} F
                  </span>
                )}
                <p className="text-sm font-bold text-foreground shrink-0">
                  {(s.total - s.discount).toLocaleString('fr-FR')} F
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Receipt modal */}
      {completedSale && <ReceiptModal sale={completedSale} onClose={resetSale} />}
    </div>
  )
}
