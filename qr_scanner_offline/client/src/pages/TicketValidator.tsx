/**
 * /validator — Page de scan de billets événement (scan.restafy.shop).
 *
 * Auth   : token (URL ?token=…) + PIN (team_scan_tokens). Même schéma que /team.
 * Online : POST https://app.restafy.shop/api/team-scan?action=validate-ticket → RPC atomique.
 * Offline: fallback localStorage + queue → flush automatique dès le retour réseau.
 *
 * Simplifié : pas de sélection d'événement (l'API détecte l'event depuis le QR).
 * La caméra démarre automatiquement après le login.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle,
  ChefHat,
  Clock,
  Loader2,
  Lock,
  LogOut,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type Session = {
  token: string;
  pin: string;
  memberName: string;
  memberRole: string;
  restaurantId: string;
  restaurantName: string | null;
};

type ValidationResult = {
  /**
   * - `valid` / `used` / `invalid` / `expired`: réponse du serveur (en ligne) ou
   *   réponse synthétique après flush du queue offline.
   * - `pending`: scan enregistré hors-ligne, en file d'attente, pas encore validé
   *   par le serveur. Sera flushé au retour réseau.
   * - `error`: problème technique (pas de session, code vide, erreur réseau
   *   non-récupérable).
   */
  status: 'valid' | 'used' | 'invalid' | 'expired' | 'pending' | 'error';
  reason: string;
  ticket?: {
    id?: string;
    ticket_number?: string;
    customer_name?: string;
    event_name?: string;
    ticket_type?: string;
    scanned_at?: string;
    scanned_by?: string;
    scan_location?: string;
    payment_status?: string;
    event_start_at?: string;
  };
  source: 'server' | 'offline';
};

type QueuedScan = {
  code: string;
  scanned_at: string;
  location?: string | null;
};

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const APP_API_BASE = (
  (import.meta.env.VITE_RESTAFY_APP_URL as string | undefined) || 'https://app.restafy.shop'
).replace(/\/$/, '');

const STORAGE = {
  session: 'restafy-validator-session-v1',
  // localStorage (pas sessionStorage) pour survivre au reload café
  // ou à un crash navigateur.
  queue: 'restafy-validator-offline-queue-v1',
} as const;

const QUEUE_MAX = 200; // même limite que /api/team-scan?action=sync-tickets
const FLUSH_BATCH = 50;

const TEAM_SESSION_KEY = 'restafy-scan-team-session-v1';

const SCAN_REGION_ID = 'qr-scanner-region';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function readJson<T>(key: string, storage: Storage = localStorage): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T | null, storage: Storage = localStorage) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota
  }
}

