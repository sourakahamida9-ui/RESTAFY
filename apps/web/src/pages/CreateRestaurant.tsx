// src/pages/CreateRestaurant.tsx
// Page pour les restaurant_owner : créer et publier leur restaurant
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, ArrowRight, Store, MapPin, Phone, Image as ImageIcon,
  Clock, Utensils, CheckCircle2, Loader2, Upload, Eye, EyeOff,
  AlertCircle, ChevronRight, Sparkles
} from 'lucide-react';

const CITIES = ['Cotonou', 'Porto-Novo', 'Abomey-Calavi', 'Parakou', 'Bohicon', 'Natitingou', 'Ouidah', 'Lokossa'];
const CUISINES = ['Cuisine béninoise', 'Cuisine africaine', 'Fast food', 'Pizza', 'Grill / Barbecue', 'Végétarien', 'Brochettes', 'Fruits de mer', 'Maquis', 'Pâtisserie', 'Café / Snack'];

const inputCls = "w-full px-4 py-3.5 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all placeholder:text-zinc-300";

// ── Step indicator ──────────────────────────────────────────────────────────
function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 px-4 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className="h-1 flex-1 rounded-full overflow-hidden bg-zinc-100"
        >
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={false}
            animate={{ width: i < step ? '100%' : '0%' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </motion.div>
      ))}
    </div>
  );
}

