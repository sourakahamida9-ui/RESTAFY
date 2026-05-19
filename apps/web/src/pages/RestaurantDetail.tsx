// src/pages/RestaurantDetail.tsx
// Route /r/:slug (principale) ; parsing legacy /@… si besoin
// Page publique complète : hero, menu, avis, horaires, réservation

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useRestaurants, useRestaurantMenu } from '@/hooks/useRestaurant';
import { useCartStore } from '@/hooks/useOrderCart';
import { useAuth } from '@/hooks/useAuth';
import {
  ShoppingCart, Star, MapPin, Clock, ChevronLeft, Plus, Minus,
  ChevronRight, ShoppingBag, MessageSquare, Send, Loader2,
  Phone, Calendar, BadgeCheck, MessageCircle, X, Info,
  UtensilsCrossed, ExternalLink, Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ShareButton } from '@/components/ShareButton';
import { createReservation } from '@/hooks/useReservations';
import { toast } from 'sonner';
import { RestaurantAvatar } from '@/components/ui/RestaurantAvatar';

// ── Types ────────────────────────────────────────────────────────────────────
interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  customer_id: string;
  order_id: string | null;
  is_verified: boolean;
  restaurant_reply: string | null;
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
}

function reviewAuthorName(profiles: Review['profiles']): string | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0]?.full_name ?? null;
  return profiles.full_name;
}

interface ReservationForm {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  notes: string;
}

// Horaires par défaut si pas en DB
const DEFAULT_HOURS: Record<string, { open: string; close: string; closed: boolean }> = {
  Lun: { open: '08:00', close: '22:00', closed: false },
  Mar: { open: '08:00', close: '22:00', closed: false },
  Mer: { open: '08:00', close: '22:00', closed: false },
  Jeu: { open: '08:00', close: '22:00', closed: false },
  Ven: { open: '08:00', close: '23:00', closed: false },
  Sam: { open: '10:00', close: '23:00', closed: false },
  Dim: { open: '11:00', close: '21:00', closed: false },
};

const DAY_MAP: Record<number, string> = { 0: 'Dim', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven', 6: 'Sam' };

// ── StarRow ──────────────────────────────────────────────────────────────────
function StarRow({ value, onChange, readonly = false, size = 'md' }: {
  value: number; onChange?: (v: number) => void; readonly?: boolean; size?: 'sm' | 'md' | 'lg';
}) {
  const cls = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5';
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <button key={s} type="button" disabled={readonly} onClick={() => onChange?.(s)} className={readonly ? 'cursor-default' : 'cursor-pointer'}>
          <Star className={`${cls} transition-colors ${s <= value ? 'fill-amber-400 text-amber-400' : 'text-zinc-200'}`} />
        </button>
      ))}
    </div>
  );
}

