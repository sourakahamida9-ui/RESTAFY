import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Ticket, Calendar, MapPin, QrCode, CheckCircle, Clock, Loader2, AlertCircle, X, Download, Share2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

// ─── Types alignés sur les vraies colonnes Supabase ──────────────────────────
interface MyTicket {
  id: string;
  qr_code_data: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  amount_paid: number;
  customer_name: string;
  created_at: string;
  // colonnes optionnelles (ajoutées par script 013)
  ticket_number?: string | null;
  confirmed_at?: string | null;
  // jointures
  events: {
    id: string;
    title: string;
    start_time: string;
    location: string | null;
    image_url: string | null;
  } | null;
  event_tickets: {
    name: string;
    price: number;
  } | null;
}

// ─── Composant QR réel + téléchargement (visible sur mobile) ─────────────────
function TicketQRBlock({ ticket }: { ticket: MyTicket }) {
  const qrRef = useRef<SVGSVGElement>(null);
  const ticketNumber = ticket.ticket_number || `#${ticket.id.slice(0, 8).toUpperCase()}`;
  /** Toujours encoder la donnée DB : le fallback #id n’est pas un code d’entrée valide. */
  const qrValue = (ticket.qr_code_data && ticket.qr_code_data.trim()) || (ticket.ticket_number && ticket.ticket_number.trim()) || '';

  // Télécharge le QR en PNG via canvas
  const handleDownload = () => {
    const svg = qrRef.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const SIZE = 600;
    canvas.width = SIZE;
    canvas.height = SIZE + 120; // espace pour le texte en bas
    const ctx = canvas.getContext('2d')!;

    // Fond blanc
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 60, 40, SIZE - 120, SIZE - 120);

      // Titre événement
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(ticket.events?.title || 'Billet', SIZE / 2, SIZE - 60);

      // Numéro ticket
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px monospace';
      ctx.fillText(ticketNumber, SIZE / 2, SIZE - 30);

      // Watermark Restafy
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('restafy.shop', SIZE / 2, SIZE + 90);

      const link = document.createElement('a');
      link.download = `billet-${ticketNumber.replace(/[^a-zA-Z0-9]/g, '')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // Partage natif (Web Share API) ou fallback copie
  const handleShare = async () => {
    const text = `🎫 Mon billet — ${ticket.events?.title || 'Événement'}\n${ticketNumber}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Mon billet Restafy', text }); } catch { }
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  if (!qrValue) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center text-sm text-amber-900">
        Code billet indisponible. Ouvrez « Mes billets » après confirmation du restaurant ou contactez le support.
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-gray-100 rounded-2xl p-5 flex flex-col items-center gap-4">
      {/* QR sans logo au centre : le logo excavé dégrade fortement la lecture caméra. */}
      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
        <QRCodeSVG
          ref={qrRef as any}
          value={qrValue}
          size={240}
          level="H"
          includeMargin
        />
      </div>

      <div className="text-center">
        <p className="text-xs font-mono text-gray-400">{ticketNumber}</p>
        <p className="text-xs font-bold text-orange-600 mt-1 uppercase tracking-wider">
          📷 Présentez ce code à l'entrée
        </p>
      </div>

      {/* Boutons bien visibles sur mobile */}
      <div className="flex gap-3 w-full">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-bold py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-orange-200"
        >
          <Download className="w-4 h-4" />
          Télécharger
        </button>
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-bold py-3.5 px-4 rounded-xl transition-all text-sm"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function MyTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [selectedTicket, setSelectedTicket] = useState<MyTicket | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      // Refresh the auth session to ensure the JWT token is valid
      await supabase.auth.getSession();

      // ── Full query with joins ──────────────────────────────────────
      const { data, error: fetchErr } = await supabase
        .from('ticket_purchases')
        .select(`
          id,
          qr_code_data,
          status,
          amount_paid,
          customer_name,
          created_at,
          ticket_number,
          confirmed_at,
          events:event_id ( id, title, start_time, location, image_url ),
          event_tickets:ticket_id ( name, price )
        `)
        .eq('customer_id', user.id)
        .in('status', ['confirmed', 'pending'])
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.warn('[MyTickets] Full query failed, trying fallback:', fetchErr.message);
        // Fallback: query without joins and optional columns
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from('ticket_purchases')
          .select('id, qr_code_data, status, amount_paid, customer_name, created_at, event_id, ticket_id')
          .eq('customer_id', user.id)
          .in('status', ['confirmed', 'pending'])
          .order('created_at', { ascending: false });

        if (fallbackErr) throw fallbackErr;

        const mapped: MyTicket[] = (fallbackData || []).map((row: any) => ({
          id: row.id,
          qr_code_data: row.qr_code_data,
          status: (row.status as MyTicket['status']) || 'pending',
          amount_paid: row.amount_paid,
          customer_name: row.customer_name,
          created_at: row.created_at,
          ticket_number: null,
          confirmed_at: null,
          events: null,
          event_tickets: null,
        }));
        setTickets(mapped);
        return;
      }

      setTickets((data as unknown as MyTicket[]) || []);
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error('[MyTickets] Erreur:', err);
      setError('Impossible de charger vos billets. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const now = new Date();
  const confirmed = tickets.filter(t => t.status === 'confirmed');
  const pending = tickets.filter(t => t.status === 'pending');

  const upcomingTickets = confirmed.filter(t => t.events && new Date(t.events.start_time) > now);
  const pastTickets = confirmed.filter(t => t.events && new Date(t.events.start_time) <= now);

  const filteredTickets =
    filter === 'upcoming' ? upcomingTickets :
      filter === 'past' ? pastTickets :
        tickets; // 'all' = confirmed + pending

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-semibold">Erreur de chargement</p>
          <p className="text-sm text-gray-400 mt-1">{error}</p>
          <button
            onClick={() => void fetchTickets()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 transition"
          >
            <RefreshCw className="w-4 h-4" /> Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <h1 className="text-2xl font-black">Mes billets</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {confirmed.length} confirmé{confirmed.length > 1 ? 's' : ''}
          {pending.length > 0 && (
            <span className="ml-2 text-yellow-600 font-semibold">
              · {pending.length} en attente
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex gap-2 overflow-x-auto">
        {[
          { id: 'all', label: 'Tous' },
          { id: 'upcoming', label: '🔜 À venir' },
          { id: 'past', label: '✓ Passés' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as typeof filter)}
            className={`px-4 py-2 rounded-xl font-semibold whitespace-nowrap text-sm transition ${filter === f.id
              ? 'bg-orange-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto pb-20">
        {filteredTickets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Ticket className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-semibold">Aucun billet</p>
            <p className="text-gray-400 text-sm mt-1">
              Vos billets achetés apparaîtront ici.
            </p>
            <button
              onClick={() => void fetchTickets()}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 transition"
            >
              <RefreshCw className="w-4 h-4" /> Actualiser
            </button>
          </div>
        ) : (
          filteredTickets.map(ticket => {
            const eventDate = ticket.events ? new Date(ticket.events.start_time) : null;
            const isUpcoming = eventDate ? eventDate > now : false;
            const isPending = ticket.status === 'pending';

            return (
              <motion.div
                key={ticket.id}
                onClick={() => !isPending && setSelectedTicket(ticket)}
                className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition ${isPending
                  ? 'border-yellow-200 opacity-80'
                  : 'border-gray-100 cursor-pointer hover:shadow-md'
                  }`}
                whileHover={!isPending ? { y: -2 } : {}}
              >
                <div className="flex gap-0">
                  {/* Image */}
                  <div className="w-24 flex-shrink-0 bg-gray-100 min-h-[96px]">
                    {ticket.events?.image_url ? (
                      <img
                        src={ticket.events.image_url}
                        alt={ticket.events?.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xl font-black">
                        {ticket.events?.title?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-black text-gray-900 leading-tight">
                        {ticket.events?.title || 'Événement inconnu'}
                      </h3>
                      {isPending ? (
                        <span className="flex-shrink-0 bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                          <Clock className="w-3 h-3" /> En attente
                        </span>
                      ) : (
                        <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${isUpcoming ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                          {isUpcoming ? '📅 À venir' : '✓ Passé'}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm text-gray-500">
                      {eventDate && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {eventDate.toLocaleDateString('fr-FR', {
                            weekday: 'long', day: 'numeric', month: 'long',
                          })}
                        </div>
                      )}
                      {ticket.events?.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {ticket.events.location}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 font-semibold text-orange-600">
                        <Ticket className="w-3.5 h-3.5" />
                        {ticket.event_tickets?.name || 'Billet'} — {ticket.amount_paid.toLocaleString('fr-FR')} FCFA
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                      <p className="text-xs text-gray-400 font-mono">
                        {ticket.ticket_number || `#${ticket.id.slice(0, 8).toUpperCase()}`}
                      </p>
                      {!isPending && <CheckCircle className="w-4 h-4 text-green-500" />}
                    </div>
                  </div>
                </div>

                {isPending && (
                  <div className="bg-yellow-50 border-t border-yellow-100 px-4 py-2.5 text-xs text-yellow-700 font-semibold flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    En attente de confirmation par le restaurant
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* QR Code Modal - UNIQUEMENT pour billets confirmés */}
      <AnimatePresence>
        {selectedTicket && selectedTicket.status === 'confirmed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
            onClick={() => setSelectedTicket(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              /**
               * Petits écrans : modale ancrée en bas, scroll interne, hauteur
               * limitée à 95dvh (dvh = viewport dynamique → exclut la barre
               * d'adresse Chrome/Safari iOS qui faisait disparaître le bouton
               * "Fermer" et le bloc Détails sur mobile).
               * Desktop (sm+) : centrée comme avant.
               */
              className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[95dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain shadow-2xl flex flex-col"
            >
              {/* Modal header — collant en haut pour rester visible pendant le scroll interne */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-5 text-white flex justify-between items-start sticky top-0 z-10">
                <div>
                  <h2 className="text-xl font-black leading-tight">
                    {selectedTicket.events?.title}
                  </h2>
                  <p className="text-orange-100 text-sm mt-1">
                    {selectedTicket.event_tickets?.name || 'Billet'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* QR Code RÉEL scannable */}
                <TicketQRBlock ticket={selectedTicket} />

                {/* Details */}
                <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
                  {[
                    ['Numéro', selectedTicket.ticket_number || `#${selectedTicket.id.slice(0, 8).toUpperCase()}`],
                    ['Date', selectedTicket.events
                      ? new Date(selectedTicket.events.start_time).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                      : '—'],
                    ['Lieu', selectedTicket.events?.location || '—'],
                    ['Montant', `${selectedTicket.amount_paid.toLocaleString('fr-FR')} FCFA`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center px-4 py-3 text-sm">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-bold text-gray-900 text-right max-w-[55%]">{value}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedTicket(null)}
                  className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
