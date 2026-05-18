'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import {
  CalendarDays, Ticket, Users, TrendingUp, Plus, X,
  Download, Share2, Clock, MapPin, Tag, Star, Edit3, Trash2,
  CheckCircle2, XCircle, ArrowRight, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { EVENTS, Event } from '@/lib/restafy-data'

const LOGO_SVG_B64 =
  'data:image/svg+xml;base64,' +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">` +
    `<rect width="40" height="40" rx="10" fill="#E86F3F"/>` +
    `<path d="M10 14h20M10 20h14M10 26h18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>` +
    `<circle cx="28" cy="26" r="5" fill="white"/>` +
    `<path d="M25.5 26l2 2 3-3" stroke="#E86F3F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
    `</svg>`
  )

const EVENT_GRADIENTS: Record<string, string> = {
  e1: 'linear-gradient(135deg,#E86F3F 0%,#F3A739 100%)',
  e2: 'linear-gradient(135deg,#2A6B5E 0%,#3D9B8A 100%)',
  e3: 'linear-gradient(135deg,#1A2F2B 0%,#2A6B5E 100%)',
  e4: 'linear-gradient(135deg,#F3A739 0%,#E86F3F 100%)',
}

const STATUS_CFG = {
  a_venir: { label: 'À venir', badgeCls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  passe:   { label: 'Passé',   badgeCls: 'bg-muted text-muted-foreground' },
  annule:  { label: 'Annulé', badgeCls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

interface Attendee {
  id: string; name: string; ticketCode: string; paid: boolean; checkedIn: boolean
}
const MOCK_ATTENDEES: Attendee[] = [
  { id: 'a1', name: 'Mariama Diallo',  ticketCode: 'RST-001', paid: true,  checkedIn: true  },
  { id: 'a2', name: 'Ibrahima Sow',   ticketCode: 'RST-002', paid: true,  checkedIn: false },
  { id: 'a3', name: 'Kadiatou Barry', ticketCode: 'RST-003', paid: true,  checkedIn: false },
  { id: 'a4', name: 'Moussa Camara',  ticketCode: 'RST-004', paid: false, checkedIn: false },
  { id: 'a5', name: 'Awa Traoré',     ticketCode: 'RST-005', paid: true,  checkedIn: false },
]

/* ─── Event Card ─────────────────────────────────────────────────── */
function EventCard({ event, onSelect }: { event: Event; onSelect: (e: Event) => void }) {
  const cfg  = STATUS_CFG[event.status]
  const pct  = event.totalTickets > 0 ? Math.round((event.ticketsSold / event.totalTickets) * 100) : 0
  const rev  = event.ticketsSold * event.price
  const grad = EVENT_GRADIENTS[event.id] ?? 'linear-gradient(135deg,#E86F3F,#F3A739)'
  const d    = new Date(event.date)

  return (
    <div
      className="order-card group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm cursor-pointer"
      onClick={() => onSelect(event)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(event)}
    >
      {/* Banner */}
      <div className="relative h-32" style={{ background: grad }}>
        {/* Date pill */}
        <div className="absolute left-4 top-4 rounded-2xl bg-white/25 backdrop-blur-sm px-3 py-2 text-white">
          <p className="text-2xl font-black leading-none">{d.getDate()}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide">
            {d.toLocaleDateString('fr-FR', { month: 'short' })}
          </p>
        </div>
        {/* Status */}
        <span className={cn('absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold', cfg.badgeCls)}>
          {cfg.label}
        </span>
        {/* Hover arrow */}
        <div className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100">
          <ChevronRight size={14} className="text-white" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-bold text-foreground line-clamp-1 text-sm">{event.title}</h3>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock size={10} />
              {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="flex items-center gap-1"><MapPin size={10} />Dakar</span>
            <span className="flex items-center gap-1"><Tag size={10} />
              {event.price === 0 ? 'Gratuit' : `${event.price.toLocaleString('fr-FR')} F`}
            </span>
          </div>
        </div>

        {/* Ticket bar */}
        <div>
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Ticket size={10} /> {event.ticketsSold}/{event.totalTickets}
            </span>
            <span className="font-bold" style={{ color: pct > 75 ? '#E86F3F' : '#2A6B5E' }}>{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: pct > 75 ? '#E86F3F' : '#2A6B5E' }}
            />
          </div>
        </div>

        {/* Revenue */}
        <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
          <span className="text-[11px] text-muted-foreground">Revenus</span>
          <span className="text-xs font-bold text-foreground">{rev.toLocaleString('fr-FR')} FCFA</span>
        </div>

        <button
          className="flex w-full items-center justify-center gap-1 rounded-xl border border-primary/30 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary/5"
          onClick={(ev) => { ev.stopPropagation(); onSelect(event) }}
        >
          Gérer <ArrowRight size={11} />
        </button>
      </div>
    </div>
  )
}

/* ─── Event Detail Modal ─────────────────────────────────────────── */
function EventDetail({ event, onClose }: { event: Event; onClose: () => void }) {
  const [attendees, setAttendees] = useState<Attendee[]>(MOCK_ATTENDEES)
  const [activeTab, setActiveTab] = useState<'overview' | 'attendees' | 'qr'>('overview')
  const qrUrl  = `https://restafy.app/events/${event.id}/ticket`
  const pct    = event.totalTickets > 0 ? Math.round((event.ticketsSold / event.totalTickets) * 100) : 0
  const grad   = EVENT_GRADIENTS[event.id] ?? 'linear-gradient(135deg,#E86F3F,#F3A739)'
  const checkedCount = attendees.filter((a) => a.checkedIn).length

  const toggleCheckin = (id: string) => {
    setAttendees((prev) => prev.map((a) => a.id === id ? { ...a, checkedIn: !a.checkedIn } : a))
    const a = attendees.find((x) => x.id === id)
    if (a) toast.success(`${a.name} — ${a.checkedIn ? 'Check-in annulé' : 'Check-in validé'}`)
  }

  const handleDownloadQr = () => {
    const el = document.getElementById(`event-qr-${event.id}`)
    if (!el) return
    const blob = new Blob([el.outerHTML], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `ticket-qr-${event.id}.svg`; a.click()
    URL.revokeObjectURL(url)
    toast.success('QR billet téléchargé')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card shadow-2xl" style={{ maxHeight: '90vh' }}>

        {/* Banner */}
        <div className="relative h-36 shrink-0" style={{ background: grad }}>
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            <h2 className="text-xl font-black text-white drop-shadow">{event.title}</h2>
            <p className="text-sm text-white/80">
              {new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-border">
          {(['overview', 'attendees', 'qr'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                'flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors',
                activeTab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'overview' ? 'Aperçu' : t === 'attendees' ? `Participants (${attendees.length})` : 'QR Billet'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Billets vendus', val: event.ticketsSold,   icon: <Ticket size={14} />,     color: '#E86F3F' },
                  { label: 'Places restantes', val: event.totalTickets - event.ticketsSold, icon: <Users size={14} />, color: '#2A6B5E' },
                  { label: 'Revenus (F)',  val: (event.ticketsSold * event.price).toLocaleString('fr-FR'), icon: <TrendingUp size={14} />, color: '#F3A739' },
                ].map((k) => (
                  <div key={k.label} className="rounded-2xl bg-muted/40 p-3 text-center">
                    <div className="mb-1 flex justify-center" style={{ color: k.color }}>{k.icon}</div>
                    <p className="text-lg font-black text-foreground">{k.val}</p>
                    <p className="text-[10px] text-muted-foreground">{k.label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl bg-muted/30 p-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Taux de remplissage</span>
                  <span className="font-bold text-foreground">{pct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 75 ? '#E86F3F' : '#2A6B5E' }} />
                </div>
                {pct > 80 && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-primary">
                    <Star size={10} /> Événement presque complet !
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {[
                  { label: 'Heure', val: new Date(event.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), icon: <Clock size={13} /> },
                  { label: 'Lieu', val: 'RESTAFY Dakar, Plateau', icon: <MapPin size={13} /> },
                  { label: 'Prix billet', val: event.price === 0 ? 'Gratuit' : `${event.price.toLocaleString('fr-FR')} FCFA`, icon: <Tag size={13} /> },
                ].map((d) => (
                  <div key={d.label} className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-2.5 text-sm">
                    <span className="text-muted-foreground">{d.icon}</span>
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="ml-auto font-semibold text-foreground">{d.val}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs"><Edit3 size={12} /> Modifier</Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs text-red-500 hover:text-red-500"><Trash2 size={12} /> Annuler</Button>
                <Button size="sm" className="flex-1 gap-1.5 text-xs" style={{ background: '#E86F3F' }} onClick={() => toast.success('Lien partagé')}>
                  <Share2 size={12} /> Partager
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'attendees' && (
            <div className="space-y-2">
              <div className="mb-3 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                <span className="text-xs text-muted-foreground">Check-in</span>
                <span className="text-sm font-bold text-foreground">{checkedCount}/{attendees.length}</span>
              </div>
              {attendees.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 transition-all',
                    a.checkedIn ? 'border-green-200 bg-green-50/50 dark:border-green-900/40 dark:bg-green-900/10' : 'border-border bg-muted/20',
                  )}
                >
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white', a.checkedIn ? 'bg-green-500' : 'bg-muted-foreground/40')}>
                    {a.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{a.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{a.ticketCode}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', a.paid ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400')}>
                      {a.paid ? 'payé' : 'impayé'}
                    </span>
                    <button
                      onClick={() => toggleCheckin(a.id)}
                      className={cn('flex h-7 w-7 items-center justify-center rounded-full transition-colors', a.checkedIn ? 'bg-green-500 text-white hover:bg-red-400' : 'border border-border text-muted-foreground hover:border-green-500 hover:text-green-600')}
                    >
                      {a.checkedIn ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-center text-sm text-muted-foreground">QR Code d&apos;accès — imprimez-le sur les billets</p>
              <div className="rounded-3xl border-2 border-border bg-[#FEF9F0] p-6">
                <QRCodeSVG
                  id={`event-qr-${event.id}`}
                  value={qrUrl}
                  size={180}
                  fgColor="#E86F3F"
                  bgColor="#FEF9F0"
                  level="H"
                  imageSettings={{ src: LOGO_SVG_B64, height: 40, width: 40, excavate: true }}
                />
              </div>
              <p className="font-mono text-[11px] text-muted-foreground">{qrUrl}</p>
              <div className="flex w-full gap-2">
                <Button className="flex-1 gap-2" style={{ background: '#E86F3F' }} onClick={handleDownloadQr}>
                  <Download size={14} /> Télécharger
                </Button>
                <Button variant="outline" className="flex-1 gap-2" onClick={() => { navigator.clipboard.writeText(qrUrl); toast.success('Lien copié') }}>
                  <Share2 size={14} /> Partager
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Main ───────────────────────────────────────────────────────── */
export default function EventsSection() {
  const [events, setEvents]           = useState<Event[]>(EVENTS)
  const [selected, setSelected]       = useState<Event | null>(null)
  const [tab, setTab]                 = useState<'a_venir' | 'passe'>('a_venir')
  const [showCreate, setShowCreate]   = useState(false)
  const [newTitle, setNewTitle]       = useState('')
  const [newDate, setNewDate]         = useState('')
  const [newPrice, setNewPrice]       = useState('')
  const [newTickets, setNewTickets]   = useState('')

  const filtered     = events.filter((e) => tab === 'a_venir' ? e.status === 'a_venir' : e.status !== 'a_venir')
  const totalRevenue = events.reduce((s, e) => s + e.ticketsSold * e.price, 0)
  const totalSold    = events.reduce((s, e) => s + e.ticketsSold, 0)
  const upcomingCnt  = events.filter((e) => e.status === 'a_venir').length

  const handleCreate = () => {
    if (!newTitle || !newDate) { toast.error('Titre et date requis'); return }
    const ev: Event = {
      id: String(Date.now()), title: newTitle, date: newDate,
      ticketsSold: 0, totalTickets: Number(newTickets) || 50,
      price: Number(newPrice) || 5000, status: 'a_venir',
    }
    setEvents((prev) => [ev, ...prev])
    toast.success(`"${newTitle}" créé`)
    setShowCreate(false); setNewTitle(''); setNewDate(''); setNewPrice(''); setNewTickets('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Événements</h2>
          <p className="mt-1 text-sm text-muted-foreground">Gérez vos soirées, billetterie et check-in</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="shrink-0 gap-2" style={{ background: '#E86F3F' }}>
          <Plus size={15} /> Nouvel événement
        </Button>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'À venir', value: upcomingCnt, icon: <CalendarDays size={16} />, color: '#2A6B5E' },
          { label: 'Billets vendus', value: totalSold, icon: <Ticket size={16} />, color: '#E86F3F' },
          { label: 'Revenus', value: `${totalRevenue.toLocaleString('fr-FR')} F`, icon: <TrendingUp size={16} />, color: '#F3A739' },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span style={{ color: k.color }}>{k.icon}</span>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </div>
            <p className="text-2xl font-black text-foreground">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1 w-fit">
        {(['a_venir', 'passe'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-semibold transition-all',
              tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'a_venir' ? 'À venir' : 'Passés'}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <CalendarDays size={36} className="opacity-30" />
          <p className="text-sm font-semibold">Aucun événement dans cette catégorie</p>
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus size={13} /> Créer un événement
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ev) => <EventCard key={ev.id} event={ev} onSelect={setSelected} />)}
        </div>
      )}

      {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Nouvel événement</h3>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Titre de l&apos;événement</label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Soirée Afrobeat..." />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Date &amp; heure</label>
                <Input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Prix billet (FCFA)</label>
                  <Input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="5000" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground">Capacité max</label>
                  <Input type="number" value={newTickets} onChange={(e) => setNewTickets(e.target.value)} placeholder="50" />
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button className="flex-1 gap-1.5" style={{ background: '#E86F3F' }} onClick={handleCreate}>
                <Plus size={14} /> Créer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
