// Générateur QR multi-types + modèles visuels (cadre / couleurs) + option logo centre

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Copy, Check, ExternalLink, Loader2, QrCode, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getAppUrl } from '@/lib/appUrl';
import {
  type QrTemplateDef,
  type QrTemplateId,
  QR_TEMPLATES,
  getQrTemplate,
} from '@/lib/qrTemplates';
import { cn } from '@/lib/utils';

export type QRType = 'restaurant' | 'event' | 'share' | 'menu' | 'reservation';

interface QRConfig {
  url: string;
  label: string;
  sublabel?: string;
  color: string;
  bgColor: string;
}

interface QRCodeGeneratorProps {
  slug?: string;
  restaurantId?: string;
  restaurantName?: string;
  eventId?: string;
  eventName?: string;
  eventDate?: string;
  types?: QRType[];
  compact?: boolean;
  /** Masquer la grille de choix de modèle (ex. embed très petit) */
  hideTemplatePicker?: boolean;
}

const STORAGE_KEY = 'restafy-qr-template-id';

const RestafyLogo = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="10" fill="#f97316" />
    <text
      x="20"
      y="28"
      textAnchor="middle"
      fontFamily="system-ui, sans-serif"
      fontWeight="900"
      fontSize="22"
      fill="white"
      fontStyle="italic"
    >
      R
    </text>
  </svg>
);

