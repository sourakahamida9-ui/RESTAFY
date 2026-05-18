import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Camera, CameraSlash, ArrowLeft } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

type ScanStatus = 'idle' | 'loading' | 'ready' | 'error' | 'success';

export default function Scan() {
  const navigate = useNavigate();
  const readerId = useMemo(() => `scan-${Math.random().toString(36).slice(2, 11)}`, []);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const instanceRef = useRef<{ stop: () => Promise<unknown>; clear: () => void } | null>(null);

  const handleDecoded = useCallback(
    (text: string) => {
      setStatus('success');
      try { navigator.vibrate?.(50); } catch { /* unsupported */ }

      // Parse QR: could be full URL like https://app.restafy.shop/r/slug or /r/slug
      let path = text;
      try {
        const url = new URL(text);
        path = url.pathname;
      } catch {
        // Already a relative path or slug
      }

      // Navigate to the restaurant page
      if (path.startsWith('/r/') || path.startsWith('/restaurant/')) {
        setTimeout(() => navigate(path), 300);
      } else if (!path.startsWith('/')) {
        // Assume it's a slug
        setTimeout(() => navigate(`/r/${path}`), 300);
      } else {
        setTimeout(() => navigate(path), 300);
      }
    },
    [navigate],
  );

  const handleDecodedRef = useRef(handleDecoded);
  handleDecodedRef.current = handleDecoded;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setStatus('loading');
      setErrorMsg(null);
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        const html5QrCode = new Html5Qrcode(readerId, { verbose: false });

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 280 },
            aspectRatio: 1,
          },
          (decodedText) => {
            void html5QrCode.stop().then(() => {
              try { html5QrCode.clear(); } catch { /* already cleared */ }
            }).catch(() => {});
            instanceRef.current = null;
            handleDecodedRef.current(decodedText);
          },
          () => {},
        );

        instanceRef.current = html5QrCode;
        if (!cancelled) setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(
          e instanceof Error
            ? e.message
            : "Caméra indisponible. Autorisez l'accès à la caméra dans les paramètres de votre navigateur.",
        );
      }
    };

    void run();

    return () => {
      cancelled = true;
      const inst = instanceRef.current;
      instanceRef.current = null;
      if (inst) {
        try {
          void inst.stop().then(() => {
            try { inst.clear(); } catch { /* noop */ }
          }).catch(() => {});
        } catch { /* scanner was never started */ }
      }
    };
  }, [readerId]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
      {/* Header */}
      <div className="w-full max-w-sm mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
        >
          <ArrowLeft size={18} weight="bold" />
          Retour
        </button>
        <h1 className="text-2xl font-bold font-['Sora',sans-serif] text-zinc-900">
          Scanner un QR code
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Pointez vers le QR code sur votre table pour accéder au menu et commander.
        </p>
      </div>

      {/* Scanner Area */}
      <div className="w-full max-w-sm">
        <div className="relative rounded-3xl overflow-hidden bg-zinc-950 shadow-2xl">
          {/* Status bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900/90">
            <AnimatePresence mode="wait">
              {status === 'loading' && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  <span className="text-xs font-medium text-zinc-300">
                    Démarrage de la caméra…
                  </span>
                </motion.div>
              )}
              {status === 'ready' && (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <Camera size={16} weight="fill" className="text-emerald-400" />
                  <span className="text-xs font-medium text-zinc-300">
                    Scannez le QR code de votre table
                  </span>
                </motion.div>
              )}
              {status === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400">
                    QR détecté ! Redirection…
                  </span>
                </motion.div>
              )}
              {status === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <CameraSlash size={16} weight="fill" className="text-amber-400" />
                  <span className="text-xs font-medium text-amber-300">
                    Caméra non disponible
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Camera viewfinder */}
          <div className="relative">
            <div id={readerId} className="w-full min-h-[320px]" />

            {/* Corner overlays for premium feel */}
            {status === 'ready' && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Top-left corner */}
                <div className="absolute top-6 left-6 w-10 h-10 border-t-3 border-l-3 border-[#FF5C00] rounded-tl-xl" style={{ borderWidth: '3px 0 0 3px' }} />
                {/* Top-right corner */}
                <div className="absolute top-6 right-6 w-10 h-10 border-t-3 border-r-3 border-[#FF5C00] rounded-tr-xl" style={{ borderWidth: '3px 3px 0 0' }} />
                {/* Bottom-left corner */}
                <div className="absolute bottom-6 left-6 w-10 h-10 border-b-3 border-l-3 border-[#FF5C00] rounded-bl-xl" style={{ borderWidth: '0 0 3px 3px' }} />
                {/* Bottom-right corner */}
                <div className="absolute bottom-6 right-6 w-10 h-10 border-b-3 border-r-3 border-[#FF5C00] rounded-br-xl" style={{ borderWidth: '0 3px 3px 0' }} />

                {/* Scan line animation */}
                <motion.div
                  className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-[#FF5C00] to-transparent opacity-60"
                  initial={{ top: '15%' }}
                  animate={{ top: ['15%', '85%', '15%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            )}
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-800">
              <p className="text-xs text-amber-200">{errorMsg}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 text-xs font-bold text-[#FF5C00] hover:underline"
              >
                Réessayer
              </button>
            </div>
          )}
        </div>

        {/* Help text below scanner */}
        <div className="mt-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-zinc-400">
            <QrCode size={20} weight="duotone" />
            <span className="text-xs">
              Chaque table a un QR code unique
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed max-w-[280px] mx-auto">
            Scannez le code QR posé sur votre table pour voir le menu du restaurant et passer votre commande directement depuis votre téléphone.
          </p>
        </div>
      </div>
    </div>
  );
}
