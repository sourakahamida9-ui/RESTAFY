// src/pages/admin/RestaurantDashboardEvents.tsx — Gestion événements alignée sur la DB (event_tickets + ticket_purchases)
import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  Calendar,
  Users,
  TrendingUp,
  ScanLine,
  X,
  CheckCircle2,
  AlertCircle,
  Ticket,
  Loader2,
  MapPin,
  Clock,
  Edit2,
  Trash2,
  QrCode,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import { EventEntryQrScanner } from '@/components/events/EventEntryQrScanner';
import { normalizeTicketScanPayload } from '@/lib/ticketScan';

type EventTicketRow = {
  id: string;
  name: string;
  price: number;
  quantity_available: number;
  quantity_sold: number;
};

type Event = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  image_url: string | null;
  is_published: boolean;
  total_capacity: number | null;
  created_at: string;
  event_tickets?: EventTicketRow[] | null;
};

type TicketPurchase = {
  id: string;
  event_id: string;
  customer_name: string | null;
  customer_email?: string | null;
  is_used: boolean;
  qr_scanned_at: string | null;
  created_at: string;
  amount_paid: number;
  status: string;
  ticket_number?: string | null;
  qr_code_data?: string | null;
};

const FIELD =
  'w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 bg-white transition-all';
const LABEL = 'block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5';

function minTicketPrice(tickets: EventTicketRow[] | null | undefined): number | null {
  if (!tickets?.length) return null;
  return Math.min(...tickets.map((t) => Number(t.price)));
}

