// src/pages/admin/RestaurantSlug.tsx
// Lien public personnalisé + QR Codes — design premium

import React, { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Link2, CheckCircle2, XCircle, Loader2, Save, RefreshCw,
  Copy, Check, ExternalLink, QrCode, Sparkles, Globe2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getAppUrl } from '@/lib/appUrl';
import { QRCodeGenerator } from '@/components/QRCodeGenerator';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

const BASE_DISPLAY = 'app.restafy.shop/r/';
const SLUG_REGEX = /^[a-z0-9][a-z0-9_-]{2,28}[a-z0-9]$/;

function slugify(s: string | null | undefined) {
  if (s == null || typeof s !== 'string') return '';
  return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 30);
}

type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

type Restaurant = {
  id: string; name: string | null; slug: string | null;
  city: string | null; avg_rating: number | null;
  delivery_time_min: number | null; delivery_time_max: number | null;
  cuisine_type: string | null;
};

export default function RestaurantSlug() {
  const { profile } = useAuth();
  const restaurantId = profile?.restaurant_id;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [slug, setSlug] = useState('');
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void supabase
      .from('restaurants')
      .select('id,name,slug,city,avg_rating,delivery_time_min,delivery_time_max,cuisine_type')
      .eq('id', restaurantId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error('Impossible de charger le restaurant : ' + error.message);
          setRestaurant(null);
        } else if (data) {
          const row = data as Restaurant;
          setRestaurant(row);
          setSlug(row.slug ?? (slugify(row.name) || 'restaurant'));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const baseName = restaurant?.name?.trim() || 'resto';
  const suggestions = restaurant
    ? [slugify(`${baseName}229`), slugify(`${baseName}cotonou`), slugify(`chez${baseName}`)]
    : [];

  const checkAvailability = useCallback(async () => {
    if (!slug || !SLUG_REGEX.test(slug)) { setCheckState('invalid'); return; }
    setCheckState('checking');
    const { data } = await supabase.from('restaurants').select('id').eq('slug', slug).neq('id', restaurantId ?? '').maybeSingle();
    setCheckState(data ? 'taken' : 'available');
  }, [slug, restaurantId]);

  const handleSave = async () => {
    if (checkState !== 'available' && slug !== restaurant?.slug) return;
    setSaving(true);
    const { error } = await supabase.from('restaurants').update({ slug }).eq('id', restaurantId ?? '');
    setSaving(false);
    if (!error) {
      setSaved(true); setRestaurant(p => p ? { ...p, slug } : p);
      toast.success('Lien mis à jour !');
      setTimeout(() => setSaved(false), 3000);
    } else toast.error('Erreur sauvegarde');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${getAppUrl()}/r/${slug}`);
    setCopied(true); toast.success('Lien copié !');
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig: Record<CheckState, { label: string; color: string; icon: React.ReactNode } | null> = {
    idle: null,
    checking: { label: 'Vérification…', color: 'text-zinc-400', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
    available: { label: 'Disponible', color: 'text-emerald-400', icon: <CheckCircle2 className="w-4 h-4" /> },
    taken: { label: 'Déjà utilisé', color: 'text-rose-400', icon: <XCircle className="w-4 h-4" /> },
    invalid: { label: 'Min. 4 caractères, lettres minuscules, chiffres, - ou _', color: 'text-amber-400', icon: <XCircle className="w-4 h-4" /> },
  };

  const status = statusConfig[checkState];
  const canSave = (checkState === 'available' || slug === restaurant?.slug) && slug.length >= 4;
  const activeSlug = saved ? slug : (restaurant?.slug ?? '');
  const liveUrl = activeSlug ? `${getAppUrl()}/r/${activeSlug}` : '';

  if (loading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <RestafyLoader fullscreen={false} message="Chargement du lien & QR…" size="md" />
      </div>
    );
  }

  if (!restaurantId || !restaurant) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center text-zinc-500">
        <p className="font-bold text-zinc-300">Restaurant introuvable</p>
        <p className="text-sm mt-2">Vérifiez que votre profil a un <code className="text-orange-400">restaurant_id</code> (tableau de bord → reconnexion si besoin).</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-12">
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-orange-500/15 bg-gradient-to-br from-orange-500/[0.08] via-amber-500/[0.04] to-transparent p-8 sm:p-10"
      >
        {/* Décor ambient */}
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-orange-500/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200/90">Présence en ligne</span>
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight font-display bg-gradient-to-br from-white via-orange-100 to-amber-200 bg-clip-text text-transparent">
            Lien public &amp; QR Codes
          </h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-zinc-400 leading-relaxed">
            Une adresse signature pour {restaurant.name?.trim() || 'votre restaurant'}, des QR codes haut de gamme prêts à imprimer pour vos affiches, vitrines et réseaux sociaux.
          </p>

          {liveUrl && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-950/60 border border-white/10 backdrop-blur-sm">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                  <Globe2 className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Votre adresse</p>
                  <p className="text-sm font-mono text-zinc-200 truncate">
                    {BASE_DISPLAY}<span className="text-orange-300 font-bold">{activeSlug}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold text-zinc-200 hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span className="hidden sm:inline">{copied ? 'Copié' : 'Copier'}</span>
                </button>
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:brightness-105 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Voir</span>
                </a>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ── Éditeur de slug ─────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="r-admin-card p-6 sm:p-8 space-y-6"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
                <Link2 className="w-4 h-4 text-orange-300" />
              </div>
              <h2 className="text-lg font-black text-zinc-100 tracking-tight font-display">Slug personnalisé</h2>
            </div>
            <p className="mt-2 text-sm text-zinc-500 max-w-md">
              Choisissez l&apos;adresse unique qui apparaîtra sur vos cartes, flyers et QR codes.
            </p>
          </div>
        </div>

        <div className="flex items-stretch rounded-2xl border-2 border-zinc-800 overflow-hidden bg-zinc-950/60 focus-within:border-orange-500/60 focus-within:ring-4 focus-within:ring-orange-500/15 transition-all">
          <span className="flex items-center px-4 sm:px-5 bg-zinc-900/80 border-r border-zinc-800 text-zinc-500 text-sm font-mono whitespace-nowrap select-none">
            {BASE_DISPLAY}
          </span>
          <input
            type="text"
            value={slug}
            onChange={e => { setSlug(slugify(e.target.value)); setCheckState('idle'); setSaved(false); }}
            placeholder="monrestaurant"
            maxLength={30}
            className="flex-1 px-4 py-4 text-base font-mono font-bold text-zinc-100 outline-none bg-transparent placeholder:text-zinc-600 placeholder:font-normal"
          />
        </div>

        <AnimatePresence mode="wait">
          {status && (
            <motion.div
              key={checkState}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold',
                checkState === 'available' && 'bg-emerald-500/10 border border-emerald-500/30',
                checkState === 'taken' && 'bg-rose-500/10 border border-rose-500/30',
                checkState === 'invalid' && 'bg-amber-500/10 border border-amber-500/30',
                checkState === 'checking' && 'bg-zinc-800 border border-zinc-700',
                status.color,
              )}
            >
              {status.icon}{status.label}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={checkAvailability}
            disabled={checkState === 'checking' || !slug}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 text-sm font-bold text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', checkState === 'checking' && 'animate-spin')} />
            Vérifier
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving || saved}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
              saved
                ? 'bg-emerald-600 text-white'
                : canSave
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110 shadow-lg shadow-orange-500/30'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Enregistré' : 'Enregistrer'}
          </button>
        </div>
      </motion.section>

      {/* ── Suggestions ─────────────────────────────────────────────────── */}
      {(checkState === 'taken' || checkState === 'invalid') && (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="r-admin-card p-6 space-y-3"
        >
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Suggestions disponibles</p>
          <div className="grid sm:grid-cols-3 gap-2">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => { setSlug(s); setCheckState('idle'); }}
                className="group flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all"
              >
                <span className="font-mono text-xs text-zinc-300 group-hover:text-orange-200 truncate">
                  {BASE_DISPLAY}<strong>{s}</strong>
                </span>
                <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex-shrink-0">
                  Choisir
                </span>
              </button>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── QR Codes ────────────────────────────────────────────────────── */}
      {activeSlug && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="space-y-6"
        >
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                  <QrCode className="w-4 h-4 text-violet-300" />
                </div>
                <h2 className="text-lg font-black text-zinc-100 tracking-tight font-display">QR Codes prêts à imprimer</h2>
              </div>
              <p className="mt-2 text-sm text-zinc-500 max-w-2xl">
                Trois codes — page restaurant, menu direct, réservation — avec choix de modèle visuel et téléchargement haute résolution.
              </p>
            </div>
          </div>

          <QRCodeGenerator
            slug={activeSlug}
            restaurantName={restaurant?.name ?? undefined}
            types={['restaurant', 'menu', 'reservation']}
          />

          <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <QrCode className="w-5 h-5 text-amber-300" />
            </div>
            <div className="text-sm text-amber-100/90 space-y-1.5">
              <p className="font-black tracking-tight">Comment utiliser vos QR codes</p>
              <ul className="space-y-1 text-xs text-amber-100/70 leading-relaxed">
                <li><strong className="text-amber-200">Page restaurant</strong> — flyers, affiches, réseaux sociaux, vitrine</li>
                <li><strong className="text-amber-200">Menu direct</strong> — sets de table pour commander sans serveur</li>
                <li><strong className="text-amber-200">Réservation</strong> — entrée et accueil pour réserver une table en scannant</li>
              </ul>
            </div>
          </div>
        </motion.section>
      )}
    </div>
  );
}
