'use client'

import { useState } from 'react'
import Sidebar from '@/components/restafy/Sidebar'
import Header from '@/components/restafy/Header'
import DashboardOverview from '@/components/restafy/DashboardOverview'
import OrdersSection from '@/components/restafy/OrdersSection'
import MenuSection from '@/components/restafy/MenuSection'
import ImportSection from '@/components/restafy/ImportSection'
import TeamSection from '@/components/restafy/TeamSection'
import ScanEquipeSection from '@/components/restafy/ScanEquipeSection'
import EventsSection from '@/components/restafy/EventsSection'
import StatsSection from '@/components/restafy/StatsSection'
import QrLinkSection from '@/components/restafy/QrLinkSection'
import CaisseSection from '@/components/restafy/CaisseSection'
import { ORDERS } from '@/lib/restafy-data'

export type Section =
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

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-muted-foreground">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted">
        <span className="text-3xl font-bold text-muted-foreground/40">?</span>
      </div>
      <p className="text-base font-semibold">{title}</p>
      <p className="text-sm">Cette section sera bientôt disponible.</p>
    </div>
  )
}

export default function RestafyDashboard() {
  const [activeSection, setActiveSection] = useState<Section>('dashboard')

  const pendingCount = ORDERS.filter((o) => o.status === 'en_attente').length

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardOverview onNavigate={(s) => setActiveSection(s as Section)} />
      case 'commandes':
        return <OrdersSection />
      case 'caisse':
        return <CaisseSection />
      case 'menu':
        return <MenuSection />
      case 'import':
        return <ImportSection />
      case 'equipe':
        return <TeamSection />
      case 'scan':
        return <ScanEquipeSection />
      case 'evenements':
        return <EventsSection />
      case 'statistiques':
        return <StatsSection />
      case 'lien_qr':
        return <QrLinkSection />
      case 'reservations':
        return <ComingSoon title="Réservations" />
      case 'promos':
        return <ComingSoon title="Promotions" />
      case 'iframe':
        return <ComingSoon title="Iframe / Intégration" />
      default:
        return <DashboardOverview onNavigate={(s) => setActiveSection(s as Section)} />
    }
  }

  return (
    <div className="afro-pattern flex h-screen overflow-hidden bg-background">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header activeSection={activeSection} pendingCount={pendingCount} />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl">
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  )
}