async function downloadQRPNG(
  svgEl: SVGElement,
  filename: string,
  label: string,
  template: QrTemplateDef,
): Promise<void> {
  const SIZE = 600;
  const PAD = 40;
  const FOOTER = 60;
  const LOGO = 52;

  const clone = svgEl.cloneNode(true) as SVGElement;
  clone.setAttribute('width', String(SIZE - PAD * 2));
  clone.setAttribute('height', String(SIZE - PAD * 2 - FOOTER));

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE + FOOTER;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = template.accentColor;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 3;
      roundRect(ctx, 8, 8, SIZE - 16, SIZE + FOOTER - 16, 20);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.drawImage(img, PAD, PAD, SIZE - PAD * 2, SIZE - PAD * 2 - FOOTER);

      if (template.showCenterLogo) {
        const logoX = SIZE / 2 - LOGO / 2;
        const logoY = (SIZE - FOOTER) / 2 - LOGO / 2 + PAD / 2 - 10;
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, logoX - 4, logoY - 4, LOGO + 8, LOGO + 8, 14);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#f97316';
        roundRect(ctx, logoX, logoY, LOGO, LOGO, 12);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 italic ${LOGO * 0.65}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('R', SIZE / 2, logoY + LOGO / 2 + 2);
      }

      ctx.fillStyle = template.accentColor;
      ctx.font = `800 16px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.slice(0, 40), SIZE / 2, SIZE - 10);

      ctx.fillStyle = '#9ca3af';
      ctx.font = `600 13px system-ui, sans-serif`;
      ctx.fillText('app.restafy.shop', SIZE / 2, SIZE + 20);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas to blob failed'));
            return;
          }
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          a.click();
          URL.revokeObjectURL(a.href);
          URL.revokeObjectURL(svgUrl);
          resolve();
        },
        'image/png',
      );
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = svgUrl;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function QrTemplatePicker({
  value,
  onChange,
  compact,
}: {
  value: QrTemplateId;
  onChange: (id: QrTemplateId) => void;
  compact?: boolean;
}) {
  const visible = compact ? QR_TEMPLATES.slice(0, 8) : QR_TEMPLATES;
  const rest = compact ? QR_TEMPLATES.length - visible.length : 0;

  return (
    <div className="space-y-3 rounded-2xl bg-zinc-900/40 border border-white/5 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-300 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" aria-hidden />
          Modèle visuel
        </p>
        <span className="text-[10px] text-zinc-500 italic">Les modèles « lecture max » scannent mieux à distance</span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2.5">
        {visible.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            title={`${t.name} — ${t.hint}`}
            className={cn(
              'group rounded-xl p-1.5 border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400',
              value === t.id
                ? 'border-violet-400 ring-4 ring-violet-500/25 shadow-lg shadow-violet-500/10 scale-[1.03]'
                : 'border-white/5 hover:border-white/15 bg-zinc-950/40 hover:bg-zinc-900/60',
            )}
          >
            <div className={cn('aspect-square rounded-lg flex items-center justify-center', t.frameClass)}>
              <div
                className="w-7 h-7 rounded border border-black/10"
                style={{ backgroundColor: t.bgColor }}
              />
            </div>
            <p className={cn(
              'text-[10px] font-black truncate text-center mt-1.5 leading-tight transition-colors',
              value === t.id ? 'text-violet-200' : 'text-zinc-400 group-hover:text-zinc-200',
            )}>{t.name}</p>
          </button>
        ))}
        {rest > 0 && (
          <div className="rounded-xl p-1.5 border border-dashed border-white/10 flex items-center justify-center aspect-square min-h-[72px]">
            <span className="text-xs font-black text-zinc-500">+{rest}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function QRCard({
  config,
  filename,
  compact,
  template,
}: {
  config: QRConfig;
  filename: string;
  compact?: boolean;
  template: QrTemplateDef;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!svgRef.current) {
      toast.error('QR code non disponible — rechargez la page');
      return;
    }
    setDownloading(true);
    try {
      await downloadQRPNG(svgRef.current as unknown as SVGElement, filename, config.label, template);
      toast.success('QR Code téléchargé !');
    } catch (err) {
      console.error('[QR] download error', err);
      toast.error('Erreur lors du téléchargement — essayez un autre navigateur');
    } finally {
      setDownloading(false);
    }
  }, [filename, config.label, template]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(config.url);
      setCopying(true);
      toast.success('Lien copié !');
      setTimeout(() => setCopying(false), 2000);
    } catch {
      toast.error('Impossible de copier');
    }
  }, [config.url]);

  const qrSize = compact ? 160 : 220;

  return (
    <div
      className={cn(
        'group relative rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 shadow-xl shadow-black/40 overflow-hidden transition-all',
        'hover:border-white/20 hover:shadow-2xl hover:-translate-y-0.5',
        compact ? '' : 'flex flex-col',
      )}
      style={{
        boxShadow: `0 0 0 1px ${template.accentColor}10, 0 20px 48px -24px ${template.accentColor}30`,
      }}
    >
      {/* Halo signature couleur */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-30 blur-3xl transition-opacity group-hover:opacity-50"
        style={{ backgroundColor: template.accentColor }}
      />

      {/* Header */}
      <div className="relative px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] mb-2"
            style={{
              backgroundColor: `${template.accentColor}20`,
              color: template.accentColor,
              borderWidth: 1,
              borderColor: `${template.accentColor}40`,
            }}
          >
            <QrCode className="w-3 h-3" />
            QR
          </div>
          <p className="font-black text-zinc-100 text-base tracking-tight truncate">{config.label}</p>
          {config.sublabel && <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{config.sublabel}</p>}
        </div>
      </div>

      {/* QR area */}
      <div className="relative flex items-center justify-center px-6 pb-5">
        <div className={cn('rounded-2xl p-4 inline-block max-w-full', template.frameClass)}>
          {template.topBarText && (
            <div className={cn('rounded-t-lg -mx-1 -mt-1 mb-2', template.topBarClass)}>{template.topBarText}</div>
          )}
          <div className="relative inline-block">
            <QRCodeSVG
              ref={svgRef as React.RefObject<SVGSVGElement>}
              value={config.url}
              size={qrSize}
              level="H"
              includeMargin={template.id === 'scan_me' || template.id === 'midnight'}
              fgColor={template.fgColor}
              bgColor={template.bgColor}
            />
            {template.showCenterLogo && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white rounded-xl p-1 shadow-md">
                  <RestafyLogo size={Math.round(qrSize * 0.18)} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* URL line */}
      <div className="relative px-5 pb-3">
        <p className="text-[10px] text-zinc-500 text-center truncate font-mono select-all">{config.url.replace('https://', '')}</p>
      </div>

      {/* Action footer */}
      <div className="relative px-4 pb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="flex-[1.4] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg disabled:opacity-60 transition-all hover:brightness-110"
          style={{
            background: `linear-gradient(135deg, ${template.accentColor}, ${template.accentColor}dd)`,
            boxShadow: `0 8px 20px -8px ${template.accentColor}80`,
          }}
        >
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {downloading ? 'Préparation…' : 'Télécharger PNG'}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copier le lien"
          className={cn(
            'flex items-center justify-center px-3 py-2.5 rounded-xl text-xs font-bold border transition-all',
            copying
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'border-white/10 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 hover:border-white/20',
          )}
        >
          {copying ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <a
          href={config.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ouvrir le lien"
          className="flex items-center justify-center px-3 py-2.5 rounded-xl border border-white/10 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 hover:border-white/20 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

/**
 * QR codes must always use the public production URL so they work
 * even when the admin is on a preview / localhost deployment.
 */
function getQrBaseUrl(): string {
  const appUrl = getAppUrl();
  // Prefer production domain for QR codes
  if (/localhost|127\.0\.0\.1|vercel\.app/.test(appUrl)) {
    return 'https://app.restafy.shop';
  }
  return appUrl;
}

export function QRCodeGenerator({
  slug,
  restaurantId: _restaurantId,
  restaurantName: _restaurantName,
  eventId,
  eventName,
  eventDate,
  types,
  compact = false,
  hideTemplatePicker = false,
}: QRCodeGeneratorProps) {
  const base = getQrBaseUrl();

  const [templateId, setTemplateId] = useState<QrTemplateId>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY) as QrTemplateId | null;
      if (s && QR_TEMPLATES.some((t) => t.id === s)) return s;
    } catch {
      /* noop */
    }
    return 'minimal';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, templateId);
    } catch {
      /* noop */
    }
  }, [templateId]);

  const template = getQrTemplate(templateId);

  const configs: Record<QRType, QRConfig | null> = {
    restaurant: slug
      ? {
          url: `${base}/r/${slug}`,
          label: 'Page du restaurant',
          sublabel: `app.restafy.shop/r/${slug}`,
          color: '#f97316',
          bgColor: '#fff7ed',
        }
      : null,

    menu: slug
      ? {
          url: `${base}/r/${slug}#menu`,
          label: 'Menu direct',
          sublabel: 'Accès direct au menu',
          color: '#8b5cf6',
          bgColor: '#f5f3ff',
        }
      : null,

    reservation: slug
      ? {
          url: `${base}/r/${slug}#reservation`,
          label: 'Réservation table',
          sublabel: 'Formulaire de réservation',
          color: '#10b981',
          bgColor: '#ecfdf5',
        }
      : null,

    event: eventId
      ? {
          url: `${base}/events/${eventId}`,
          label: eventName ? `Événement: ${eventName.slice(0, 25)}` : 'Événement',
          sublabel: eventDate
            ? new Date(eventDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
            : undefined,
          color: '#6366f1',
          bgColor: '#eef2ff',
        }
      : null,

    share: slug
      ? {
          url: `${base}/r/${slug}`,
          label: 'Partage rapide',
          sublabel: 'Pour vos réseaux sociaux',
          color: '#ec4899',
          bgColor: '#fdf2f8',
        }
      : null,
  };

  const activeTypes = types || (Object.keys(configs) as QRType[]).filter((k) => configs[k] !== null);
  const activeConfigs = activeTypes.map((t) => configs[t]).filter(Boolean) as QRConfig[];

  if (activeConfigs.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-400">
        <QrCode className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">Configurez un slug pour générer les QR codes</p>
      </div>
    );
  }

  const picker = !hideTemplatePicker && (
    <QrTemplatePicker value={templateId} onChange={setTemplateId} compact={compact} />
  );

  if (compact && activeConfigs.length === 1) {
    const t = activeTypes.find((k) => configs[k] !== null)!;
    return (
      <div className="space-y-3">
        {picker}
        <QRCard config={activeConfigs[0]} filename={`qr-${t}-restafy.png`} compact template={template} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {picker}
      <div
        className={`grid gap-4 ${
          compact
            ? 'grid-cols-1'
            : activeConfigs.length === 1
              ? 'grid-cols-1 max-w-xs'
              : activeConfigs.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {activeConfigs.map((cfg, i) => (
          <QRCard
            key={i}
            config={cfg}
            filename={`qr-${activeTypes[i]}-${slug || eventId || 'restafy'}.png`}
            template={template}
          />
        ))}
      </div>
    </div>
  );
}
