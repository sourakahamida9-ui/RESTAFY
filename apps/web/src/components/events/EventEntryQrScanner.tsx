import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2 } from 'lucide-react';

type Props = {
  onDecoded: (text: string) => void;
  disabled?: boolean;
};

/**
 * Scanner QR caméra (html5-qrcode), chargé dynamiquement.
 */
export function EventEntryQrScanner({ onDecoded, disabled }: Props) {
  const readerId = useMemo(() => `ev-scan-${Math.random().toString(36).slice(2, 11)}`, []);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const instanceRef = useRef<{ stop: () => Promise<unknown>; clear: () => void } | null>(null);
  const onDecodedRef = useRef(onDecoded);
  onDecodedRef.current = onDecoded;

  useEffect(() => {
    if (disabled) return;

    let cancelled = false;
    const readerElId = readerId;

    const run = async () => {
      setStatus('loading');
      setErrorMsg(null);
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        const html5QrCode = new Html5Qrcode(readerElId, { verbose: false });
        instanceRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 8,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1,
          },
          (decodedText) => {
            void html5QrCode
              .stop()
              .then(() => {
                try {
                  html5QrCode.clear();
                } catch {
                  /* déjà nettoyé */
                }
              })
              .catch(() => {});
            instanceRef.current = null;
            onDecodedRef.current(decodedText);
          },
          () => {},
        );

        if (!cancelled) setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(
          e instanceof Error
            ? e.message
            : 'Caméra indisponible. Autorisez l’accès ou saisissez le code manuellement.',
        );
      }
    };

    void run();

    return () => {
      cancelled = true;
      const inst = instanceRef.current;
      instanceRef.current = null;
      if (inst) {
        void inst
          .stop()
          .then(() => {
            try {
              inst.clear();
            } catch {
              /* noop */
            }
          })
          .catch(() => {});
      }
    };
  }, [disabled, readerId]);

  if (disabled) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-black">
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 text-white text-xs font-bold">
        {status === 'error' ? (
          <CameraOff className="w-4 h-4 text-amber-400" />
        ) : status === 'ready' ? (
          <Camera className="w-4 h-4 text-emerald-400" />
        ) : (
          <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
        )}
        <span>
          {status === 'loading' && 'Démarrage de la caméra…'}
          {status === 'ready' && 'Pointez vers le QR du billet'}
          {status === 'error' && 'Caméra non disponible'}
          {status === 'idle' && 'Préparation…'}
        </span>
      </div>
      <div id={readerId} className="w-full min-h-[240px]" />
      {errorMsg && (
        <p className="text-xs text-amber-200 bg-zinc-900 px-3 py-2 border-t border-zinc-800">{errorMsg}</p>
      )}
    </div>
  );
}
