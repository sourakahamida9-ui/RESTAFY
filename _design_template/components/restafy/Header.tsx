'use client'

import { Bell } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'

const PAGE_TITLES: Record<string, string> = {
  dashboard:     'Tableau de bord',
  commandes:     'Commandes',
  caisse:        'Caisse — POS',
  menu:          'Menu',
  import:        'Import menu par photo',
  reservations:  'Réservations',
  equipe:        'Équipe',
  scan:          'Scan Équipe',
  evenements:    'Événements',
  statistiques:  'Statistiques',
  promos:        'Promotions',
  lien_qr:       'Lien & QR Code',
  iframe:        'Iframe / Intégration',
}

interface HeaderProps {
  activeSection: string
  pendingCount: number
}

export default function Header({ activeSection, pendingCount }: HeaderProps) {
  const today = new Date()
  const dateFormatted = format(today, "EEEE d MMMM yyyy", { locale: fr })
  const dateCapitalized = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1)

  return (
    <header className="flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-6 py-4 sticky top-0 z-30">
      <div className="pl-10 lg:pl-0">
        <h1 className="text-xl font-bold text-foreground leading-tight">
          {PAGE_TITLES[activeSection] ?? 'Tableau de bord'}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{dateCapitalized}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Restaurant status */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 dark:border-green-800 dark:bg-green-900/20">
          <span className="pulse-dot h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs font-semibold text-green-700 dark:text-green-400">Restaurant ouvert</span>
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative rounded-xl" aria-label="Notifications">
          <Bell size={18} />
          {pendingCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  )
}
