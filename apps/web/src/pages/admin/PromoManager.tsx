// src/pages/admin/PromoManager.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  Plus, Tag, Percent, BadgeDollarSign, Trash2, ToggleLeft, ToggleRight,
  Copy, CheckCircle2, Calendar, Users, TrendingUp, X, Loader2,
  AlertCircle, Sparkles, Clock, ShoppingBag, Flame
} from 'lucide-react';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

// ── Types ──────────────────────────────────────────────────────────────────
interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

const inputCls = "w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all placeholder:text-zinc-300";

// ── Generateur de code ─────────────────────────────────────────────────────
function generateCode(prefix = '') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return prefix ? `${prefix.toUpperCase()}${rand}` : rand;
}

// ── Card stat mini ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-black text-zinc-900 leading-none">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Badge état ─────────────────────────────────────────────────────────────
function StatusBadge({ code }: { code: PromoCode }) {
  const now = new Date();
  const expired = code.expires_at && new Date(code.expires_at) < now;
  const exhausted = code.max_uses !== null && code.used_count >= code.max_uses;

  if (!code.is_active) return <span className="px-2 py-1 bg-zinc-100 text-zinc-500 text-[10px] font-black rounded-lg uppercase tracking-widest">Inactif</span>;
  if (expired) return <span className="px-2 py-1 bg-red-50 text-red-500 text-[10px] font-black rounded-lg uppercase tracking-widest">Expiré</span>;
  if (exhausted) return <span className="px-2 py-1 bg-orange-50 text-orange-500 text-[10px] font-black rounded-lg uppercase tracking-widest">Épuisé</span>;
  return <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg uppercase tracking-widest">Actif</span>;
}