async function postJson<T>(path: string, body: Record<string, unknown>, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(`${APP_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    return payload as T;
  } finally {
    window.clearTimeout(t);
  }
}

function normalizeCode(raw: string): string {
  let s = raw.replace(/\u200b|\u200c|\u200d|\ufeff/g, '').trim();
  s = s.replace(/^["'«»]+|["'«»]+$/g, '').trim();
  const lines = s.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  s = lines[0] ?? s;
  try {
    if (/^https?:\/\//i.test(s)) {
      const url = new URL(s.split(/\s+/)[0]);
      const fromQuery = url.searchParams.get('q') || url.searchParams.get('code') || url.searchParams.get('ticket') || url.searchParams.get('t');
      if (fromQuery) return normalizeCode(fromQuery);
      const seg = url.pathname.split('/').filter(Boolean).pop();
      if (seg && (/^RESTAFY-/i.test(seg) || /^TKT-/i.test(seg))) return normalizeCode(seg);
    }
  } catch { /* not a URL */ }
  if (/^RESTAFY-/i.test(s)) return s.replace(/\s+/g, '').toUpperCase();
  if (/^TKT-/i.test(s)) return s.replace(/\s+/g, '').toUpperCase();
  return s.trim();
}

// Audio feedback
function beep(freq: number, duration: number) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch { /* ignore */ }
}

function feedback(status: ValidationResult['status']) {
  if (status === 'valid') beep(880, 0.15);
  else if (status === 'used') beep(360, 0.35);
  else if (status === 'pending') beep(540, 0.18);
  else beep(200, 0.4);
  try { navigator.vibrate?.(status === 'valid' ? [50] : [80, 40, 80]); } catch { /* ignore */ }
}

// ────────────────────────────────────────────────────────────────────────────
// Offline queue helpers (localStorage)
//
// Le queue n'est PAS un substitut à la validation serveur: tant qu'un scan
// n'est pas flushé il reste "pending" et on ne peut pas garantir qu'il est
// valide ou non (paiement, doublon, billet annulé). Le portier doit savoir
// que c'est un scan différé. Au retour réseau on POST /api/team-scan?action=
// sync-tickets et on recolle les vrais statuts.
// ────────────────────────────────────────────────────────────────────────────

function readQueue(): QueuedScan[] {
  return readJson<QueuedScan[]>(STORAGE.queue, localStorage) ?? [];
}
function writeQueue(q: QueuedScan[]) {
  writeJson(STORAGE.queue, q, localStorage);
}
function enqueueScan(item: QueuedScan): { ok: boolean; size: number } {
  const q = readQueue();
  if (q.length >= QUEUE_MAX) return { ok: false, size: q.length };
  // dédoublonnage minimum : si le même code est déjà en file, on garde
  // l'original (premier scan) plutôt que d'ajouter un doublon.
  if (q.some((s) => s.code === item.code)) return { ok: true, size: q.length };
  const next = [...q, item];
  writeQueue(next);
  return { ok: true, size: next.length };
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export default function TicketValidator() {
  const urlToken = useMemo(
    () => new URLSearchParams(window.location.search).get('token') || '',
    []
  );

  // Auth state
  const [session, setSession] = useState<Session | null>(null);
  const [pin, setPin] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Scanner state
  const [useCameraScan, setUseCameraScan] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'loading' | 'ready' | 'error' | 'permission'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [lastResult, setLastResult] = useState<ValidationResult | null>(null);
  const [history, setHistory] = useState<ValidationResult[]>([]);
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [queueSize, setQueueSize] = useState<number>(() => readQueue().length);
  const [flushing, setFlushing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastCodeRef = useRef<string>('');
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Bootstrap session from storage ────────────────────────────────────
  useEffect(() => {
    const stored = readJson<Session>(STORAGE.session, sessionStorage);
    if (stored && stored.token === urlToken) setSession(stored);
  }, [urlToken]);

  // ─── Online/offline ────────────────────────────────────────────────────
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // ─── Auth ──────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.replace(/\D/g, '');
    if (!urlToken) return setAuthError('Lien invalide (token manquant)');
    if (cleanPin.length < 4) return setAuthError('PIN invalide (4 chiffres)');

    setAuthLoading(true);
    setAuthError(null);
    try {
      const payload = await postJson<{
        success: true;
        member: { name: string; role: string };
        restaurant: { id: string; name: string | null };
      }>('/api/team-scan?action=auth', { token: urlToken, pin: cleanPin });

      const next: Session = {
        token: urlToken,
        pin: cleanPin,
        memberName: payload.member.name,
        memberRole: payload.member.role,
        restaurantId: payload.restaurant.id,
        restaurantName: payload.restaurant.name,
      };
      writeJson(STORAGE.session, next, sessionStorage);
      setSession(next);
      setPin('');
      setUseCameraScan(true); // auto-start camera after login
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentification refusée');
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = useCallback(() => {
    writeJson(STORAGE.session, null, sessionStorage);
    setSession(null);
    stopScanner();
  }, []);

  const goToTeamScanner = useCallback((s: Session) => {
    try {
      sessionStorage.setItem(TEAM_SESSION_KEY, JSON.stringify({
        token: s.token,
        pin: s.pin,
        memberName: s.memberName,
        memberRole: s.memberRole,
        restaurantId: s.restaurantId,
        restaurantName: s.restaurantName,
        canUpdateOrderStatus: true,
        canCancelOrder: false,
      }));
    } catch { /* ignore */ }
    window.location.href = `/team?token=${encodeURIComponent(s.token)}`;
  }, []);

  // ─── Validation ────────────────────────────────────────────────────────
  const validate = useCallback(
    async (rawCode: string): Promise<ValidationResult> => {
      const code = normalizeCode(rawCode);
      if (!code) return { status: 'invalid', reason: 'empty', source: 'offline' };
      if (!session) return { status: 'error', reason: 'no_session', source: 'offline' };

      // Hors-ligne: enfile + répond `pending`. Le scan sera validé côté serveur
      // au retour réseau via flushQueue().
      if (!online) {
        const { ok, size } = enqueueScan({
          code,
          scanned_at: new Date().toISOString(),
          location: 'Offline',
        });
        setQueueSize(size);
        return {
          status: ok ? 'pending' : 'error',
          reason: ok ? 'queued_offline' : 'queue_full',
          ticket: { ticket_number: code },
          source: 'offline',
        };
      }

      try {
        const payload = await postJson<{
          status: ValidationResult['status'];
          reason: string;
          ticket?: ValidationResult['ticket'];
        }>('/api/team-scan?action=validate-ticket', {
          token: session.token,
          pin: session.pin,
          code,
        });
        return { ...payload, source: 'server' };
      } catch (err) {
        // Erreur réseau alors que navigator.onLine était true: on enfile aussi
        // pour ne pas perdre le scan, le flush retentera plus tard.
        const { ok, size } = enqueueScan({
          code,
          scanned_at: new Date().toISOString(),
          location: 'Offline',
        });
        setQueueSize(size);
        return {
          status: ok ? 'pending' : 'error',
          reason: ok ? 'queued_after_network_error' : (err instanceof Error ? err.message : 'network_error'),
          ticket: { ticket_number: code },
          source: 'offline',
        };
      }
    },
    [session, online]
  );

  // ─── Flush du queue offline ────────────────────────────────────────────
  const flushQueue = useCallback(async () => {
    if (!session || flushing) return;
    const q = readQueue();
    if (q.length === 0) return;
    setFlushing(true);
    try {
      // On envoie par lots (FLUSH_BATCH) au cas où le queue dépasse la limite
      // serveur et pour limiter la durée d'un appel sur connexion lente.
      const batches: QueuedScan[][] = [];
      for (let i = 0; i < q.length; i += FLUSH_BATCH) batches.push(q.slice(i, i + FLUSH_BATCH));

      let validated = 0;
      let alreadyUsed = 0;
      let invalid = 0;
      const synced = new Set<string>();

      for (const batch of batches) {
        try {
          const payload = await postJson<{
            synced: number;
            total: number;
            results: Array<{ code: string; status: string; reason: string }>;
          }>('/api/team-scan?action=sync-tickets', {
            token: session.token,
            pin: session.pin,
            scans: batch.map((s) => ({
              code: s.code,
              scanned_at: s.scanned_at,
              location: s.location,
            })),
          });
          for (const r of payload.results || []) {
            synced.add(r.code);
            if (r.status === 'valid') validated += 1;
            else if (r.status === 'used') alreadyUsed += 1;
            else if (r.status === 'invalid' || r.status === 'expired') invalid += 1;
          }
        } catch {
          // garde le batch en file, retentera la prochaine fois
          break;
        }
      }

      // Retire seulement les scans confirmés par le serveur
      const remaining = q.filter((s) => !synced.has(s.code));
      writeQueue(remaining);
      setQueueSize(remaining.length);

      if (validated || alreadyUsed || invalid) {
        const parts: string[] = [];
        if (validated) parts.push(`${validated} validé${validated > 1 ? 's' : ''}`);
        if (alreadyUsed) parts.push(`${alreadyUsed} déjà utilisé${alreadyUsed > 1 ? 's' : ''}`);
        if (invalid) parts.push(`${invalid} invalide${invalid > 1 ? 's' : ''}`);
        toast.success(`Sync hors-ligne: ${parts.join(' · ')}`);
      }
    } finally {
      setFlushing(false);
    }
  }, [session, flushing]);

  // Auto-flush au retour réseau + retry périodique tant que le queue n'est pas vide
  useEffect(() => {
    if (!session || !online || queueSize === 0) return;
    void flushQueue();
    const t = window.setInterval(() => {
      if (navigator.onLine && readQueue().length > 0) void flushQueue();
    }, 30_000);
    return () => window.clearInterval(t);
  }, [session, online, queueSize, flushQueue]);

  const submit = useCallback(
    async (rawCode: string) => {
      const code = normalizeCode(rawCode);
      if (!code || submittingRef.current) return;
      if (code === lastCodeRef.current) return;
      lastCodeRef.current = code;
      submittingRef.current = true;
      setSubmitting(true);
      try {
        const result = await validate(code);
        setLastResult(result);
        setHistory((h) => [result, ...h].slice(0, 10));
        feedback(result.status);
        if (result.status === 'valid')
          toast.success(`${result.ticket?.customer_name || 'Billet'} — entrée validée`);
        else if (result.status === 'used') {
          const scannedAt = result.ticket?.scanned_at
            ? new Date(result.ticket.scanned_at).toLocaleString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
              })
            : null;
          const scannedBy = result.ticket?.scanned_by || null;
          const detail =
            scannedAt && scannedBy
              ? `Déjà scanné le ${scannedAt} par ${scannedBy}`
              : scannedAt
              ? `Déjà scanné le ${scannedAt}`
              : scannedBy
              ? `Déjà scanné par ${scannedBy}`
              : 'Billet déjà utilisé — ouvre le panneau Dernier scan pour voir quand';
          toast.warning(detail, { duration: 5000 });
        } else if (result.status === 'expired')
          toast.error('Billet expiré');
        else
          toast.error('Billet invalide');
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
        if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = setTimeout(() => {
          if (lastCodeRef.current === code) lastCodeRef.current = '';
          cooldownTimerRef.current = null;
        }, 5000);
      }
    },
    [validate]
  );

  // ─── Camera lifecycle ──────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    setCameraStatus('loading');
    setCameraError(null);

    // Request camera permission explicitly before starting the scanner
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError');
      setCameraStatus(denied ? 'permission' : 'error');
      setCameraError(
        denied
          ? "Vous devez autoriser l'accès à la caméra pour scanner les billets. Cliquez sur l'icône 🔒 dans la barre d'adresse, autorisez la caméra, puis rechargez la page."
          : "Caméra indisponible sur cet appareil. Utilisez la saisie manuelle du code."
      );
      return;
    }

    try {
      const html5QrCode = new Html5Qrcode(SCAN_REGION_ID, { verbose: false });

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
        (decodedText) => {
          void submit(decodedText);
        },
        () => { /* ignore per-frame errors */ }
      );
      scannerRef.current = html5QrCode;
      setCameraStatus('ready');
    } catch (e) {
      setCameraStatus('error');
      setCameraError(
        e instanceof Error ? e.message : "Caméra indisponible. Autorisez l'accès ou saisissez le code manuellement."
      );
    }
  }, [submit]);

  const stopScanner = useCallback(() => {
    const inst = scannerRef.current;
    scannerRef.current = null;
    if (inst) {
      try {
        void inst.stop().then(() => { try { inst.clear(); } catch { /* noop */ } }).catch(() => {});
      } catch { /* stop() may throw synchronously if scanner was never started */ }
    }
    setCameraStatus('idle');
  }, []);

  // Start/stop camera when toggle changes
  useEffect(() => {
    if (useCameraScan && session) {
      void startScanner();
    } else {
      stopScanner();
    }
    return () => { stopScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCameraScan, session]);

  // Cleanup on unmount
  useEffect(() => () => { stopScanner(); }, [stopScanner]);

  // ─── Render: no token ──────────────────────────────────────────────────
  if (!urlToken) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Lien invalide</h2>
          <p className="text-sm text-slate-500 mb-6">
            Demandez à votre restaurant un nouveau lien de scan (token + PIN).
          </p>
          <a href="/" className="px-6 py-3 bg-orange-500 text-white rounded-xl inline-block font-bold">
            Retour
          </a>
        </div>
      </div>
    );
  }

  // ─── Render: PIN login ─────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full"
        >
          <div className="flex justify-center mb-4">
            <div className="bg-orange-500 text-white p-3 rounded-xl">
              <Lock className="w-6 h-6" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 text-center mb-1">
            Scanner de billets
          </h1>
          <p className="text-sm text-slate-500 text-center mb-6">
            Entrez votre PIN fourni par le restaurant.
          </p>
          <input
            type="tel"
            inputMode="numeric"
            autoFocus
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full px-4 py-3 text-center text-2xl tracking-[0.4em] border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500"
            placeholder="••••"
            aria-label="Code PIN"
          />
          {authError && (
            <p className="text-sm text-red-600 mt-3 text-center" role="alert">
              {authError}
            </p>
          )}
          <button
            type="submit"
            disabled={authLoading}
            className="mt-5 w-full bg-orange-500 active:bg-orange-600 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[48px]"
          >
            {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
            Se connecter
          </button>
        </form>
      </div>
    );
  }

  // ─── Render: main scanner UI ───────────────────────────────────────────
  const badgeColor = (status?: ValidationResult['status']) => {
    switch (status) {
      case 'valid': return 'bg-green-100 text-green-700 border-green-300';
      case 'used': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'pending': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'expired': return 'bg-slate-100 text-slate-600 border-slate-300';
      case 'invalid': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-slate-100 text-slate-600 border-slate-300';
    }
  };
  const badgeLabel = (status?: ValidationResult['status']) => {
    switch (status) {
      case 'valid': return 'Entrée validée';
      case 'used': return 'Déjà utilisé';
      case 'pending': return 'En attente de sync';
      case 'expired': return 'Expiré';
      case 'invalid': return 'Invalide';
      default: return 'Erreur';
    }
  };
  const badgeIcon = (status?: ValidationResult['status']) => {
    switch (status) {
      case 'valid': return <CheckCircle className="w-5 h-5" />;
      case 'used': return <Clock className="w-5 h-5" />;
      case 'pending': return <WifiOff className="w-5 h-5" />;
      case 'expired': return <Clock className="w-5 h-5" />;
      default: return <XCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">
              Scanner de billets
            </h1>
            <p className="text-xs text-slate-500 truncate">
              {session.memberName} · {session.restaurantName || 'Restaurant'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {queueSize > 0 && (
              <span
                className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded-full border border-orange-200"
                title={flushing ? 'Synchronisation en cours…' : 'Scans en attente de sync'}
              >
                {flushing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                {queueSize} en file
              </span>
            )}
            {!online && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                <WifiOff className="w-3 h-3" /> Hors-ligne
              </span>
            )}
            <button
              onClick={() => goToTeamScanner(session)}
              className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 active:text-orange-600 active:bg-slate-100 rounded-lg"
              title="Voir les commandes"
            >
              <ChefHat className="w-5 h-5" />
            </button>
            <button
              onClick={logout}
              className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 active:text-red-600 active:bg-slate-100 rounded-lg"
              title="Se déconnecter"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4 pb-8" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px))' }}>
        {/* Scanner card */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-orange-500" /> Valider une entrée
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Utilisez la caméra ou collez le texte du QR (<span className="font-mono">RESTAFY-…</span>) ou le numéro{' '}
            <code className="bg-slate-100 px-1 rounded text-xs">TKT-…</code>.
          </p>

          {/* Camera toggle */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => setUseCameraScan((v) => !v)}
            className="w-full py-3.5 text-sm font-bold rounded-xl border-2 border-orange-200 text-orange-700 bg-orange-50 active:bg-orange-100 disabled:opacity-50 min-h-[48px]"
          >
            {useCameraScan ? 'Masquer la caméra' : 'Scanner avec la caméra'}
          </button>

          {/* Camera view */}
          {useCameraScan && (
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-black">
              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 text-white text-xs font-bold">
                {cameraStatus === 'error' || cameraStatus === 'permission' ? (
                  <CameraOff className="w-4 h-4 text-amber-400" />
                ) : cameraStatus === 'ready' ? (
                  <Camera className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                )}
                <span>
                  {cameraStatus === 'loading' && 'Démarrage de la caméra…'}
                  {cameraStatus === 'ready' && 'Pointez vers le QR du billet'}
                  {cameraStatus === 'permission' && 'Accès caméra requis'}
                  {cameraStatus === 'error' && 'Caméra non disponible'}
                  {cameraStatus === 'idle' && 'Préparation…'}
                </span>
              </div>
              <div id={SCAN_REGION_ID} className="w-full min-h-[240px]" />
              {cameraError && (
                <p className="text-xs text-amber-200 bg-zinc-900 px-3 py-2 border-t border-zinc-800">
                  {cameraError}
                </p>
              )}
            </div>
          )}

          {/* Manual input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(manualCode);
              setManualCode('');
            }}
            className="space-y-3"
          >
            <textarea
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Coller le code ici si besoin…"
              rows={2}
              className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-orange-500 resize-none"
            />
            <button
              type="submit"
              disabled={!manualCode.trim() || submitting}
              className="w-full py-3.5 bg-orange-500 active:bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors min-h-[48px]"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Valider
            </button>
          </form>
        </div>

        {/* Last result */}
        {lastResult && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Dernier scan</h3>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-bold rounded-full border ${badgeColor(lastResult.status)}`}
            >
              {badgeIcon(lastResult.status)}
              {badgeLabel(lastResult.status)}
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              {lastResult.ticket?.customer_name && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Client</dt>
                  <dd className="text-slate-900 font-medium">{lastResult.ticket.customer_name}</dd>
                </div>
              )}
              {lastResult.ticket?.ticket_number && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">N°</dt>
                  <dd className="font-mono text-slate-900">{lastResult.ticket.ticket_number}</dd>
                </div>
              )}
              {lastResult.ticket?.event_name && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Événement</dt>
                  <dd className="text-slate-900">{lastResult.ticket.event_name}</dd>
                </div>
              )}
              {lastResult.ticket?.ticket_type && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Type</dt>
                  <dd className="text-slate-900">{lastResult.ticket.ticket_type}</dd>
                </div>
              )}
              {lastResult.ticket?.scanned_by && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Scanné par</dt>
                  <dd className="text-slate-900">{lastResult.ticket.scanned_by}</dd>
                </div>
              )}
              {lastResult.ticket?.scanned_at && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">À</dt>
                  <dd className="text-slate-900">
                    {new Date(lastResult.ticket.scanned_at).toLocaleString('fr-FR')}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* History */}
        {history.length > 1 && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Historique</h3>
            <ul className="divide-y divide-slate-100">
              {history.slice(1).map((h, i) => (
                <li key={i} className="py-2 flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${badgeColor(h.status)}`}>
                      {badgeIcon(h.status)}
                      {badgeLabel(h.status)}
                    </span>
                    <span className="text-slate-700 truncate max-w-[160px]">
                      {h.ticket?.customer_name || h.ticket?.ticket_number || '—'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
