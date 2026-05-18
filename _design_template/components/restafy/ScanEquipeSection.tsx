'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import {
  ScanLine, Clock, UserCheck, Download, RefreshCw, LogIn, LogOut,
  User, Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TEAM_MEMBERS, TeamMember } from '@/lib/restafy-data'

const ROLE_COLORS: Record<string, string> = {
  Manager: '#E86F3F',
  Caissière: '#2A6B5E',
  Cuisinier: '#F3A739',
  Serveuse: '#5B6E6A',
}

const LOGO_SVG_B64 =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
    <rect width="40" height="40" rx="10" fill="#E86F3F"/>
    <path d="M10 14h20M10 20h14M10 26h18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="28" cy="26" r="5" fill="white"/>
    <path d="M25.5 26l2 2 3-3" stroke="#E86F3F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`)

interface LogEntry {
  id: string
  memberId: string
  memberName: string
  role: string
  action: 'entree' | 'sortie'
  time: string
}

const INITIAL_LOG: LogEntry[] = [
  { id: 'l1', memberId: 't1', memberName: 'Souraka', role: 'Manager', action: 'entree', time: '08:00' },
  { id: 'l2', memberId: 't2', memberName: 'Aminata', role: 'Caissière', action: 'entree', time: '08:15' },
  { id: 'l3', memberId: 't3', memberName: 'Boubacar', role: 'Cuisinier', action: 'entree', time: '08:30' },
]