// ── Formulaire création ────────────────────────────────────────────────────
function CreatePromoModal({ restaurantId, onClose, onCreated }: {
  restaurantId: string;
  onClose: () => void;
  onCreated: (promo: PromoCode) => void;
}) {
  const [form, setForm] = useState({
    code: generateCode(),
    description: '',
    discount_type: 'percent' as 'percent' | 'fixed',
    discount_value: 10,
    min_order_amount: '',
    max_uses: '',
    expires_at: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const validate = () => {
    if (form.code.length < 3) return 'Le code doit faire au moins 3 caractères';
    if (form.discount_value <= 0) return 'La réduction doit être > 0';
    if (form.discount_type === 'percent' && form.discount_value > 100) return 'Le pourcentage ne peut pas dépasser 100%';
    return null;
  };

  const handleSave = async () => {
    const validErr = validate();
    if (validErr) { setErr(validErr); return; }
    setSaving(true);
    setErr(null);

    const { data, error } = await supabase
      .from('promo_codes')
      .insert({
        restaurant_id: restaurantId,
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        is_active: true,
        used_count: 0,
      })
      .select()
      .single();

    setSaving(false);
    if (error) { setErr(error.message); return; }
    onCreated(data as PromoCode);
    onClose();
  };

  const PRESETS = [
    { label: '10%', type: 'percent' as const, value: 10 },
    { label: '20%', type: 'percent' as const, value: 20 },
    { label: '50%', type: 'percent' as const, value: 50 },
    { label: '-500 FCFA', type: 'fixed' as const, value: 500 },
    { label: '-1000 FCFA', type: 'fixed' as const, value: 1000 },
    { label: 'Gratuit', type: 'percent' as const, value: 100 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
        transition={{ type: 'spring', damping: 30 }}
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <h2 className="font-black text-lg">Nouveau code promo</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-zinc-100 rounded-full"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Code */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Code promo *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="EX: BIENVENUE20"
                className={`${inputCls} font-mono font-black tracking-widest flex-1`}
                maxLength={20}
              />
              <button
                type="button"
                onClick={() => set('code', generateCode())}
                className="px-4 py-3 bg-zinc-100 text-zinc-600 rounded-2xl text-sm font-bold hover:bg-zinc-200 transition-colors whitespace-nowrap"
              >
                🎲 Aléatoire
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Description interne (optionnel)</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Ex: Code pour les nouveaux clients" className={inputCls} />
          </div>

          {/* Réduction — presets rapides */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-3">Type de réduction *</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { set('discount_type', p.type); set('discount_value', p.value); }}
                  className={`py-2.5 rounded-2xl text-xs font-black transition-all ${
                    form.discount_type === p.type && form.discount_value === p.value
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-zinc-50 border border-zinc-100 text-zinc-600 hover:border-primary/30'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Ou valeur personnalisée */}
            <div className="flex gap-2">
              <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 flex-shrink-0">
                <button
                  onClick={() => set('discount_type', 'percent')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${form.discount_type === 'percent' ? 'bg-white text-primary shadow-sm' : 'text-zinc-400'}`}
                >
                  %
                </button>
                <button
                  onClick={() => set('discount_type', 'fixed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${form.discount_type === 'fixed' ? 'bg-white text-primary shadow-sm' : 'text-zinc-400'}`}
                >
                  FCFA
                </button>
              </div>
              <input
                type="number"
                value={form.discount_value}
                onChange={e => set('discount_value', e.target.value)}
                min={1}
                max={form.discount_type === 'percent' ? 100 : undefined}
                className={`${inputCls} flex-1`}
                placeholder={form.discount_type === 'percent' ? 'Ex: 15' : 'Ex: 750'}
              />
            </div>
          </div>

          {/* Conditions */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Commande min. (FCFA)</label>
              <input type="number" value={form.min_order_amount}
                onChange={e => set('min_order_amount', e.target.value)}
                placeholder="Aucun minimum" className={inputCls} min={0} step={500} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Utilisations max.</label>
              <input type="number" value={form.max_uses}
                onChange={e => set('max_uses', e.target.value)}
                placeholder="Illimité" className={inputCls} min={1} />
            </div>
          </div>

          {/* Expiration */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Date d'expiration (optionnel)</label>
            <input type="datetime-local" value={form.expires_at}
              onChange={e => set('expires_at', e.target.value)}
              className={inputCls}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          {/* Aperçu du code */}
          <div className="bg-gradient-to-br from-primary/5 to-orange-50 border border-primary/10 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Aperçu</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono font-black text-xl text-zinc-900 tracking-widest">{form.code || '- - - - - -'}</p>
                {form.description && <p className="text-xs text-zinc-400 mt-0.5">{form.description}</p>}
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-primary">
                  {form.discount_type === 'percent' ? `-${form.discount_value}%` : `-${Number(form.discount_value).toLocaleString('fr-FR')} FCFA`}
                </p>
                {form.min_order_amount && <p className="text-[10px] text-zinc-400">min. {Number(form.min_order_amount).toLocaleString('fr-FR')} FCFA</p>}
              </div>
            </div>
          </div>

          {err && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-2xl">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 font-medium">{err}</p>
            </div>
          )}

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {saving ? 'Création...' : 'Créer ce code promo'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────
export default function PromoManager() {
  const { profile } = useAuth();
  const restaurantId = profile?.restaurant_id;

  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }
    supabase
      .from('promo_codes')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPromos((data as PromoCode[]) || []);
        setLoading(false);
      });
  }, [restaurantId]);

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggle = async (promo: PromoCode) => {
    const newVal = !promo.is_active;
    setPromos(p => p.map(x => x.id === promo.id ? { ...x, is_active: newVal } : x));
    await supabase.from('promo_codes').update({ is_active: newVal }).eq('id', promo.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce code promo ?')) return;
    setPromos(p => p.filter(x => x.id !== id));
    await supabase.from('promo_codes').delete().eq('id', id);
  };

  // Stats
  const activeCount  = promos.filter(p => p.is_active).length;
  const totalUses    = promos.reduce((s, p) => s + p.used_count, 0);
  const now          = new Date();
  const expiredCount = promos.filter(p => p.expires_at && new Date(p.expires_at) < now).length;

  // Filtrés
  const filtered = promos.filter(p => {
    if (filter === 'active') return p.is_active;
    if (filter === 'inactive') return !p.is_active;
    return true;
  });

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-zinc-100 px-4 py-5 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-xl font-black">Codes promo</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{promos.length} code{promos.length !== 1 ? 's' : ''} au total</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-2xl text-sm font-bold shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> Créer
        </button>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Actifs" value={activeCount} icon={Flame} color="bg-emerald-100 text-emerald-600" />
          <StatCard label="Utilisations" value={totalUses} icon={TrendingUp} color="bg-blue-100 text-blue-600" />
          <StatCard label="Expirés" value={expiredCount} icon={Clock} color="bg-red-100 text-red-500" />
        </div>

        {/* Filtre */}
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                filter === f ? 'bg-primary text-white' : 'bg-white border border-zinc-100 text-zinc-400'
              }`}
            >
              {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : 'Inactifs'}
            </button>
          ))}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-12 min-h-[200px]">
            <RestafyLoader fullscreen={false} message="Chargement des promos…" size="md" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-zinc-100 rounded-3xl flex items-center justify-center mb-4">
              <Tag className="w-10 h-10 text-zinc-300" />
            </div>
            <p className="font-bold text-zinc-500">Aucun code promo</p>
            <p className="text-sm text-zinc-400 mt-1">Créez votre premier code pour attirer des clients !</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-5">
              <Plus className="w-4 h-4" /> Créer mon premier code
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(promo => {
              const usagePercent = promo.max_uses ? Math.min(100, Math.round(promo.used_count / promo.max_uses * 100)) : null;
              return (
                <motion.div
                  key={promo.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white rounded-3xl border overflow-hidden transition-all ${
                    !promo.is_active ? 'border-zinc-100 opacity-60' : 'border-zinc-100'
                  }`}
                >
                  {/* Bande colorée du haut */}
                  <div className={`h-1 ${promo.is_active ? 'bg-gradient-to-r from-primary to-orange-400' : 'bg-zinc-200'}`} />

                  <div className="p-4 space-y-3">
                    {/* Ligne 1 : code + badge + toggle */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-lg tracking-widest text-zinc-900">{promo.code}</span>
                          <StatusBadge code={promo} />
                        </div>
                        {promo.description && <p className="text-xs text-zinc-400 mt-0.5">{promo.description}</p>}
                      </div>
                      <button onClick={() => handleToggle(promo)} className="flex-shrink-0 mt-1">
                        {promo.is_active
                          ? <ToggleRight className="w-8 h-8 text-primary" />
                          : <ToggleLeft className="w-8 h-8 text-zinc-300" />
                        }
                      </button>
                    </div>

                    {/* Ligne 2 : réduction + conditions */}
                    <div className="flex flex-wrap gap-2">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-black">
                        {promo.discount_type === 'percent' ? <Percent className="w-3 h-3" /> : <BadgeDollarSign className="w-3 h-3" />}
                        {promo.discount_type === 'percent' ? `-${promo.discount_value}%` : `-${promo.discount_value.toLocaleString('fr-FR')} FCFA`}
                      </span>
                      {promo.min_order_amount && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 text-zinc-500 rounded-xl text-xs font-bold">
                          <ShoppingBag className="w-3 h-3" /> min. {promo.min_order_amount.toLocaleString('fr-FR')} FCFA
                        </span>
                      )}
                      {promo.expires_at && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 text-zinc-500 rounded-xl text-xs font-bold">
                          <Calendar className="w-3 h-3" /> exp. {formatDate(promo.expires_at)}
                        </span>
                      )}
                    </div>

                    {/* Barre d'utilisation */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                          <Users className="w-3 h-3" /> Utilisations
                        </span>
                        <span className="text-xs font-bold text-zinc-500">
                          {promo.used_count}
                          {promo.max_uses ? ` / ${promo.max_uses}` : ''}
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: usagePercent !== null ? `${usagePercent}%` : '0%' }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleCopy(promo.id, promo.code)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all flex-1 justify-center ${
                          copiedId === promo.id
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                        }`}
                      >
                        {copiedId === promo.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === promo.id ? 'Copié !' : 'Copier le code'}
                      </button>
                      <button
                        onClick={() => handleDelete(promo.id)}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal création */}
      <AnimatePresence>
        {showCreate && restaurantId && (
          <CreatePromoModal
            restaurantId={restaurantId}
            onClose={() => setShowCreate(false)}
            onCreated={promo => setPromos(p => [promo, ...p])}
          />
        )}
      </AnimatePresence>
    </div>
  );
}