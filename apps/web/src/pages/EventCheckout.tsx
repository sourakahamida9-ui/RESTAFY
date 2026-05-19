import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, User, Mail, Phone, SmartphoneNfc,
  CheckCircle2, Clock, X, ChevronRight, Sparkles, CreditCard,
  Ticket as TicketIcon, Calendar, ArrowRight, Loader2, Shield,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import { useAuth } from '@/hooks/useAuth';
import { createNotification, playNotificationSound, showBrowserNotification } from '@/lib/notifications';
import { sendTicketConfirmation } from '@/lib/email';

import { toast } from 'sonner';
import KkiapayPaymentModal from '@/components/KkiapayPaymentModal';
import { Badge } from '@/components/ui/Badge';

interface DBEvent {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
  image_url: string | null;
  restaurant_id: string;
  restaurants: { name: string } | null;
}

interface DBTicketType {
  id: string;
  name: string;
  price: number;
  quantity_available: number;
  quantity_sold: number;
}

const EVENT_COMMISSION_RATE = 0.05;

export default function EventCheckout() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const ticketTypeId = searchParams.get('ticketId');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState<DBEvent | null>(null);
  const [ticketType, setTicketType] = useState<DBTicketType | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const [showPayment, setShowPayment] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string>('');
  const [directPaymentTicket, setDirectPaymentTicket] = useState<{
    purchaseId: string;
    ticketNumber: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const prefill = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', user.id)
        .single();
      if (!cancelled && data) {
        setFormData(prev => ({
          ...prev,
          name: data.full_name || prev.name,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
        }));
      }
    };
    prefill();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      if (!id || !ticketTypeId) return;
      setLoadingData(true);
      try {
        const [eventRes, ticketRes] = await Promise.all([
          supabase.from('events').select('*, restaurants(name)').eq('id', id).single(),
          supabase.from('event_tickets').select('id,name,price,quantity_available,quantity_sold').eq('id', ticketTypeId).single(),
        ]);
        if (eventRes.error) throw eventRes.error;
        if (ticketRes.error) throw ticketRes.error;
        if (!cancelled) {
          setEvent(eventRes.data);
          setTicketType(ticketRes.data);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[EventCheckout] Erreur fetch data:', err);
        if (!cancelled) navigate('/events');
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [id, ticketTypeId, navigate]);

  const isFormValid = formData.name.trim() && formData.email.trim() && formData.phone.trim();

  const extractErrorMessage = (_err: unknown): string => {
    return 'Une erreur est survenue. Veuillez réessayer.';
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const baseAmount = ticketType?.price || 0;
  const commissionAmount = Math.round(baseAmount * EVENT_COMMISSION_RATE);
  const totalAmount = baseAmount + commissionAmount;

  const createPendingTicket = async (paymentChannel: 'ussd' | 'kkiapay') => {
    if (!event || !ticketType || !user) throw new Error('Contexte de paiement incomplet');
    const idPart = event.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const rnd = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => (b % 36).toString(36))
      .join('')
      .toUpperCase();
    const qrCode = `RESTAFY-${idPart}-${rnd}`;

    const { data: purchase, error: purchaseErr } = await supabase
      .from('ticket_purchases')
      .insert([
        {
          ticket_id: ticketType.id,
          event_id: event.id,
          customer_id: user.id,
          customer_name: formData.name,
          customer_email: formData.email,
          customer_phone: formData.phone,
          qr_code_data: qrCode,
          amount_paid: totalAmount,
          is_used: false,
          status: 'pending',
        },
      ])
      .select('id, ticket_number')
      .single();

    if (purchaseErr) throw purchaseErr;

    const finalTicketNumber =
      purchase.ticket_number || `TKT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    return { purchaseId: purchase.id, ticketNumber: finalTicketNumber, qrCode, paymentChannel };
  };

  const handleFreeTicket = async () => {
    if (!event || !ticketType || !user || isSubmitting) return;
    if (!isFormValid) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setIsSubmitting(true);
    try {
      const idPart = event.id.replace(/-/g, '').slice(0, 8).toUpperCase();
      const rnd = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => (b % 36).toString(36))
        .join('')
        .toUpperCase();
      const qrCode = `RESTAFY-${idPart}-${rnd}`;

      const { data: purchase, error: purchaseErr } = await supabase
        .from('ticket_purchases')
        .insert([{
          ticket_id: ticketType.id,
          event_id: event.id,
          customer_id: user.id,
          customer_name: formData.name,
          customer_email: formData.email,
          customer_phone: formData.phone,
          qr_code_data: qrCode,
          amount_paid: 0,
          is_used: false,
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        }])
        .select('id, ticket_number')
        .single();

      if (purchaseErr) throw purchaseErr;

      const finalTicketNumber =
        purchase.ticket_number || `TKT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      setPurchaseId(purchase.id);
      setTicketNumber(finalTicketNumber);

      createNotification(user.id, {
        type: 'event',
        title: 'Billet confirme',
        message: `Votre inscription gratuite pour "${event.title}" est confirmee.`,
        action_url: `/my-tickets/${purchase.id}`,
      }).catch(() => {});

      try {
        await sendTicketConfirmation({
          customerEmail: formData.email,
          customerName: formData.name,
          eventTitle: event.title,
          ticketType: ticketType.name,
          ticketNumber: finalTicketNumber,
          qrCodeData: qrCode,
          eventDate: event.start_time,
          eventLocation: event.location || '',
          quantity: 1,
          totalPrice: 0,
          restaurantName: event.restaurants?.name || '',
        });
      } catch { /* email is best-effort */ }

      playNotificationSound('message');
      setIsSuccess(true);
      void import('canvas-confetti').then(({ default: confetti }) =>
        confetti({ particleCount: 160, spread: 72, origin: { y: 0.55 }, colors: ['#FF6B00', '#22C55E', '#1A1A1A'] })
      ).catch(() => {});
    } catch (err) {
      const msg = extractErrorMessage(err);
      toast.error(`Erreur : ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUSSDPayment = async () => {
    if (!event || !ticketType) return;
    if (isSubmitting) return;

    if (!isFormValid) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (!user) {
      toast.error('Vous devez etre connecte pour acheter un billet. Veuillez vous connecter et reessayer.');
      navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await createPendingTicket('ussd');
      setPurchaseId(created.purchaseId);
      setTicketNumber(created.ticketNumber);

      createNotification(user.id, {
        type: 'event',
        title: 'Paiement en cours de verification',
        message: `Votre paiement pour "${event.title}" est en cours de verification. Vous recevrez un email de confirmation.`,
        action_url: `/my-tickets/${created.purchaseId}`,
      }).catch((e) => {
        if (import.meta.env.DEV) console.warn('[EventCheckout] Notif non creee:', e);
      });

      sendTicketConfirmation({
        customerEmail: formData.email,
        customerName: formData.name,
        ticketNumber: created.ticketNumber,
        eventTitle: event.title,
        eventDate: event.start_time,
        eventLocation: event.location || 'Lieu non precise',
        ticketType: ticketType.name,
        quantity: 1,
        totalPrice: totalAmount,
        qrCodeData: created.qrCode,
        restaurantName: event.restaurants?.name || 'Restafy',
        eventImage: event.image_url || undefined,
      }).catch((e) => {
        console.error('[EventCheckout] Email non envoye:', e);
        const detail = e instanceof Error ? e.message : '';
        toast.error(`Email de confirmation non envoye${detail ? ` : ${detail}` : ''}. Votre billet reste valide.`);
      });

      playNotificationSound('message');

      void showBrowserNotification('Restafy - Paiement', {
        body: `Paiement en cours de verification pour: ${event.title}`,
        tag: `ticket-${created.purchaseId}`,
      });

      setIsSuccess(true);
      // Lazy-load confetti only when actually firing — keeps it out of the
      // EventCheckout chunk's initial paint.
      void import('canvas-confetti').then(({ default: confetti }) =>
        confetti({
          particleCount: 160, spread: 72, origin: { y: 0.55 },
          colors: ['#FF6B00', '#22C55E', '#1A1A1A'],
        })
      ).catch(() => {});

    } catch (err) {
      const msg = extractErrorMessage(err);
      if (import.meta.env.DEV) console.error('[EventCheckout] Erreur handleUSSDPayment:', msg, err);
      toast.error(`Erreur lors de la confirmation : ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKkiapay = async () => {
    if (!event || !ticketType || !user || isSubmitting) return;

    if (!isFormValid) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createPendingTicket('kkiapay');
      setPurchaseId(created.purchaseId);
      setTicketNumber(created.ticketNumber);

      // Persiste le numéro saisi pour pré-remplir les prochains achats.
      // Fire-and-forget : on ne bloque pas l'ouverture du widget Kkiapay.
      const trimmedPhone = formData.phone.trim();
      if (user?.id && trimmedPhone) {
        void supabase
          .from('profiles')
          .update({ phone: trimmedPhone })
          .eq('id', user.id);
      }

      setDirectPaymentTicket({
        purchaseId: created.purchaseId,
        ticketNumber: created.ticketNumber,
      });
      setShowPayment(false);
    } catch (err) {
      const msg = extractErrorMessage(err);
      if (import.meta.env.DEV) console.error('[EventCheckout] Erreur handleKkiapay:', msg, err);
      toast.error(`Paiement Kkiapay impossible : ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-[#fafaf9]">
        <RestafyLoader fullscreen={false} message="Chargement du billet..." size="md" />
      </div>
    );
  }

  if (!event || !ticketType) return null;

  // Success Screen
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex flex-col items-center justify-center px-5 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 20 }}
          className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 border border-emerald-100"
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          {totalAmount === 0 ? (
            <>
              <Badge variant="success" size="md" dot className="mb-4">Confirme</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-2">Inscription confirmee</h2>
              <p className="text-sm text-zinc-500 mb-8 max-w-xs mx-auto">
                Votre inscription gratuite pour <span className="font-semibold text-orange-600">{event.title}</span> est confirmee.
              </p>
            </>
          ) : (
            <>
              <Badge variant="warning" size="md" dot className="mb-4">Verification en cours</Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-2">Paiement recu</h2>
              <p className="text-sm text-zinc-500 mb-2 max-w-xs mx-auto">
                Votre paiement pour <span className="font-semibold text-orange-600">{event.title}</span> est en cours de verification.
              </p>
              <p className="text-xs text-zinc-400 mb-8 max-w-xs mx-auto">
                Vous recevrez un email de confirmation avec votre billet et QR code.
              </p>
            </>
          )}
        </motion.div>

        {/* Ticket Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl border border-zinc-100 shadow-md p-5 w-full max-w-sm mb-8"
        >
          <div className="flex items-center gap-3.5 mb-4 pb-4 border-b border-dashed border-zinc-200">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
              <TicketIcon className="w-5.5 h-5.5 text-orange-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-zinc-900">{ticketType.name}</p>
              <p className="text-xs text-orange-600 font-semibold mt-0.5">{ticketNumber}</p>
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Date</span>
              <span className="text-sm font-semibold text-zinc-900">
                {new Date(event.start_time).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Montant</span>
              <span className="text-sm font-bold text-orange-600">{totalAmount.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          onClick={() => navigate('/mes-billets')}
          className="bg-orange-600 text-white rounded-2xl px-8 py-3.5 text-sm font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-lg shadow-orange-600/25"
        >
          Voir mon billet <ArrowRight className="w-4.5 h-4.5" />
        </motion.button>
      </div>
    );
  }

  const formFields = [
    { icon: User, key: 'name' as const, placeholder: 'Nom complet', type: 'text', label: 'Nom' },
    { icon: Mail, key: 'email' as const, placeholder: 'votre@email.com', type: 'email', label: 'Email' },
    { icon: Phone, key: 'phone' as const, placeholder: '+229 XX XX XX XX', type: 'tel', label: 'Telephone' },
  ];

  return (
    <div className="min-h-screen bg-[#fafaf9] pb-40">
      {/* Header */}
      <div className="bg-white border-b border-zinc-100">
        <div className="max-w-lg mx-auto px-4 pt-12 pb-5">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center hover:bg-zinc-100 transition-colors mb-4"
          >
            <ArrowLeft className="w-4.5 h-4.5 text-zinc-600" />
          </button>
          <Badge variant="outline" size="sm" className="mb-2.5">Reservation</Badge>
          <h1 className="text-xl font-bold text-zinc-900">Finalisez votre billet</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {/* Event Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 flex gap-3.5 items-center"
        >
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-zinc-100 flex items-center justify-center">
            {event.image_url ? (
              <img src={event.image_url} alt={event.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              <TicketIcon className="w-6 h-6 text-zinc-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-zinc-900 truncate">{event.title}</h3>
            <p className="text-sm font-semibold text-orange-600 mt-0.5">
              {ticketType.name} · {ticketType.price.toLocaleString('fr-FR')} FCFA
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <Calendar className="w-3 h-3 text-zinc-400" />
              <span className="text-xs text-zinc-500 font-medium">
                {new Date(event.start_time).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-4">Vos informations</p>
          <div className="space-y-3.5">
            {formFields.map(({ icon: Icon, key, placeholder, type, label }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">{label}</label>
                <div className="relative">
                  <Icon className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={type}
                    value={formData[key]}
                    onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all hover:border-zinc-300"
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Price Summary */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-zinc-900 rounded-2xl p-5 text-white relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-orange-500/15 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="flex justify-between items-end relative z-10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1.5">Total a payer</p>
              <p className="text-3xl font-bold tracking-tight">
                {totalAmount.toLocaleString('fr-FR')} <span className="text-base text-zinc-400 font-medium">FCFA</span>
              </p>
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Billet: {baseAmount.toLocaleString('fr-FR')} F · Commission (5%): {commissionAmount.toLocaleString('fr-FR')} F
              </p>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => totalAmount === 0 ? handleFreeTicket() : setShowPayment(true)}
          disabled={!isFormValid || isSubmitting}
          className={`w-full rounded-2xl py-4 text-[15px] font-bold flex items-center justify-center gap-2.5 transition-all duration-200 ${
            isFormValid && !isSubmitting
              ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25 hover:bg-orange-700'
              : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting && <Loader2 className="w-4.5 h-4.5 animate-spin" />}
          {totalAmount === 0 ? 'Confirmer (gratuit)' : 'Confirmer & Payer'}
          <ArrowRight className="w-4.5 h-4.5" />
        </motion.button>

        {/* Trust badge */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Shield className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs text-zinc-400">Paiement securise via Kkiapay</span>
        </div>
      </div>

      <AnimatePresence>
        {showPayment && (
          <USSDModal
            amount={totalAmount}
            onClose={() => setShowPayment(false)}
            onUSSDSuccess={handleUSSDPayment}
            onKkiapay={handleKkiapay}
            busy={isSubmitting}
          />
        )}
        {directPaymentTicket && event && (
          <KkiapayPaymentModal
            amount={totalAmount}
            description={`Billet evenement: ${event.title}`}
            customerName={formData.name}
            customerEmail={formData.email}
            defaultPhone={formData.phone || null}
            ticketPurchaseId={directPaymentTicket.purchaseId}
            restaurantId={event.restaurant_id}
            restaurantName={event.restaurants?.name}
            metadata={{
              payment_context: 'event_ticket',
              event_id: event.id,
              restaurant_id: event.restaurant_id,
              commission_rate: EVENT_COMMISSION_RATE,
              base_amount: baseAmount,
              commission_amount: commissionAmount,
              total_amount: totalAmount,
            }}
            onSuccess={({ reference }) => {
              try {
                localStorage.setItem(
                  'pending_payment',
                  JSON.stringify({
                    reference,
                    purchase_id: directPaymentTicket.purchaseId,
                    type: 'event',
                    event_id: event.id,
                  }),
                );
              } catch {
                /* localStorage indisponible (incognito iOS) */
              }
              setDirectPaymentTicket(null);
              setShowPayment(false);
              navigate(`/payment/success?type=event&reference=${encodeURIComponent(reference)}`);
            }}
            onClose={() => {
              const purchaseIdToCancel = directPaymentTicket.purchaseId;
              setDirectPaymentTicket(null);
              void (async () => {
                try {
                  const { data: sessionData } = await supabase.auth.getSession();
                  const accessToken = sessionData?.session?.access_token;
                  if (!accessToken) return;
                  await fetch('/api/orders/cancel', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                      ticket_purchase_id: purchaseIdToCancel,
                      reason: 'user_closed_payment_modal',
                    }),
                  });
                } catch (err) {
                  console.warn('[EventCheckout] orphan ticket cleanup failed:', err);
                }
              })();
            }}
            onError={(msg) => {
              toast.error(msg);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Payment Method Selection Modal
function USSDModal({
  amount,
  onClose,
  onUSSDSuccess,
  onKkiapay,
  busy,
}: {
  amount: number;
  onClose: () => void;
  onUSSDSuccess: () => Promise<void>;
  onKkiapay: () => Promise<void>;
  busy: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const steps = [
    'Vous recevrez une notification sur votre telephone',
    'Confirmez le paiement dans votre app Mobile Money',
    `Montant: ${amount.toLocaleString('fr-FR')} FCFA`,
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-end justify-center p-4"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white rounded-t-3xl rounded-b-2xl w-full max-w-md overflow-hidden shadow-xl"
      >
        {/* Header */}
        <div className="bg-zinc-900 px-5 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-[15px] font-bold text-white">Paiement Mobile Money</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{amount.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-sm text-zinc-500 mb-4">
            Paiement securise via Kkiapay (MTN MoMo / Moov Money / Carte)
          </p>

          <div className="bg-zinc-50 rounded-xl p-4 mb-5 space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-orange-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-white">{i + 1}</span>
                </div>
                <span className="text-sm text-zinc-600 leading-relaxed">{step}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => { setLoading(true); void onKkiapay(); }}
            disabled={loading || busy}
            className={`w-full rounded-2xl py-4 text-[15px] font-bold flex items-center justify-center gap-2.5 transition-all duration-200 ${
              loading || busy
                ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                : 'bg-orange-600 text-white shadow-lg shadow-orange-600/25 hover:bg-orange-700'
            }`}
          >
            {(loading || busy) && <Loader2 className="w-4.5 h-4.5 animate-spin" />}
            <CreditCard className="w-4.5 h-4.5" />
            Payer maintenant
          </button>

          <div className="flex items-center justify-center gap-2 mt-3">
            <Shield className="w-3 h-3 text-zinc-400" />
            <span className="text-[11px] text-zinc-400">Paiement chiffre de bout en bout</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
