// src/pages/Cart.tsx — Refonte panier (audit cart)
// Fixes critiques B1…B5 (loyalty branchée, fetch frais stable,
// time slots auto-refresh, validation server-side prix, cart UX).

import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/hooks/useOrderCart';
import { useOrderManager } from '@/hooks/useOrderManager';
import { useCustomerLoyalty } from '@/hooks/useLoyalty';
import { useOrderModes } from '@/hooks/useOrderModes';
import type { CartItem } from '@/hooks/useOrderCart';
import KkiapayPaymentModal from '@/components/KkiapayPaymentModal';
import {
  ArrowLeft, Trash2, Plus, Minus, MapPin, SmartphoneNfc,
  ChevronRight, X, CheckCircle2, Clock, ShoppingBag,
  Loader2, AlertCircle, UtensilsCrossed, ShoppingBag as BagIcon, Bike, Star, Gift, Tag, CreditCard,
  Phone, Plus as PlusIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { safeParseResponse } from '@/lib/http/safeParseResponse';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────
type OrderMode = 'delivery' | 'dine_in' | 'takeaway';

/** Aligne les codes Supabase sur les 3 modes UI (évite value === jamais vrai → état incohérent). */
function normalizeOrderModeCode(code: string): OrderMode {
  const c = (code || '').toLowerCase().trim();
  if (c === 'delivery' || c === 'livraison') return 'delivery';
  if (c === 'dine_in' || c === 'sur_place' || c === 'surplace' || c === 'on_site') return 'dine_in';
  if (c === 'takeaway' || c === 'pickup' || c === 'emporter' || c === 'a_emporter') return 'takeaway';
  return 'delivery';
}

interface OrderModeOption {
  rowId: string;
  code: OrderMode;
  icon: React.ReactNode;
  label: string;
  sub: string;
}

// Génère des créneaux horaires à partir de maintenant (min 20 min, toutes les 15 min, sur 2h)
function generateTimeSlots(): { label: string; value: string }[] {
  const slots: { label: string; value: string }[] = [];
  const now = new Date();
  const start = new Date(now.getTime() + 20 * 60 * 1000);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);

  for (let i = 0; i < 9; i++) {
    const t = new Date(start.getTime() + i * 15 * 60 * 1000);
    const hh = t.getHours().toString().padStart(2, '0');
    const mm = t.getMinutes().toString().padStart(2, '0');
    const diff = Math.round((t.getTime() - now.getTime()) / 60000);
    const label = diff < 60
      ? `${hh}:${mm} (dans ~${diff} min)`
      : `${hh}:${mm} (dans ~${Math.round(diff / 60)}h)`;
    slots.push({ label, value: `${hh}:${mm}` });
  }
  return slots;
}

// ─── Helper pour obtenir l'icône du mode ─────────────────────────────────────
function getOrderModeIcon(code: string): React.ReactNode {
  switch (code) {
    case 'delivery':
      return <Bike className="w-5 h-5" />;
    case 'dine_in':
    case 'sur_place':
      return <UtensilsCrossed className="w-5 h-5" />;
    case 'takeaway':
    case 'pickup':
      return <BagIcon className="w-5 h-5" />;
    default:
      return <ShoppingBag className="w-5 h-5" />;
  }
}

const FALLBACK_ORDER_MODES: OrderModeOption[] = [
  { rowId: 'fallback-delivery', code: 'delivery', icon: <Bike className="w-5 h-5" />, label: 'Livraison', sub: 'À votre adresse' },
  { rowId: 'fallback-dine_in', code: 'dine_in', icon: <UtensilsCrossed className="w-5 h-5" />, label: 'Sur place', sub: 'Sans frais' },
  { rowId: 'fallback-takeaway', code: 'takeaway', icon: <BagIcon className="w-5 h-5" />, label: 'À emporter', sub: 'Au restaurant' },
];

// ─── CartItemRow (mémoïsé) ────────────────────────────────────────────────────
const CartItemRow = memo(function CartItemRow({
  item,
  onRemove,
  onUpdateQty,
  onUpdateNote,
}: {
  item: CartItem;
  onRemove: (id: string) => void;
  onUpdateQty: (id: string, qty: number) => void;
  onUpdateNote: (id: string, note: string) => void;
}) {
  const [showNote, setShowNote] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-2"
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-zinc-900 truncate">{item.itemName}</h3>
          <p className="text-xs text-orange-600 font-black mt-0.5">
            {(item.unitPrice * item.quantity).toLocaleString('fr-FR')} FCFA
            <span className="text-zinc-300 font-normal ml-1">
              ({item.unitPrice.toLocaleString('fr-FR')} × {item.quantity})
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 bg-zinc-50 rounded-xl p-1">
          <button
            onClick={() => onUpdateQty(item.itemId, item.quantity - 1)}
            disabled={item.quantity <= 1}
            aria-label="Diminuer la quantité"
            className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-sm font-black w-5 text-center">{item.quantity}</span>
          <button
            onClick={() => onUpdateQty(item.itemId, item.quantity + 1)}
            aria-label="Augmenter la quantité"
            className="w-7 h-7 flex items-center justify-center text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <button
          onClick={() => onRemove(item.itemId)}
          className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {!showNote && !item.notes && (
        <button
          onClick={() => setShowNote(true)}
          className="text-[11px] font-bold text-zinc-400 hover:text-orange-600 transition-colors"
        >
          ✏️ Ajouter une personnalisation...
        </button>
      )}
      {(showNote || item.notes) && (
        <input
          type="text"
          value={item.notes || ''}
          onChange={(e) => onUpdateNote(item.itemId, e.target.value)}
          onBlur={() => { if (!item.notes) setShowNote(false); }}
          autoFocus={showNote && !item.notes}
          placeholder="Ex: sans oignon, bien cuit, sauce à part..."
          className="w-full text-xs px-3 py-2 bg-orange-50 border border-orange-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 text-zinc-800 placeholder:text-zinc-400 font-medium"
        />
      )}
    </motion.div>
  );
});

