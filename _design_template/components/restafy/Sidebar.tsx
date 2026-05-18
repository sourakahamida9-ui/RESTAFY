'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Camera, CalendarDays,
  Users, ScanLine, BarChart2, Tag, Link2, Code2, LogOut, Settings,
  Moon, Sun, X, Menu, ChevronRight, Store, Landmark,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type Section =
  | 'dashboard'
  | 'commandes'
  | 'caisse'
  | 'menu'
  | 'import'
  | 'reservations'
  | 'equipe'
  | 'scan'
  | 'evenements'
  | 'statistiques'
  | 'promos'
  | 'lien_qr'
  | 'iframe'

interface SidebarProps {
  activeSection: Section
  onSectionChange: (s: Section) => void
}

const NAV_MAIN: { key: Section; label: string; icon: React.ReactNode; badge?: string }[] = [
  { key: 'dashboard',    label: 'Tableau de bord', icon: <LayoutDashboard size={18} /> },
  { key: 'commandes',    label: 'Commandes',        icon: <ShoppingBag size={18} /> },
  { key: 'caisse',       label: 'Caisse — POS',     icon: <Landmark size={18} /> },
  { key: 'menu',         label: 'Menu',             icon: <UtensilsCrossed size={18} /> },
  { key: 'import',       label: 'Import photo',     icon: <Camera size={18} /> },
  { key: 'reservations', label: 'Réservations',     icon: <CalendarDays size={18} /> },
  { key: 'equipe',       label: 'Équipe',           icon: <Users size={18} /> },
  { key: 'scan',         label: 'Scan Équipe',      icon: <ScanLine size={18} /> },
]

const NAV_GESTION: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: 'evenements', label: 'Événements', icon: <CalendarDays size={18} /> },
  { key: 'statistiques', label: 'Statistiques', icon: <BarChart2 size={18} /> },
  { key: 'promos', label: 'Promos', icon: <Tag size={18} /> },
  { key: 'lien_qr', label: 'Lien & QR', icon: <Link2 size={18} /> },
  { key: 'iframe', label: 'Iframe / Intégration', icon: <Code2 size={18} /> },
]

function NavItem({
  item,
  active,
  onClick,
}: {
  item: (typeof NAV_MAIN)[0]
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <span className={cn(active ? 'text-primary' : 'text-muted-foreground')}>
        {item.icon}
      </span>
      <span>{item.label}</span>
      {active && (
        <ChevronRight size={14} className="ml-auto text-primary" />
      )}
    </button>
  )
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  const content = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
          <Store size={18} className="text-white" />
        </div>
        <div>
          <p className="text-base font-bold tracking-tight text-foreground">RESTAFY</p>
          <p className="text-xs text-muted-foreground">Espace propriétaire</p>
        </div>
        {/* Status badge */}
        <div className="ml-auto flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-0.5 dark:bg-green-900/30">
          <span className="pulse-dot h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs font-medium text-green-700 dark:text-green-400">Ouvert</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Principal
        </p>
        <div className="flex flex-col gap-0.5">
          {NAV_MAIN.map((item) => (
            <NavItem
              key={item.key}
              item={item}
              active={activeSection === item.key}
              onClick={() => { onSectionChange(item.key); setMobileOpen(false) }}
            />
          ))}
        </div>

        <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Gestion
        </p>
        <div className="flex flex-col gap-0.5">
          {NAV_GESTION.map((item) => (
            <NavItem
              key={item.key}
              item={item}
              active={activeSection === item.key}
              onClick={() => { onSectionChange(item.key); setMobileOpen(false) }}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-3 py-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl p-2 hover:bg-muted transition-colors cursor-pointer">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-sm font-bold">
            S
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">Souraka</p>
            <p className="text-xs text-muted-foreground">Propriétaire</p>
          </div>
          <Settings size={15} className="shrink-0 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 text-muted-foreground hover:text-destructive"
            onClick={() => {}}
          >
            <LogOut size={15} />
            <span>Déconnexion</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Basculer le thème"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </Button>
        </div>
        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          v1.4.2 &middot;{' '}
          <a href="https://restafy.shop" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-primary transition-colors">
            restafy.shop
          </a>
        </p>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-card shadow-md border border-border lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir le menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[260px] bg-card shadow-2xl transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <button
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          onClick={() => setMobileOpen(false)}
        >
          <X size={18} />
        </button>
        {content}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-[260px] lg:shrink-0 lg:flex-col border-r border-border bg-card">
        {content}
      </aside>
    </>
  )
}