export default function RestaurantDashboardEvents() {
  const { profile } = useAuth();
  const restaurantId = profile?.restaurant_id;

  const [events, setEvents] = useState<Event[]>([]);
  const [recentTickets, setRecentTickets] = useState<TicketPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [useCameraScan, setUseCameraScan] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [stats, setStats] = useState({ totalTickets: 0, totalRevenue: 0, activeEvents: 0, usedTickets: 0 });

  const [form, setForm] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    location: '',
    total_capacity: 100,
    ticket_name: 'Standard',
    ticket_price: 0,
    is_published: true,
    image_url: '',
  });

  const [ticketTypes, setTicketTypes] = useState<Array<{ name: string; price: number; quantity_available: number }>>([
    { name: 'Standard', price: 0, quantity_available: 100 }
  ]);

  const fetchAll = useCallback(async (background = false) => {
    if (!restaurantId) return;
    if (!background) setLoading(true);
    try {
      const { data: evs, error: evErr } = await supabase
        .from('events')
        .select(
          `
          id, title, description, start_time, end_time, location, image_url, is_published, total_capacity, created_at,
          event_tickets ( id, name, price, quantity_available, quantity_sold )
        `,
        )
        .eq('restaurant_id', restaurantId)
        .order('start_time', { ascending: false });

      if (evErr) throw evErr;

      const list = (evs || []) as Event[];
      setEvents(list);

      const eventIds = list.map((e) => e.id);
      let purchases: TicketPurchase[] = [];

      if (eventIds.length > 0) {
        const { data: tp, error: tpErr } = await supabase
          .from('ticket_purchases')
          .select('id, event_id, customer_name, customer_email, amount_paid, is_used, qr_scanned_at, status, created_at, ticket_number, qr_code_data')
          .in('event_id', eventIds)
          .order('created_at', { ascending: false })
          .limit(120);

        if (tpErr) {
          console.warn('[Events] ticket_purchases:', tpErr.message);
        } else {
          purchases = (tp || []) as TicketPurchase[];
        }
      }

      const valid = purchases.filter((t) => t.status !== 'cancelled');

      setRecentTickets(valid.slice(0, 12));
      setStats({
        totalTickets: valid.length,
        totalRevenue: valid.reduce((s, t) => s + Number(t.amount_paid || 0), 0),
        activeEvents: list.filter((e) => e.is_published).length,
        usedTickets: valid.filter((t) => t.is_used).length,
      });
    } catch (err) {
      console.error(err);
      toast.error('Impossible de charger les événements');
    } finally {
      if (!background) setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    void fetchAll();
  }, [restaurantId, fetchAll]);

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      start_time: '',
      end_time: '',
      location: '',
      total_capacity: 100,
      ticket_name: 'Standard',
      ticket_price: 0,
      is_published: true,
      image_url: '',
    });
    setTicketTypes([{ name: 'Standard', price: 0, quantity_available: 100 }]);
  };

  const openEdit = (ev: Event) => {
    const t0 = ev.event_tickets?.[0];
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      description: ev.description || '',
      start_time: ev.start_time.slice(0, 16),
      end_time: ev.end_time ? ev.end_time.slice(0, 16) : '',
      location: ev.location || '',
      total_capacity: ev.total_capacity ?? t0?.quantity_available ?? 100,
      ticket_name: t0?.name || 'Standard',
      ticket_price: t0 ? Number(t0.price) : 0,
      is_published: ev.is_published,
      image_url: ev.image_url || '',
    });

    // Charger tous les types de tickets existants
    if (ev.event_tickets && ev.event_tickets.length > 0) {
      setTicketTypes(
        ev.event_tickets.map((t) => ({
          name: t.name,
          price: Number(t.price),
          quantity_available: t.quantity_available,
        }))
      );
    } else {
      setTicketTypes([{ name: 'Standard', price: 0, quantity_available: ev.total_capacity ?? 100 }]);
    }

    setShowEdit(true);
  };

  const handleCreate = async () => {
    if (!restaurantId) {
      toast.error('Restaurant non trouvé');
      return;
    }
    if (!form.title?.trim() || !form.start_time) {
      toast.error('Titre et date de début obligatoires');
      return;
    }
    if (ticketTypes.length === 0) {
      toast.error('Au moins un type de billet est requis');
      return;
    }

    const cap = Math.max(1, form.total_capacity || 1);
    const price = Math.max(0, form.ticket_price || 0);

    setCreating(true);
    try {
      const { data: ev, error: evErr } = await supabase
        .from('events')
        .insert({
          restaurant_id: restaurantId,
          title: form.title.trim(),
          description: form.description?.trim() || null,
          start_time: new Date(form.start_time).toISOString(),
          end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
          location: form.location?.trim() || null,
          image_url: form.image_url?.trim() || null,
          total_capacity: cap,
          is_published: form.is_published,
        })
        .select(
          `
          id, title, description, start_time, end_time, location, image_url, is_published, total_capacity, created_at,
          event_tickets ( id, name, price, quantity_available, quantity_sold )
        `,
        )
        .single();

      if (evErr) throw evErr;

      // Insérer tous les types de tickets
      const ticketsToInsert = ticketTypes.map((tt) => ({
        event_id: ev.id,
        name: tt.name.trim() || 'Standard',
        price: Math.max(0, tt.price),
        quantity_available: Math.max(1, tt.quantity_available),
        quantity_sold: 0,
      }));

      const { error: etErr } = await supabase.from('event_tickets').insert(ticketsToInsert);

      if (etErr) {
        await supabase.from('events').delete().eq('id', ev.id);
        throw etErr;
      }

      const { data: full } = await supabase
        .from('events')
        .select(
          `
          id, title, description, start_time, end_time, location, image_url, is_published, total_capacity, created_at,
          event_tickets ( id, name, price, quantity_available, quantity_sold )
        `,
        )
        .eq('id', ev.id)
        .single();

      setEvents((prev) => [full as Event, ...prev]);
      setShowCreate(false);
      resetForm();
      toast.success('Événement créé — billet « Standard » ajouté (modifiable).');
      void fetchAll(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erreur : ' + msg);
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!restaurantId || !editingEvent) return;
    if (!form.title?.trim() || !form.start_time) {
      toast.error('Titre et date de début obligatoires');
      return;
    }
    if (ticketTypes.length === 0) {
      toast.error('Au moins un type de billet est requis');
      return;
    }

    const cap = Math.max(1, form.total_capacity || 1);
    const price = Math.max(0, form.ticket_price || 0);
    setSavingEdit(true);
    try {
      const { error: u1 } = await supabase
        .from('events')
        .update({
          title: form.title.trim(),
          description: form.description?.trim() || null,
          start_time: new Date(form.start_time).toISOString(),
          end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
          location: form.location?.trim() || null,
          image_url: form.image_url?.trim() || null,
          total_capacity: cap,
          is_published: form.is_published,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingEvent.id)
        .eq('restaurant_id', restaurantId);

      if (u1) throw u1;

      // Supprimer tous les tickets existants pour cet événement
      await supabase.from('event_tickets').delete().eq('event_id', editingEvent.id);

      // Insérer tous les nouveaux types de tickets
      const ticketsToInsert = ticketTypes.map((tt) => ({
        event_id: editingEvent.id,
        name: tt.name.trim() || 'Standard',
        price: Math.max(0, tt.price),
        quantity_available: Math.max(1, tt.quantity_available),
        quantity_sold: 0,
      }));

      const { error: etErr } = await supabase.from('event_tickets').insert(ticketsToInsert);

      if (etErr) throw etErr;

      toast.success('Événement mis à jour');
      setShowEdit(false);
      setEditingEvent(null);
      resetForm();
      void fetchAll(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erreur : ' + msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (ev: Event) => {
    if (!confirm(`Supprimer « ${ev.title} » ? Les billets vendus restent en base selon votre politique — ici suppression en cascade si la DB le permet.`)) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', ev.id).eq('restaurant_id', restaurantId!);
      if (error) throw error;
      setEvents((prev) => prev.filter((e) => e.id !== ev.id));
      toast.success('Événement supprimé');
      void fetchAll(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Suppression impossible');
    }
  };

  const togglePublish = async (event: Event) => {
    const { error } = await supabase
      .from('events')
      .update({ is_published: !event.is_published, updated_at: new Date().toISOString() })
      .eq('id', event.id);
    if (!error) {
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, is_published: !e.is_published } : e)));
      toast.success(event.is_published ? 'Événement dépublié' : 'Événement publié');
    } else toast.error(error.message);
  };

  const validateScan = async (rawOverride?: string) => {
    const normalized = normalizeTicketScanPayload(rawOverride ?? scanInput);
    if (!normalized || !restaurantId) {
      toast.error('Scannez le QR, ou collez le code RESTAFY-… / TKT-…');
      return;
    }
    if (rawOverride !== undefined) {
      setScanInput(normalized);
    }
    setScanning(true);
    try {
      const sel = `
        id, is_used, qr_code_data, status, ticket_number,
        events!inner ( id, title, restaurant_id )
      `;
      let row =
        (
          await supabase
            .from('ticket_purchases')
            .select(sel)
            .eq('qr_code_data', normalized)
            .maybeSingle()
        ).data ??
        (
          await supabase
            .from('ticket_purchases')
            .select(sel)
            .eq('ticket_number', normalized)
            .maybeSingle()
        ).data;

      if (!row) {
        setScanResult({
          success: false,
          message: 'Aucun billet correspondant. Vérifiez la luminosité du QR ou saisissez le code manuellement.',
        });
        return;
      }

      const ev = row.events as unknown as { restaurant_id: string; title: string };
      if (ev.restaurant_id !== restaurantId) {
        setScanResult({ success: false, message: 'Ce billet n’est pas pour votre restaurant.' });
        return;
      }

      if (row.status === 'cancelled') {
        setScanResult({ success: false, message: 'Billet annulé.' });
        return;
      }

      if (row.status !== 'confirmed') {
        setScanResult({
          success: false,
          message: 'Billet non confirmé — paiement en attente ou non validé.',
        });
        return;
      }

      if (row.is_used) {
        setScanResult({ success: false, message: 'Billet déjà utilisé.' });
        return;
      }

      const { data: updated, error: upErr } = await supabase
        .from('ticket_purchases')
        .update({
          is_used: true,
          qr_scanned_at: new Date().toISOString(),
          qr_scanned_by: 'Dashboard restaurateur',
          qr_scan_location: 'Dashboard',
        })
        .eq('id', row.id)
        .eq('is_used', false)
        .select('id')
        .maybeSingle();

      if (upErr) throw upErr;
      if (!updated) {
        setScanResult({
          success: false,
          message: 'Billet déjà utilisé (validation en double ou scan simultané).',
        });
        return;
      }

      setScanResult({ success: true, message: `Entrée validée — ${ev.title}` });
      setScanInput('');
      setUseCameraScan(false);
      void fetchAll(true);
    } catch (e: unknown) {
      setScanResult({ success: false, message: e instanceof Error ? e.message : 'Erreur validation' });
    } finally {
      setScanning(false);
    }
  };


  const copyEventLink = (id: string) => {
    const url = `${window.location.origin}/events/${id}`;
    void navigator.clipboard.writeText(url);
    toast.success('Lien copié');
  };

  const addTicketType = () => {
    setTicketTypes([...ticketTypes, { name: '', price: 0, quantity_available: 100 }]);
  };

  const removeTicketType = (index: number) => {
    if (ticketTypes.length > 1) {
      setTicketTypes(ticketTypes.filter((_, i) => i !== index));
    } else {
      toast.error('Au moins un type de billet est requis');
    }
  };

  const updateTicketType = (index: number, field: 'name' | 'price' | 'quantity_available', value: string | number) => {
    const updated = [...ticketTypes];
    updated[index] = { ...updated[index], [field]: value };
    setTicketTypes(updated);
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (!restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-[320px] text-zinc-500 text-sm">
        Aucun restaurant associé à votre compte.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[420px] flex items-center justify-center">
        <RestafyLoader fullscreen={false} message="Chargement des événements…" size="md" />
      </div>
    );
  }

  const upcomingEvents = events.filter((e) => new Date(e.start_time) >= new Date());
  const pastEvents = events.filter((e) => new Date(e.start_time) < new Date());

  const formModalBody = (isEdit: boolean) => (
    <>
      <div>
        <label className={LABEL}>
          Titre <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="Soirée live, Brunch, Atelier…"
          className={FIELD}
        />
      </div>
      <div>
        <label className={LABEL}>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Infos pratiques, dress code, FCFA sur place…"
          rows={3}
          className={`${FIELD} resize-none`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>
            Début <span className="text-red-400">*</span>
          </label>
          <input
            type="datetime-local"
            value={form.start_time}
            onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL}>Fin</label>
          <input
            type="datetime-local"
            value={form.end_time}
            onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
            className={FIELD}
          />
        </div>
      </div>
      <div>
        <label className={LABEL}>Lieu</label>
        <input
          type="text"
          value={form.location}
          onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
          placeholder="Quartier, ville (ex. Haie Vive, Cotonou)"
          className={FIELD}
        />
      </div>
      <div>
        <label className="LABEL">Places (billets max)</label>
        <input
          type="number"
          value={form.total_capacity}
          min={1}
          onChange={(e) => setForm((p) => ({ ...p, total_capacity: parseInt(e.target.value, 10) || 1 }))}
          className={FIELD}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="LABEL">Types de billets</label>
          <button
            type="button"
            onClick={addTicketType}
            className="text-xs font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {ticketTypes.map((tt, index) => (
            <div key={index} className="flex gap-2 items-start">
              <div className="flex-1">
                <input
                  type="text"
                  value={tt.name}
                  onChange={(e) => updateTicketType(index, 'name', e.target.value)}
                  placeholder="Standard, VIP, Early bird…"
                  className={`${FIELD} text-sm`}
                />
              </div>
              <div className="w-24">
                <input
                  type="number"
                  value={tt.price}
                  onChange={(e) => updateTicketType(index, 'price', parseInt(e.target.value, 10) || 0)}
                  placeholder="Prix"
                  className={`${FIELD} text-sm`}
                />
              </div>
              <div className="w-24">
                <input
                  type="number"
                  value={tt.quantity_available}
                  onChange={(e) => updateTicketType(index, 'quantity_available', parseInt(e.target.value, 10) || 1)}
                  placeholder="Quantité"
                  className={`${FIELD} text-sm`}
                />
              </div>
              {ticketTypes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTicketType(index)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400 mt-1">
          Ajoutez un tarif par catégorie de billet (ex. Standard, VIP). Chaque tarif crée une
          ligne distincte sur la page publique de l'événement.
        </p>
      </div>
      <div>
        <label className={LABEL}>Image (URL)</label>
        <input
          type="url"
          value={form.image_url}
          onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
          placeholder="https://…"
          className={FIELD}
        />
        {form.image_url ? (
          <img
            src={form.image_url}
            alt=""
            className="mt-2 w-full h-28 object-cover rounded-xl border border-zinc-200"
            onError={() => {}}
          />
        ) : null}
      </div>
      <div className="flex items-center justify-between bg-zinc-50 rounded-xl px-4 py-3 border border-zinc-100">
        <div>
          <p className="text-sm font-bold text-zinc-800">Publier sur la marketplace</p>
          <p className="text-xs text-zinc-400">Visible sur /events pour les clients</p>
        </div>
        <button type="button" onClick={() => setForm((p) => ({ ...p, is_published: !p.is_published }))}>
          {form.is_published ? (
            <ToggleRight className="w-8 h-8 text-orange-500" />
          ) : (
            <ToggleLeft className="w-8 h-8 text-zinc-300" />
          )}
        </button>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            setShowCreate(false);
            setShowEdit(false);
            setEditingEvent(null);
            resetForm();
          }}
          className="flex-1 py-3 border border-zinc-200 rounded-xl font-bold text-zinc-600 hover:bg-zinc-50 text-sm"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={isEdit ? () => void handleSaveEdit() : () => void handleCreate()}
          disabled={isEdit ? savingEdit : creating}
          className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-orange-500/25"
        >
          {(isEdit ? savingEdit : creating) ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {isEdit ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </>
  );

  return (
    <div className="r-page-shell !space-y-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Événements</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Création alignée sur les billets vendus en ligne (types de billets + QR). Contexte mobile & FCFA comme sur la
            marketplace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setScanInput('');
              setScanResult(null);
              setUseCameraScan(false);
              setShowScanner(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-bold text-sm transition-colors"
          >
            <ScanLine className="w-4 h-4" /> Valider une entrée
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowCreate(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-orange-500/25"
          >
            <Plus className="w-4 h-4" /> Créer un événement
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Billets (non annulés)', value: stats.totalTickets, icon: <Ticket className="w-4 h-4" />, color: 'text-violet-600 bg-violet-50' },
          { label: 'Revenus (FCFA)', value: stats.totalRevenue.toLocaleString('fr-FR'), icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Publiés', value: stats.activeEvents, icon: <Calendar className="w-4 h-4" />, color: 'text-orange-600 bg-orange-50' },
          { label: 'Entrées scannées', value: stats.usedTickets, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-sky-600 bg-sky-50' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-zinc-100 p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${k.color}`}>{k.icon}</div>
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{k.label}</p>
              <p className="text-xl font-black text-zinc-900">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {upcomingEvents.length > 0 && (
            <div>
              <h2 className="font-black text-zinc-900 text-sm uppercase tracking-widest mb-3">À venir</h2>
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onToggle={() => void togglePublish(event)}
                    onEdit={() => openEdit(event)}
                    onDelete={() => void handleDelete(event)}
                    onCopyLink={() => copyEventLink(event.id)}
                    fmtDate={fmtDate}
                    fmtTime={fmtTime}
                  />
                ))}
              </div>
            </div>
          )}

          {pastEvents.length > 0 && (
            <div>
              <h2 className="font-black text-zinc-400 text-sm uppercase tracking-widest mb-3">Passés</h2>
              <div className="space-y-3 opacity-80">
                {pastEvents.slice(0, 6).map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    past
                    onToggle={() => void togglePublish(event)}
                    onEdit={() => openEdit(event)}
                    onDelete={() => void handleDelete(event)}
                    onCopyLink={() => copyEventLink(event.id)}
                    fmtDate={fmtDate}
                    fmtTime={fmtTime}
                  />
                ))}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center">
              <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-7 h-7 text-zinc-300" />
              </div>
              <h3 className="font-black text-zinc-700 mb-1">Aucun événement</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Créez un événement : un type de billet sera ajouté automatiquement pour la vente en ligne.
              </p>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowCreate(true);
                }}
                className="px-5 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600"
              >
                Créer un événement
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-100 p-5">
            <h3 className="font-black text-zinc-900 mb-4">Billets récents</h3>
            {recentTickets.length === 0 ? (
              <div className="text-center py-8">
                <Ticket className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                <p className="text-sm text-zinc-400">Aucune vente enregistrée</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto">
                {recentTickets.map((t) => (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      t.is_used ? 'bg-emerald-50 border-emerald-100' : 'bg-zinc-50 border-zinc-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          t.is_used ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-200 text-zinc-500'
                        }`}
                      >
                        {t.is_used ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ticket className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-800 truncate">{t.customer_name || 'Client'}</p>
                        <p className="text-[10px] text-zinc-400">
                          {Number(t.amount_paid || 0).toLocaleString('fr-FR')} F · {t.status}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          t.is_used ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-500'
                        }`}
                      >
                        {t.is_used ? 'Entré' : t.status === 'pending' ? 'Paiement en vérification' : 'Valide'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100 p-5">
            <h4 className="font-black text-zinc-900 text-sm mb-3">Flux cohérent</h4>
            <ul className="text-xs text-zinc-600 space-y-2 list-disc pl-4">
              <li>La marketplace et la fiche événement utilisent <strong>event_tickets</strong> (prix + stock).</li>
              <li>À la création, un billet « Standard » est créé avec votre prix et votre capacité.</li>
              <li>
                Pour valider une entrée : ouvrez « Valider une entrée », utilisez « Scanner avec la caméra » ou collez le code
                RESTAFY-… / TKT-….
              </li>
            </ul>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(showCreate || showEdit) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && (setShowCreate(false), setShowEdit(false), setEditingEvent(null), resetForm())}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
                <div>
                  <h2 className="font-black text-zinc-900">{showEdit ? 'Modifier l’événement' : 'Nouvel événement'}</h2>
                  <p className="text-xs text-zinc-400">Champs * obligatoires</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setShowEdit(false);
                    setEditingEvent(null);
                    resetForm();
                  }}
                  className="p-2 hover:bg-zinc-100 rounded-xl"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">{formModalBody(showEdit)}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-zinc-900 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-orange-500" /> Valider une entrée
                </h3>
                <button type="button" onClick={() => setShowScanner(false)} className="p-2 rounded-xl hover:bg-zinc-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Utilisez la caméra ou collez le texte du QR (<span className="font-mono">RESTAFY-…</span>) ou le numéro{' '}
                <code className="bg-zinc-100 px-1 rounded">TKT-…</code>.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={scanning}
                  onClick={() => setUseCameraScan((v) => !v)}
                  className="flex-1 py-2.5 text-sm font-bold rounded-xl border-2 border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50"
                >
                  {useCameraScan ? 'Masquer la caméra' : 'Scanner avec la caméra'}
                </button>
              </div>

              {useCameraScan && !scanning && (
                <EventEntryQrScanner
                  disabled={scanning}
                  onDecoded={(text) => {
                    const n = normalizeTicketScanPayload(text);
                    setScanInput(n);
                    void validateScan(n);
                  }}
                />
              )}

              <textarea
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Coller le code ici si besoin…"
                rows={3}
                className={`${FIELD} font-mono text-xs`}
              />
              <button
                type="button"
                disabled={scanning}
                onClick={() => void validateScan()}
                className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Valider
              </button>
              <button
                type="button"
                onClick={() => setShowScanner(false)}
                className="w-full py-2 text-sm text-zinc-500 font-bold"
              >
                Fermer
              </button>
            </motion.div>
          </motion.div>
        )}

        {scanResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  scanResult.success ? 'bg-emerald-100' : 'bg-red-100'
                }`}
              >
                {scanResult.success ? (
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-10 h-10 text-red-500" />
                )}
              </div>
              <h3 className="text-xl font-black text-zinc-900 mb-1">{scanResult.success ? 'OK' : 'Refusé'}</h3>
              <p className="text-zinc-500 text-sm mb-6">{scanResult.message}</p>
              <button
                type="button"
                onClick={() => setScanResult(null)}
                className="w-full py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-700"
              >
                Continuer
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EventRow({
  event,
  onToggle,
  onEdit,
  onDelete,
  onCopyLink,
  fmtDate,
  fmtTime,
  past,
}: {
  event: Event;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  fmtDate: (d: string) => string;
  fmtTime: (d: string) => string;
  past?: boolean;
}) {
  const pMin = minTicketPrice(event.event_tickets || []);
  const sold = event.event_tickets?.reduce((s, t) => s + (t.quantity_sold || 0), 0) ?? 0;
  const cap = event.total_capacity ?? event.event_tickets?.[0]?.quantity_available;

  return (
    <div
      className={`bg-white rounded-2xl border border-zinc-100 overflow-hidden flex flex-col sm:flex-row gap-0 group hover:border-zinc-200 hover:shadow-sm transition-all ${
        past ? 'opacity-75' : ''
      }`}
    >
      <div className="w-full sm:w-32 h-28 sm:h-auto flex-shrink-0 relative overflow-hidden">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center min-h-[7rem] sm:min-h-0">
            <Calendar className="w-8 h-8 text-orange-300" />
          </div>
        )}
      </div>

      <div className="flex-1 p-4 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-black text-zinc-900 text-sm leading-tight line-clamp-2">{event.title}</h4>
          <button
            type="button"
            onClick={onToggle}
            className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 border transition-colors ${
              event.is_published
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200'
            }`}
          >
            {event.is_published ? '● Publié' : '○ Brouillon'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 mb-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {fmtDate(event.start_time)} · {fmtTime(event.start_time)}
          </span>
          {event.location ? (
            <span className="flex items-center gap-1 truncate max-w-[200px]">
              <MapPin className="w-3 h-3 flex-shrink-0" /> {event.location}
            </span>
          ) : null}
          {cap != null ? (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> {sold}/{cap} vendus
            </span>
          ) : null}
          {pMin != null && pMin >= 0 ? (
            <span className="font-bold text-orange-600">
              {pMin === 0 ? 'Gratuit' : `${pMin.toLocaleString('fr-FR')} FCFA`}
            </span>
          ) : (
            <span className="text-amber-600 font-bold">Sans type de billet</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-zinc-50">
          <a
            href={`/events/${event.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
          >
            <ExternalLink className="w-3 h-3" /> Voir
          </a>
          <button
            type="button"
            onClick={onCopyLink}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
          >
            <Copy className="w-3 h-3" /> Lien
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100"
          >
            <Edit2 className="w-3 h-3" /> Modifier
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100"
          >
            <Trash2 className="w-3 h-3" /> Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
