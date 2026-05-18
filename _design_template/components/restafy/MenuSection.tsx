'use client'

import { useState } from 'react'
import { Search, Plus, UtensilsCrossed, ChevronRight, Circle, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MENU_ITEMS, MENU_CATEGORIES, formatFCFA } from '@/lib/restafy-data'

const CATEGORY_COLORS: Record<string, string> = {
  'Plats principaux': '#E86F3F',
  'Entrées': '#2A6B5E',
  'Desserts': '#F3A739',
  'Boissons': '#5B6E6A',
}

export default function MenuSection() {
  const [activeCategory, setActiveCategory] = useState<string>('Tous')
  const [search, setSearch] = useState('')

  const categories = ['Tous', ...MENU_CATEGORIES]

  const filtered = MENU_ITEMS.filter((item) => {
    const matchCat = activeCategory === 'Tous' || item.category === activeCategory
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const avgPrice = Math.round(
    MENU_ITEMS.reduce((s, i) => s + i.price, 0) / MENU_ITEMS.length,
  )

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total plats</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{MENU_ITEMS.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Catégories</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{MENU_CATEGORIES.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prix moyen</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{avgPrice.toLocaleString('fr-FR')} F</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Disponibles</p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {MENU_ITEMS.filter((i) => i.available).length}
          </p>
        </div>
      </div>

      {/* Categories carrousel + search + add */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'btn-micro shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all',
                activeCategory === cat
                  ? 'bg-primary text-white border-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {cat}
              <span className="ml-1.5 opacity-60">
                ({cat === 'Tous' ? MENU_ITEMS.length : MENU_ITEMS.filter((i) => i.category === cat).length})
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un plat..."
              className="pl-8 rounded-xl text-sm w-52"
            />
          </div>
          <Button size="sm" className="btn-micro gap-1.5 rounded-xl">
            <Plus size={14} />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Menu grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={cn(
              'group order-card flex items-center justify-between rounded-2xl border bg-card p-4',
              !item.available && 'opacity-50',
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: `${CATEGORY_COLORS[item.category] ?? '#5B6E6A'}18`,
                  color: CATEGORY_COLORS[item.category] ?? '#5B6E6A',
                }}
              >
                <UtensilsCrossed size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.category}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <p className="text-sm font-bold text-foreground">{formatFCFA(item.price)}</p>
              {item.available ? (
                <CheckCircle2 size={14} className="text-green-500" />
              ) : (
                <Circle size={14} className="text-muted-foreground" />
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <UtensilsCrossed size={32} strokeWidth={1.5} />
          <p className="text-sm">Aucun plat trouvé</p>
        </div>
      )}
    </div>
  )
}
