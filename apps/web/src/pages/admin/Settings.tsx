// src/pages/admin/Settings.tsx — CORRIGÉ
// Corrections appliquées :
//   [CRITIQUE] import toast from 'sonner' ajouté
//   [CRITIQUE] SettingsProps : formData: any → RestaurantFormData (type strict)
//   [CRITIQUE] NotificationsSettings : restaurant: any → Restaurant
//   [CRITIQUE] analytics_events : event_type → event_name (SQL 065)
//   [CRITIQUE] Restaurant.settings : Record<string, any> → Record<string, unknown>
//   [MOYEN]    handleSave : alert() → toast.error/success, console.error → DEV guard
//   [MOYEN]    GeneralSettings : alert() → toast.error, console.error → DEV guard
//   [MOYEN]    LoyaltySettings : alert() → toast.success
//   [MINEUR]   Tous les inputs ont un <label htmlFor> associé
//   [MINEUR]   Boutons toggle ont aria-pressed + aria-label

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useRestaurantLoyaltySettings } from '@/hooks/useLoyalty';
import { toast } from 'sonner';
import {
  Store, Smartphone, Truck, Bell, Lock, Save, Loader2, Gift, Star,
  TrendingUp, Users, AlertCircle, Eye, EyeOff, Shield, ShieldCheck,
  Smartphone as Phone2, Mail, CheckCircle2, Upload, ImageIcon, X,
  Download, FileText, Package, Palette, CreditCard, XCircle, AlertTriangle,
  BarChart3, Code, Copy,
  Volume2, Vibrate,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import { RestaurantThemeToggle } from '@/components/admin/RestaurantThemeToggle';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { playNotificationSound } from '@/lib/notifications';
import { invalidateRestaurantCache } from '@/hooks/useRestaurant';

/** Champs formulaire : suit le thème clair/sombre du dashboard (évite texte foncé sur fond zinc-950). */
const rSettingsInput = cn(
  'w-full px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/25 focus:border-orange-500/50',
  'bg-[var(--r-input-bg)] border border-[var(--r-input-border)] text-[var(--r-text)] placeholder:text-[var(--r-input-placeholder)]',
);

/** Action principale : min 44px de hauteur, focus clavier, pas de scale au survol (évite le layout shift). */
const settingsPrimaryBtn = cn(
  'inline-flex items-center justify-center gap-2 min-h-11 px-6 sm:px-8 py-2.5',
  'rounded-xl font-bold text-white bg-primary shadow-md shadow-primary/25',
  'transition-[filter,box-shadow] duration-150 ease-out',
  'hover:shadow-lg hover:shadow-primary/30 hover:brightness-[1.03]',
  'active:brightness-[0.97]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2',
  'focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:hover:brightness-100',
  'touch-manipulation select-none',
);

const settingsSecondaryBtn = cn(
  'inline-flex items-center justify-center gap-2 min-h-10 min-w-[5rem] px-4 py-2 rounded-xl text-sm font-bold',
  'bg-zinc-900 text-white dark:bg-zinc-800',
  'transition-colors duration-150 hover:bg-zinc-800 dark:hover:bg-zinc-700',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2',
  'focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
  'touch-manipulation',
);

function SettingsSwitch({
  pressed,
  onToggle,
  'aria-label': ariaLabel,
}: {
  pressed: boolean;
  onToggle: () => void;
  'aria-label': string;
}) {
  return (
    <div className="flex min-h-11 min-w-11 items-center justify-end sm:min-w-[3.25rem]">
      <button
        type="button"
        role="switch"
        aria-checked={pressed}
        aria-label={ariaLabel}
        onClick={onToggle}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          'focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950',
          'touch-manipulation',
          pressed ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-600',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md ring-1 ring-black/10 transition-transform duration-200 will-change-transform',
            pressed ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Restaurant = {
  id: string;
  name: string;
  slug?: string | null;
  phone: string | null;
  description: string | null;
  address: string | null;
  city: string;
  ussd_mtn: string | null;
  ussd_moov: string | null;
  ussd_celtiis: string | null;
  delivery_fee: number;
  min_order: number;
  delivery_time_min: number;
  delivery_time_max: number;
  // CORRECTION: Record<string, any> → Record<string, unknown>
  settings: Record<string, unknown>;
};

interface RestaurantFormData {
  name: string;
  phone: string;
  description: string;
  address: string;
  city: string;
  ussd_mtn: string;
  ussd_moov: string;
  ussd_celtiis: string;
  delivery_fee: number;
  min_order: number;
  delivery_time_min: number;
  delivery_time_max: number;
  logo_url: string;
  banner_url: string;
}

// CORRECTION: formData: any → RestaurantFormData
interface SettingsProps {
  formData: RestaurantFormData;
  setFormData: (data: RestaurantFormData) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────────────────────
// IntegrationSettings
// ─────────────────────────────────────────────────────────────────────────────
function IntegrationSettings({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { slug } = useParams();
  
  // Get restaurant slug for embed URLs
  const restaurantSlug = slug || restaurantId.toLowerCase().replace(/-/g, '');
  
  // Use app URL for proper embedding
  const appUrl = 'https://restafy.shop';
  
  // Iframe embed code - uses slug for cleaner URLs
  const embedCode = `<iframe 
  src="${appUrl}/r/${restaurantSlug}"
  width="100%" 
  height="700" 
  frameborder="0"
  style="border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
</iframe>`;

  // Full embed code with widget.js (if available)
  const widgetCode = `<div id="restafy-widget" data-restaurant="${restaurantSlug}"></div>
<script src="${appUrl}/widget.js" async></script>`;

  // Single-file widget - tout en un seul fichier HTML (pour WordPress/Wix/Squarespace)
  const singleFileCode = `<div id="restafy-widget" data-slug="${restaurantSlug}"></div>
<script>
(function(){var o=document.getElementById('restafy-widget'),s=o.dataset.slug||'',c=[],cat='all',q='',A='${appUrl}',S='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;--p:#FF6600;--b:#eee;--m:#666',L=document.getElementById('rw-styles');if(!L){L=document.createElement('style');L.id='rw-styles';L.textContent='*{box-sizing:border-box}';document.head.appendChild(L)}
function r(d){var t=c.reduce(function(a,i){return a+i.p*i.q},0),n=c.reduce(function(a,i){return a+i.q},0),f=d.items.filter(function(i){return(cat==='all'||i.category_id===cat)&&(!q||i.name.toLowerCase().indexOf(q.toLowerCase())!==-1)}),h='<button class="rw-cat '+(cat==='all'?'active':'')+'" data-cat="all">Tout</button>';d.categories.forEach(function(x){h+='<button class="rw-cat '+(cat===x.id?'active':'')+'" data-cat="'+x.id+'">'+x.name+'</button>'});var m='';f.forEach(function(i){m+='<div class="rw-item">'+(i.image_url?'<img class="rw-img" src="'+i.image_url+'">':'')+'<div class="rw-info"><h3 class="rw-name">'+i.name+'</h3>'+(i.description?'<p class="rw-desc">'+i.description+'</p>':'')+'<p class="rw-price">'+i.price.toLocaleString()+' F</p></div><button class="rw-add" data-id="'+i.id+'" data-p="'+i.price+'">+</button></div>'});var b=n>0?'<div class="rw-fixed"><div style="display:flex;align-items:center;gap:8px"><span>🛒<span class="rw-badge">'+n+'</span></span><p>'+n+' plat'+(n>1?'s':'')+'</p><p>'+t.toLocaleString()+' F</p></div><a class="rw-btn" href="'+A+'/r/'+d.restaurant.slug+'">Commander</a></div>':'';o.innerHTML='<style>#restafy-widget{font-family:'+S+';--primary:var(--p);background:#fff;color:#222;border-radius:12px;max-width:420px;margin:0 auto;overflow:hidden}.rw-header{padding:16px;display:flex;gap:12px;border-bottom:1px solid var(--b)}.rw-logo{width:48px;height:48px;background:var(--p);color:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px}.rw-title{font-size:16px;font-weight:700;margin:0}.rw-sub{font-size:12px;color:var(--m);margin:4px 0 0}.rw-search{padding:12px 16px;border-bottom:1px solid var(--b)}.rw-search input{width:100%;padding:10px 12px;border:1px solid var(--b);border-radius:8px;font-size:14px}.rw-cats{display:flex;gap:8px;padding:12px 16px;overflow-x:auto}.rw-cat{padding:6px 12px;border-radius:16px;font-size:12px;background:#f5f5f5;border:none;cursor:pointer}.rw-cat.active,.rw-cat:hover{background:var(--p);color:#fff}.rw-items{padding:8px 16px;max-height:400px;overflow-y:auto}.rw-item{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--b);align-items:center}.rw-img{width:64px;height:64px;border-radius:8px;object-fit:cover;background:#f5f5f5}.rw-info{flex:1}.rw-name{font-size:14px;font-weight:600;margin:0 0 4px}.rw-desc{font-size:11px;color:var(--m);margin:0}.rw-price{font-size:14px;font-weight:700;color:var(--p);margin:6px 0 0}.rw-add{width:28px;height:28px;border-radius:50%;background:var(--p);color:#fff;border:none;cursor:pointer;font-size:16px}.rw-fixed{position:sticky;bottom:0;background:#fff;padding:12px 16px;border-top:1px solid var(--b);display:flex;align-items:center;justify-content:space-between}.rw-btn{flex:1;padding:12px;border-radius:10px;background:var(--p);color:#fff;font-weight:600;border:none;text-decoration:none;display:block;text-align:center}.rw-badge{background:var(--p);padding:2px 6px;border-radius:10px;font-size:10px}.rw-empty{text-align:center;padding:40px 20px;color:var(--m)}</style><div class="rw-header"><div class="rw-logo">'+d.restaurant.name.charAt(0).toUpperCase()+'</div><div><h2 class="rw-title">'+d.restaurant.name+'</h2><p class="rw-sub">🕒 '+d.restaurant.delivery_time+(d.restaurant.min_order?' • Min: '+d.restaurant.min_order+' F':'')+'</p></div></div><div class="rw-search"><input placeholder="Rechercher..." value="'+q+'"></div><div class="rw-cats">'+h+'</div><div class="rw-items">'+(f.length?'<p class="rw-empty">Aucun plat</p>':m)+'</div>'+b;o.querySelectorAll('.rw-cat').forEach(function(x){x.onclick=function(){cat=x.dataset.cat;r(d)}});o.querySelector('.rw-search input').oninput=function(){q=this.value;r(d)};o.querySelectorAll('.rw-add').forEach(function(x){x.onclick=function(){var i=c.find(function(e){return e.id===x.dataset.id});if(i)i.q++;else c.push({id:x.dataset.id,p:parseInt(x.dataset.p),q:1});x.textContent=\"✓\";setTimeout(function(){x.textContent=\"+\"},500);r(d)}})}
o.innerHTML=\"<p class=rw-load>⏳</p>\";fetch(A+\"/api/lite?slug=\"+s).then(function(e){return e.json()}).then(r).catch(function(){o.innerHTML=\"<p class=rw-empty>Erreur</p>\"})})();
</script>`;

  // LiteEmbed - simplified widget for any website
  const liteEmbedCode = `<div id="restafy-lite" data-restaurant="${restaurantSlug}" data-theme="orange" style="max-width:400px;margin:0 auto;"></div>
<link rel="stylesheet" href="${appUrl}/lite.css">
<script src="${appUrl}/lite.js" async></script>`;

  const copyToClipboard = (code: string, label: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-xl font-black tracking-tight mb-2 text-[color:var(--r-text)]">Intégration Web</h3>
        <p className="text-sm text-zinc-500 mb-8">Intégrez Restafy dans votre site web avec nos codes embed.</p>

        {/* Embed Iframe */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-bold text-[color:var(--r-text)] mb-2 flex items-center gap-2">
              <Code className="w-4 h-4" /> Embed Iframe
            </h4>
            <p className="text-xs text-zinc-500 mb-3">
              Intégrez votre restaurant complet dans votre site web avec un iframe.
            </p>
            <div className="bg-zinc-900 rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{embedCode}</pre>
            </div>
            <button
              onClick={() => copyToClipboard(embedCode, 'iframe')}
              className="mt-2 flex items-center gap-2 text-xs font-bold text-orange-500 hover:text-orange-600"
            >
              {copiedCode === 'iframe' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedCode === 'iframe' ? 'Copié !' : 'Copier le code'}
            </button>
          </div>

          {/* Widget */}
          <div>
            <h4 className="text-sm font-bold text-[color:var(--r-text)] mb-2 flex items-center gap-2">
              <Package className="w-4 h-4" /> Widget JavaScript
            </h4>
            <p className="text-xs text-zinc-500 mb-3">
              Widget léger pour afficher votre menu sur votre site.
            </p>
            <div className="bg-zinc-900 rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{widgetCode}</pre>
            </div>
            <button
              onClick={() => copyToClipboard(widgetCode, 'widget')}
              className="mt-2 flex items-center gap-2 text-xs font-bold text-orange-500 hover:text-orange-600"
            >
              {copiedCode === 'widget' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedCode === 'widget' ? 'Copié !' : 'Copier le code'}
            </button>
          </div>

          {/* LiteEmbed - pour les sites existants */}
          <div>
            <h4 className="text-sm font-bold text-[color:var(--r-text)] mb-2 flex items-center gap-2">
              <Package className="w-4 h-4" /> Lite (sites existants)
            </h4>
            <p className="text-xs text-zinc-500 mb-3">
              Pour sites avec WordPress, Wix, Squarespace... pas d'iframe!
            </p>
            <div className="bg-zinc-900 rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{liteEmbedCode}</pre>
            </div>
            <button
              onClick={() => copyToClipboard(liteEmbedCode, 'lite')}
              className="mt-2 flex items-center gap-2 text-xs font-bold text-orange-500 hover:text-orange-600"
            >
              {copiedCode === 'lite' ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedCode === 'lite' ? 'Copié !' : 'Copier le code'}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mt-6">
          <h4 className="text-sm font-bold text-orange-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Instructions
          </h4>
          <ul className="text-xs text-orange-800 space-y-1 list-disc list-inside">
            <li>Collez le code dans votre site web où vous voulez afficher Restafy</li>
            <li>L'iframe s'adapte automatiquement à la largeur de votre conteneur</li>
            <li>Le widget nécessite le script JavaScript pour fonctionner</li>
            <li>Contactez-nous pour une intégration personnalisée si nécessaire</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { profile } = useAuth();
  const restaurantId = profile?.restaurant_id;

  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  // CORRECTION: type explicite RestaurantFormData
  const [formData, setFormData] = useState<RestaurantFormData>({
    name: '', phone: '', description: '', address: '', city: '',
    ussd_mtn: '', ussd_moov: '', ussd_celtiis: '',
    delivery_fee: 0, min_order: 0, delivery_time_min: 30, delivery_time_max: 60,
    logo_url: '', banner_url: '',
  });

  const loyaltySettings = useRestaurantLoyaltySettings(restaurantId || null);

  /**
   * Empêche fetchRestaurant() de réécrire setFormData(...) sur les refresh
   * d'auth Supabase (token refresh ~1h, retour en focus, reconnexion réseau,
   * SIGNED_IN replays). Sans ce ref, chaque refresh repassait par
   * setFormData(...) avec les valeurs DB et écrasait les modifications en
   * cours dans les onglets — l'utilisateur voyait "tout se recharger" en
   * changeant d'onglet et perdait sa saisie. On n'initialise formData qu'UNE
   * SEULE FOIS par session (sauf si le restaurantId change vraiment).
   */
  const formDataInitialized = useRef(false);

  const tabs = [
    { id: 'general',       label: 'Général',        icon: Store },
    { id: 'appearance',    label: 'Apparence',      icon: Palette },
    { id: 'loyalty',       label: 'Fidélité',        icon: Gift },
    { id: 'ussd',          label: 'Paiements USSD',  icon: Smartphone },
    { id: 'delivery',      label: 'Livraison',       icon: Truck },
    { id: 'notifications', label: 'Notifications',   icon: Bell },
    { id: 'integration',   label: 'Intégration',     icon: Code },
    { id: 'security',      label: 'Sécurité',        icon: Lock },
    { id: 'export',        label: 'Export données',  icon: Download },
  ];

  useEffect(() => {
    if (!restaurantId) return;

    // Race-safe : si restaurantId change pendant que le fetch précédent est
    // encore en vol, on ignore son résultat. Sans ce flag (cf. Devin Review
    // PR #63), un fetch lent du restaurant A pouvait résoudre APRÈS un swap
    // vers restaurant B, repasser le `formDataInitialized` à true avec les
    // valeurs de A, puis le fetch correct de B verrait `true` et sauterait
    // setFormData → l'utilisateur éditerait B avec les valeurs de A.
    let stale = false;
    // Reset l'init quand on change vraiment de restaurant : nouvelle session
    // d'édition, on accepte une nouvelle initialisation depuis la DB.
    formDataInitialized.current = false;

    const fetchRestaurant = async () => {
      try {
        const RESTAURANT_FIELDS = 'id,name,slug,phone,description,address,city,ussd_mtn,ussd_moov,ussd_celtiis,delivery_fee,min_order,delivery_time_min,delivery_time_max,logo_url,banner_url,settings' as const;
        let { data, error } = await supabase
          .from('restaurants').select(RESTAURANT_FIELDS).eq('id', restaurantId).maybeSingle();

        if (!data && profile?.id) {
          const fb = await supabase.from('restaurants').select(RESTAURANT_FIELDS).eq('owner_id', profile.id).maybeSingle();
          if (fb.data) {
            data = fb.data;
            if (fb.data.id !== restaurantId) {
              await supabase.from('profiles').update({ restaurant_id: fb.data.id }).eq('id', profile.id);
            }
          }
        }
        if (stale) return;
        if (error && !data) throw error;
        if (data) {
          const row = data as Record<string, unknown> & { settings?: Record<string, unknown> };
          setRestaurant({
            ...(data as Omit<Restaurant, 'settings'>),
            settings: row.settings ?? {},
          });
          // N'initialise formData qu'à la première charge réussie pour ce
          // restaurant ; sinon on écrase les modifs en cours sur chaque
          // refresh d'auth Supabase (cf. commentaire sur formDataInitialized).
          if (!formDataInitialized.current) {
            setFormData({
              name: data.name || '', phone: data.phone || '',
              description: data.description || '', address: data.address || '',
              city: data.city || '', ussd_mtn: data.ussd_mtn || '',
              ussd_moov: data.ussd_moov || '', ussd_celtiis: data.ussd_celtiis || '',
              delivery_fee: data.delivery_fee ?? 0, min_order: data.min_order ?? 0,
              delivery_time_min: data.delivery_time_min ?? 30,
              delivery_time_max: data.delivery_time_max ?? 60,
              logo_url: data.logo_url || '', banner_url: data.banner_url || '',
            });
            formDataInitialized.current = true;
          }
        }
      } catch (err) {
        if (stale) return;
        // CORRECTION: console.error → DEV guard
        if (import.meta.env.DEV) console.error('[Settings] fetch error:', err);
      } finally {
        if (!stale) setLoading(false);
      }
    };
    fetchRestaurant();

    return () => {
      stale = true;
    };
  }, [restaurantId, profile?.id]);

  const handleSave = async () => {
    if (!restaurantId) {
      // CORRECTION: alert() → toast.error()
      toast.error('Erreur : restaurant non trouvé');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('restaurants').update({
        name: formData.name,
        phone: formData.phone || null,
        description: formData.description || null,
        address: formData.address || null,
        city: formData.city || null,
        ussd_mtn: formData.ussd_mtn?.trim() || null,
        ussd_moov: formData.ussd_moov?.trim() || null,
        ussd_celtiis: formData.ussd_celtiis?.trim() || null,
        delivery_fee: Number(formData.delivery_fee) || 0,
        min_order: Number(formData.min_order) || 0,
        delivery_time_min: Number(formData.delivery_time_min) || 30,
        delivery_time_max: Number(formData.delivery_time_max) || 60,
        logo_url: formData.logo_url || null,
        banner_url: formData.banner_url || null,
        updated_at: new Date().toISOString(),
      }).eq('id', restaurantId);

      if (error) {
        if (import.meta.env.DEV) console.error('[Settings] update error:', error);
        throw error;
      }
      // Update local restaurant state so child components see fresh data
      setRestaurant(prev => prev ? {
        ...prev,
        name: formData.name,
        phone: formData.phone || null,
        description: formData.description || null,
        address: formData.address || null,
        city: formData.city || '',
        ussd_mtn: formData.ussd_mtn?.trim() || null,
        ussd_moov: formData.ussd_moov?.trim() || null,
        ussd_celtiis: formData.ussd_celtiis?.trim() || null,
        delivery_fee: Number(formData.delivery_fee) || 0,
        min_order: Number(formData.min_order) || 0,
        delivery_time_min: Number(formData.delivery_time_min) || 30,
        delivery_time_max: Number(formData.delivery_time_max) || 60,
      } : prev);
      invalidateRestaurantCache();
      toast.success('Paramètres enregistrés !');
    } catch (err) {
      if (import.meta.env.DEV) console.error('[Settings] save error:', err);
      // CORRECTION: alert() → toast.error()
      toast.error('Impossible de sauvegarder les paramètres. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <RestafyLoader fullscreen={false} message="Chargement des paramètres…" size="md" />
    </div>
  );

  if (!restaurantId) return (
    <div className="text-center py-12">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-red-800 mb-2">Restaurant non lié</h3>
        <p className="text-red-600 text-sm">
          Votre profil n'est pas lié à un restaurant. Contactez l'administrateur.
        </p>
        <p className="text-xs text-red-400 mt-4">
          Contactez le support si le problème persiste.
        </p>
      </div>
    </div>
  );

  if (!restaurant) return (
    <div className="text-center py-12 text-gray-500">
      Aucun restaurant trouvé. Veuillez contacter l'administrateur.
    </div>
  );

  return (
    <div className="r-page-shell !space-y-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2 font-display text-[color:var(--r-text)]">Paramètres</h1>
          <p className="font-medium text-[color:var(--r-text-muted)]">Configurez votre restaurant et vos préférences.</p>
        </div>
        <button type="button" onClick={handleSave} disabled={saving} className={cn(settingsPrimaryBtn, 'w-full sm:w-auto')}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden /> : <Save className="w-5 h-5 shrink-0" aria-hidden />}
          <span>{saving ? 'Enregistrement...' : 'Enregistrer les modifications'}</span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
        <aside className="lg:w-64 flex-shrink-0">
          <div className="r-admin-card p-2 rounded-[2rem] space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 min-h-11 rounded-2xl border transition-colors duration-200 touch-manipulation text-left',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500/35',
                  activeTab === tab.id
                    ? 'bg-orange-500/15 text-orange-600 border-orange-500/35'
                    : 'border-transparent text-[color:var(--r-text-muted)] hover:bg-[var(--r-surface)] hover:text-[color:var(--r-text)]',
                )}
              >
                <tab.icon className="w-5 h-5 shrink-0" aria-hidden />
                <span className="font-bold text-sm">{tab.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="r-admin-card p-4 lg:p-10 rounded-2xl lg:rounded-[2rem]">
            {activeTab === 'general'       && <GeneralSettings formData={formData} setFormData={setFormData} />}
            {activeTab === 'appearance'     && <AppearanceSettings />}
            {activeTab === 'loyalty'       && <LoyaltySettings loyaltySettings={loyaltySettings} />}
            {activeTab === 'ussd'          && <USSDSettings formData={formData} setFormData={setFormData} />}
            {activeTab === 'delivery'      && <DeliverySettings formData={formData} setFormData={setFormData} />}
            {activeTab === 'notifications' && <NotificationsSettings restaurantId={restaurantId} restaurant={restaurant} onSettingsChange={(settings) => setRestaurant(prev => prev ? { ...prev, settings } : prev)} />}
            {activeTab === 'integration'   && <IntegrationSettings restaurantId={restaurantId} restaurantName={restaurant.name} />}
            {activeTab === 'security'      && <SecuritySettings />}
            {activeTab === 'export'        && <ExportSettings restaurantId={restaurantId} restaurantName={restaurant.name} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-xl font-black tracking-tight mb-2 text-[color:var(--r-text)]">Thème du dashboard</h3>
        <p className="text-sm mb-8 text-[color:var(--r-text-muted)] leading-relaxed">
          Choisissez entre le <strong className="text-[color:var(--r-text)]">mode clair</strong> et le{' '}
          <strong className="text-[color:var(--r-text)]">mode nuit</strong>. Le réglage est mémorisé sur cet appareil
          et concorde avec la barre latérale, l&apos;en-tête, les cartes (<code className="text-xs bg-[var(--r-surface)] px-1 rounded">r-admin-card</code>) et la navigation mobile.
        </p>
        <RestaurantThemeToggle variant="segmented" className="w-full" />
      </div>
      <div className="r-admin-inset p-5 rounded-2xl">
        <p className="text-xs font-bold uppercase tracking-widest mb-2 text-[color:var(--r-text-muted)]">Raccourci</p>
        <p className="text-sm leading-relaxed text-[color:var(--r-text)]">
          Utilisez aussi l&apos;icône soleil / lune dans l&apos;en-tête du dashboard pour basculer instantanément.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExportSettings
// CORRECTION CRITIQUE : analytics_events.event_type → event_name (SQL 065)
// ─────────────────────────────────────────────────────────────────────────────
function ExportSettings({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const [exporting, setExporting] = React.useState<string | null>(null);

  const toCSV = (rows: Record<string, unknown>[]): string => {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportData = async (type: string) => {
    if (!restaurantId) return;
    setExporting(type);
    try {
      const { supabase: sb } = await import('@/lib/supabase');
      const safe = restaurantName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const date = new Date().toISOString().split('T')[0];

      if (type === 'orders') {
        const { data } = await sb.from('orders')
          .select('id, created_at, status, type, subtotal, delivery_fee, discount, total_amount, delivery_address, notes')
          .eq('restaurant_id', restaurantId).order('created_at', { ascending: false });
        if (data) downloadCSV(toCSV(data as Record<string, unknown>[]), `${safe}-commandes-${date}.csv`);

      } else if (type === 'items') {
        const { data } = await sb.from('items')
          .select('id, name, description, price, is_available, created_at')
          .eq('restaurant_id', restaurantId).order('name');
        if (data) downloadCSV(toCSV(data as Record<string, unknown>[]), `${safe}-plats-${date}.csv`);

      } else if (type === 'reviews') {
        const { data } = await sb.from('reviews')
          .select('id, rating, comment, is_verified, created_at, restaurant_reply, profiles(full_name)')
          .eq('restaurant_id', restaurantId).order('created_at', { ascending: false });
        const flat = (data ?? []).map((r: Record<string, unknown>) => {
          const p = r.profiles as Record<string, unknown> | null;
          return { ...r, profiles: undefined, customer_name: p?.full_name ?? '' };
        });
        downloadCSV(toCSV(flat), `${safe}-avis-${date}.csv`);

      } else if (type === 'analytics') {
        // CORRECTION CRITIQUE: event_type → event_name (migration SQL 065)
        const { data } = await sb.from('analytics_events')
          .select('event_name, created_at')
          .eq('restaurant_id', restaurantId)
          .order('created_at', { ascending: false }).limit(5000);
        if (data) downloadCSV(toCSV(data as Record<string, unknown>[]), `${safe}-analytics-${date}.csv`);

      } else if (type === 'reservations') {
        const { data } = await sb.from('table_reservations')
          .select('id, customer_name, customer_phone, customer_email, party_size, reservation_date, reservation_time, status, table_number, notes, created_at')
          .eq('restaurant_id', restaurantId).order('reservation_date', { ascending: false });
        if (data) downloadCSV(toCSV(data as Record<string, unknown>[]), `${safe}-reservations-${date}.csv`);
      }
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(null);
    }
  };

  const exports: { type: string; label: string; desc: string; icon: React.ElementType }[] = [
    { type: 'orders',       label: 'Commandes',    desc: 'Toutes vos commandes avec statuts et montants',        icon: Package },
    { type: 'items',        label: 'Menu / Plats', desc: 'Liste complète de vos plats et prix',                   icon: FileText },
    { type: 'reviews',      label: 'Avis clients', desc: 'Tous les avis reçus avec notes et commentaires',        icon: Star },
    { type: 'reservations', label: 'Réservations', desc: 'Historique des réservations de table',                  icon: Users },
    { type: 'analytics',    label: 'Statistiques', desc: 'Événements analytics (vues, clics, etc.)',              icon: TrendingUp },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-black tracking-tight mb-2">Export de vos données</h3>
        <p className="text-sm text-zinc-500 mb-8">
          Téléchargez vos données au format CSV, compatible Excel, Google Sheets et tout tableur.
        </p>
      </div>
      <div className="space-y-3">
        {exports.map((item) => (
          <div key={item.type} className="flex items-center justify-between p-4 r-admin-inset rounded-2xl gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-zinc-900 rounded-xl border border-zinc-700 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-5 h-5 text-zinc-500" aria-hidden="true" />
              </div>
              <div>
                <p className="font-bold text-sm text-[color:var(--r-text)]">{item.label}</p>
                <p className="text-xs text-[color:var(--r-text-muted)] mt-0.5">{item.desc}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => exportData(item.type)}
              disabled={!!exporting}
              aria-label={`Exporter les données — ${item.label}`}
              className={cn(settingsSecondaryBtn, 'flex-shrink-0')}
            >
              {exporting === item.type ? <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> : <Download className="w-4 h-4 shrink-0" aria-hidden />}
              {exporting === item.type ? 'Export...' : 'CSV'}
            </button>
          </div>
        ))}
      </div>
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-sm font-semibold text-blue-900 mb-1">ℹ️ Format CSV</p>
        <p className="text-xs text-blue-700">
          Les fichiers CSV sont encodés en UTF-8 avec BOM pour une compatibilité optimale avec Excel.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GeneralSettings — CORRECTION: alert() → toast, console.error → DEV guard
// ─────────────────────────────────────────────────────────────────────────────
const GeneralSettings = ({ formData, setFormData }: SettingsProps) => {
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [uploadingBanner, setUploadingBanner] = React.useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const bannerInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logo_url' | 'banner_url',
    setUploading: (v: boolean) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Seules les images sont acceptées.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop lourde (max 5 MB)'); return; }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${field}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('restaurants').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('restaurants').getPublicUrl(fileName);
      setFormData({ ...formData, [field]: data.publicUrl });
    } catch (err) {
      if (import.meta.env.DEV) console.error('Upload error:', err);
      toast.error("Échec de l'upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-black tracking-tight mb-6 text-[color:var(--r-text)]">Identité visuelle</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="input-logo" className="text-[10px] font-bold text-[color:var(--r-text-muted)] uppercase tracking-widest block">Logo</label>
            <div onClick={() => logoInputRef.current?.click()}
              className="relative w-32 h-32 rounded-2xl border-2 border-dashed border-[var(--restaurant-inset-border)] cursor-pointer hover:border-orange-500 transition overflow-hidden bg-[var(--restaurant-inset-bg)]">
              <input id="input-logo" ref={logoInputRef} type="file" accept="image/*"
                onChange={(e) => handleImageUpload(e, 'logo_url', setUploadingLogo)} className="hidden" aria-label="Choisir un logo" />
              {formData.logo_url ? (
                <>
                  <img src={formData.logo_url} alt="Logo" className="w-full h-full object-cover" loading="lazy" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, logo_url: '' }); }}
                    aria-label="Supprimer le logo"
                    className="absolute top-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 touch-manipulation"
                  >
                    <X className="w-4 h-4 shrink-0" aria-hidden />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[color:var(--r-text-muted)]">
                  {uploadingLogo ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-8 h-8" />}
                  <span className="text-xs mt-1">Logo</span>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="input-banner" className="text-[10px] font-bold text-[color:var(--r-text-muted)] uppercase tracking-widest block">Bannière</label>
            <div onClick={() => bannerInputRef.current?.click()}
              className="relative w-full h-32 rounded-2xl border-2 border-dashed border-[var(--restaurant-inset-border)] cursor-pointer hover:border-orange-500 transition overflow-hidden bg-[var(--restaurant-inset-bg)]">
              <input id="input-banner" ref={bannerInputRef} type="file" accept="image/*"
                onChange={(e) => handleImageUpload(e, 'banner_url', setUploadingBanner)} className="hidden" aria-label="Choisir une bannière" />
              {formData.banner_url ? (
                <>
                  <img src={formData.banner_url} alt="Bannière" className="w-full h-full object-cover" loading="lazy" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, banner_url: '' }); }}
                    aria-label="Supprimer la bannière"
                    className="absolute top-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 touch-manipulation"
                  >
                    <X className="w-4 h-4 shrink-0" aria-hidden />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[color:var(--r-text-muted)]">
                  {uploadingBanner ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-8 h-8" />}
                  <span className="text-xs mt-1">Bannière (1200×400)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-black tracking-tight mb-6 text-[color:var(--r-text)]">Informations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { id: 'g-name',    label: 'Nom du Restaurant', field: 'name'    as const, type: 'text' },
            { id: 'g-phone',   label: 'Téléphone',         field: 'phone'   as const, type: 'text' },
            { id: 'g-city',    label: 'Ville',             field: 'city'    as const, type: 'text' },
            { id: 'g-address', label: 'Adresse',           field: 'address' as const, type: 'text' },
          ].map(({ id, label, field, type }) => (
            <div key={id} className="space-y-2">
              <label htmlFor={id} className="text-[10px] font-bold text-[color:var(--r-text-muted)] uppercase tracking-widest block">{label}</label>
              <input id={id} type={type} value={formData[field] as string}
                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                className={cn(rSettingsInput, 'rounded-2xl')} />
            </div>
          ))}
          <div className="md:col-span-2 space-y-2">
            <label htmlFor="g-desc" className="text-[10px] font-bold text-[color:var(--r-text-muted)] uppercase tracking-widest block">Description</label>
            <textarea id="g-desc" rows={4} value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={cn(rSettingsInput, 'rounded-2xl resize-none')} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// USSDSettings
// ─────────────────────────────────────────────────────────────────────────────
function UssdPreview({ template }: { template: string }) {
  if (!template.trim()) return null;
  let preview = template.trim();
  if (preview.includes('{montant}')) preview = preview.replace('{montant}', '3500');
  else if (preview.endsWith('#')) preview = preview.replace(/#$/, '*3500#');
  else preview = `${preview}3500#`;
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Aperçu :</span>
      <code className="text-xs font-mono bg-zinc-900 text-green-400 px-2 py-0.5 rounded-lg">{preview}</code>
    </div>
  );
}

const USSDSettings = ({ formData, setFormData }: SettingsProps) => (
  <div className="space-y-8">
    <div>
      <h3 className="text-xl font-black tracking-tight mb-2">Configuration USSD</h3>
      <p className="text-sm text-zinc-500 mb-3">Entrez le <strong>format complet</strong> de votre code USSD.</p>
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-8">
        <p className="text-xs font-black text-orange-800 mb-2">📌 Comment saisir votre code ?</p>
        <div className="space-y-1.5 text-xs text-orange-700">
          <p>• Utilisez <code className="bg-orange-100 px-1 rounded font-mono">{'{montant}'}</code> là où le montant doit apparaître</p>
          <p>• Exemple MTN : <code className="bg-orange-100 px-1 rounded font-mono">*880*{'{montant}'}#</code></p>
          <p>• Exemple Moov : <code className="bg-orange-100 px-1 rounded font-mono">*155*1*1*{'{montant}'}#</code></p>
        </div>
      </div>
      <div className="space-y-6">
        {[
          { id: 'ussd-mtn',     field: 'ussd_mtn'     as const, label: 'MTN Mobile Money',  bg: 'bg-yellow-400', textColor: 'text-black', abbr: 'MTN',  placeholder: '*880*{montant}#' },
          { id: 'ussd-moov',    field: 'ussd_moov'    as const, label: 'Moov Money',         bg: 'bg-blue-500',   textColor: 'text-white', abbr: 'MOOV', placeholder: '*155*1*1*{montant}#' },
          { id: 'ussd-celtiis', field: 'ussd_celtiis' as const, label: 'Celtiis Cash',       bg: 'bg-green-500',  textColor: 'text-white', abbr: 'CEL',  placeholder: '*123*1*{montant}#' },
        ].map(({ id, field, label, bg, textColor, abbr, placeholder }) => (
          <div key={id} className="p-6 r-admin-inset rounded-[2rem]">
            <div className="flex items-center gap-4 mb-4">
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs', bg, textColor)}>{abbr}</div>
              <h4 className="font-bold">{label}</h4>
            </div>
            <label htmlFor={id} className="sr-only">Code USSD {label}</label>
            <input id={id} type="text" value={formData[field]}
              onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
              placeholder={`Ex: ${placeholder}`}
              className={cn(rSettingsInput, 'rounded-xl font-mono')} />
            <UssdPreview template={formData[field]} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DeliverySettings
// ─────────────────────────────────────────────────────────────────────────────
const DeliverySettings = ({ formData, setFormData }: SettingsProps) => (
  <div className="space-y-8">
    <div>
      <h3 className="text-xl font-black tracking-tight mb-2">Paramètres de Livraison</h3>
      <p className="text-sm text-zinc-500 mb-8">Configurez vos frais et temps de livraison.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { id: 'd-fee',  label: 'Frais de livraison (FCFA)',        field: 'delivery_fee'      as const, fallback: 0  },
          { id: 'd-min',  label: 'Commande minimum (FCFA)',          field: 'min_order'         as const, fallback: 0  },
          { id: 'd-tmin', label: 'Temps de livraison min (minutes)', field: 'delivery_time_min' as const, fallback: 30 },
          { id: 'd-tmax', label: 'Temps de livraison max (minutes)', field: 'delivery_time_max' as const, fallback: 60 },
        ].map(({ id, label, field, fallback }) => (
          <div key={id} className="space-y-2">
            <label htmlFor={id} className="text-[10px] font-bold text-[color:var(--r-text-muted)] uppercase tracking-widest block">{label}</label>
            <input id={id} type="number" value={formData[field] as number}
              onChange={(e) => setFormData({ ...formData, [field]: parseInt(e.target.value) || fallback })}
              className={cn(rSettingsInput, 'rounded-2xl')} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// LoyaltySettings — CORRECTION: alert() → toast.success/error
// ─────────────────────────────────────────────────────────────────────────────
const LoyaltySettings = ({ loyaltySettings }: { loyaltySettings: ReturnType<typeof useRestaurantLoyaltySettings> }) => {
  const { config, stats, loading, saving, saveConfig, updateConfig } = loyaltySettings;
  if (loading) return (
    <div className="flex items-center justify-center py-12 min-h-[200px]">
      <RestafyLoader fullscreen={false} message="Chargement de la fidélité…" size="sm" />
    </div>
  );

  const handleSave = async () => {
    const result = await saveConfig(config);
    if (!result.error) toast.success('Configuration de fidélité enregistrée !');
    else toast.error('Erreur lors de la sauvegarde');
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Membres fidélité', value: stats.totalAccounts,      color: 'from-orange-50 to-orange-100', textColor: 'text-orange-900', icon: Users,      iconColor: 'text-orange-600' },
          { label: 'Points émis',      value: stats.totalPointsIssued,  color: 'from-green-50 to-green-100',   textColor: 'text-green-900',  icon: TrendingUp, iconColor: 'text-green-600'  },
          { label: 'Points utilisés',  value: stats.totalPointsRedeemed,color: 'from-purple-50 to-purple-100', textColor: 'text-purple-900', icon: Gift,       iconColor: 'text-purple-600' },
          { label: 'Membres actifs',   value: stats.activeMembers,      color: 'from-blue-50 to-blue-100',     textColor: 'text-blue-900',   icon: Star,       iconColor: 'text-blue-600'   },
        ].map(({ label, value, color, textColor, icon: Icon, iconColor }) => (
          <div key={label} className={cn('p-4 bg-gradient-to-br rounded-2xl', color)}>
            <Icon className={cn('w-6 h-6 mb-2', iconColor)} />
            <p className={cn('text-2xl font-black', textColor)}>{value.toLocaleString()}</p>
            <p className={cn('text-xs font-medium', iconColor)}>{label}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-xl font-black tracking-tight mb-2">Programme de Fidélité</h3>
        <p className="text-sm text-[color:var(--r-text-muted)] mb-8">Définissez vos propres règles de points et récompenses.</p>
        <div className="p-6 r-admin-inset rounded-[2rem] mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-lg">Activer le programme</h4>
              <p className="text-sm text-[color:var(--r-text-muted)]">Les clients gagneront des points sur chaque commande</p>
            </div>
            <SettingsSwitch
              pressed={config.loyalty_enabled}
              onToggle={() => updateConfig({ loyalty_enabled: !config.loyalty_enabled })}
              aria-label={config.loyalty_enabled ? 'Désactiver le programme de fidélité' : 'Activer le programme de fidélité'}
            />
          </div>
        </div>

        {config.loyalty_enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="l-ppc" className="text-[10px] font-bold text-[color:var(--r-text-muted)] uppercase tracking-widest block">Points par FCFA dépensé</label>
              <input id="l-ppc" type="number" step="0.001" min="0" value={config.loyalty_points_per_fcfa}
                onChange={(e) => updateConfig({ loyalty_points_per_fcfa: parseFloat(e.target.value) || 0.01 })}
                className={cn(rSettingsInput, 'rounded-2xl')} />
            </div>
            <div className="space-y-2">
              <label htmlFor="l-min" className="text-[10px] font-bold text-[color:var(--r-text-muted)] uppercase tracking-widest block">Minimum de points pour utiliser</label>
              <input id="l-min" type="number" min="0" value={config.loyalty_min_points_redeem}
                onChange={(e) => updateConfig({ loyalty_min_points_redeem: parseInt(e.target.value) || 100 })}
                className={cn(rSettingsInput, 'rounded-2xl')} />
            </div>
            <div className="space-y-2">
              <label htmlFor="l-wb" className="text-[10px] font-bold text-[color:var(--r-text-muted)] uppercase tracking-widest block">Bonus de bienvenue (points)</label>
              <input id="l-wb" type="number" min="0" value={config.loyalty_welcome_bonus}
                onChange={(e) => updateConfig({ loyalty_welcome_bonus: parseInt(e.target.value) || 0 })}
                className={cn(rSettingsInput, 'rounded-2xl')} />
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button type="button" onClick={handleSave} disabled={saving} className={settingsPrimaryBtn}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden /> : <Save className="w-5 h-5 shrink-0" aria-hidden />}
            <span>{saving ? 'Enregistrement...' : 'Enregistrer la fidélité'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LocalAlertsSettings — son + vibration (per-device, persistance localStorage)
// ─────────────────────────────────────────────────────────────────────────────
function LocalAlertsSettings() {
  const { prefs, update } = useNotificationPreferences();
  return (
    <div>
      <h3 className="text-xl font-black tracking-tight mb-2">Alertes sur cet appareil</h3>
      <p className="text-sm text-zinc-500 mb-6">
        Réglages spécifiques à ce téléphone, cette tablette ou cet ordinateur. Idéal pour avoir
        le son sur la tablette de la caisse mais pas sur votre téléphone personnel.
      </p>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-5 r-admin-inset rounded-2xl">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
              aria-hidden
            >
              <Volume2 className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-[color:var(--r-text)]">Son nouvelle commande</p>
              <p className="text-xs text-[color:var(--r-text-muted)] mt-0.5">
                Joue un son répétitif jusqu'à votre interaction. Sinon désactivez ici.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => playNotificationSound('order')}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-[color:var(--r-text-muted)]"
            >
              Tester
            </button>
            <SettingsSwitch
              pressed={prefs.soundEnabled}
              onToggle={() => update({ soundEnabled: !prefs.soundEnabled })}
              aria-label={`${prefs.soundEnabled ? 'Désactiver' : 'Activer'} le son`}
            />
          </div>
        </div>
        <div className="flex items-center justify-between p-5 r-admin-inset rounded-2xl">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
              aria-hidden
            >
              <Vibrate className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-[color:var(--r-text)]">Vibration</p>
              <p className="text-xs text-[color:var(--r-text-muted)] mt-0.5">
                Sur mobile, vibre lors d'une nouvelle commande (si supporté par le navigateur).
              </p>
            </div>
          </div>
          <SettingsSwitch
            pressed={prefs.vibrationEnabled}
            onToggle={() => update({ vibrationEnabled: !prefs.vibrationEnabled })}
            aria-label={`${prefs.vibrationEnabled ? 'Désactiver' : 'Activer'} la vibration`}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationsSettings — CORRECTION: restaurant: any → Restaurant
// ─────────────────────────────────────────────────────────────────────────────
const NOTIF_FIELDS: { key: string; Icon: LucideIcon; label: string; desc: string }[] = [
  { key: 'notif_new_order',     Icon: Bell,          label: 'Nouvelle commande',    desc: "Alerté dès qu'une commande arrive" },
  { key: 'notif_payment',       Icon: CreditCard,    label: 'Paiement reçu',         desc: 'Confirmation de paiement validé' },
  { key: 'notif_order_cancel',  Icon: XCircle,       label: 'Commande annulée',      desc: 'Quand un client annule' },
  { key: 'notif_low_stock',     Icon: AlertTriangle, label: 'Plat épuisé signalé',  desc: 'Quand un plat est marqué indisponible' },
  { key: 'notif_new_review',    Icon: Star,          label: 'Nouvel avis client',    desc: 'Quand un client laisse un avis' },
  { key: 'notif_daily_summary', Icon: BarChart3,     label: 'Résumé quotidien',      desc: 'Rapport de fin de journée par SMS/email' },
];

function NotificationsSettings({ restaurantId, restaurant, onSettingsChange }: { restaurantId: string; restaurant: Restaurant; onSettingsChange?: (settings: Record<string, unknown>) => void }) {
  const defaultPrefs: Record<string, boolean> = {
    notif_new_order: true, notif_payment: true, notif_order_cancel: true,
    notif_low_stock: false, notif_new_review: false, notif_daily_summary: false,
  };
  const [prefs, setPrefs] = useState<Record<string, boolean>>(defaultPrefs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (restaurant?.settings) {
      const s = restaurant.settings;
      setPrefs(prev => ({
        ...prev,
        ...Object.fromEntries(NOTIF_FIELDS.map(f => [f.key, s[f.key] !== undefined ? Boolean(s[f.key]) : prev[f.key]])),
      }));
    }
  }, [restaurant]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('restaurants')
      .update({ settings: { ...(restaurant?.settings || {}), ...prefs }, updated_at: new Date().toISOString() })
      .eq('id', restaurantId);
    setSaving(false);
    if (!error) {
      const merged = { ...(restaurant?.settings || {}), ...prefs };
      onSettingsChange?.(merged);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <div className="space-y-8">
      <LocalAlertsSettings />
      <div>
        <h3 className="text-xl font-black tracking-tight mb-2">Notifications</h3>
        <p className="text-sm text-zinc-500 mb-8">Choisissez les événements pour lesquels vous souhaitez être alerté.</p>
        <div className="space-y-3">
          {NOTIF_FIELDS.map(f => (
            <div key={f.key} className="flex items-center justify-between p-5 r-admin-inset rounded-2xl hover:bg-[var(--r-surface-hover)] transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"
                  aria-hidden
                >
                  <f.Icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[color:var(--r-text)]">{f.label}</p>
                  <p className="text-xs text-[color:var(--r-text-muted)] mt-0.5">{f.desc}</p>
                </div>
              </div>
              <SettingsSwitch
                pressed={prefs[f.key]}
                onToggle={() => setPrefs(p => ({ ...p, [f.key]: !p[f.key] }))}
                aria-label={`${prefs[f.key] ? 'Désactiver' : 'Activer'} : ${f.label}`}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
        {saved && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
            <CheckCircle2 className="w-4 h-4" /> Préférences enregistrées
          </div>
        )}
        <button type="button" onClick={save} disabled={saving} className={cn(settingsPrimaryBtn, 'ml-auto w-full sm:w-auto')}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden /> : <Save className="w-5 h-5 shrink-0" aria-hidden />}
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SecuritySettings
// ─────────────────────────────────────────────────────────────────────────────
function SecuritySettings() {
  const [form, setForm] = useState({ next: '', confirm: '' });
  const [show, setShow] = useState({ next: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const strength = (pw: string) => {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };
  const s = strength(form.next);
  const strengthLabel = ['', 'Faible', 'Moyen', 'Bon', 'Fort'][s];
  const strengthColor = ['', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-emerald-400'][s];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.next.length < 8) return setMsg({ text: 'Minimum 8 caractères', ok: false });
    if (form.next !== form.confirm) return setMsg({ text: 'Les mots de passe ne correspondent pas', ok: false });
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: form.next });
    setSaving(false);
    if (error) setMsg({ text: 'Impossible de modifier le mot de passe. Veuillez réessayer.', ok: false });
    else { setForm({ next: '', confirm: '' }); setMsg({ text: 'Mot de passe modifié avec succès ✓', ok: true }); }
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div className="space-y-10">
      <div>
        <h3 className="text-xl font-black tracking-tight mb-2">Changer le mot de passe</h3>
        <p className="text-sm text-zinc-500 mb-8">Utilisez un mot de passe fort avec lettres, chiffres et symboles.</p>
        {msg && (
          <div className={cn('flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold mb-6',
            msg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100')}>
            {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {msg.text}
          </div>
        )}
        <form onSubmit={save} className="space-y-5 max-w-md">
          {(['next', 'confirm'] as const).map(k => (
            <div key={k} className="space-y-2">
              <label htmlFor={`pwd-${k}`} className="text-[10px] font-bold text-[color:var(--r-text-muted)] uppercase tracking-widest block">
                {k === 'next' ? 'Nouveau mot de passe' : 'Confirmer le mot de passe'}
              </label>
              <div className="relative">
                <input id={`pwd-${k}`} type={show[k] ? 'text' : 'password'} value={form[k]}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  placeholder={k === 'next' ? 'Minimum 8 caractères' : 'Retapez le nouveau mot de passe'}
                  className={cn(rSettingsInput, 'rounded-2xl pr-12')} />
                <button
                  type="button"
                  onClick={() => setShow(sv => ({ ...sv, [k]: !sv[k] }))}
                  aria-label={show[k] ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={show[k]}
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[color:var(--r-text-muted)] transition-colors hover:bg-[var(--r-surface)] hover:text-[color:var(--r-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 touch-manipulation"
                >
                  {show[k] ? <EyeOff className="w-4 h-4 shrink-0" aria-hidden /> : <Eye className="w-4 h-4 shrink-0" aria-hidden />}
                </button>
              </div>
            </div>
          ))}
          {form.next.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => <div key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', s >= i ? strengthColor : 'bg-zinc-100')} />)}
              </div>
              <p className="text-xs text-zinc-400">Force : <span className="font-bold">{strengthLabel}</span></p>
            </div>
          )}
          <button type="submit" disabled={saving || !form.next || !form.confirm} className={settingsPrimaryBtn}>
            {saving ? <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden /> : <Shield className="w-5 h-5 shrink-0" aria-hidden />}
            {saving ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>

      <div className="border-t border-zinc-100 pt-10">
        <h3 className="text-xl font-black tracking-tight mb-2">Informations de sécurité</h3>
        <p className="text-sm text-zinc-500 mb-6">Conseils pour sécuriser votre compte Restafy.</p>
        <div className="space-y-3">
          {[
            { icon: ShieldCheck, title: 'Utilisez un mot de passe unique',     desc: "N'utilisez pas le même mot de passe sur d'autres sites." },
            { icon: Mail,        title: 'Vérifiez votre email',                desc: "Assurez-vous d'avoir accès à l'adresse email de votre compte." },
            { icon: Phone2,      title: 'Déconnectez-vous sur appareils partagés', desc: 'Toujours se déconnecter après une session sur un appareil public.' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-4 p-4 r-admin-inset rounded-2xl">
              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm text-[color:var(--r-text)]">{item.title}</p>
                <p className="text-xs text-[color:var(--r-text-muted)] mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
