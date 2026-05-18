import { useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ForkKnife, Download, Copy, WhatsappLogo, ShareNetwork } from '@phosphor-icons/react';

interface PremiumQRCodeProps {
  value: string;
  restaurantName: string;
  tableName?: string;
  size?: number;
  accentColor?: string;
}

export function PremiumQRCode({
  value,
  restaurantName,
  tableName,
  size = 200,
  accentColor = '#FF5C00',
}: PremiumQRCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const downloadAsPng = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;

    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(el, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `${restaurantName.replace(/\s+/g, '-')}-qrcode${tableName ? `-${tableName}` : ''}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // Fallback: use SVG export
      const svgEl = el.querySelector('svg');
      if (!svgEl) return;
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const link = document.createElement('a');
      link.download = `${restaurantName.replace(/\s+/g, '-')}-qrcode.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }
  }, [restaurantName, tableName]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch { /* clipboard not supported */ }
  }, [value]);

  const shareWhatsApp = useCallback(() => {
    const text = tableName
      ? `Scannez ce QR code pour commander chez ${restaurantName} (${tableName}) : ${value}`
      : `Découvrez ${restaurantName} sur Restafy : ${value}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }, [value, restaurantName, tableName]);

  const shareNative = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${restaurantName} — Menu`,
          text: tableName
            ? `Scannez pour commander chez ${restaurantName} (${tableName})`
            : `Découvrez ${restaurantName} sur Restafy`,
          url: value,
        });
      } catch { /* user cancelled */ }
    }
  }, [value, restaurantName, tableName]);

  const lightenColor = (hex: string, percent: number) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + Math.round(255 * percent));
    const g = Math.min(255, ((num >> 8) & 0x00ff) + Math.round(255 * percent));
    const b = Math.min(255, (num & 0x0000ff) + Math.round(255 * percent));
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className="flex flex-col items-center gap-5">
      {/* QR Card */}
      <div
        ref={containerRef}
        className="relative p-6 rounded-3xl"
        style={{
          background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}08, transparent)`,
          border: `2px solid ${accentColor}25`,
        }}
      >
        {/* Inner card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm relative overflow-hidden">
          {/* Decorative corner patterns */}
          <div
            className="absolute top-0 left-0 w-16 h-16 opacity-[0.06]"
            style={{
              background: `radial-gradient(circle at 0% 0%, ${accentColor}, transparent 70%)`,
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-16 h-16 opacity-[0.06]"
            style={{
              background: `radial-gradient(circle at 100% 100%, ${accentColor}, transparent 70%)`,
            }}
          />

          {/* QR Code */}
          <div className="relative">
            <QRCodeSVG
              value={value}
              size={size}
              level="H"
              includeMargin={false}
              bgColor="transparent"
              fgColor="#1a1a1a"
              imageSettings={{
                src: '',
                height: 0,
                width: 0,
                excavate: true,
              }}
              style={{
                borderRadius: 8,
              }}
            />

            {/* Center logo overlay */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ pointerEvents: 'none' }}
            >
              <div
                className="flex items-center justify-center rounded-xl shadow-lg"
                style={{
                  width: size * 0.22,
                  height: size * 0.22,
                  background: `linear-gradient(135deg, ${accentColor}, ${lightenColor(accentColor, 0.15)})`,
                }}
              >
                <ForkKnife
                  size={size * 0.12}
                  weight="fill"
                  color="#fff"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Restaurant name */}
        <div className="mt-4 text-center">
          <p
            className="text-sm font-bold font-['Sora',sans-serif] truncate max-w-[220px]"
            style={{ color: accentColor }}
          >
            {restaurantName}
          </p>
          {tableName && (
            <p className="text-[11px] font-medium text-zinc-500 mt-0.5">
              {tableName}
            </p>
          )}
          <div className="flex items-center justify-center gap-1 mt-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
              Powered by
            </span>
            <span
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: accentColor }}
            >
              Restafy
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-[260px]">
        <button
          type="button"
          onClick={downloadAsPng}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.97]"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, ${lightenColor(accentColor, 0.1)})`,
            boxShadow: `0 4px 14px ${accentColor}30`,
          }}
        >
          <Download size={15} weight="bold" />
          Télécharger
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-[0.97]"
          style={{
            borderColor: `${accentColor}30`,
            color: accentColor,
          }}
        >
          <Copy size={15} weight="bold" />
          Copier le lien
        </button>
      </div>

      {/* Share buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={shareWhatsApp}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 transition-all active:scale-[0.97]"
        >
          <WhatsappLogo size={16} weight="fill" />
          WhatsApp
        </button>
        {typeof navigator.share === 'function' && (
          <button
            type="button"
            onClick={shareNative}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 transition-all active:scale-[0.97]"
          >
            <ShareNetwork size={16} weight="bold" />
            Partager
          </button>
        )}
      </div>
    </div>
  );
}
