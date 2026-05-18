import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2, LogOut, RefreshCw, ChefHat, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatSupabaseErr, isLikelyMissingKioskSql } from '@/lib/formatSupabaseError';
import { useStaffKioskStore } from '@/store/useStaffKioskStore';
import { toast } from 'sonner';

type StaffKioskStaffPayload = {
  id: string;
  restaurant_id: string;
  role: string;
  display_name?: string;
};

type KioskCap = {
  can_update_order_status?: boolean;
  can_cancel_order?: boolean;
  kiosk_scope?: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  type: string;
  total_amount: number;
  delivery_address?: string | null;
  notes?: string | null;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  items: Array<{
    id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    notes?: string | null;
  }>;
};

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

const NEXT: Partial<Record<string, string>> = {
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

export default function StaffKioskPage() {
  const { token: accessTokenFromPath } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const hydrate = useStaffKioskStore((s) => s.hydrate);
  const accessToken = useStaffKioskStore((s) => s.accessToken);
  const sessionToken = useStaffKioskStore((s) => s.sessionToken);
  const staff = useStaffKioskStore((s) => s.staff);
  const restaurantName = useStaffKioskStore((s) => s.restaurantName);
  const capabilities = useStaffKioskStore((s) => s.capabilities);
  const setKioskSession = useStaffKioskStore((s) => s.setKioskSession);
  const clearKioskSession = useStaffKioskStore((s) => s.clearKioskSession);
  const resolvedAccessToken = useMemo(
    () => accessTokenFromPath || searchParams.get('token') || null,
    [accessTokenFromPath, searchParams]
  );

  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [view, setView] = useState<'pin' | 'orders'>('pin');

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!resolvedAccessToken) return;
    if (accessToken && accessToken !== resolvedAccessToken) {
      clearKioskSession();
      setOrders([]);
      setView('pin');
    }
  }, [accessToken, clearKioskSession, resolvedAccessToken]);

  const loadOrders = useCallback(async () => {
    const tok = useStaffKioskStore.getState().sessionToken;
    if (!tok) return;
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase.rpc('staff_kiosk_list_orders_json', {
        p_session_token: tok,
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string; orders?: OrderRow[] };
      if (!payload?.ok) {
        if (payload?.error === 'session_invalid') {
          clearKioskSession();
          setView('pin');
          toast.error('Session expirée — entrez le PIN à nouveau');
          return;
        }
        throw new Error(payload?.error || 'Erreur chargement');
      }
      setOrders(Array.isArray(payload.orders) ? payload.orders : []);
    } catch (e: unknown) {
      console.error(e);
      const msg = formatSupabaseErr(e);
      toast.error(
        isLikelyMissingKioskSql(msg) ? `${msg} — scripts SQL 072/073 requis sur Supabase.` : msg,
      );
    } finally {
      setOrdersLoading(false);
    }
  }, [clearKioskSession]);

  useEffect(() => {
    if (sessionToken) {
      setView('orders');
      void loadOrders();
    } else {
      setView('pin');
    }
  }, [sessionToken, loadOrders]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedAccessToken) {
      toast.error('Lien invalide');
      return;
    }
    const clean = pin.replace(/\D/g, '');
    if (clean.length < 4) {
      toast.error('PIN : au moins 4 chiffres');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('staff_kiosk_login', {
        p_access_token: resolvedAccessToken,
        p_pin: clean,
      });
      if (error) throw error;
      const payload = data as {
        ok?: boolean;
        error?: string;
        session_token?: string;
        staff?: StaffKioskStaffPayload;
        restaurant?: { name?: string | null };
        capabilities?: KioskCap;
      };
      if (!payload?.ok) {
        const msg =
          payload?.error === 'invalid_pin'
            ? 'PIN incorrect'
            : payload?.error === 'pin_not_set'
              ? 'PIN non défini — le gérant doit le configurer dans Équipe'
              : payload?.error === 'invalid_token'
                ? 'Lien invalide ou membre inactif'
                : 'Connexion impossible';
        toast.error(msg);
        return;
      }
      if (!payload.session_token || !payload.staff) {
        toast.error('Réponse serveur incomplète');
        return;
      }
      setKioskSession({
        accessToken: resolvedAccessToken,
        sessionToken: payload.session_token,
        staff: {
          id: payload.staff.id,
          restaurant_id: payload.staff.restaurant_id,
          role: payload.staff.role,
          display_name: payload.staff.display_name || '',
        },
        restaurantName: payload.restaurant?.name ?? null,
        capabilities: {
          can_update_order_status: Boolean(payload.capabilities?.can_update_order_status),
          can_cancel_order: Boolean(payload.capabilities?.can_cancel_order),
          kiosk_scope: String(payload.capabilities?.kiosk_scope || 'orders_only'),
        },
      });
      setPin('');
      setView('orders');
      toast.success('Bienvenue');
      void loadOrders();
    } catch (err: unknown) {
      console.error(err);
      const msg = formatSupabaseErr(err);
      toast.error(isLikelyMissingKioskSql(msg) ? `${msg} — scripts SQL 072/073 sur Supabase.` : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const tok = useStaffKioskStore.getState().sessionToken;
    if (tok) {
      try {
        await supabase.rpc('staff_kiosk_logout', { p_session_token: tok });
      } catch {
        /* ignore */
      }
    }
    clearKioskSession();
    setOrders([]);
    setView('pin');
    toast.message('Déconnecté');
  };

  const advanceStatus = async (orderId: string, current: string) => {
    const next = NEXT[current];
    if (!next || !sessionToken) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('staff_kiosk_update_order_status', {
        p_session_token: sessionToken,
        p_order_id: orderId,
        p_new_status: next,
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string };
      if (!payload?.ok) {
        toast.error(payload?.error === 'invalid_status' ? 'Statut non autorisé' : 'Mise à jour refusée');
        return;
      }
      toast.success('Statut mis à jour');
      await loadOrders();
    } catch (e: unknown) {
      toast.error(formatSupabaseErr(e));
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!capabilities?.can_cancel_order) {
      toast.error('Seuls le gérant ou le chef peuvent annuler');
      return;
    }
    if (!sessionToken || !confirm('Annuler cette commande ?')) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('staff_kiosk_update_order_status', {
        p_session_token: sessionToken,
        p_order_id: orderId,
        p_new_status: 'cancelled',
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string };
      if (!payload?.ok) {
        if (payload?.error === 'forbidden_cancel') toast.error('Annulation réservée au gérant / chef');
        else toast.error('Annulation impossible');
        return;
      }
      toast.success('Commande annulée');
      await loadOrders();
    } catch (e: unknown) {
      toast.error(formatSupabaseErr(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view !== 'orders' || !sessionToken) return;
    const id = window.setInterval(() => {
      void loadOrders();
    }, 25000);
    return () => window.clearInterval(id);
  }, [view, sessionToken, loadOrders]);

  useEffect(() => {
    if (view !== 'orders' || !sessionToken || !staff?.restaurant_id) return;

    const channel = supabase
      .channel(`staff-kiosk-orders:${staff.restaurant_id}:${sessionToken}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${staff.restaurant_id}`,
        },
        () => {
          void loadOrders();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [view, sessionToken, staff?.restaurant_id, loadOrders]);

  if (!resolvedAccessToken) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <p className="text-zinc-400">Lien d’accès invalide.</p>
      </div>
    );
  }

  if (view === 'pin') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-zinc-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-400">
              <ChefHat className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Espace équipe</h1>
            <p className="text-sm text-zinc-400">Entrez votre code PIN pour voir les commandes du restaurant.</p>
          </div>
          <form
            onSubmit={handleLogin}
            autoComplete="off"
            className="space-y-4 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-xl"
          >
            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-2 mb-2">
                <Lock className="w-3.5 h-3.5" /> Code PIN
              </label>
              <input
                type="text"
                name="restafy-kiosk-pin-entry"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                maxLength={8}
                value={pin}
                onChange={(ev) => setPin(ev.target.value)}
                placeholder="••••"
                className="input-pin-obscured w-full rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Accéder'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-orange-400 uppercase tracking-widest">Vue équipe</p>
          <p className="text-sm font-black truncate">{restaurantName || 'Restaurant'}</p>
          <p className="text-xs text-zinc-500 truncate">
            {staff?.display_name || 'Membre'} · {staff?.role}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={ordersLoading}
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            aria-label="Actualiser"
          >
            <RefreshCw className={`w-5 h-5 ${ordersLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-red-900/40 text-zinc-200"
            aria-label="Déconnexion"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-4">
        <p className="text-xs text-zinc-500">
          Cette page affiche uniquement les commandes. Pour le menu complet du tableau de bord, utilisez un compte
          gérant.
        </p>

        {orders.length === 0 && !ordersLoading ? (
          <div className="text-center py-16 text-zinc-500 text-sm">Aucune commande récente.</div>
        ) : (
          orders.map((o) => (
            <article
              key={o.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-black text-white">#{o.order_number}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(o.created_at).toLocaleString('fr-FR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-zinc-800 text-orange-300">
                  {STATUS_FR[o.status] || o.status}
                </span>
              </div>
              {(o.customer_name || o.customer_phone) && (
                <p className="text-sm text-zinc-300">
                  {o.customer_name}
                  {o.customer_phone ? ` · ${o.customer_phone}` : ''}
                </p>
              )}
              {o.delivery_address && (
                <p className="text-xs text-zinc-400">📍 {o.delivery_address}</p>
              )}
              {o.notes && <p className="text-xs text-amber-200/90">Note : {o.notes}</p>}
              <ul className="text-sm space-y-1 border-t border-zinc-800 pt-2">
                {o.items?.map((it) => (
                  <li key={it.id} className="flex justify-between gap-2 text-zinc-300">
                    <span>
                      {it.quantity}× {it.item_name}
                    </span>
                    <span className="text-zinc-500 shrink-0">{Number(it.subtotal).toLocaleString('fr-FR')} F</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                {capabilities?.can_update_order_status && NEXT[o.status] && o.status !== 'cancelled' && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void advanceStatus(o.id, o.status)}
                    className="flex-1 min-w-[120px] py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold"
                  >
                    {NEXT_LABEL[o.status] || 'Suivant'}
                  </button>
                )}
                {capabilities?.can_cancel_order && o.status !== 'cancelled' && o.status !== 'delivered' && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void cancelOrder(o.id)}
                    className="py-2.5 px-4 rounded-xl border border-red-900/50 text-red-400 text-xs font-bold hover:bg-red-950/40"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </main>
    </div>
  );
}