function MemberQrCard({ member }: { member: TeamMember }) {
  const color = ROLE_COLORS[member.role] ?? '#5B6E6A'
  const initials = member.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  const qrUrl = `https://restafy.app/scan/${member.id}`

  const handleDownload = () => {
    const svg = document.getElementById(`qr-team-${member.id}`)
    if (!svg) return
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `restafy-badge-${member.name.replace(' ', '-').toLowerCase()}.svg`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Badge QR de ${member.name} téléchargé`)
  }

  return (
    <div className={cn(
      'order-card rounded-2xl border bg-card overflow-hidden',
      !member.active && 'opacity-60',
    )}>
      {/* Color bar */}
      <div className="h-1.5 w-full" style={{ background: color }} />

      <div className="p-5">
        {/* Member info */}
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ background: color }}
          >
            {initials}
          </div>
          <div className="flex-1">
            <p className="font-bold text-foreground">{member.name}</p>
            <p className="text-xs text-muted-foreground">{member.role}</p>
          </div>
          {member.active ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Actif
            </span>
          ) : (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              Inactif
            </span>
          )}
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div
            className="rounded-2xl p-3"
            style={{ background: '#FEF9F0', border: `1.5px solid ${color}22` }}
          >
            <QRCodeSVG
              id={`qr-team-${member.id}`}
              value={qrUrl}
              size={120}
              fgColor={color}
              bgColor="#FEF9F0"
              level="H"
              imageSettings={{
                src: LOGO_SVG_B64,
                height: 28,
                width: 28,
                excavate: true,
              }}
            />
          </div>
        </div>

        {/* URL */}
        <p className="mt-3 text-center font-mono text-[10px] text-muted-foreground">
          {qrUrl}
        </p>

        {/* Download */}
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full gap-1.5 text-xs"
          onClick={handleDownload}
          disabled={!member.active}
        >
          <Download size={12} />
          Télécharger badge
        </Button>
      </div>
    </div>
  )
}

export default function ScanEquipeSection() {
  const [log, setLog] = useState<LogEntry[]>(INITIAL_LOG)
  const [now, setNow] = useState(new Date())
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [scanAnim, setScanAnim] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const handleSimulateScan = (member: TeamMember) => {
    setScanAnim(true)
    setSelectedMember(member)
    setTimeout(() => {
      const lastEntry = [...log].reverse().find((e) => e.memberId === member.id)
      const action: LogEntry['action'] = lastEntry?.action === 'entree' ? 'sortie' : 'entree'
      const entry: LogEntry = {
        id: String(Date.now()),
        memberId: member.id,
        memberName: member.name,
        role: member.role,
        action,
        time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      }
      setLog((prev) => [entry, ...prev])
      toast.success(
        `${member.name} — ${action === 'entree' ? 'Arrivée enregistrée' : 'Départ enregistré'}`,
        { description: entry.time }
      )
      setScanAnim(false)
    }, 800)
  }

  const presentMembers = TEAM_MEMBERS.filter((m) => {
    const last = [...log].find((e) => e.memberId === m.id)
    return last?.action === 'entree'
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Scan Équipe</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          QR codes personnels — pointage entrée &amp; sortie en temps réel
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left col: QR cards */}
        <div className="space-y-5 xl:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM_MEMBERS.map((m) => (
              <MemberQrCard key={m.id} member={m} />
            ))}
          </div>

          {/* Simulate scan */}
          <div className="rounded-2xl border bg-card p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Simuler un scan (demo)
            </p>
            <div className="flex flex-wrap gap-2">
              {TEAM_MEMBERS.filter((m) => m.active).map((m) => {
                const last = [...log].find((e) => e.memberId === m.id)
                const isIn = last?.action === 'entree'
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSimulateScan(m)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all',
                      scanAnim && selectedMember?.id === m.id
                        ? 'scale-95 border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/30 hover:bg-muted',
                    )}
                  >
                    <ScanLine size={14} className={isIn ? 'text-green-600' : 'text-muted-foreground'} />
                    {m.name}
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      isIn ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground',
                    )}>
                      {isIn ? 'Présent' : 'Absent'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right col: live clock + log */}
        <div className="flex flex-col gap-4">
          {/* Live clock */}
          <div className="rounded-2xl border bg-card p-5 text-center shadow-sm">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock size={14} />
              <p className="text-xs font-semibold uppercase tracking-wider">{dateStr}</p>
            </div>
            <p className="mt-2 font-mono text-4xl font-bold tabular-nums text-foreground">{timeStr}</p>

            {/* Present count */}
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-green-50 dark:bg-green-900/20 px-3 py-2">
              <UserCheck size={15} className="text-green-600 dark:text-green-400" />
              <span className="text-sm font-bold text-green-700 dark:text-green-400">
                {presentMembers.length} membre{presentMembers.length > 1 ? 's' : ''} présent{presentMembers.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Present names */}
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {presentMembers.map((m) => (
                <span
                  key={m.id}
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                  style={{ background: ROLE_COLORS[m.role] ?? '#5B6E6A' }}
                >
                  {m.name}
                </span>
              ))}
            </div>
          </div>

          {/* Log */}
          <div className="flex-1 rounded-2xl border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Journal d&apos;accès
              </p>
              <button
                onClick={() => setLog(INITIAL_LOG)}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw size={13} />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {log.map((entry) => {
                const color = ROLE_COLORS[entry.role] ?? '#5B6E6A'
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-muted/40"
                  >
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        entry.action === 'entree'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-muted',
                      )}
                    >
                      {entry.action === 'entree'
                        ? <LogIn size={13} className="text-green-600 dark:text-green-400" />
                        : <LogOut size={13} className="text-muted-foreground" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{entry.memberName}</p>
                      <p className="text-[10px] text-muted-foreground">{entry.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono font-semibold text-foreground">{entry.time}</p>
                      <p className={cn(
                        'text-[10px] font-medium',
                        entry.action === 'entree' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                      )}>
                        {entry.action === 'entree' ? 'Arrivée' : 'Départ'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* QR codes section title for printing */}
      <div className="rounded-2xl border bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <Shield size={16} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Badges imprimables</span> — Chaque QR code est unique par membre et lié à son profil. Imprimez les badges et plastifiez-les pour un usage quotidien.
          </p>
        </div>
      </div>
    </div>
  )
}
