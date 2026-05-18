// src/pages/admin/Reservations.tsx
// Dashboard réservations — vue liste + vue calendrier + confirm/refus

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantReservations, type TableReservation, type ReservationStatus } from '@/hooks/useReservations';
import {
  Calendar, Clock, Users, Phone, CheckCircle2, XCircle,
  Loader2, MessageCircle, Filter, ChevronLeft, ChevronRight,
  BadgeCheck, AlertCircle, Search, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ReservationStatus, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: 'En attente', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  confirmed: { label: 'Confirmée', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  refused: { label: 'Refusée', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  cancelled: { label: 'Annulée', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
  completed: { label: 'Terminée', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
};

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatDateTime(date: string, time: string): string {
  const d = new Date(date + 'T' + time);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal confirm/refuse
// ─────────────────────────────────────────────────────────────────────────────
interface ActionModalProps {
  reservation: TableReservation;
  action: 'confirm' | 'refuse';
  onConfirm: (tableNumber?: string, reason?: string) => Promise<void>;
  onClose: () => void;
}

function ActionModal({ reservation, action, onConfirm, onClose }: ActionModalProps) {
  const [tableNumber, setTableNumber] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onConfirm(tableNumber || undefined, reason || undefined);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full">
        <div className="p-6">
          <h3 className="font-bold text-lg mb-1">
            {action === 'confirm' ? '✅ Confirmer la réservation' : '❌ Refuser la réservation'}
          </h3>
          <div className="text-sm text-zinc-600 mb-4">
            <strong>{reservation.customer_name}</strong> — {reservation.party_size} personne{reservation.party_size > 1 ? 's' : ''}
            <br />
            {formatDateTime(reservation.reservation_date, reservation.reservation_time)}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {action === 'confirm' && (
              <div>
                <label htmlFor="table-number" className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  Numéro de table (optionnel)
                </label>
                <input
                  id="table-number"
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Ex : Table 5, Terrasse 2..."
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            )}
            {action === 'refuse' && (
              <div>
                <label htmlFor="refuse-reason" className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  Raison du refus (optionnel)
                </label>
                <textarea
                  id="refuse-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Restaurant complet, horaires indisponibles..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-zinc-200 rounded-xl font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors text-sm"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white text-sm transition-colors',
                  action === 'confirm'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-red-600 hover:bg-red-700',
                  loading && 'opacity-60 cursor-not-allowed'
                )}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {action === 'confirm' ? 'Confirmer' : 'Refuser'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte réservation
// ─────────────────────────────────────────────────────────────────────────────
interface ReservationCardProps {
  reservation: TableReservation;
  onConfirm: (r: TableReservation) => void;
  onRefuse: (r: TableReservation) => void;
  onComplete: (r: TableReservation) => void;
}

function ReservationCard({ reservation: r, onConfirm, onRefuse, onComplete }: ReservationCardProps) {
  const cfg = STATUS_CONFIG[r.status];

  const whatsappLink = () => {
    const phone = r.customer_phone.replace(/[\s()-]/g, '').replace(/^00/, '+');
    const message = encodeURIComponent(
      r.status === 'confirmed'
        ? `Bonjour ${r.customer_name} 👋\n\nVotre réservation du ${formatDateTime(r.reservation_date, r.reservation_time)} pour ${r.party_size} personne${r.party_size > 1 ? 's' : ''} est confirmée !${r.table_number ? `\n📍 Table : ${r.table_number}` : ''}\n\nÀ très bientôt ! 🍽️`
        : `Bonjour ${r.customer_name}, nous avons bien reçu votre réservation du ${formatDate(r.reservation_date)} à ${r.reservation_time}.`
    );
    return `https://wa.me/${phone.replace('+', '')}?text=${message}`;
  };

  return (
    <article className={cn('bg-white rounded-2xl border-2 p-5 shadow-sm', cfg.border)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-zinc-900">{r.customer_name}</span>
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', cfg.color, cfg.bg, cfg.border)}>
              {cfg.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              {formatDate(r.reservation_date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {r.reservation_time}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              {r.party_size} pers.
            </span>
          </div>
        </div>

        <a
          href={`tel:${r.customer_phone}`}
          className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center hover:bg-zinc-200 transition-colors flex-shrink-0"
          aria-label={`Appeler ${r.customer_name}`}
        >
          <Phone className="w-4 h-4 text-zinc-600" />
        </a>
      </div>

      {r.table_number && (
        <p className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg inline-block mb-3">
          📍 {r.table_number}
        </p>
      )}

      {r.notes && (
        <p className="text-sm text-zinc-600 bg-zinc-50 rounded-xl px-3 py-2 mb-3 italic">
          "{r.notes}"
        </p>
      )}

      {r.refused_reason && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          {r.refused_reason}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {/* WhatsApp */}
        <a
          href={whatsappLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors"
          aria-label={`Envoyer un WhatsApp à ${r.customer_name}`}
        >
          <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
          WhatsApp
        </a>

        {/* Confirmer */}
        {r.status === 'pending' && (
          <button
            onClick={() => onConfirm(r)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            Confirmer
          </button>
        )}

        {/* Refuser */}
        {(r.status === 'pending' || r.status === 'confirmed') && (
          <button
            onClick={() => onRefuse(r)}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
            Refuser
          </button>
        )}

        {/* Marquer terminé */}
        {r.status === 'confirmed' && (
          <button
            onClick={() => onComplete(r)}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors"
          >
            <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Terminée
          </button>
        )}
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vue calendrier mensuel
// ─────────────────────────────────────────────────────────────────────────────
function CalendarView({
  reservations,
  onDayClick,
}: {
  reservations: TableReservation[];
  onDayClick: (date: string) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Lundi = 0
  const daysInMonth = lastDay.getDate();

  const days: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const reservationsByDate = reservations.reduce<Record<string, TableReservation[]>>((acc, r) => {
    if (!acc[r.reservation_date]) acc[r.reservation_date] = [];
    acc[r.reservation_date].push(r);
    return acc;
  }, {});

  const todayStr = new Date().toISOString().split('T')[0];
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
        <button
          onClick={prevMonth}
          aria-label="Mois précédent"
          className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-zinc-600" />
        </button>
        <h3 className="font-bold text-zinc-900">
          {monthNames[month]} {year}
        </h3>
        <button
          onClick={nextMonth}
          aria-label="Mois suivant"
          className="p-2 hover:bg-zinc-100 rounded-xl transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-zinc-600" />
        </button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 border-b border-zinc-100">
        {dayNames.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-bold text-zinc-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Grille jours */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          if (!day) return <div key={`pad-${idx}`} className="min-h-[72px] border-b border-r border-zinc-50" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayRes = reservationsByDate[dateStr] ?? [];
          const isToday = dateStr === todayStr;
          const hasPending = dayRes.some((r) => r.status === 'pending');
          const hasConfirmed = dayRes.some((r) => r.status === 'confirmed');
          return (
            <button
              key={dateStr}
              onClick={() => dayRes.length > 0 && onDayClick(dateStr)}
              disabled={dayRes.length === 0}
              className={cn(
                'min-h-[72px] p-2 border-b border-r border-zinc-50 text-left transition-colors',
                dayRes.length > 0 ? 'hover:bg-orange-50 cursor-pointer' : 'cursor-default',
                isToday && 'bg-orange-50'
              )}
            >
              <span className={cn(
                'text-sm font-bold inline-flex w-7 h-7 items-center justify-center rounded-full',
                isToday ? 'bg-orange-600 text-white' : 'text-zinc-700'
              )}>
                {day}
              </span>
              {dayRes.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {hasPending && (
                    <div className="text-xs font-bold text-amber-700 bg-amber-100 rounded px-1 py-0.5 truncate">
                      {dayRes.filter((r) => r.status === 'pending').length} en attente
                    </div>
                  )}
                  {hasConfirmed && (
                    <div className="text-xs font-bold text-blue-700 bg-blue-100 rounded px-1 py-0.5 truncate">
                      {dayRes.filter((r) => r.status === 'confirmed').length} confirmée{dayRes.filter((r) => r.status === 'confirmed').length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page principale Reservations
// ─────────────────────────────────────────────────────────────────────────────
export default function Reservations() {
  const { profile } = useAuth();
  const restaurantId = profile?.restaurant_id ?? null;

  const { reservations, loading, error, stats, fetchReservations, confirmReservation, refuseReservation, completeReservation } =
    useRestaurantReservations(restaurantId);

  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{
    reservation: TableReservation;
    action: 'confirm' | 'refuse';
  } | null>(null);

  const filtered = reservations.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (selectedDate && r.reservation_date !== selectedDate) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (r.customer_name ?? '').toLowerCase().includes(q) ||
        (r.customer_phone ?? '').includes(q) ||
        (r.notes ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleConfirmAction = async (tableNumber?: string, reason?: string) => {
    if (!actionModal) return;
    if (actionModal.action === 'confirm') {
      await confirmReservation(actionModal.reservation.id, tableNumber);
    } else {
      await refuseReservation(actionModal.reservation.id, reason);
    }
  };

  const handleComplete = async (r: TableReservation) => {
    await completeReservation(r.id);
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Réservations</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gérez les demandes de table de vos clients</p>
        </div>
        <button
          onClick={() => void fetchReservations()}
          aria-label="Actualiser les réservations"
          className="p-2 hover:bg-zinc-100 rounded-xl transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-5 h-5 text-zinc-500" />
        </button>
      </div>

      {!restaurantId && (
        <div className="r-admin-inset flex items-start gap-3 p-4 rounded-2xl border border-amber-200 bg-amber-50/80">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900 text-sm">Aucun restaurant lié</p>
            <p className="text-xs text-amber-800 mt-1">Vérifiez que votre profil possède un restaurant_id valide.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="r-admin-inset flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border border-red-200 bg-red-50/90">
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-900 text-sm">Impossible de charger les réservations</p>
              <p className="text-xs text-red-800 mt-1 font-mono break-all">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchReservations()}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </button>
        </div>
      )}

      {/* KPIs (une seule rangée) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'En attente', value: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Confirmées', value: stats.confirmed, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: "Aujourd'hui", value: stats.today, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
          { label: 'Total', value: stats.total, color: 'text-zinc-700', bg: 'bg-zinc-50 border-zinc-200' },
        ].map((k) => (
          <div key={k.label} className={cn('rounded-2xl border p-4 shadow-sm', k.bg)}>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">{k.label}</p>
            <p className={cn('text-2xl font-black tabular-nums', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Recherche */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Rechercher par nom, téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher une réservation"
            className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-white"
          />
        </div>

        {/* Filtre statut */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400 flex-shrink-0" aria-hidden="true" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReservationStatus | 'all')}
            aria-label="Filtrer par statut"
            className="border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-white"
          >
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="confirmed">Confirmée</option>
            <option value="refused">Refusée</option>
            <option value="cancelled">Annulée</option>
            <option value="completed">Terminée</option>
          </select>
        </div>

        {/* Vue liste/calendrier */}
        <div className="flex rounded-xl border border-zinc-200 overflow-hidden">
          <button
            onClick={() => { setView('list'); setSelectedDate(null); }}
            className={cn(
              'flex-1 px-4 py-2.5 text-sm font-bold transition-colors',
              view === 'list' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
            )}
            aria-pressed={view === 'list'}
          >
            Liste
          </button>
          <button
            onClick={() => setView('calendar')}
            className={cn(
              'flex-1 px-4 py-2.5 text-sm font-bold transition-colors',
              view === 'calendar' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50'
            )}
            aria-pressed={view === 'calendar'}
          >
            Calendrier
          </button>
        </div>
      </div>

      {/* Filtre date sélectionnée */}
      {selectedDate && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5">
          <span className="text-sm font-semibold text-orange-800">
            Réservations du {formatDate(selectedDate)}
          </span>
          <button
            onClick={() => setSelectedDate(null)}
            aria-label="Effacer le filtre de date"
            className="ml-auto text-orange-600 hover:text-orange-800 font-bold text-xs"
          >
            Effacer
          </button>
        </div>
      )}

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-16 min-h-[280px]">
          <RestafyLoader fullscreen={false} message="Chargement des réservations…" size="md" />
        </div>
      ) : view === 'calendar' ? (
        <div className="space-y-6">
          <CalendarView
            reservations={reservations}
            onDayClick={(date) => { setSelectedDate(date); setView('list'); }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <Calendar className="w-12 h-12 text-zinc-200 mx-auto mb-4" aria-hidden="true" />
              <p className="text-zinc-500 font-semibold">Aucune réservation trouvée</p>
              <p className="text-zinc-400 text-sm mt-1">
                {statusFilter !== 'all' ? 'Essayez un autre filtre' : 'Les nouvelles réservations apparaîtront ici en temps réel'}
              </p>
            </div>
          ) : (
            filtered.map((r) => (
              <ReservationCard
                key={r.id}
                reservation={r}
                onConfirm={(res) => setActionModal({ reservation: res, action: 'confirm' })}
                onRefuse={(res) => setActionModal({ reservation: res, action: 'refuse' })}
                onComplete={handleComplete}
              />
            ))
          )}
        </div>
      )}

      {/* Modal action */}
      {actionModal && (
        <ActionModal
          reservation={actionModal.reservation}
          action={actionModal.action}
          onConfirm={handleConfirmAction}
          onClose={() => setActionModal(null)}
        />
      )}
    </div>
  );
}
