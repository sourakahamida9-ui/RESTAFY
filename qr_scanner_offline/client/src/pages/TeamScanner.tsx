import { useEffect, useMemo, useState } from 'react';
import { ChefHat, Loader2, Lock, LogOut, RefreshCw, Ticket, XCircle } from 'lucide-react';

type TeamSession = {
  token: string;
  pin: string;
  memberName: string;
  memberRole: string;
  restaurantId: string;
  restaurantName: string | null;
  canUpdateOrderStatus: boolean;
  canCancelOrder: boolean;
};

type TeamOrder = {
  id: string;
  order_number: string;
  status: string;
  type: string;
  total_amount: number;
  delivery_address?: string | null;
  notes?: string | null;
  created_at: string;
  items: Array<{
    id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    notes?: string | null;
  }>;
};

const STORAGE_KEY = 'restafy-scan-team-session-v1';
// Session key used by /validator (TicketValidator). We pre-fill it on cross-nav
// so the user does not have to re-enter their PIN when switching to billets.
const VALIDATOR_SESSION_KEY = 'restafy-validator-session-v1';
const APP_API_BASE =
  ((import.meta.env.VITE_RESTAFY_APP_URL as string | undefined) || 'https://app.restafy.shop').replace(/\/$/, '');

const STATUS_FR: Record<string, string> = {
  pending: 'Nouvelle',
  accepted: 'Acceptée',
  confirmed: 'Confirmée',
  preparing: 'En cuisine',
  ready: 'Prête',
  delivering: 'Livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

const NEXT_STATUS: Partial<Record<string, string>> = {
  pending: 'confirmed',
  accepted: 'preparing',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'delivering',
  delivering: 'delivered',
};

const NEXT_LABEL: Partial<Record<string, string>> = {
  pending: 'Confirmer',
  accepted: 'En cuisine',
  confirmed: 'En cuisine',
  preparing: 'Prête',
  ready: 'Expédier',
  delivering: 'Livrée',
};

function readStoredSession(): TeamSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TeamSession) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: TeamSession | null) {
  try {
    if (!session) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${APP_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Erreur réseau');
  }
  return payload as T;
}

export default function TeamScanner() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') || '', []);
  const [session, setSession] = useState<TeamSession | null>(null);
  const [pin, setPin] = useState('');
  const [orders, setOrders] = useState<TeamOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSession = () => {
    writeStoredSession(null);
    setSession(null);
    setOrders([]);
    setPin('');
  };

  // Cross-nav to the ticket validator (/validator). We persist the same
  // token+PIN+restaurant in the session key the validator reads, so the
  // user is taken directly to the events list without re-entering the PIN.
  const goToTicketValidator = (currentSession: TeamSession) => {
    try {
      const validatorSession = {
        token: currentSession.token,
        pin: currentSession.pin,
        memberName: currentSession.memberName,
        memberRole: currentSession.memberRole,
        restaurantId: currentSession.restaurantId,
        restaurantName: currentSession.restaurantName,
      };
      sessionStorage.setItem(VALIDATOR_SESSION_KEY, JSON.stringify(validatorSession));
    } catch {
      // ignore quota / privacy-mode errors; the user will simply re-enter the PIN
    }
    window.location.href = `/validator?token=${encodeURIComponent(currentSession.token)}`;
  };

  const loadOrders = async (currentSession: TeamSession) => {
    setOrdersLoading(true);
    try {
      const payload = await postJson<{ success: true; orders: TeamOrder[] }>('/api/team-scan?action=orders', {
        token: currentSession.token,
        pin: currentSession.pin,
      });
      setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de charger les commandes';
      setError(message);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    const stored = readStoredSession();
    if (stored && stored.token === token) {
      setSession(stored);
      void loadOrders(stored);
      return;
    }
    writeStoredSession(null);
  }, [token]);

  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(() => {
      void loadOrders(session);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [session]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanPin = pin.replace(/\D/g, '');
    if (!token) {
      setError('Lien invalide');
      return;
    }
    if (cleanPin.length < 4) {
      setError('PIN invalide');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = await postJson<{
        success: true;
        member: { name: string; role: string };
        restaurant: { id: string; name: string | null };
        capabilities: { canUpdateOrderStatus: boolean; canCancelOrder: boolean };
      }>('/api/team-scan?action=auth', {
        token,
        pin: cleanPin,
      });

      const nextSession: TeamSession = {
        token,
        pin: cleanPin,
        memberName: payload.member.name,
        memberRole: payload.member.role,
        restaurantId: payload.restaurant.id,
        restaurantName: payload.restaurant.name,
        canUpdateOrderStatus: payload.capabilities.canUpdateOrderStatus,
        canCancelOrder: payload.capabilities.canCancelOrder,
      };

      writeStoredSession(nextSession);
      setSession(nextSession);
      setPin('');
      await loadOrders(nextSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!session) return;
    setLoading(true);
    try {
      await postJson('/api/team-scan?action=update-order-status', {
        token: session.token,
        pin: session.pin,
        orderId,
        newStatus,
      });
      await loadOrders(session);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <XCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-2xl font-black">Lien invalide</h1>
          <p className="text-zinc-400">Aucun token d’accès équipe n’a été fourni.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-3xl bg-orange-500/20 text-orange-400">
              <ChefHat className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Scan Équipe</h1>
            <p className="text-sm text-zinc-400">
              Entrez votre PIN pour accéder aux commandes. Les mises à jour se synchronisent automatiquement entre agents.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            autoComplete="off"
            className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"
          >
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" /> Code PIN
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center text-xl font-mono tracking-[0.4em] text-white outline-none focus:border-orange-500"
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {loading ? 'Connexion…' : 'Accéder au scan équipe'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-zinc-100 pb-16">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-400">Scan Équipe</p>
            <p className="truncate text-sm font-black">{session.restaurantName || 'Restaurant'}</p>
            <p className="truncate text-xs text-zinc-500">
              {session.memberName} · {session.memberRole} · synchro auto 3s
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToTicketValidator(session)}
              title="Scanner les billets d'événement"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-orange-500/20 px-3 py-2 text-xs font-bold text-orange-200 hover:bg-orange-500/30"
            >
              <Ticket className="h-4 w-4" />
              <span className="hidden sm:inline">Billets</span>
            </button>
            <button
              type="button"
              onClick={() => void loadOrders(session)}
              disabled={ordersLoading}
              className="rounded-2xl bg-white/5 p-2.5 text-zinc-200 hover:bg-white/10"
              title="Rafraîchir"
            >
              <RefreshCw className={`h-5 w-5 ${ordersLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={clearSession}
              className="rounded-2xl bg-white/5 p-2.5 text-zinc-200 hover:bg-red-500/20"
              title="Déconnexion"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-4">
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {orders.length === 0 && !ordersLoading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-16 text-center text-zinc-400">
            Aucune commande récente.
          </div>
        ) : (
          orders.map((order) => (
            <article key={order.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/10">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-black text-white">#{order.order_number || order.id.slice(0, 8)}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(order.created_at).toLocaleString('fr-FR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <span className="rounded-xl bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-300">
                  {STATUS_FR[order.status] || order.status}
                </span>
              </div>

              {order.delivery_address && (
                <p className="mt-3 text-xs text-zinc-400">{order.delivery_address}</p>
              )}
              {order.notes && (
                <p className="mt-2 text-xs text-amber-200">Note : {order.notes}</p>
              )}

              <ul className="mt-4 space-y-2 border-t border-white/10 pt-3 text-sm text-zinc-300">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    <span>
                      {item.quantity}x {item.item_name}
                    </span>
                    <span className="shrink-0 text-zinc-500">
                      {Number(item.subtotal || item.quantity * item.unit_price).toLocaleString('fr-FR')} F
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                {session.canUpdateOrderStatus && NEXT_STATUS[order.status] && order.status !== 'cancelled' && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void updateOrderStatus(order.id, NEXT_STATUS[order.status] as string)}
                    className="min-w-[140px] flex-1 rounded-2xl bg-orange-500 px-4 py-2.5 text-xs font-black text-white hover:bg-orange-600 disabled:opacity-60"
                  >
                    {NEXT_LABEL[order.status] || 'Suivant'}
                  </button>
                )}
                {session.canCancelOrder && order.status !== 'cancelled' && order.status !== 'delivered' && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void updateOrderStatus(order.id, 'cancelled')}
                    className="rounded-2xl border border-red-500/30 px-4 py-2.5 text-xs font-black text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </article>
          ))
        )}

        {ordersLoading && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Synchronisation des commandes…
          </div>
        )}
      </main>
    </div>
  );
}
