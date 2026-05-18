/**
 * /login — "Connexion locale"
 *
 * Permet à un membre d'équipe (agent) de se connecter en saisissant
 * manuellement le **token d'équipe** et le **PIN** que son restaurateur lui
 * a fournis (utile quand le QR de partage n'est pas accessible, par
 * exemple en mode hors-ligne ou sur un autre appareil).
 *
 * Auth   : POST {APP_API_BASE}/api/team-scan?action=auth — c'est exactement
 *          le même endpoint que /team et /validator, donc pas de double
 *          source de vérité ni de comptes "agents" séparés.
 * Après auth : on pré-remplit les deux sessions (team + validator) puis on
 *              affiche un hub où l'utilisateur choisit Commandes ou Billets.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChefHat, Loader2, Lock, Shield, Ticket as TicketIcon, Wifi, WifiOff } from 'lucide-react';

const APP_API_BASE = (
  (import.meta.env.VITE_RESTAFY_APP_URL as string | undefined) || 'https://app.restafy.shop'
).replace(/\/$/, '');

const TEAM_SESSION_KEY = 'restafy-scan-team-session-v1';
const VALIDATOR_SESSION_KEY = 'restafy-validator-session-v1';

type AuthOk = {
  success: true;
  member: { name: string; role: string };
  restaurant: { id: string; name: string | null };
  capabilities?: { canUpdateOrderStatus: boolean; canCancelOrder: boolean };
};

type AuthSession = {
  token: string;
  pin: string;
  memberName: string;
  memberRole: string;
  restaurantId: string;
  restaurantName: string | null;
};

async function postJson<T>(path: string, body: Record<string, unknown>, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(`${APP_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Erreur ${response.status}`);
    }
    return payload as T;
  } finally {
    window.clearTimeout(timer);
  }
}

function persistSessions(s: AuthSession, caps: { canUpdateOrderStatus: boolean; canCancelOrder: boolean }) {
  const teamSession = {
    token: s.token,
    pin: s.pin,
    memberName: s.memberName,
    memberRole: s.memberRole,
    restaurantId: s.restaurantId,
    restaurantName: s.restaurantName,
    canUpdateOrderStatus: caps.canUpdateOrderStatus,
    canCancelOrder: caps.canCancelOrder,
  };
  const validatorSession = {
    token: s.token,
    pin: s.pin,
    memberName: s.memberName,
    memberRole: s.memberRole,
    restaurantId: s.restaurantId,
    restaurantName: s.restaurantName,
  };
  try {
    sessionStorage.setItem(TEAM_SESSION_KEY, JSON.stringify(teamSession));
    sessionStorage.setItem(VALIDATOR_SESSION_KEY, JSON.stringify(validatorSession));
  } catch {
    // ignore quota / privacy-mode
  }
}

export default function AgentLogin() {
  // Pre-fill from URL ?token= if user came via a deep link
  const initialToken = useMemo(
    () => new URLSearchParams(window.location.search).get('token') || '',
    []
  );

  const [token, setToken] = useState(initialToken);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState<{ s: AuthSession } | null>(null);
  const [online, setOnline] = useState<boolean>(navigator.onLine);

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

  const handlePasteToken = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setToken(text.trim());
    } catch {
      // clipboard blocked, ignore
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanToken = token.trim();
    const cleanPin = pin.replace(/\D/g, '');
    if (!cleanToken) return setError('Token équipe manquant');
    if (cleanPin.length < 4) return setError('PIN invalide (4 chiffres)');

    setLoading(true);
    try {
      const payload = await postJson<AuthOk>('/api/team-scan?action=auth', {
        token: cleanToken,
        pin: cleanPin,
      });
      const s: AuthSession = {
        token: cleanToken,
        pin: cleanPin,
        memberName: payload.member.name,
        memberRole: payload.member.role,
        restaurantId: payload.restaurant.id,
        restaurantName: payload.restaurant.name,
      };
      persistSessions(s, payload.capabilities || { canUpdateOrderStatus: true, canCancelOrder: false });
      setAuthed({ s });
      setPin('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  if (authed) {
    const { s } = authed;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center text-white">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl shadow-xl mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Bienvenue, {s.memberName}</h1>
            <p className="text-sm text-blue-200 mt-1">
              {s.restaurantName || 'Restaurant'} · {s.memberRole}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <a
              href={`/team?token=${encodeURIComponent(s.token)}`}
              className="flex items-center justify-between gap-3 rounded-2xl bg-orange-500 px-5 py-4 text-white font-bold shadow-lg hover:bg-orange-600 transition-colors"
            >
              <span className="flex items-center gap-3">
                <ChefHat className="w-6 h-6" />
                Commandes (cuisine / livraison)
              </span>
              <span aria-hidden>→</span>
            </a>
            <a
              href={`/validator?token=${encodeURIComponent(s.token)}`}
              className="flex items-center justify-between gap-3 rounded-2xl bg-blue-500 px-5 py-4 text-white font-bold shadow-lg hover:bg-blue-600 transition-colors"
            >
              <span className="flex items-center gap-3">
                <TicketIcon className="w-6 h-6" />
                Scanner les billets d'événement
              </span>
              <span aria-hidden>→</span>
            </a>
          </div>

          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.removeItem(TEAM_SESSION_KEY);
                sessionStorage.removeItem(VALIDATOR_SESSION_KEY);
              } catch {
                // ignore
              }
              setAuthed(null);
              setToken('');
            }}
            className="w-full text-sm text-blue-200 hover:text-white"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-xl mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Connexion locale</h1>
          <p className="text-blue-200 text-sm">
            Saisissez le token équipe et le PIN fournis par votre restaurateur.
          </p>
          <span
            className={`inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full text-xs ${
              online
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {online ? 'En ligne' : 'Hors ligne'}
          </span>
        </div>

        <form
          onSubmit={submit}
          autoComplete="off"
          className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-white mb-2">Token d'équipe</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Collez le token fourni"
                className="flex-1 px-3 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm font-mono"
                required
              />
              <button
                type="button"
                onClick={handlePasteToken}
                className="px-3 rounded-xl bg-white/10 border border-white/20 text-xs font-bold text-white hover:bg-white/20"
              >
                Coller
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Code PIN</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 text-center text-lg font-mono tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !online}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold text-white transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Connexion…
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" /> Se connecter
              </>
            )}
          </button>

          {!online && (
            <p className="text-xs text-amber-200 text-center">
              La première connexion nécessite une connexion internet. Une fois authentifié, le
              scanner fonctionne hors-ligne.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