// ─── Sélecteur de mode (mémoïsé) ─────────────────────────────────────────────
const OrderModeSelector = memo(function OrderModeSelector({
  modes,
  value,
  onChange,
}: {
  modes: OrderModeOption[];
  value: OrderMode;
  onChange: (m: OrderMode) => void;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(modes.length, 3)}, 1fr)` }}>
      {modes.map((m) => {
        const active = value === m.code;
        return (
          <button
            key={m.rowId}
            type="button"
            onClick={() => onChange(m.code)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all font-semibold text-center
              ${active
                ? 'border-orange-600 bg-orange-50 text-orange-600 shadow-sm shadow-orange-100'
                : 'border-zinc-100 bg-white text-zinc-500 hover:border-zinc-200'
              }`}
          >
            <span className={active ? 'text-orange-600' : 'text-zinc-400'}>
              {m.icon}
            </span>
            <span className="text-[11px] font-black leading-tight">{m.label}</span>
            <span className="text-[9px] font-medium text-zinc-400 leading-tight">{m.sub}</span>
          </button>
        );
      })}
    </div>
  );
});

// ─── Composant principal ─────────────────────────────────────────────
export default function Cart() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { modes: dynamicModes, loading: modesLoading } = useOrderModes();

  const items = useCartStore((s) => s.items);
  const restaurantId = useCartStore((s) => s.restaurantId);
  const restaurantName = useCartStore((s) => s.restaurantName);
  const cartTableNumber = useCartStore((s) => s.tableNumber);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateItemQuantity = useCartStore((s) => s.updateItemQuantity);
  const updateItemNote = useCartStore((s) => s.updateItemNote);
  const clear = useCartStore((s) => s.clear);
  const subtotal = useCartStore((s) => s.subtotal);

  // Loyalty (B1): branché sur le restaurant courant.
  const loyalty = useCustomerLoyalty(restaurantId);

  const { loading: orderLoading } = useOrderManager();

  // Si le panier a été démarré par un scan QR de table (cartTableNumber set),
  // on force le mode "sur place" (dine_in) par défaut.
  const [orderMode, setOrderMode] = useState<OrderMode>(cartTableNumber ? 'dine_in' : 'delivery');

  useEffect(() => {
    if (dynamicModes.length === 0) return;
    const allowed = new Set(dynamicModes.map((m) => normalizeOrderModeCode(m.code)));
    // Si un n° de table vient d'un QR, on privilégie dine_in tant que ce mode est supporté.
    if (cartTableNumber && allowed.has('dine_in') && orderMode !== 'dine_in') {
      setOrderMode('dine_in');
      return;
    }
    if (!allowed.has(orderMode)) {
      setOrderMode(normalizeOrderModeCode(dynamicModes[0].code));
    }
  }, [dynamicModes, orderMode, cartTableNumber]);

  const [deliveryAddress, setDeliveryAddress] = useState(profile?.address || '');
  const [tableNumber, setTableNumber] = useState(cartTableNumber ?? '');
  const [pickupTime, setPickupTime] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showKkiapayModal, setShowKkiapayModal] = useState(false);
  const [kkiapayOrderData, setKkiapayOrderData] = useState<{
    orderId: string;
    totalAmount: number;
    description: string;
    metadata: Record<string, unknown>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Phone capture (U7) — collect inline if profile.phone is missing.
  const [phoneInput, setPhoneInput] = useState(profile?.phone || '');
  const [showPhoneStep, setShowPhoneStep] = useState(false);
  useEffect(() => {
    if (profile?.phone) setPhoneInput(profile.phone);
  }, [profile?.phone]);

  // Restaurant settings (B2/B3): un seul fetch stable par restaurant,
  // dépendances minimales + AbortController pour éviter les races.
  const [restaurantSettings, setRestaurantSettings] = useState<{
    ussd_mtn: string | null;
    ussd_moov: string | null;
    ussd_celtiis: string | null;
    delivery_fee: number;
    delivery_time_min: number | null;
    delivery_time_max: number | null;
  } | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    if (!restaurantId) {
      setRestaurantSettings(null);
      return;
    }
    let cancelled = false;
    setSettingsLoading(true);
    supabase.from('restaurants')
      .select('ussd_mtn, ussd_moov, ussd_celtiis, delivery_fee, delivery_time_min, delivery_time_max')
      .eq('id', restaurantId).single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setRestaurantSettings({
          ussd_mtn: data.ussd_mtn ?? null,
          ussd_moov: data.ussd_moov ?? null,
          ussd_celtiis: data.ussd_celtiis ?? null,
          delivery_fee: Number(data.delivery_fee ?? 0),
          delivery_time_min: data.delivery_time_min ?? null,
          delivery_time_max: data.delivery_time_max ?? null,
        });
        setSettingsLoading(false);
      });
    return () => { cancelled = true; };
  }, [restaurantId]);

  const restaurantDeliveryFee = restaurantSettings?.delivery_fee ?? 0;
  const restaurantUssd = useMemo(() => ({
    mtn: restaurantSettings?.ussd_mtn ?? null,
    moov: restaurantSettings?.ussd_moov ?? null,
    celtiis: restaurantSettings?.ussd_celtiis ?? null,
  }), [restaurantSettings]);

  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<{
    id: string;
    code: string;
    discount_type: 'percent' | 'fixed';
    discount_value: number;
  } | null>(null);

  // Time slots (B4): re-générés toutes les 60 secondes pour ne jamais
  // proposer un créneau déjà passé si l’utilisateur reste longtemps sur la page.
  const [timeSlots, setTimeSlots] = useState(() => generateTimeSlots());
  useEffect(() => {
    const id = setInterval(() => setTimeSlots(generateTimeSlots()), 60_000);
    return () => clearInterval(id);
  }, []);
  // Si l’heure choisie tombe dans le passé, on la réinitialise.
  useEffect(() => {
    if (!pickupTime) return;
    const stillValid = timeSlots.some((s) => s.value === pickupTime);
    if (!stillValid) setPickupTime('');
  }, [timeSlots, pickupTime]);

  const uiModes = useMemo(() => {
    if (dynamicModes.length === 0) return FALLBACK_ORDER_MODES;
    return dynamicModes.map((mode) => ({
      rowId: mode.id,
      code: normalizeOrderModeCode(mode.code),
      icon: getOrderModeIcon(mode.code),
      label: mode.name,
      sub: mode.description || '',
    }));
  }, [dynamicModes]);

  const handleModeChange = useCallback((mode: OrderMode) => {
    setOrderMode(mode);
    setError(null);
  }, []);

  const handleRemove = useCallback((id: string) => removeItem(id), [removeItem]);
  const handleUpdateQty = useCallback(
    (id: string, qty: number) => updateItemQuantity(id, qty),
    [updateItemQuantity]
  );
  const handleUpdateNote = useCallback(
    (id: string, note: string) => updateItemNote(id, note),
    [updateItemNote]
  );

  const handleApplyPromo = useCallback(async () => {
    if (!promoCode.trim() || !restaurantId) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', promoCode.trim().toUpperCase())
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .single();

      if (error || !data) { setPromoError('Code promo invalide ou inexistant'); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setPromoError('Ce code promo a expiré'); return; }
      if (data.max_uses && data.used_count >= data.max_uses) { setPromoError("Ce code promo a atteint sa limite d'utilisation"); return; }

      const currentSubtotal = subtotal();
      if (data.min_order_amount && currentSubtotal < data.min_order_amount) {
        setPromoError(`Commande minimum de ${data.min_order_amount.toLocaleString()} FCFA requise`);
        return;
      }

      setAppliedPromo({
        id: data.id,
        code: data.code,
        discount_type: data.discount_type === 'percent' ? 'percent' : 'fixed',
        discount_value: data.discount_value,
      });
      setPromoCode('');
    } catch {
      setPromoError('Erreur lors de la vérification du code');
    } finally {
      setPromoLoading(false);
    }
  }, [promoCode, restaurantId, subtotal]);

  const handleRemovePromo = useCallback(() => {
    setAppliedPromo(null);
    setPromoError(null);
  }, []);

  const sub = useMemo(() => subtotal(), [items]);
  // Frais livraison dérivés du mode + settings restaurant (évite la race B2/B3).
  const effectiveDeliveryFee = orderMode === 'delivery' ? restaurantDeliveryFee : 0;

  const promoDiscount = useMemo(() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.discount_type === 'percent') {
      return Math.round(sub * (appliedPromo.discount_value / 100));
    }
    return appliedPromo.discount_value;
  }, [appliedPromo, sub]);

  // Loyalty (B1) — conversion 1 point = 1 FCFA, plafonné par le sous-total.
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);
  const loyaltyAvailable = loyalty.account.points || 0;
  const loyaltyMinRedeem = Number(loyalty.config?.min_points_redeem || 0);
  const loyaltyEnabled = !!loyalty.config?.loyalty_enabled && loyaltyAvailable >= loyaltyMinRedeem && loyaltyMinRedeem > 0;
  const loyaltyMaxRedeem = Math.min(loyaltyAvailable, Math.max(0, sub + effectiveDeliveryFee - promoDiscount));
  // Reset si on change de resto / le sous-total ne le supporte plus.
  useEffect(() => {
    if (loyaltyPointsToRedeem > loyaltyMaxRedeem) setLoyaltyPointsToRedeem(0);
  }, [loyaltyPointsToRedeem, loyaltyMaxRedeem]);
  const loyaltyDiscount = Math.min(loyaltyPointsToRedeem, loyaltyMaxRedeem);

  const totalDiscount = promoDiscount + loyaltyDiscount;
  const grandTotal = useMemo(
    () => Math.max(0, sub + effectiveDeliveryFee - totalDiscount),
    [sub, effectiveDeliveryFee, totalDiscount]
  );

  const handleKkiapayOrder = useCallback(async () => {
    setError(null);
    if (!user || !restaurantId) {
      setError('Erreur: utilisateur ou restaurant introuvable');
      return;
    }
    setPaymentLoading(true);
    try {
      const notes = orderMode === 'takeaway' && pickupTime
        ? `À emporter — récupération à ${pickupTime}`
        : orderMode === 'dine_in' && tableNumber
          ? `Sur place — table ${tableNumber}`
          : undefined;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      const orderResp = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            notes: item.notes || undefined,
          })),
          restaurant_id: restaurantId,
          // Server re-validates prices & recomputes totals (security B5).
          // We still send delivery_fee + loyalty intent for traceability.
          delivery_fee: effectiveDeliveryFee,
          loyalty_points_redeem: loyaltyDiscount,
          delivery_address: orderMode === 'delivery' ? deliveryAddress : undefined,
          notes: orderMode === 'takeaway' && pickupTime
            ? `À emporter — récupération à ${pickupTime}`
            : orderMode === 'dine_in' && tableNumber
              ? `Sur place — table ${tableNumber}`
              : undefined,
          type: orderMode,
        }),
      });

      // ✅ FIX: Utiliser safeParseResponse pour protéger contre les réponses HTML
      const { ok: orderOk, data: orderPayload, message: orderMsg } = await safeParseResponse(orderResp);
      if (!orderOk || !orderPayload?.order_id) {
        const errorMsg = orderMsg || 'Creation de commande impossible';
        console.error('[Cart] Order creation failed:', { status: orderResp.status, message: orderMsg, parseError: (orderPayload as any)?.parseError });
        throw new Error(errorMsg);
      }

      // Le serveur retourne le total canonique — on l’utilise pour le paiement
      // (prévient toute divergence si les prix DB ont changé entre temps).
      const canonicalTotal = Number(orderPayload.total_amount ?? grandTotal);
      setKkiapayOrderData({
        orderId: orderPayload.order_id,
        totalAmount: canonicalTotal,
        description: `Commande ${orderMode === 'delivery' ? 'livraison' : orderMode === 'takeaway' ? 'à emporter' : 'sur place'} - ${restaurantName || 'Restafy'}`,
        metadata: {
          payment_context: 'food_order',
          order_mode: orderMode,
          subtotal: Number(orderPayload.subtotal ?? sub),
          delivery_fee: Number(orderPayload.delivery_fee ?? effectiveDeliveryFee),
          discount: Number(orderPayload.discount ?? totalDiscount),
          total_amount: canonicalTotal,
          items: items.map((item) => ({
            itemId: item.itemId,
            itemName: item.itemName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            notes: item.notes || undefined,
          })),
          orderType: orderMode,
          deliveryAddress: orderMode === 'delivery' ? deliveryAddress : undefined,
          notes,
        },
      });
      setShowPayment(false);
      setShowKkiapayModal(true);
    } catch (err) {
      let errorMessage = 'Erreur inconnue';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      console.error('[Cart] Payment error details:', {
        originalError: err,
        extractedMessage: errorMessage,
      });
      
      const lower = errorMessage.toLowerCase();
      let userMsg: string;
      
      if (lower.includes('temporairement indisponible') || 
          lower.includes('service de paiement') ||
          lower.includes('payment gateway not configured') ||
          lower.includes('server error')) {
        userMsg = 'Le service de paiement est momentanément indisponible. Réessayez dans quelques instants.';
      } else if (lower.includes('invalid api key') || lower.includes('kkiapay') || lower.includes('api_key')) {
        userMsg = 'Erreur de configuration du paiement. Contactez le support Restafy.';
      } else if (lower.includes('missing checkout url') || lower.includes('checkout_url')) {
        userMsg = 'Erreur lors de la création du lien de paiement. Réessayez.';
      } else if (lower.includes('session expir') || lower.includes('unauthorized') || lower.includes('401')) {
        userMsg = 'Votre session a expiré. Veuillez vous reconnecter.';
      } else if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('connexion')) {
        userMsg = 'Connexion impossible. Vérifiez votre réseau internet et réessayez.';
      } else if (lower.includes('too many') || lower.includes('429') || lower.includes('rate')) {
        userMsg = 'Trop de tentatives. Patientez quelques secondes puis réessayez.';
      } else if (lower.includes('creation de commande') || lower.includes('order')) {
        userMsg = 'Impossible de créer la commande. Vérifiez votre panier et réessayez.';
      } else {
        userMsg = 'Paiement impossible. Veuillez réessayer.';
      }
      
      setError(userMsg);
    } finally {
      setPaymentLoading(false);
    }
  }, [
    user,
    restaurantId,
    orderMode,
    pickupTime,
    tableNumber,
    deliveryAddress,
    items,
    sub,
    effectiveDeliveryFee,
    totalDiscount,
    grandTotal,
    restaurantName,
    loyaltyDiscount,
    profile?.full_name,
    profile?.phone,
  ]);

  const handleRequestPayment = useCallback(async () => {
    setError(null);
    if (!user) { navigate('/auth'); return; }
    if (orderMode === 'delivery' && !deliveryAddress.trim()) {
      setError('Veuillez entrer une adresse de livraison.');
      return;
    }
    if (orderMode === 'takeaway' && !pickupTime) {
      setError('Veuillez sélectionner une heure d\'emport.');
      return;
    }
    if (!restaurantId) {
      setError('Restaurant introuvable. Veuillez réessayer.');
      return;
    }
    // U7: si on s’apprête à payer via Kkiapay/USSD et que le téléphone
    // manque, on demande la saisie inline avant d’ouvrir la modale paiement.
    if (!profile?.phone && !phoneInput.trim()) {
      setShowPhoneStep(true);
      return;
    }
    if (orderMode === 'dine_in') {
      setShowPayment(true);
      return;
    }
    await handleKkiapayOrder();
  }, [user, orderMode, deliveryAddress, pickupTime, restaurantId, navigate, handleKkiapayOrder, profile?.phone, phoneInput]);

  // ─── CORRECTION : bloc orphelin supprimé (lignes 407-412 dans l'original)
  // L'ancien code avait un objet littéral non assigné entre la définition de `notes`
  // et l'appel à `createOrder`, ce qui causait l'erreur esbuild
  // "Expected ';' but found ':'" à la ligne 412.
  const handlePlaceOrder = useCallback(async () => {
    setError(null);
    if (!user || !restaurantId) {
      setError('Erreur: utilisateur ou restaurant introuvable');
      return;
    }

    if (orderMode === 'delivery' && !deliveryAddress.trim()) {
      setError('Veuillez entrer votre adresse de livraison.');
      return;
    }
    if (orderMode === 'takeaway' && !pickupTime) {
      setError("Veuillez choisir l'heure de récupération.");
      return;
    }
    if (orderMode === 'dine_in' && !tableNumber) {
      setError("Veuillez indiquer votre numéro de table.");
      return;
    }

    const notes = orderMode === 'takeaway' && pickupTime
      ? `À emporter — récupération à ${pickupTime}`
      : orderMode === 'dine_in' && tableNumber
        ? `Sur place — table ${tableNumber}`
        : undefined;

    // ✅ FIX : l'objet orphelin { restaurantId, customerId: user.id, ... } a été supprimé
    // Création server-side via /api/orders/create pour bénéficier de la
    // re-validation des prix + débit fidélité atomique (B5).
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Session expirée. Veuillez vous reconnecter.');

      const orderResp = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            itemId: item.itemId,
            quantity: item.quantity,
            notes: item.notes || undefined,
          })),
          restaurant_id: restaurantId,
          delivery_fee: effectiveDeliveryFee,
          loyalty_points_redeem: loyaltyDiscount,
          delivery_address: orderMode === 'delivery' ? deliveryAddress : undefined,
          notes,
          type: orderMode,
        }),
      });
      const { ok: orderOk, data: orderPayload, message: orderMsg } = await safeParseResponse(orderResp);
      if (!orderOk || !orderPayload?.order_id) {
        setError(orderMsg || 'Création de commande impossible');
        return;
      }
      clear();
      setShowPayment(false);
      navigate(`/track/${orderPayload.order_id}`);
    } catch (err) {
      setError('Impossible de créer la commande. Veuillez réessayer.');
    }
  }, [
    user, restaurantId, orderMode, pickupTime, tableNumber,
    deliveryAddress, items, effectiveDeliveryFee, loyaltyDiscount,
    clear, navigate,
  ]);

  const handlePaymentError = useCallback((error: string) => {
    setError(error);
    setShowKkiapayModal(false);
  }, []);

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center pb-[max(5.5rem,calc(4.75rem+env(safe-area-inset-bottom,0px)))] lg:pb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-28 h-28 bg-zinc-100 rounded-3xl flex items-center justify-center mb-6"
        >
          <ShoppingBag className="w-14 h-14 text-zinc-300" />
        </motion.div>
        <h2 className="text-2xl font-black mb-2">Panier vide</h2>
        <p className="text-zinc-400 text-sm mb-8">
          Ajoutez des articles depuis vos restaurants favoris.
        </p>
        <button onClick={() => navigate('/')} className="btn-primary w-full max-w-xs">
          Découvrir les restaurants
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-h-screen bg-zinc-50',
        'pb-[max(9rem,calc(7.5rem+env(safe-area-inset-bottom,0px)))] lg:pb-10',
      )}
    >
      {/* Header sticky */}
      <header className="px-4 py-5 flex items-center gap-4 bg-white border-b border-zinc-100 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 bg-zinc-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black">Votre panier</h1>
          {restaurantName && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              {restaurantName}
            </p>
          )}
        </div>
        <button
          onClick={() => clear()}
          className="text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-3 py-1.5 rounded-xl"
        >
          Vider
        </button>
      </header>

      <div className="px-4 py-5 space-y-4">

        {/* ── Articles ── */}
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <CartItemRow
              key={item.itemId}
              item={item}
              onRemove={handleRemove}
              onUpdateQty={handleUpdateQty}
              onUpdateNote={handleUpdateNote}
            />
          ))}
        </AnimatePresence>

        {/* ── Sélecteur de mode ── */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Comment souhaitez-vous recevoir votre commande ?
          </h2>
          {modesLoading ? (
            <div className="py-4 text-center text-zinc-400 text-sm">Chargement des modes...</div>
          ) : (
            <OrderModeSelector modes={uiModes} value={orderMode} onChange={handleModeChange} />
          )}

          <AnimatePresence mode="wait">

            {orderMode === 'delivery' && (
              <motion.div
                key="delivery"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-1 space-y-2">
                  <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    <MapPin className="w-3 h-3 text-orange-600" />
                    Adresse de livraison
                  </label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => { setDeliveryAddress(e.target.value); setError(null); }}
                    placeholder="Quartier, rue, repère notable..."
                    className="w-full text-sm font-medium px-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 text-zinc-800 placeholder:text-zinc-300"
                  />
                  {profile?.address && deliveryAddress !== profile.address && (
                    <button
                      onClick={() => setDeliveryAddress(profile.address || '')}
                      className="text-[11px] font-bold text-orange-600"
                    >
                      📍 Utiliser mon adresse enregistrée →
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {orderMode === 'dine_in' && (
              <motion.div
                key="dine_in"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-1 space-y-2">
                  <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    <UtensilsCrossed className="w-3 h-3 text-orange-600" />
                    Numéro de table
                    <span className="text-zinc-300 normal-case font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Ex : Table 5, Terrasse, Bar..."
                    className="w-full text-sm font-medium px-3 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 text-zinc-800 placeholder:text-zinc-300"
                  />
                  <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                    ✅ Aucun frais de livraison — service à table
                  </p>
                </div>
              </motion.div>
            )}

            {orderMode === 'takeaway' && (
              <motion.div
                key="takeaway"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-1 space-y-2">
                  <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    <Clock className="w-3 h-3 text-orange-600" />
                    Heure de récupération
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.value}
                        onClick={() => { setPickupTime(slot.value); setError(null); }}
                        className={`py-2 px-3 rounded-xl text-[11px] font-bold transition-all border-2
                          ${pickupTime === slot.value
                            ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                            : 'bg-zinc-50 text-zinc-600 border-zinc-100 hover:border-zinc-200'
                          }`}
                      >
                        {slot.value}
                      </button>
                    ))}
                  </div>
                  {pickupTime && (
                    <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                      ✅ Prêt pour {pickupTime} — aucun frais de livraison
                    </p>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ── Code Promo ── */}
        <div className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3">
          <label className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Code promo
          </label>

          {appliedPromo ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="font-bold text-emerald-800">{appliedPromo.code}</p>
                  <p className="text-xs text-emerald-600">
                    {appliedPromo.discount_type === 'percent'
                      ? `-${appliedPromo.discount_value}%`
                      : `-${appliedPromo.discount_value.toLocaleString()} FCFA`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemovePromo}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Entrez votre code"
                className="flex-1 px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl text-sm font-bold uppercase placeholder:normal-case placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <button
                onClick={handleApplyPromo}
                disabled={promoLoading || !promoCode.trim()}
                className="px-4 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Appliquer'}
              </button>
            </div>
          )}

          {promoError && (
            <p className="text-xs text-red-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {promoError}
            </p>
          )}
        </div>

        {/* ── Loyalty (B1) ── */}
        {loyaltyEnabled && (
          <LoyaltyRedeemPanel
            availablePoints={loyaltyAvailable}
            minRedeem={loyaltyMinRedeem}
            maxRedeem={loyaltyMaxRedeem}
            value={loyaltyPointsToRedeem}
            onChange={setLoyaltyPointsToRedeem}
          />
        )}

        {/* ── Erreur ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Saisie téléphone (U7) ── */}
        <AnimatePresence>
          {showPhoneStep && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-700">
                  <Phone className="w-4 h-4" />
                  Téléphone Mobile Money
                </label>
                <p className="text-xs text-amber-700/80 font-medium">
                  Indique ton numéro pour le paiement (MTN, Moov, Celtiis).
                </p>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+229 01 XX XX XX XX"
                  className="w-full text-sm font-bold px-3 py-2.5 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                />
                <button
                  onClick={() => {
                    const trimmed = phoneInput.trim();
                    if (!trimmed) return;
                    setShowPhoneStep(false);
                    // Sauvegarde le numéro sur le profil pour qu'il soit
                    // pré-rempli automatiquement aux prochaines commandes.
                    if (user?.id && trimmed !== profile?.phone) {
                      // Mise à jour immédiate du store pour que profile?.phone
                      // soit disponible partout sans attendre le réseau.
                      const currentProfile = useAuthStore.getState().profile;
                      if (currentProfile) {
                        useAuthStore.setState({ profile: { ...currentProfile, phone: trimmed } });
                      }
                      // Persister en base (fire-and-forget).
                      void supabase
                        .from('profiles')
                        .update({ phone: trimmed })
                        .eq('id', user.id);
                    }
                    if (orderMode === 'dine_in') setShowPayment(true);
                    else void handleKkiapayOrder();
                  }}
                  disabled={!phoneInput.trim()}
                  className="btn-primary w-full text-sm disabled:opacity-50"
                >
                  Continuer
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Récapitulatif ── */}
        <div className="bg-zinc-900 text-white rounded-3xl p-5 space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Sous-total</span>
              <span className="font-bold">{sub.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Livraison</span>
              <span className="font-bold flex items-center gap-2">
                {orderMode === 'delivery' && settingsLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
                ) : effectiveDeliveryFee > 0 ? (
                  `${effectiveDeliveryFee.toLocaleString('fr-FR')} FCFA`
                ) : (
                  <span className="text-emerald-400">Gratuite</span>
                )}
              </span>
            </div>
            {orderMode === 'delivery' && restaurantSettings?.delivery_time_min != null && (
              <div className="flex justify-between text-zinc-500 text-xs">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Estimation
                </span>
                <span className="font-medium text-white/70">
                  {restaurantSettings.delivery_time_max != null && restaurantSettings.delivery_time_max !== restaurantSettings.delivery_time_min
                    ? `${restaurantSettings.delivery_time_min}–${restaurantSettings.delivery_time_max} min`
                    : `≈ ${restaurantSettings.delivery_time_min} min`}
                </span>
              </div>
            )}
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span className="flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5" /> Réduction fidélité ({loyaltyDiscount} pts)
                </span>
                <span className="font-bold">-{loyaltyDiscount.toLocaleString('fr-FR')} FCFA</span>
              </div>
            )}
            {promoDiscount > 0 && appliedPromo && (
              <div className="flex justify-between text-emerald-400">
                <span>Code promo ({appliedPromo.code})</span>
                <span className="font-bold">-{promoDiscount.toLocaleString('fr-FR')} FCFA</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-500 text-xs pt-1 border-t border-white/5">
              <span>Mode</span>
              <span className="font-bold text-white/70 flex items-center gap-1.5">
                {orderMode === 'delivery' && <><Bike className="w-3.5 h-3.5" /> Livraison</>}
                {orderMode === 'dine_in' && <><UtensilsCrossed className="w-3.5 h-3.5" /> Sur place</>}
                {orderMode === 'takeaway' && <><BagIcon className="w-3.5 h-3.5" /> À emporter{pickupTime ? ` · ${pickupTime}` : ''}</>}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-between items-center">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-400">
              Total à payer
            </p>
            <p className="text-2xl font-black">
              {grandTotal.toLocaleString('fr-FR')}{' '}
              <span className="text-sm font-bold text-zinc-400">FCFA</span>
            </p>
          </div>
        </div>

        {/* ── CTA ── */}
        <button
          onClick={handleRequestPayment}
          disabled={paymentLoading || orderLoading}
          className="btn-primary w-full text-lg"
        >
          {paymentLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Initialisation du paiement...
            </>
          ) : !user ? (
            <>Se connecter pour commander <ChevronRight className="w-5 h-5" /></>
          ) : (
            <>
              {orderMode === 'dine_in' ? 'Choisir le paiement' : 'Payer'}{' '}
              <span className="font-black">{grandTotal.toLocaleString('fr-FR')} FCFA</span>
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>

        {/* ── Continuer mes achats (U6) ── */}
        {restaurantId && (
          <button
            onClick={() => navigate(`/restaurants/${restaurantId}`)}
            className="w-full text-sm font-bold text-zinc-500 hover:text-orange-600 flex items-center justify-center gap-2 py-3"
          >
            <PlusIcon className="w-4 h-4" />
            Ajouter d’autres plats
          </button>
        )}
      </div>

      {/* ── Modal paiement USSD (dine_in) ── */}
      <AnimatePresence>
        {showPayment && (
          <USSDModal
            amount={grandTotal}
            onClose={() => setShowPayment(false)}
            onSuccess={handlePlaceOrder}
            onKkiapay={handleKkiapayOrder}
            loading={orderLoading}
            paymentLoading={paymentLoading}
            restaurantUssd={restaurantUssd}
          />
        )}
        {showKkiapayModal && kkiapayOrderData && user && (
          <KkiapayPaymentModal
            amount={kkiapayOrderData.totalAmount}
            description={kkiapayOrderData.description}
            customerName={profile?.full_name || user.user_metadata?.full_name || 'Client Restafy'}
            customerEmail={user.email || ''}
            defaultPhone={profile?.phone || phoneInput.trim() || null}
            orderId={kkiapayOrderData.orderId}
            restaurantId={restaurantId}
            restaurantName={restaurantName}
            metadata={kkiapayOrderData.metadata}
            onSuccess={({ transactionId, reference }) => {
              try {
                localStorage.setItem(
                  'pending_payment',
                  JSON.stringify({
                    reference,
                    order_id: kkiapayOrderData.orderId,
                    type: 'order',
                  }),
                );
              } catch {
                /* localStorage indisponible (incognito iOS) */
              }
              setKkiapayOrderData(null);
              setShowKkiapayModal(false);
              clear();
              navigate(`/payment/success?reference=${encodeURIComponent(reference)}`);
            }}
            onClose={() => {
              const orderIdToCancel = kkiapayOrderData.orderId;
              setKkiapayOrderData(null);
              setShowKkiapayModal(false);
              setPaymentLoading(false);
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
                      order_id: orderIdToCancel,
                      reason: 'user_closed_payment_modal',
                    }),
                  });
                } catch (err) {
                  console.warn('[Cart] orphan order cleanup failed:', err);
                }
              })();
            }}
            onError={(msg) => {
              setError(msg);
              setPaymentLoading(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Loyalty Redeem Panel (B1) ────────────────────────────────────────────────
const LoyaltyRedeemPanel = memo(function LoyaltyRedeemPanel({
  availablePoints,
  minRedeem,
  maxRedeem,
  value,
  onChange,
}: {
  availablePoints: number;
  minRedeem: number;
  maxRedeem: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const presets = useMemo(() => {
    const candidates = [minRedeem, Math.floor(maxRedeem / 2), maxRedeem];
    return Array.from(new Set(candidates.filter((n) => n >= minRedeem && n <= maxRedeem)));
  }, [minRedeem, maxRedeem]);
  const active = value > 0;
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          Points fidélité
        </label>
        <span className="text-[11px] font-bold text-zinc-500">
          {availablePoints.toLocaleString('fr-FR')} dispo
        </span>
      </div>
      {maxRedeem < minRedeem ? (
        <p className="text-xs text-zinc-400 font-medium">
          Minimum {minRedeem} points pour utiliser une réduction.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange(0)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition ${
                value === 0 ? 'border-orange-600 bg-orange-50 text-orange-600' : 'border-zinc-100 text-zinc-500 hover:border-zinc-200'
              }`}
            >
              Aucune
            </button>
            {presets.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition ${
                  value === n ? 'border-orange-600 bg-orange-50 text-orange-600' : 'border-zinc-100 text-zinc-500 hover:border-zinc-200'
                }`}
              >
                {n.toLocaleString('fr-FR')} pts
              </button>
            ))}
          </div>
          {active && (
            <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
              <Gift className="w-3 h-3" /> {value.toLocaleString('fr-FR')} FCFA de réduction
            </p>
          )}
        </>
      )}
    </div>
  );
});

