'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, ScanLine, Copy, Eye, EyeOff, UserCheck, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { TEAM_MEMBERS, TeamMember } from '@/lib/restafy-data'

function MemberCard({ member }: { member: TeamMember }) {
  const [showPin, setShowPin] = useState(false)

  const initials = member.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const roleColors: Record<string, string> = {
    Manager: '#E86F3F',
    Caissière: '#2A6B5E',
    Cuisinier: '#F3A739',
    Serveuse: '#5B6E6A',
  }
  const color = roleColors[member.role] ?? '#5B6E6A'

  return (
    <div className={cn(
      'order-card rounded-2xl border bg-card p-5',
      !member.active && 'opacity-60',
    )} style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{member.name}</p>
            <p className="text-xs text-muted-foreground">{member.role}</p>
          </div>
        </div>
        {member.active ? (
          <div className="flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5">
            <UserCheck size={11} className="text-green-600 dark:text-green-400" />
            <span className="text-[10px] font-semibold text-green-700 dark:text-green-400">Actif</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
            <UserX size={11} className="text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground">Inactif</span>
          </div>
        )}
      </div>

      {/* PIN */}
      <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">PIN</p>
          <p className="text-base font-bold tracking-[0.3em] text-foreground font-mono">
            {showPin ? member.pin : '••••'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPin((v) => !v)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-border transition-colors"
            aria-label="Afficher le PIN"
          >
            {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(member.pin)
              toast.success('PIN copié')
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-border transition-colors"
            aria-label="Copier le PIN"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/40 p-2 text-center">
          <p className="text-xs font-semibold text-muted-foreground">Accès actifs</p>
          <p className="text-lg font-bold text-foreground">{member.active ? 1 : 0}</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2 text-center">
          <p className="text-xs font-semibold text-muted-foreground">Utilisations</p>
          <p className="text-lg font-bold text-foreground">{member.usages}</p>
        </div>
      </div>

      {/* Scan link */}
      {member.active && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2">
          <ScanLine size={14} className="shrink-0 text-primary" />
          <p className="text-xs text-muted-foreground truncate">
            restafy.shop/scan/<span className="font-mono font-semibold text-foreground">{member.pin}</span>
          </p>
          <button
            onClick={() => toast.success('Lien copié')}
            className="ml-auto shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors"
          >
            <Copy size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function TeamSection() {
  const [members, setMembers] = useState<TeamMember[]>(TEAM_MEMBERS)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')

  const totalUsages = members.reduce((s, m) => s + m.usages, 0)
  const activeCount = members.filter((m) => m.active).length

  const handleAdd = () => {
    if (!newName.trim()) return
    const pin = String(Math.floor(1000 + Math.random() * 9000))
    const newMember: TeamMember = {
      id: `t${Date.now()}`,
      name: newName.trim(),
      role: newRole.trim() || 'Staff',
      pin,
      usages: 0,
      active: true,
    }
    setMembers((prev) => [...prev, newMember])
    toast.success(`Accès créé pour ${newName} — PIN: ${pin}`)
    setNewName('')
    setNewRole('')
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Membres</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{members.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accès actifs</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total utilisations</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{totalUsages}</p>
        </div>
      </div>

      {/* New access form */}
      <div className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Plus size={16} className="text-primary" />
          Créer un nouvel accès scan
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom du membre"
            className="rounded-xl flex-1"
          />
          <Input
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            placeholder="Rôle (ex : Serveur)"
            className="rounded-xl flex-1"
          />
          <Button onClick={handleAdd} className="btn-micro gap-2 rounded-xl shrink-0">
            <ScanLine size={14} />
            Générer PIN
          </Button>
        </div>
      </div>

      {/* Members grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {members.map((m) => <MemberCard key={m.id} member={m} />)}
      </div>
    </div>
  )
}