// ── Image picker ────────────────────────────────────────────────────────────
function ImagePicker({ value, onChange, label, aspect }: { value: string; onChange: (url: string) => void; label: string; aspect: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `restaurants/${user.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('restaurants').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('restaurants').getPublicUrl(path);
      onChange(data.publicUrl);
    } catch { /* silent */ }
    finally { setUploading(false); }
  };

  return (
    <div>
      <input ref={ref} type="file" accept="image/*" onChange={handle} className="hidden" />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`w-full border-2 border-dashed border-zinc-200 rounded-2xl overflow-hidden transition-colors hover:border-primary/40 ${aspect}`}
      >
        {value ? (
          <div className="relative w-full h-full group">
            <img src={value} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <p className="text-white text-xs font-bold">Changer</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-zinc-300">
            {uploading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <Upload className="w-6 h-6" />}
            <p className="text-xs font-medium text-zinc-400">{uploading ? 'Upload...' : label}</p>
          </div>
        )}
      </button>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function CreateRestaurant() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    cuisine_type: '',
    city: 'Cotonou',
    address: '',
    phone: '',
    logo_url: '',
    banner_url: '',
    delivery_fee: 0,
    min_order: 0,
    delivery_time_min: 20,
    delivery_time_max: 45,
    ussd_mtn: '',
    ussd_moov: '',
    ussd_celtiis: '',
  });

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const TOTAL_STEPS = 4;

  const canNext = () => {
    if (step === 1) return form.name.trim().length >= 2 && form.city && form.address.trim().length >= 5;
    if (step === 2) return form.cuisine_type !== '';
    if (step === 3) return true; // images optionnelles
    return true;
  };

  const handlePublish = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);

    try {
      // Générer le slug
      const slug = form.name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

      // Créer le restaurant
      const { data: resto, error: restoErr } = await supabase
        .from('restaurants')
        .insert({
          name: form.name,
          slug,
          description: form.description || null,
          cuisine_type: form.cuisine_type,
          city: form.city,
          address: form.address,
          phone: form.phone || null,
          logo_url: form.logo_url || null,
          banner_url: form.banner_url || null,
          delivery_fee: form.delivery_fee,
          min_order: form.min_order,
          delivery_time_min: form.delivery_time_min,
          delivery_time_max: form.delivery_time_max,
          ussd_mtn: form.ussd_mtn || null,
          ussd_moov: form.ussd_moov || null,
          ussd_celtiis: form.ussd_celtiis || null,
          is_active: true,
          is_open: false, // le propriétaire ouvre manuellement
          avg_rating: 0,
          total_reviews: 0,
        })
        .select()
        .single();

      if (restoErr) throw restoErr;

      // Lier au profil du propriétaire
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ restaurant_id: resto.id })
        .eq('id', user.id);

      if (profileErr) throw profileErr;

      setStep(5); // Step succès
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  // ── Step 5 : succès ──────────────────────────────────────────────────────
  if (step === 5) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center mb-6"
        >
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-black text-zinc-900 mb-2"
        >
          Restaurant créé ! 🎉
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-zinc-500 text-sm mb-2"
        >
          <span className="font-bold text-zinc-900">{form.name}</span> est maintenant actif.
          Rendez-vous dans votre tableau de bord pour ajouter votre menu et ouvrir votre restaurant.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col gap-3 w-full max-w-sm mt-8"
        >
          <button
            onClick={() => navigate('/admin/menu')}
            className="btn-primary"
          >
            <Utensils className="w-4 h-4" /> Ajouter mon menu
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="btn-secondary"
          >
            Voir le tableau de bord
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-zinc-100 px-4 py-5 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)} className="p-2 bg-zinc-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-black">Créer mon restaurant</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Étape {step} sur {TOTAL_STEPS}</p>
        </div>
      </div>

      <StepBar step={step} total={TOTAL_STEPS} />

      <AnimatePresence mode="wait">
        {/* ── STEP 1 : Infos de base ── */}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="px-4 space-y-5">
            <div>
              <h2 className="text-2xl font-black text-zinc-900 mb-1">Votre restaurant</h2>
              <p className="text-sm text-zinc-400">Donnez les informations de base</p>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Nom du restaurant *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Ex: Chez Mama Béatrice" className={inputCls} maxLength={60} />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Ce qui rend votre restaurant unique..." rows={3}
                className={`${inputCls} resize-none`} maxLength={300} />
              <p className="text-[10px] text-zinc-300 mt-1 text-right">{form.description.length}/300</p>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Ville *</label>
              <select value={form.city} onChange={e => set('city', e.target.value)} className={inputCls}>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Adresse *</label>
              <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
                placeholder="Quartier, rue ou repère" className={inputCls} />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Téléphone</label>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+229 01 XX XX XX XX" className={inputCls} />
            </div>
          </motion.div>
        )}

        {/* ── STEP 2 : Type de cuisine & livraison ── */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="px-4 space-y-5">
            <div>
              <h2 className="text-2xl font-black text-zinc-900 mb-1">Type de cuisine</h2>
              <p className="text-sm text-zinc-400">Choisissez ce qui vous correspond le mieux</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CUISINES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('cuisine_type', c)}
                  className={`px-3 py-3 rounded-2xl text-xs font-bold text-left transition-all ${
                    form.cuisine_type === c
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-white border border-zinc-100 text-zinc-600 hover:border-primary/30'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="border-t border-zinc-100 pt-5 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Délai de livraison
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Min (min)</label>
                  <input type="number" value={form.delivery_time_min} onChange={e => set('delivery_time_min', +e.target.value)}
                    min={5} max={120} className={inputCls} />
                </div>
                <div className="text-zinc-300 font-bold mt-4">→</div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Max (min)</label>
                  <input type="number" value={form.delivery_time_max} onChange={e => set('delivery_time_max', +e.target.value)}
                    min={10} max={180} className={inputCls} />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Frais livraison (FCFA)</label>
                  <input type="number" value={form.delivery_fee} onChange={e => set('delivery_fee', +e.target.value)}
                    min={0} step={100} className={inputCls} />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Commande min (FCFA)</label>
                  <input type="number" value={form.min_order} onChange={e => set('min_order', +e.target.value)}
                    min={0} step={500} className={inputCls} />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3 : Photos ── */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="px-4 space-y-5">
            <div>
              <h2 className="text-2xl font-black text-zinc-900 mb-1">Photos</h2>
              <p className="text-sm text-zinc-400">Attirez les clients avec de belles photos</p>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Bannière (photo principale)</label>
              <ImagePicker value={form.banner_url} onChange={v => set('banner_url', v)} label="Cliquer pour uploader votre bannière" aspect="h-44" />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Logo</label>
              <div className="flex items-start gap-4">
                <ImagePicker value={form.logo_url} onChange={v => set('logo_url', v)} label="Logo" aspect="h-28 w-28 flex-shrink-0" />
                {(form.banner_url || form.logo_url) && (
                  <div className="flex-1 bg-zinc-100 rounded-2xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Aperçu</p>
                    <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                      <div className="h-20 bg-gradient-to-br from-orange-200 to-red-200 relative overflow-hidden">
                        {form.banner_url && <img src={form.banner_url} alt="" className="w-full h-full object-cover" />}
                        {form.logo_url && (
                          <div className="absolute bottom-2 left-2 w-10 h-10 rounded-lg overflow-hidden border-2 border-white">
                            <img src={form.logo_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-bold truncate">{form.name || 'Votre restaurant'}</p>
                        <p className="text-[10px] text-zinc-400">{form.cuisine_type || 'Restaurant'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-zinc-400 bg-zinc-100 rounded-xl p-3">
              💡 Les photos peuvent être ajoutées plus tard depuis vos paramètres.
            </p>
          </motion.div>
        )}

        {/* ── STEP 4 : Paiement USSD ── */}
        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="px-4 space-y-5">
            <div>
              <h2 className="text-2xl font-black text-zinc-900 mb-1">Paiement USSD</h2>
              <p className="text-sm text-zinc-400">Configurez vos numéros de réception Mobile Money (optionnel)</p>
            </div>

            {[
              { key: 'ussd_mtn', label: 'MTN MoMo', color: 'bg-yellow-400', placeholder: '*880*1*VOTRE_NUMERO*MONTANT#' },
              { key: 'ussd_moov', label: 'Moov Money', color: 'bg-blue-500', placeholder: '*155*1*1*VOTRE_NUMERO#' },
              { key: 'ussd_celtiis', label: 'Celtiis Cash', color: 'bg-emerald-500', placeholder: '*123*1*VOTRE_NUMERO#' },
            ].map(op => (
              <div key={op.key}>
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                  <span className={`w-3 h-3 rounded-full ${op.color}`} />
                  {op.label}
                </label>
                <input
                  type="text"
                  value={form[op.key as keyof typeof form] as string}
                  onChange={e => set(op.key, e.target.value)}
                  placeholder={op.placeholder}
                  className={inputCls}
                />
              </div>
            ))}

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
              <p className="text-xs font-bold text-primary mb-2 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Récapitulatif
              </p>
              <div className="space-y-1 text-xs text-zinc-600">
                <p>🏪 <strong>{form.name}</strong> — {form.city}</p>
                <p>🍽️ {form.cuisine_type}</p>
                <p>⏱️ {form.delivery_time_min}–{form.delivery_time_max} min · {form.delivery_fee} FCFA livraison</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-zinc-100 p-4">
        <div className="max-w-md mx-auto">
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => canNext() && setStep(s => s + 1)}
              disabled={!canNext()}
              className="btn-primary w-full disabled:opacity-40"
            >
              Suivant <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handlePublish}
              disabled={saving}
              className="btn-primary w-full"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {saving ? 'Création en cours...' : 'Créer et publier mon restaurant'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}