// ─── Modal paiement USSD ──────────────────────────────────────────────────────
function buildUssdCode(template: string | null | undefined, amount: number): string {
  if (!template || template.trim() === '') return '';
  const t = template.trim();
  if (t.includes('{montant}')) return t.replace('{montant}', String(amount));
  if (t.endsWith('#')) return t.replace(/#$/, `*${amount}#`);
  return `${t}${amount}#`;
}

const DEFAULT_CODES = {
  mtn: '*880*{montant}#',
  moov: '*155*1*1*{montant}#',
  celtiis: '*123*1*{montant}#',
};

function USSDModal({
  amount, onClose, onSuccess, onKkiapay, loading, paymentLoading, restaurantUssd,
}: {
  amount: number;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  onKkiapay: () => Promise<void>;
  loading: boolean;
  paymentLoading: boolean;
  restaurantUssd?: { mtn: string | null; moov: string | null; celtiis: string | null };
}) {
  const ussd = {
    mtn: restaurantUssd?.mtn || DEFAULT_CODES.mtn,
    moov: restaurantUssd?.moov || DEFAULT_CODES.moov,
    celtiis: restaurantUssd?.celtiis || DEFAULT_CODES.celtiis,
  };

  const operators = [
    { id: 'mtn', name: 'MTN MoMo', color: 'bg-yellow-400 text-black', code: ussd.mtn },
    { id: 'moov', name: 'Moov Money', color: 'bg-blue-600 text-white', code: ussd.moov },
    { id: 'celtiis', name: 'Celtiis Cash', color: 'bg-emerald-600 text-white', code: ussd.celtiis },
  ].filter(op => op.code && op.code.trim() !== '');

  const [step, setStep] = useState<1 | 2>(1);
  const [operator, setOperator] = useState<typeof operators[0] | null>(null);
  const [timeLeft, setTimeLeft] = useState(600);

  React.useEffect(() => {
    if (step !== 2) return;
    const t = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [step]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const code = operator ? buildUssdCode(operator.code, amount) : '';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white w-full max-w-md rounded-t-3xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="font-black text-base">Paiement Mobile Money</h3>
            <p className="text-xs text-zinc-400">
              {amount.toLocaleString('fr-FR')} FCFA à payer
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-zinc-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {step === 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500 mb-1">Choisissez votre méthode de paiement :</p>
              <button
                onClick={() => { void onKkiapay(); }}
                disabled={paymentLoading || loading}
                className="w-full p-4 rounded-2xl flex items-center gap-4 font-bold transition-all active:scale-95 bg-zinc-900 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CreditCard className="w-5 h-5" />
                <span>Payer avec Kkiapay (recommandé)</span>
                {(paymentLoading || loading)
                  ? <Loader2 className="w-4 h-4 ml-auto animate-spin opacity-80" />
                  : <ChevronRight className="w-4 h-4 ml-auto opacity-60" />}
              </button>
              <p className="text-xs text-zinc-400 mb-3">Ou payez sur place via USSD :</p>
              {operators.map((op) => (
                <button
                  key={op.id}
                  onClick={() => { setOperator(op); setStep(2); }}
                  className={`w-full p-4 rounded-2xl flex items-center gap-4 font-bold transition-all active:scale-95 ${op.color}`}
                >
                  <SmartphoneNfc className="w-5 h-5" />
                  <span>{op.name}</span>
                  <ChevronRight className="w-4 h-4 ml-auto opacity-60" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-red-500 font-bold">
                  <Clock className="w-4 h-4" /> Expire dans {fmt(timeLeft)}
                </span>
                <button onClick={() => setStep(1)} className="text-zinc-400 text-xs underline">
                  Changer
                </button>
              </div>

              <div className="bg-zinc-900 text-white p-6 rounded-2xl text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">
                  Code USSD
                </p>
                <p className="text-xl font-mono font-black tracking-tighter break-all mb-4">
                  {code}
                </p>
                <button
                  onClick={() => navigator.clipboard.writeText(code)}
                  className="text-[10px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/10 px-3 py-1.5 rounded-lg"
                >
                  Copier le code
                </button>
              </div>

              <div className="space-y-3 bg-blue-50 rounded-2xl p-4">
                {[
                  'Composez le code ci-dessus sur votre téléphone',
                  'Saisissez votre code secret Mobile Money',
                  `Confirmez le paiement de ${amount.toLocaleString('fr-FR')} FCFA`,
                ].map((s, i) => (
                  <div key={`${operator?.id || 'ussd'}-${s}`} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs text-zinc-700">{s}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={async () => { await onSuccess(); }}
                disabled={loading || paymentLoading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <CheckCircle2 className="w-4 h-4" />
                }
                {loading ? 'Traitement...' : 'Paiement effectué'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
