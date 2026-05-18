import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, MapPin, Search, Music, PartyPopper,
  Utensils, GraduationCap, Flame, ChevronRight, Sparkles,
} from 'lucide-react';
// ── BUG CORRIGÉ #1 ────────────────────────────────────────────────────────────
// AVANT : import { useEventStore } from '../store/useEventStore';
//         → store Zustand avec 2 événements hardcodés → jamais les vrais events DB
// APRÈS : fetch Supabase directement
import { supabase } from '@/lib/supabase';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

const FILTERS = ['Tous', 'Ce soir', 'Ce weekend', 'Gratuit', 'Payant'];
const CATEGORIES = [
  { name: 'Concert', icon: Music },
  { name: 'Soirée', icon: PartyPopper },
  { name: 'Atelier', icon: GraduationCap },
  { name: 'Dîner', icon: Utensils },
];

interface DBEvent {
  id: string;
  title: string;
  description: string | null;
  restaurant_id: string;
  start_time: string;
  location: string | null;
  image_url: string | null;
  is_published: boolean;
  total_capacity: number | null;
  sold_tickets: number;
  category: string | null;
  restaurants: { name: string } | null;
  event_tickets: Array<{ id: string; price: number; quantity_available: number; quantity_sold: number }>;
}

export default function EventMarketplace() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<DBEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('Tous');
  const [query, setQuery] = useState('');

  // ── Fetch events depuis Supabase ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const fetchEvents = async () => {
      if (!cancelled) setLoading(true);
      try {
        // Charger tous les evenements publies (futurs ET recents pour ne pas perdre d'affichage)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { data, error } = await supabase
          .from('events')
          .select(`
            *,
            restaurants(name),
            event_tickets(id, price, quantity_available, quantity_sold)
          `)
          .eq('is_published', true)
          .gt('start_time', sevenDaysAgo.toISOString())  // inclure les events des 7 derniers jours
          .order('start_time', { ascending: true });

        if (error) throw error;
        if (!cancelled) setEvents(data || []);
      } catch (err) {
        console.error('[EventMarketplace] Erreur fetch events:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchEvents();
    return () => { cancelled = true; };
  }, []);

  // ── Filtre local (recherche + filtre type) ──────────────────────────────
  const filtered = events.filter(e => {
    const matchQuery = e.title.toLowerCase().includes(query.toLowerCase());
    if (activeFilter === 'Tous') return matchQuery;
    if (activeFilter === 'Gratuit') {
      const minPrice = Math.min(...(e.event_tickets?.map(t => t.price) || [0]));
      return matchQuery && minPrice === 0;
    }
    if (activeFilter === 'Payant') {
      const minPrice = Math.min(...(e.event_tickets?.map(t => t.price) || [0]));
      return matchQuery && minPrice > 0;
    }
    if (activeFilter === 'Ce soir') {
      const today = new Date();
      const eventDate = new Date(e.start_time);
      return matchQuery &&
        eventDate.getDate() === today.getDate() &&
        eventDate.getMonth() === today.getMonth();
    }
    if (activeFilter === 'Ce weekend') {
      const now = new Date();
      const eventDate = new Date(e.start_time);
      const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return matchQuery && diffDays <= 7;
    }
    return matchQuery;
  });

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", background: '#F2F0EB', minHeight: '100vh' }} className="pb-44">

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <div style={{ background: '#1A1A1A', position: 'relative', overflow: 'hidden' }} className="px-5 pt-12 pb-10">
        <div style={{
          position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
          width: 480, height: 320,
          background: 'radial-gradient(ellipse, rgba(255,107,0,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,107,0,0.12)', border: '1px solid rgba(255,107,0,0.3)',
            borderRadius: 100, padding: '5px 14px', marginBottom: 20,
          }}
        >
          <Sparkles size={12} color="#FF6B00" />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: '#FF6B00' }}>
            Restafy Events
          </span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ fontSize: 38, fontWeight: 800, color: '#fff', letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 10 }}
        >
          Les meilleures<br /><span style={{ color: '#FF6B00' }}>soirées</span> t'attendent.
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          style={{ fontSize: 14, color: '#555', marginBottom: 24 }}
        >
          Concerts, dîners, ateliers — réservez en 30 secondes.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ position: 'relative' }}
        >
          <Search size={16} color="#555" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Chercher un événement…"
            style={{
              width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '13px 16px 13px 44px', color: '#fff',
              fontSize: 14, fontFamily: "'Sora', sans-serif", outline: 'none',
            }}
          />
        </motion.div>
      </div>

      <div className="px-4 pt-6 space-y-7">

        {/* ── CATEGORIES ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {CATEGORIES.map((cat, i) => (
            <motion.button key={cat.name}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.94 }}
              style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: '#fff', borderRadius: 18, padding: '14px 18px',
                border: '1px solid #EBEBEB', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                cursor: 'pointer', minWidth: 72,
              }}
            >
              <cat.icon size={20} color="#FF6B00" />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#777' }}>
                {cat.name}
              </span>
            </motion.button>
          ))}
        </div>

        {/* ── FILTERS ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              style={{
                flexShrink: 0,
                background: activeFilter === f ? '#FF6B00' : '#fff',
                color: activeFilter === f ? '#fff' : '#888',
                border: `2px solid ${activeFilter === f ? '#FF6B00' : '#EBEBEB'}`,
                borderRadius: 100, padding: '7px 16px',
                fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                cursor: 'pointer', transition: 'all 0.18s', fontFamily: "'Sora', sans-serif",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* ── EVENT LIST ─────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1A1A1A', letterSpacing: -0.5 }}>
              À ne pas manquer
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#FF6B00' }}>
              {loading ? '…' : `${filtered.length} événement${filtered.length > 1 ? 's' : ''}`}
            </span>
          </div>

          {loading ? (
            <div style={{ minHeight: 320, background: '#F2F0EB', borderRadius: 20, marginTop: 8 }}>
              <RestafyLoader fullscreen={false} message="Chargement des événements…" size="md" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#999' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎭</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#555' }}>Aucun événement pour le moment</div>
              <div style={{ fontSize: 13, color: '#AAA', marginTop: 6 }}>Revenez bientôt !</div>
            </div>
          ) : (
            <AnimatePresence>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filtered.map((event, i) => (
                  <EventCard key={event.id} event={event} index={i} navigate={navigate} />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EventCard ────────────────────────────────────────────────────────────────
function EventCard({ event, index, navigate }: { event: DBEvent; index: number; navigate: (path: string) => void }) {
  const totalCapacity = event.total_capacity || event.event_tickets?.reduce((s, t) => s + t.quantity_available, 0) || 0;
  const totalSold = event.event_tickets?.reduce((s, t) => s + (t.quantity_sold || 0), 0) || event.sold_tickets || 0;
  const remaining = Math.max(0, totalCapacity - totalSold);
  const fill = totalCapacity > 0 ? Math.min(100, (totalSold / totalCapacity) * 100) : 0;
  const hot = remaining < 10 && remaining > 0;
  const restaurantName = event.restaurants?.name || 'Restaurant';

  const prices = event.event_tickets?.map(t => t.price) || [];
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const priceRange = minPrice === maxPrice
    ? `${minPrice.toLocaleString('fr-FR')} FCFA`
    : `${minPrice.toLocaleString('fr-FR')} - ${maxPrice.toLocaleString('fr-FR')} FCFA`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }} whileTap={{ scale: 0.985 }}
      onClick={() => navigate(`/events/${event.id}`)}
      style={{
        background: '#fff', borderRadius: 24, overflow: 'hidden',
        border: '1px solid #EBEBEB', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', cursor: 'pointer',
      }}
    >
      <div style={{ height: 180, position: 'relative', background: '#E8E8E8' }}>
        {event.image_url ? (
          <img src={event.image_url} alt={event.title} referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🎭</div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)' }} />

        <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderRadius: 100, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Calendar size={11} color="#FF6B00" />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: '#1A1A1A' }}>
            {new Date(event.start_time).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
        </div>

        {prices.length > 0 && (
          <div style={{ position: 'absolute', bottom: 12, right: 12, background: '#FF6B00', borderRadius: 100, padding: '5px 12px' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>{priceRange}</span>
          </div>
        )}

        {hot && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: '#1A1A1A', borderRadius: 100, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Flame size={10} color="#FF6B00" />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#FF6B00' }}>Presque complet</span>
          </div>
        )}
      </div>

      <div style={{ padding: '18px 20px 20px' }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1A1A1A', letterSpacing: -0.4, marginBottom: 4 }}>{event.title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
          <MapPin size={11} color="#999" />
          <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>
            {restaurantName}{event.location ? ` · ${event.location}` : ''}
          </span>
        </div>

        {totalCapacity > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#BBB' }}>Remplissage</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: hot ? '#EF4444' : '#FF6B00' }}>
                {remaining} places{hot ? ' 🔥' : ''}
              </span>
            </div>
            <div style={{ height: 5, background: '#F0F0F0', borderRadius: 100, overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${fill}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{ height: '100%', background: hot ? '#EF4444' : '#FF6B00', borderRadius: 100 }}
              />
            </div>
          </>
        )}

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#999' }}>{event.category || 'Événement'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1A1A1A', borderRadius: 100, padding: '7px 14px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Réserver</span>
            <ChevronRight size={13} color="#FF6B00" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
