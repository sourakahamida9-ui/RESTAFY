'use client'

import { useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import {
  Copy, Download, ExternalLink, Link2, QrCode, Palette,
  RefreshCw, Globe, Instagram, Facebook, Twitter, Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const RESTAURANT_NAME = 'RESTAFY — Restaurant'
const BASE_URL = 'https://restafy.app/menu/souraka'

const QR_COLORS = [
  { fg: '#E86F3F', bg: '#FEF9F0', label: 'Terracotta' },
  { fg: '#2A6B5E', bg: '#F0F9F7', label: 'Sauge' },
  { fg: '#1A2F2B', bg: '#FEF9F0', label: 'Nuit' },
  { fg: '#F3A739', bg: '#FFF8ED', label: 'Or' },
  { fg: '#000000', bg: '#FFFFFF', label: 'Classic' },
]

// RESTAFY logo path to embed in QR center
const LOGO_SVG_B64 =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
    <rect width="40" height="40" rx="10" fill="#E86F3F"/>
    <path d="M10 14h20M10 20h14M10 26h18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="28" cy="26" r="5" fill="white"/>
    <path d="M25.5 26l2 2 3-3" stroke="#E86F3F" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`)

const SOCIAL_LINKS = [
  { icon: <Instagram size={16} />, label: 'Instagram', value: '@restafy_souraka', color: '#E1306C' },
  { icon: <Facebook size={16} />, label: 'Facebook', value: 'restafy.souraka', color: '#1877F2' },
  { icon: <Twitter size={16} />, label: 'X / Twitter', value: '@restafy_app', color: '#000000' },
]

export default function QrLinkSection() {
  const [selectedColor, setSelectedColor] = useState(0)
  const [customUrl, setCustomUrl] = useState(BASE_URL)
  const [activeTab, setActiveTab] = useState<'menu' | 'team' | 'event'>('menu')
  const qrRef = useRef<SVGSVGElement>(null)

  const color = QR_COLORS[selectedColor]

  const QR_TARGETS = {
    menu: { url: `${BASE_URL}/menu`, label: 'Menu en ligne', desc: 'Clients scannent pour voir la carte complète' },
    team: { url: `${BASE_URL}/pointage`, label: 'Pointage équipe', desc: 'Membres de l\'équipe scannent pour pointer' },
    event: { url: `${BASE_URL}/events/innovation-night`, label: 'Billet événement', desc: 'Accès billetterie de l\'événement' },
  }

  const currentTarget = QR_TARGETS[activeTab]
  const qrValue = activeTab === 'menu' && customUrl ? customUrl : currentTarget.url

  const handleCopyLink = () => {
    navigator.clipboard.writeText(qrValue)
    toast.success('Lien copié dans le presse-papiers')
  }

  const handleDownloadSVG = () => {
    const svg = document.getElementById('restafy-qr-svg')
    if (!svg) return
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `restafy-qr-${activeTab}.svg`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('QR Code téléchargé')
  }

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: RESTAURANT_NAME, url: qrValue })
    } else {
      handleCopyLink()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Lien & QR Code</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Partagez votre restaurant, votre menu ou vos événements en un scan
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left — configurator */}
        <div className="flex flex-col gap-5 lg:col-span-3">
          {/* Target tabs */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Type de QR Code
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['menu', 'team', 'event'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'rounded-xl border px-3 py-3 text-left transition-all',
                    activeTab === tab
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted',
                  )}
                >
                  <p className="text-xs font-bold">{QR_TARGETS[tab].label}</p>
                  <p className="mt-0.5 text-[10px] leading-tight">{QR_TARGETS[tab].desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom URL (menu only) */}
          {activeTab === 'menu' && (
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                URL personnalisée
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="pl-8 text-sm font-mono"
                    placeholder="https://..."
                  />
                </div>
                <Button variant="outline" size="icon" onClick={() => setCustomUrl(BASE_URL)}>
                  <RefreshCw size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* Color picker */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Palette size={14} className="text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Couleur du QR
              </p>
            </div>
            <div className="flex gap-2">
              {QR_COLORS.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedColor(i)}
                  title={c.label}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl border-2 transition-all',
                    selectedColor === i ? 'border-primary scale-110 shadow-md' : 'border-border',
                  )}
                  style={{ background: c.bg }}
                >
                  <span
                    className="h-4 w-4 rounded-md"
                    style={{ background: c.fg }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Share links */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Partage direct
            </p>
            <div className="space-y-2">
              {/* Main link */}
              <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
                <Link2 size={14} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-xs font-mono text-foreground">{qrValue}</span>
                <button
                  onClick={handleCopyLink}
                  className="rounded-lg p-1 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Copy size={13} />
                </button>
                <a
                  href={qrValue}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg p-1 text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink size={13} />
                </a>
              </div>

              {/* Social */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {SOCIAL_LINKS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => { navigator.clipboard.writeText(s.value); toast.success(`${s.label} copié`) }}
                    className="flex items-center gap-2 rounded-xl border bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                  >
                    <span style={{ color: s.color }}>{s.icon}</span>
                    <span className="truncate font-medium">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right — QR preview */}
        <div className="flex flex-col items-center gap-4 lg:col-span-2">
          <div
            className="flex w-full flex-col items-center rounded-3xl border-2 border-border bg-card p-6 shadow-lg"
            style={{ background: color.bg }}
          >
            {/* Label */}
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: color.fg }}>
              RESTAFY
            </p>
            <p className="mb-5 text-[10px]" style={{ color: color.fg, opacity: 0.6 }}>
              {currentTarget.label}
            </p>

            {/* QR Code with logo */}
            <div className="relative" id="qr-wrapper">
              <QRCodeSVG
                id="restafy-qr-svg"
                value={qrValue}
                size={200}
                fgColor={color.fg}
                bgColor={color.bg}
                level="H"
                imageSettings={{
                  src: LOGO_SVG_B64,
                  height: 44,
                  width: 44,
                  excavate: true,
                }}
              />
            </div>

            {/* Scan label */}
            <p
              className="mt-5 text-center text-[11px] font-medium leading-tight"
              style={{ color: color.fg, opacity: 0.7 }}
            >
              Scannez pour accéder<br />à {currentTarget.label.toLowerCase()}
            </p>
          </div>

          {/* Actions */}
          <div className="flex w-full flex-col gap-2">
            <Button
              className="w-full gap-2"
              style={{ background: '#E86F3F', color: '#fff' }}
              onClick={handleDownloadSVG}
            >
              <Download size={15} />
              Télécharger le QR (SVG)
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={handleShare}>
              <Share2 size={15} />
              Partager le lien
            </Button>
          </div>

          {/* Stats card */}
          <div className="w-full rounded-2xl border bg-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statistiques</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-foreground">248</p>
                <p className="text-[10px] text-muted-foreground">Scans total</p>
              </div>
              <div>
                <p className="text-xl font-bold text-primary">12</p>
                <p className="text-[10px] text-muted-foreground">Aujourd&apos;hui</p>
              </div>
              <div>
                <p className="text-xl font-bold text-accent">+18%</p>
                <p className="text-[10px] text-muted-foreground">vs semaine</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