// ── Modal Réservation ────────────────────────────────────────────────────────
function ReservationModal({ restaurantId, restaurantName, restaurantPhone, onClose, customerId, customerName, customerPhone }: {
  restaurantId: string; restaurantName: string; restaurantPhone: string | null;
  onClose: () => void; customerId?: string; customerName?: string; customerPhone?: string;
}) {
  const [form, setForm] = useState<ReservationForm>({
    customer_name: customerName ?? '',
    customer_phone: customerPhone ?? '',
    customer_email: '',
    party_size: 2,
    reservation_date: new Date().toISOString().split('T')[0],
    reservation_time: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const up = (k: keyof ReservationForm, v: string | number) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.customer_phone.trim() || !form.reservation_date || !form.reservation_time) {
      toast.error('Remplissez tous les champs obligatoires'); return;
    }
    setSubmitting(true);
    const result = await createReservation({
      restaurant_id: restaurantId, customer_id: customerId,
      customer_name: form.customer_name.trim(), customer_phone: form.customer_phone.trim(),
      customer_email: form.customer_email.trim() || undefined, party_size: form.party_size,
      reservation_date: form.reservation_date, reservation_time: form.reservation_time,
      notes: form.notes.trim() || undefined,
    });
    setSubmitting(false);
    if (result.success) setSubmitted(true);
    else toast.error(result.error ?? 'Erreur lors de la réservation');
  };

  if (submitted) return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-8 text-center shadow-2xl space-y-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-black text-zinc-900">Réservation envoyée !</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {restaurantName} confirme votre table pour <strong>{form.party_size} personne{form.party_size > 1 ? 's' : ''}</strong> le{' '}
            <strong>{new Date(form.reservation_date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong> à <strong>{form.reservation_time}</strong>.
          </p>
        </div>
        {restaurantPhone && (
          <a
            href={`https://wa.me/${restaurantPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour, réservation pour ${form.party_size} personne(s) le ${form.reservation_date} à ${form.reservation_time}. Nom: ${form.customer_name}`)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] text-white rounded-2xl font-bold hover:bg-green-600"
          >
            <MessageCircle className="w-5 h-5" /> Confirmer via WhatsApp
          </a>
        )}
        <button onClick={onClose} className="w-full py-3 border border-zinc-200 rounded-2xl font-semibold text-zinc-600 hover:bg-zinc-50">Fermer</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <div>
            <h2 className="font-black text-zinc-900">Réserver une table</h2>
            <p className="text-xs text-zinc-400">{restaurantName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl"><X className="w-5 h-5 text-zinc-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[
            { id: 'rn', label: 'Votre nom', key: 'customer_name', type: 'text', placeholder: 'Jean Dupont', required: true },
            { id: 'rp', label: 'Téléphone', key: 'customer_phone', type: 'tel', placeholder: '+229 XX XX XX XX', required: true },
            { id: 're', label: 'Email (optionnel)', key: 'customer_email', type: 'email', placeholder: 'votre@email.com', required: false },
          ].map(f => (
            <div key={f.id}>
              <label htmlFor={f.id} className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <input id={f.id} type={f.type} value={form[f.key as keyof ReservationForm] as string}
                onChange={e => up(f.key as keyof ReservationForm, e.target.value)}
                placeholder={f.placeholder} required={f.required}
                className="w-full px-4 py-3 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
              />
            </div>
          ))}

          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Nombre de personnes <span className="text-red-400">*</span></p>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => up('party_size', Math.max(1, form.party_size - 1))} className="w-10 h-10 rounded-full border border-zinc-200 flex items-center justify-center hover:bg-zinc-50"><Minus className="w-4 h-4" /></button>
              <span className="w-8 text-center font-black text-xl">{form.party_size}</span>
              <button type="button" onClick={() => up('party_size', Math.min(50, form.party_size + 1))} className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600"><Plus className="w-4 h-4" /></button>
              <span className="text-sm text-zinc-500">personne{form.party_size > 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rd" className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Date <span className="text-red-400">*</span></label>
              <input id="rd" type="date" value={form.reservation_date} min={new Date().toISOString().split('T')[0]}
                onChange={e => up('reservation_date', e.target.value)} required
                className="w-full px-3 py-3 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400" />
            </div>
            <div>
              <label htmlFor="rt" className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Heure <span className="text-red-400">*</span></label>
              <input id="rt" type="time" value={form.reservation_time} onChange={e => up('reservation_time', e.target.value)} required
                className="w-full px-3 py-3 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400" />
            </div>
          </div>

          <div>
            <label htmlFor="rnotes" className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Notes (optionnel)</label>
            <textarea id="rnotes" value={form.notes} onChange={e => up('notes', e.target.value)}
              placeholder="Occasion spéciale, allergies, préférence de table…" rows={2}
              className="w-full px-4 py-3 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 resize-none" />
          </div>

          <button type="submit" disabled={submitting}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-orange-500/25">
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
            {submitting ? 'Envoi…' : 'Envoyer ma réservation'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function RestaurantDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug: slugParam } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const tableParam = searchParams.get('table');

  // /r/:slug (useParams) ; repli: /@ancien dans le pathname
  const pathMatch = location.pathname.match(/\/@([^/]+)/);
  const id = slugParam ?? pathMatch?.[1];

  useEffect(() => {
    // intentionally empty
  }, [location.pathname, slugParam, id]);
  const { user, profile } = useAuth();
  const { restaurants, loading: restaurantsLoading } = useRestaurants();
  const { addItem, setRestaurant, items: cartItems } = useCartStore();
  const cartRestaurantId = useCartStore((s) => s.restaurantId);
  const cartRestaurantName = useCartStore((s) => s.restaurantName);
  // U1: confirmation switch resto avant de vider le panier en cours.
  const [showCartSwitchConfirm, setShowCartSwitchConfirm] = useState<{
    fromName: string;
    toName: string;
  } | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<Record<string, number>>({});
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  /** Commande livrée encore sans avis pour ce resto (une note par commande) */
  const [orderIdForReview, setOrderIdForReview] = useState<string | null>(null);
  const [directRestaurant, setDirectRestaurant] = useState<any>(null);
  const [directLoading, setDirectLoading] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'reviews' | 'info'>('menu');

  const restaurant =
    (id ? restaurants.find((r) => r.id === id || r.slug === id) : undefined) ?? directRestaurant;
  /** UUID réel — obligatoire pour menu / avis / réservation (l’URL peut être un slug) */
  const menuRestaurantId = restaurant?.id ?? '';
  const { categories, items, loading: menuLoading } = useRestaurantMenu(menuRestaurantId);

  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = useCartStore(s => s.total());

  // Charger si pas dans le store
  useEffect(() => {
    if (!id || restaurantsLoading) return;
    const found = restaurants.find(r => r.id === id || r.slug === id);
    if (!found) {
      setDirectLoading(true);
      (async () => {
        try {
          let { data } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          
          if (!data) {
            ({ data } = await supabase
              .from('restaurants')
              .select('*')
              .eq('slug', id)
              .maybeSingle());
          }
          
          if (data) {
            setDirectRestaurant(data);
          }
          setDirectLoading(false);
        } catch (err) {
          console.error('[RestaurantDetail] Error:', err);
          setDirectLoading(false);
        }
      })();
    }
  }, [id, restaurantsLoading, restaurants]);

  useEffect(() => {
    const rid = restaurant?.id;
    if (!rid) return;
    supabase.from('reviews')
      .select('id,rating,comment,created_at,customer_id,order_id,is_verified,restaurant_reply,profiles(full_name)')
      .eq('restaurant_id', rid).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => {
        if (data) setReviews(data as unknown as Review[]);
      });
  }, [restaurant?.id]);

  useEffect(() => {
    const rid = restaurant?.id;
    if (!user || !rid) {
      setOrderIdForReview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: deliveredRows } = await supabase
        .from('orders')
        .select('id')
        .eq('restaurant_id', rid)
        .eq('customer_id', user.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (!deliveredRows?.length) {
        setOrderIdForReview(null);
        return;
      }
      const { data: reviewRows } = await supabase
        .from('reviews')
        .select('order_id')
        .eq('restaurant_id', rid)
        .eq('customer_id', user.id);
      if (cancelled) return;
      const used = new Set(
        (reviewRows ?? [])
          .map((row) => row.order_id)
          .filter((oid): oid is string => typeof oid === 'string' && oid.length > 0),
      );
      const next = deliveredRows.find((o) => o.id && !used.has(o.id));
      setOrderIdForReview(next?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, restaurant?.id]);

  const canReview = orderIdForReview != null;

  const handleSubmitReview = useCallback(async () => {
    const rid = restaurant?.id;
    if (!user || !rid) return;
    if (!orderIdForReview) {
      toast.error('Seuls les clients ayant une commande livrée ici peuvent noter ce restaurant.');
      return;
    }
    if (!newReview.comment.trim()) { toast.error('Écrivez un commentaire'); return; }
    setSubmittingReview(true);
    try {
      const { error } = await supabase.from('reviews').insert({
        restaurant_id: rid,
        customer_id: user.id,
        order_id: orderIdForReview,
        rating: newReview.rating,
        comment: newReview.comment.trim(),
      });
      if (error) throw error;
      const { data } = await supabase.from('reviews').select('id,rating,comment,created_at,customer_id,order_id,is_verified,restaurant_reply,profiles(full_name)').eq('restaurant_id', rid).order('created_at', { ascending: false }).limit(20);
      if (data) setReviews(data as unknown as Review[]);
      setNewReview({ rating: 5, comment: '' });
      setShowReviewForm(false);
      setOrderIdForReview(null);
      toast.success('Avis publié !');
      const { data: deliveredRows } = await supabase
        .from('orders')
        .select('id')
        .eq('restaurant_id', rid)
        .eq('customer_id', user.id)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false });
      const { data: reviewRows } = await supabase
        .from('reviews')
        .select('order_id')
        .eq('restaurant_id', rid)
        .eq('customer_id', user.id);
      const used = new Set(
        (reviewRows ?? [])
          .map((row) => row.order_id)
          .filter((oid): oid is string => typeof oid === 'string' && oid.length > 0),
      );
      const next = (deliveredRows ?? []).find((o) => o.id && !used.has(o.id));
      setOrderIdForReview(next?.id ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('unique') || msg.includes('duplicate')) toast.error('Vous avez déjà noté cette commande');
      else toast.error('Une erreur est survenue. Veuillez réessayer.');
    } finally { setSubmittingReview(false); }
  }, [user, restaurant?.id, orderIdForReview, newReview]);

  // ⚠️ Ne retourner que si chargement terminé ET restaurant pas trouvé
  if (!restaurant && !directLoading && !restaurantsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto">
            <UtensilsCrossed className="w-8 h-8 text-zinc-300" />
          </div>
          <div>
            <p className="font-black text-zinc-900 text-lg">Restaurant introuvable</p>
            <p className="text-zinc-400 text-sm mt-1">Ce restaurant n'existe pas ou n'est plus disponible.</p>
          </div>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-700">
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (restaurantsLoading || directLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm">Chargement…</p>
      </div>
    </div>
  );



  const r = restaurant as Record<string, any>;
  const categoryItems = selectedCategory ? items.filter(i => i.category_id === selectedCategory) : items;
  const whatsappPhone = r.phone ? r.phone.replace(/[\s()\-]/g, '').replace(/^00/, '+') : null;
  const hasItems = Object.values(quantity).some(q => q > 0);
  const avgRating = typeof r.avg_rating === 'number' ? r.avg_rating : 0;
  const totalReviewsCount = typeof r.total_reviews === 'number' ? r.total_reviews : reviews.length;

  const rawOpening = r.opening_hours;
  const hasStoredOpeningHours =
    rawOpening &&
    typeof rawOpening === 'object' &&
    !Array.isArray(rawOpening) &&
    Object.keys(rawOpening as object).length > 0;
  const openingHoursForDisplay: typeof DEFAULT_HOURS | null = hasStoredOpeningHours
    ? (rawOpening as typeof DEFAULT_HOURS)
    : null;
  const todayKey = DAY_MAP[new Date().getDay()];

  const deliveryTimeLabel =
    r.delivery_time_min != null && r.delivery_time_max != null
      ? `${r.delivery_time_min}–${r.delivery_time_max} min`
      : r.delivery_time_min != null
        ? `≈ ${r.delivery_time_min} min`
        : null;

  const commitAddToCart = () => {
    if (!restaurant?.id) return;
    setRestaurant({ restaurantId: restaurant.id, restaurantName: r.name });
    // Auto-fill table number from QR code if present
    if (tableParam) {
      useCartStore.getState().setTableNumber(tableParam);
    }
    Object.entries(quantity).filter(([, qty]) => qty > 0).forEach(([itemId, qty]) => {
      const item = items.find(i => i.id === itemId);
      if (item) addItem({ itemId, itemName: item.name, quantity: qty, unitPrice: Number(item.price) });
    });
    setQuantity({});
    toast.success(tableParam 
      ? `Articles ajoutés au panier — Table ${tableParam}` 
      : 'Articles ajoutés au panier');
  };

  const handleAddToCart = () => {
    if (!user) { navigate('/login'); return; }
    if (!restaurant?.id) {
      toast.error('Restaurant indisponible');
      return;
    }
    // U1: si le panier contient des articles d’un autre resto, on demande
    // confirmation avant d’écraser silencieusement.
    if (
      cartRestaurantId &&
      cartRestaurantId !== restaurant.id &&
      cartItems.length > 0
    ) {
      setShowCartSwitchConfirm({
        fromName: cartRestaurantName || 'restaurant précédent',
        toName: r.name,
      });
      return;
    }
    commitAddToCart();
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-32">

      {/* ── Hero banner ── */}
      <div className="relative h-56 sm:h-72 overflow-hidden bg-gradient-to-br from-orange-400 to-red-600">
        {r.banner_url && (
          <img src={r.banner_url} alt="" role="presentation"
            className="absolute inset-0 w-full h-full object-cover" fetchPriority="high" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <button onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2.5 bg-black/30 backdrop-blur-md rounded-full text-white hover:bg-black/50 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="absolute top-4 right-4 flex items-center gap-2">
          <ShareButton type="restaurant" entityId={restaurant?.id ?? ''} title={r.name}
            description={`Découvrez ${r.name} sur Restafy`}
            imageUrl={r.banner_url || undefined} slug={r.slug || undefined} />
          {whatsappPhone && (
            <a href={`https://wa.me/${whatsappPhone.replace('+', '')}?text=${encodeURIComponent(`Bonjour ${r.name} !`)}`}
              target="_blank" rel="noopener noreferrer"
              className="p-2.5 bg-[#25D366]/90 backdrop-blur-md rounded-full text-white hover:bg-[#25D366]">
              <MessageCircle className="w-5 h-5" />
            </a>
          )}
        </div>

        {/* Badge ouvert/fermé */}
        <div className="absolute bottom-4 left-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md ${r.is_open ? 'bg-emerald-500/90 text-white' : 'bg-zinc-900/80 text-zinc-300'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${r.is_open ? 'bg-white animate-pulse' : 'bg-zinc-500'}`} />
            {r.is_open ? 'Ouvert maintenant' : 'Fermé'}
          </span>
        </div>
      </div>

      {/* ── Fiche restaurant ── */}
      <div className="px-4 -mt-12 relative z-10 mb-1">
        <div className="bg-white rounded-3xl shadow-xl border border-zinc-100 p-5">
          <div className="flex items-start gap-4 mb-4">
            {/* Logo */}
            <div className="flex-shrink-0">
              <RestaurantAvatar 
                src={r.logo_url} 
                name={r.name} 
                className="w-16 h-16 rounded-2xl border border-zinc-100 shadow-sm"
              />
            </div>
            {/* Infos */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-zinc-900 leading-tight">{r.name}</h1>
              <p className="text-sm text-zinc-500 mt-0.5">{r.cuisine_type || 'Restaurant'}{r.city ? ` · ${r.city}` : ''}</p>
              {/* Stats */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {avgRating > 0 && (
                  <button onClick={() => setActiveTab('reviews')} className="flex items-center gap-1 text-sm font-bold text-amber-600">
                    <Star className="w-4 h-4 fill-amber-400" />
                    {avgRating.toFixed(1)}
                    <span className="text-zinc-400 font-normal text-xs">({totalReviewsCount})</span>
                  </button>
                )}
                {deliveryTimeLabel && (
                  <span className="flex items-center gap-1 text-xs text-zinc-500">
                    <Clock className="w-3.5 h-3.5" />
                    {deliveryTimeLabel}
                  </span>
                )}
                {typeof r.delivery_fee === 'number' && (
                  <span className={`text-xs font-bold ${r.delivery_fee === 0 ? 'text-emerald-600' : 'text-zinc-500'}`}>
                    {r.delivery_fee === 0 ? 'Livraison gratuite' : `${r.delivery_fee.toLocaleString('fr-FR')} F livraison`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {r.description && (
            <p className="text-sm text-zinc-600 leading-relaxed mb-4">{r.description}</p>
          )}

          {/* Adresse */}
          {r.address && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-4">
              <MapPin className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
              <span>{r.address}</span>
            </div>
          )}

          {/* CTA */}
          <div className="flex gap-2">
            <button onClick={() => setShowReservationModal(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-2xl text-sm font-bold hover:bg-orange-100 transition-colors">
              <Calendar className="w-4 h-4" /> Réserver
            </button>
            {whatsappPhone && (
              <a href={`https://wa.me/${whatsappPhone.replace('+', '')}?text=${encodeURIComponent(`Bonjour ${r.name} !`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-2xl text-sm font-bold hover:bg-emerald-100 transition-colors">
                <Phone className="w-4 h-4" /> WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 py-2">
        <div className="flex gap-1 max-w-md">
          {([
            { key: 'menu', label: 'Menu' },
            { key: 'reviews', label: `Avis${reviews.length > 0 ? ` (${reviews.length})` : ''}` },
            { key: 'info', label: 'Infos & Horaires' },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab.key ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ MENU ══ */}
      {activeTab === 'menu' && (
        <div className="pb-4">
          {/* Filtres catégories */}
          {categories.length > 0 && (
            <div className="px-4 py-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <button onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-all ${selectedCategory === null ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}>
                Tout ({items.length})
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border transition-all ${selectedCategory === cat.id ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'}`}>
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          <div className="px-4 space-y-3 mt-1">
            {menuLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : categoryItems.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-zinc-100">
                <UtensilsCrossed className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                <p className="text-zinc-400 font-medium">Aucun plat disponible pour le moment</p>
              </div>
            ) : (
              categoryItems.map(item => (
                <div key={item.id}
                  className={`bg-white rounded-2xl border border-zinc-100 shadow-sm flex gap-4 p-4 ${!item.is_available ? 'opacity-50' : ''}`}>
                  {item.image_url && (
                    <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" loading="lazy" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-zinc-900 leading-tight">{item.name}</h3>
                      {!item.is_available && (
                        <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">Indispo</span>
                      )}
                    </div>
                    {item.description && <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{item.description}</p>}
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-black text-orange-600">{Number(item.price).toLocaleString('fr-FR')} <span className="text-xs font-semibold text-zinc-400">FCFA</span></span>
                      {item.is_available && (
                        <div className="flex items-center gap-2">
                          {(quantity[item.id] ?? 0) > 0 && (
                            <>
                              <button onClick={() => setQuantity(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] ?? 0) - 1) }))}
                                className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50">
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-black text-sm w-5 text-center">{quantity[item.id]}</span>
                            </>
                          )}
                          <button onClick={() => setQuantity(p => ({ ...p, [item.id]: (p[item.id] ?? 0) + 1 }))}
                            className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md hover:bg-orange-600 active:scale-95 transition-all">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══ AVIS ══ */}
      {activeTab === 'reviews' && (
        <div className="px-4 py-4 space-y-4">
          {/* En-tête avis */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-zinc-900">Avis clients</h2>
              {avgRating > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-zinc-900">{avgRating.toFixed(1)}</span>
                  <div>
                    <StarRow value={Math.round(avgRating)} readonly size="sm" />
                    <p className="text-xs text-zinc-400 mt-0.5">{totalReviewsCount} avis</p>
                  </div>
                </div>
              )}
            </div>
            {user ? (
              canReview ? (
                <button onClick={() => setShowReviewForm(!showReviewForm)}
                  className="w-full py-2.5 border-2 border-orange-200 text-orange-600 rounded-xl font-bold text-sm hover:bg-orange-50 transition-colors">
                  {showReviewForm ? 'Annuler' : '✍️ Laisser mon avis'}
                </button>
              ) : (
                <p className="text-center text-sm text-zinc-500 bg-zinc-50 rounded-xl py-3 px-2 leading-relaxed">
                  Les notes sont réservées aux clients ayant reçu une commande <strong>livrée</strong> depuis ce restaurant
                  (une note par commande). Passez commande puis, une fois la livraison terminée, vous pourrez donner votre avis ici.
                </p>
              )
            ) : (
              <button onClick={() => navigate('/login')} className="w-full py-2.5 border border-zinc-200 text-zinc-600 rounded-xl font-semibold text-sm hover:bg-zinc-50">
                Se connecter pour laisser un avis
              </button>
            )}
          </div>

          {showReviewForm && user && canReview && (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 space-y-4">
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Note</p>
                <StarRow value={newReview.rating} onChange={v => setNewReview(p => ({ ...p, rating: v }))} size="lg" />
              </div>
              <textarea value={newReview.comment} onChange={e => setNewReview(p => ({ ...p, comment: e.target.value }))}
                placeholder="Partagez votre expérience…" rows={3}
                className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 resize-none bg-white" />
              <button onClick={handleSubmitReview} disabled={submittingReview || !newReview.comment.trim()}
                className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Publier
              </button>
            </div>
          )}

          {reviews.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-zinc-100">
              <MessageSquare className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
              <p className="text-zinc-400 font-medium">Aucun avis pour le moment</p>
            </div>
          ) : (
            reviews.map(review => (
              <div key={review.id} className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-black text-sm flex-shrink-0">
                      {(reviewAuthorName(review.profiles) ?? 'A')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-zinc-900">{reviewAuthorName(review.profiles) ?? 'Client anonyme'}</span>
                        {review.is_verified && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-full border border-sky-100">
                            <BadgeCheck className="w-3 h-3" /> Vérifié
                          </span>
                        )}
                      </div>
                      <StarRow value={review.rating} readonly size="sm" />
                    </div>
                  </div>
                  <time className="text-xs text-zinc-400">{new Date(review.created_at).toLocaleDateString('fr-FR')}</time>
                </div>
                <p className="text-sm text-zinc-700 leading-relaxed">{review.comment}</p>
                {review.restaurant_reply && (
                  <div className="mt-3 bg-orange-50 border border-orange-100 rounded-xl p-3">
                    <p className="text-xs font-bold text-orange-600 mb-1">Réponse du restaurant</p>
                    <p className="text-sm text-orange-900">{review.restaurant_reply}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ══ INFOS & HORAIRES ══ */}
      {activeTab === 'info' && (
        <div className="px-4 py-4 space-y-4">

          {/* Infos générales */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
            <h2 className="font-black text-zinc-900">Informations</h2>
            {r.description && <p className="text-sm text-zinc-600 leading-relaxed">{r.description}</p>}

            <div className="space-y-3">
              {r.address && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Adresse</p>
                    <p className="text-sm text-zinc-700 font-medium">{r.address}{r.city ? `, ${r.city}` : ''}</p>
                  </div>
                </div>
              )}
              {r.phone && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Téléphone</p>
                    <a href={`tel:${r.phone}`} className="text-sm text-emerald-700 font-medium hover:underline">{r.phone}</a>
                  </div>
                </div>
              )}
              {r.website && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-sky-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <ExternalLink className="w-4 h-4 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Site web</p>
                    <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-600 font-medium hover:underline">{r.website}</a>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Délai de livraison</p>
                  <p className="text-sm text-zinc-700 font-medium">
                    {deliveryTimeLabel ?? 'Non renseigné — contactez le restaurant'}
                  </p>
                </div>
              </div>
              {(r.min_order ?? 0) > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Commande minimum</p>
                    <p className="text-sm text-zinc-700 font-medium">{(r.min_order ?? 0).toLocaleString('fr-FR')} FCFA</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Horaires d'ouverture */}
          <div className="bg-white rounded-2xl border border-zinc-100 p-5">
            <h2 className="font-black text-zinc-900 mb-4">Horaires d'ouverture</h2>
            {openingHoursForDisplay ? (
              <div className="space-y-2">
                {Object.entries(openingHoursForDisplay).map(([day, hours]) => {
                  const isToday = day === todayKey;
                  return (
                    <div key={day} className={`flex items-center justify-between py-2 px-3 rounded-xl transition-colors ${isToday ? 'bg-orange-50 border border-orange-100' : 'hover:bg-zinc-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold w-8 ${isToday ? 'text-orange-700' : 'text-zinc-700'}`}>{day}</span>
                        {isToday && <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full">Aujourd'hui</span>}
                      </div>
                      {hours.closed ? (
                        <span className="text-sm text-zinc-400 font-medium">Fermé</span>
                      ) : (
                        <span className={`text-sm font-bold ${isToday ? 'text-orange-700' : 'text-zinc-600'}`}>
                          {hours.open} – {hours.close}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 py-2">
                Aucun horaire renseigné pour le moment. Le statut ci-dessous reflète ce que le restaurant indique sur Restafy.
              </p>
            )}
            <div className="mt-4 flex items-center gap-2 bg-zinc-50 rounded-xl px-3 py-2.5 border border-zinc-100">
              <Info className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <p className="text-xs text-zinc-500">
                Statut actuel : <span className={`font-bold ${r.is_open ? 'text-emerald-600' : 'text-red-500'}`}>{r.is_open ? 'Ouvert' : 'Fermé'}</span>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button onClick={() => setShowReservationModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-700 transition-colors">
              <Calendar className="w-5 h-5" /> Réserver une table
            </button>
            {whatsappPhone && (
              <a href={`https://wa.me/${whatsappPhone.replace('+', '')}?text=${encodeURIComponent(`Bonjour ${r.name}, je voudrais réserver.`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#25D366] text-white rounded-2xl font-bold hover:bg-green-600 transition-colors">
                <MessageCircle className="w-5 h-5" /> Contacter via WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Floating CTA ajouter au panier ── */}
      {hasItems && (
        <div className="fixed bottom-6 left-4 right-4 z-50 max-w-lg mx-auto">
          <button onClick={handleAddToCart}
            className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white p-4 rounded-2xl shadow-2xl shadow-orange-500/30 flex items-center justify-between font-bold transition-all">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-1.5 rounded-xl">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <span>Ajouter au panier</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white/20 px-2.5 py-1 rounded-xl text-sm">
                {Object.values(quantity).reduce((s, q) => s + q, 0)} article{Object.values(quantity).reduce((s, q) => s + q, 0) > 1 ? 's' : ''}
              </span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* ── Floating CTA voir panier ── */}
      {cartCount > 0 && !hasItems && (
        <div className="fixed bottom-6 left-4 right-4 z-50 max-w-lg mx-auto">
          <button onClick={() => navigate('/cart')}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 p-1.5 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Votre panier</p>
                <p className="font-bold text-sm">{cartCount} article{cartCount > 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">{cartTotal.toLocaleString('fr-FR')} F</span>
              <ChevronRight className="w-4 h-4 text-orange-500" />
            </div>
          </button>
        </div>
      )}

      {/* ── Modal réservation ── */}
      {showReservationModal && (
        <ReservationModal
          restaurantId={restaurant?.id ?? ''} restaurantName={r.name} restaurantPhone={r.phone || null}
          onClose={() => setShowReservationModal(false)}
          customerId={user?.id} customerName={profile?.full_name ?? undefined} customerPhone={profile?.phone ?? undefined}
        />
      )}

      {/* ── Modal confirmation switch panier (U1) ── */}
      {showCartSwitchConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-lg font-black text-zinc-900">Vider le panier&nbsp;?</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Votre panier contient déjà des articles de{' '}
                <span className="font-bold text-zinc-900">{showCartSwitchConfirm.fromName}</span>.
                Pour ajouter des plats de{' '}
                <span className="font-bold text-zinc-900">{showCartSwitchConfirm.toName}</span>,
                il faut d&apos;abord vider le panier actuel.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCartSwitchConfirm(null)}
                className="flex-1 px-4 py-3 rounded-xl bg-zinc-100 text-zinc-700 font-bold text-sm hover:bg-zinc-200 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowCartSwitchConfirm(null);
                  commitAddToCart();
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-orange-600 text-white font-bold text-sm hover:bg-orange-700 transition"
              >
                Vider et continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
