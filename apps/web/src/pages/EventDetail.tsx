import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, MapPin, Clock, Ticket,
  ChevronRight, Share2, Users, AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import { ShareButton } from '@/components/ShareButton';
import { EventPoster, EventPosterHandle, EventPosterData } from '@/components/EventPoster';
import { Badge } from '@/components/ui/Badge';

interface DBEvent {
  id: string;
  title: string;
  description: string | null;
  restaurant_id: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  image_url: string | null;
  is_published: boolean;
  total_capacity: number | null;
  sold_tickets: number;
  restaurants: { name: string } | null;
  event_tickets: Array<{
    id: string;
    name: string;
    price: number;
    quantity_available: number;
    quantity_sold: number;
    benefits?: string[];
  }>;
}

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<DBEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const posterRef = useRef<EventPosterHandle>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchEvent = async () => {
      if (!id) return;
      if (!cancelled) setLoading(true);
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*, restaurants(name), event_tickets(id, name, price, quantity_available, quantity_sold)')
          .eq('id', id)
          .eq('is_published', true)
          .single();
        if (error) throw error;
        if (cancelled) return;
        setEvent(data);
        const firstAvailable = data.event_tickets?.find(
          (t: DBEvent['event_tickets'][0]) => (t.quantity_sold || 0) < (t.quantity_available || 0)
        );
        if (firstAvailable) setSelectedTicket(firstAvailable.id);
      } catch (err) {
        console.error('[EventDetail] Erreur fetch event:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchEvent();
    return () => { cancelled = true; };
  }, [id]);

  const handleShare = async () => {
    const url = window.location.href;
    const text = event ? `${event.title} - Reservez vos billets sur Restafy` : 'Restafy Events';
    try {
      if (navigator.share) {
        await navigator.share({ title: event?.title || 'Restafy', text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.warn('[EventDetail] Share error:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafaf9]">
        <RestafyLoader fullscreen={false} message="Chargement de l'evenement..." size="md" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafaf9] px-4">
        <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-zinc-400" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 mb-2">Evenement introuvable</h2>
        <p className="text-sm text-zinc-500 mb-6 text-center">Cet evenement n'existe pas ou n'est plus disponible.</p>
        <button
          onClick={() => navigate('/events')}
          className="bg-orange-600 text-white rounded-full px-6 py-3 text-sm font-semibold hover:bg-orange-700 transition-colors shadow-sm shadow-orange-600/20"
        >
          Voir tous les evenements
        </button>
      </div>
    );
  }

  const selectedType = event.event_tickets?.find(tt => tt.id === selectedTicket);
  const restaurantName = event.restaurants?.name || 'Restaurant';
  const eventDate = new Date(event.start_time);
  const eventTime = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const eventDateStr = eventDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const isTicketSoldOut = selectedType
    ? (selectedType.quantity_sold || 0) >= (selectedType.quantity_available || 0)
    : false;

  const allTicketsSoldOut = event.event_tickets?.every(
    t => (t.quantity_sold || 0) >= (t.quantity_available || 0)
  ) ?? false;

  const handleReserve = () => {
    if (!selectedTicket) return;
    navigate(`/events/${event.id}/checkout?ticketId=${selectedTicket}`);
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] pb-52">
      {/* Hero Image */}
      <div className="relative h-72 sm:h-80 bg-zinc-900">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-500 via-orange-600 to-zinc-900 flex items-center justify-center">
            <Ticket className="w-16 h-16 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Navigation */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pt-12">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/25 transition-colors"
          >
            <ArrowLeft className="w-4.5 h-4.5 text-white" />
          </button>
          <ShareButton
            type="event"
            entityId={event.id}
            title={event.title}
            description={event.description || undefined}
            imageUrl={event.image_url || undefined}
            date={eventDateStr}
            location={event.location || undefined}
            price={selectedType?.price || event.event_tickets?.[0]?.price}
            onDownloadPoster={() => posterRef.current?.downloadPoster('instagram')}
          />
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5 pb-6">
          <Badge variant="warning" size="sm" className="mb-3 bg-orange-600 text-white border-0">
            {restaurantName}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight tracking-tight">
            {event.title}
          </h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {/* Event Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                <Calendar className="w-4.5 h-4.5 text-orange-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Date</p>
                <p className="text-sm font-semibold text-zinc-900 capitalize">{eventDateStr}</p>
              </div>
            </div>
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-4.5 h-4.5 text-orange-600" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Heure</p>
                <p className="text-sm font-semibold text-zinc-900">{eventTime}</p>
              </div>
            </div>
            {event.location && (
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin className="w-4.5 h-4.5 text-orange-600" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Lieu</p>
                  <p className="text-sm font-semibold text-zinc-900">{event.location}</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Description */}
        {event.description && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">A propos</p>
            <p className="text-sm text-zinc-600 leading-relaxed">{event.description}</p>
          </motion.div>
        )}

        {/* Ticket Selection */}
        {event.event_tickets && event.event_tickets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-4">
              Choisissez votre billet
            </p>
            <div className="space-y-3">
              {event.event_tickets.map((ticket) => {
                const remaining = (ticket.quantity_available || 0) - (ticket.quantity_sold || 0);
                const isSoldOut = remaining <= 0;
                const isSelected = selectedTicket === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => !isSoldOut && setSelectedTicket(ticket.id)}
                    disabled={isSoldOut}
                    className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-200 ${
                      isSoldOut
                        ? 'bg-zinc-50 border-zinc-100 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-orange-50/50 border-orange-500 shadow-sm shadow-orange-500/10'
                        : 'bg-white border-zinc-150 hover:border-zinc-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isSoldOut ? 'bg-zinc-100' : isSelected ? 'bg-orange-100' : 'bg-orange-50'
                        }`}>
                          <Ticket className={`w-4.5 h-4.5 ${isSoldOut ? 'text-zinc-400' : 'text-orange-600'}`} />
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${isSoldOut ? 'text-zinc-400' : 'text-zinc-900'}`}>
                            {ticket.name}
                          </p>
                          <div className="mt-0.5">
                            {isSoldOut ? (
                              <Badge variant="danger" size="sm">Complet</Badge>
                            ) : remaining <= 10 ? (
                              <Badge variant="warning" size="sm">Plus que {remaining} place{remaining > 1 ? 's' : ''}</Badge>
                            ) : (
                              <span className="text-xs text-emerald-600 font-medium">
                                {remaining} places disponibles
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${isSoldOut ? 'text-zinc-300' : 'text-orange-600'}`}>
                          {ticket.price === 0 ? 'Gratuit' : `${ticket.price.toLocaleString('fr-FR')} F`}
                        </p>
                        {isSelected && !isSoldOut && (
                          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wide">Selectionne</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-zinc-100 z-40"
           style={{ paddingBottom: 'max(90px, calc(16px + env(safe-area-inset-bottom) + 70px))' }}>
        <div className="max-w-lg mx-auto px-4 pt-4">
          {allTicketsSoldOut ? (
            <div className="bg-zinc-100 rounded-2xl py-4 flex items-center justify-center gap-2.5">
              <AlertCircle className="w-4.5 h-4.5 text-zinc-400" />
              <span className="text-sm font-semibold text-zinc-400">Evenement complet</span>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleReserve}
              disabled={!selectedTicket || isTicketSoldOut}
              className={`w-full rounded-2xl py-4 text-[15px] font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
                !selectedTicket || isTicketSoldOut
                  ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  : 'bg-orange-600 text-white shadow-lg shadow-orange-600/25 hover:bg-orange-700 hover:shadow-xl hover:shadow-orange-600/30'
              }`}
            >
              <Ticket className="w-4.5 h-4.5" />
              {selectedType
                ? `Acheter — ${selectedType.price === 0 ? 'Gratuit' : `${selectedType.price.toLocaleString('fr-FR')} FCFA`}`
                : 'Selectionnez un billet'}
              <ChevronRight className="w-4.5 h-4.5" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Hidden EventPoster for download */}
      <EventPoster
        ref={posterRef}
        event={{
          id: event.id,
          title: event.title,
          imageUrl: event.image_url || undefined,
          date: eventDateStr,
          time: eventTime,
          location: event.location || 'A confirmer',
          restaurantName,
          tickets: event.event_tickets?.map(t => ({ name: t.name, price: t.price })) || [],
        }}
        visible={false}
      />
    </div>
  );
}
