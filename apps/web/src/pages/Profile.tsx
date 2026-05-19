// src/pages/Profile.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatSupabaseErr } from '@/lib/formatSupabaseError';
import {
  ArrowLeft, Camera, User, Phone, MapPin, Lock, Eye, EyeOff,
  Save, LogOut, ChevronRight, Star, Gift, Shield, Loader2,
  CheckCircle2, AlertCircle, Edit3, Utensils
} from 'lucide-react';

const CITIES = ['Cotonou', 'Porto-Novo', 'Abomey-Calavi', 'Parakou', 'Bohicon', 'Natitingou', 'Ouidah', 'Lokossa'];

const levelConfig: Record<string, { color: string; bg: string; label: string }> = {
  bronze: { color: '#CD7F32', bg: '#FFF8F0', label: 'Bronze' },
  silver: { color: '#94A3B8', bg: '#F8FAFC', label: 'Argent' },
  gold: { color: '#F59E0B', bg: '#FFFBEB', label: 'Or' },
  platinum: { color: '#6366F1', bg: '#EEF2FF', label: 'Platinum' },
};

// ── Toast notification ──────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      className={`fixed top-4 left-4 right-4 z-[100] max-w-md mx-auto px-4 py-3 rounded-2xl flex items-center gap-3 shadow-xl ${type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}
    >
      {type === 'success'
        ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
        : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
      <span className="text-sm font-semibold flex-1">{message}</span>
    </motion.div>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl border border-zinc-100 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-zinc-50">
        <div className="w-7 h-7 bg-primary/10 rounded-xl flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h2 className="text-sm font-black uppercase tracking-widest text-zinc-700">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

// ── Input field ─────────────────────────────────────────────────────────────
function Field({ label, icon: Icon, children }: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
        <Icon className="w-3 h-3" /> {label}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all placeholder:text-zinc-300";

// ── Main Page ───────────────────────────────────────────────────────────────
export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();

  // ✅ FIX CRITIQUE : TOUS les hooks déclarés EN PREMIER,
  // avant tout return conditionnel — règle fondamentale React
  const [tab, setTab] = useState<'info' | 'password'>('info');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [info, setInfo] = useState({
    full_name: '',
    phone: '',
    city: 'Cotonou',
    address: '',
    avatar_url: '',
  });

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });

  // ✅ FIX : redirection dans useEffect, JAMAIS dans le render direct
  // Appeler navigate() directement dans le corps du composant = crash garanti
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate]);

  // Sync du formulaire quand le profil arrive depuis Supabase
  useEffect(() => {
    if (profile) {
      setInfo({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        city: profile.city || 'Cotonou',
        address: profile.address || '',
        avatar_url: profile.avatar_url || '',
      });
    }
  }, [profile]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) return showToast('Seules les images sont acceptées', 'error');
    if (file.size > 5 * 1024 * 1024) return showToast('Image trop lourde (max 5 MB)', 'error');

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('restaurants')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('restaurants').getPublicUrl(path);
      setInfo(f => ({ ...f, avatar_url: data.publicUrl }));
      showToast('Photo mise à jour');
    } catch {
      showToast("Échec de l'upload", 'error');
    } finally {
      setUploading(false);
    }
  };

  // ── Save info ─────────────────────────────────────────────────────────────
  const saveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const cleanFullName = info.full_name.trim();
    const cleanPhone = info.phone.trim();
    const cleanCity = info.city.trim();
    const cleanAddress = info.address.trim();

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: cleanFullName || null,
        // phone est unique en base: ne jamais sauver une chaine vide
        phone: cleanPhone || null,
        city: cleanCity || 'Cotonou',
        address: cleanAddress || null,
        avatar_url: info.avatar_url || null,
      })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      let message = formatSupabaseErr(error) || 'Erreur lors de la sauvegarde';
      if (/duplicate key|unique constraint|profiles_phone_key|phone/i.test(message)) {
        message = 'Ce numéro de téléphone est déjà utilisé sur un autre compte.';
      }
      showToast(message, 'error');
      return;
    }

    // Sync UI locale avec les valeurs nettoyées après succès
    setInfo((prev) => ({
      ...prev,
      full_name: cleanFullName,
      phone: cleanPhone,
      city: cleanCity || 'Cotonou',
      address: cleanAddress,
    }));
    showToast('Profil enregistré ✓');
  };

  // ── Change password ───────────────────────────────────────────────────────
  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next.length < 8) return showToast('Minimum 8 caractères', 'error');
    if (pwForm.next !== pwForm.confirm)
      return showToast('Les mots de passe ne correspondent pas', 'error');
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwForm.next });
    setSaving(false);
    if (error) showToast('Impossible de modifier le mot de passe. Veuillez réessayer.', 'error');
    else {
      setPwForm({ current: '', next: '', confirm: '' });
      showToast('Mot de passe modifié ✓');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Timeout pour eviter le chargement infini
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  useEffect(() => {
    if (loading && !profile) {
      const t = setTimeout(() => setLoadingTimeout(true), 5000);
      return () => clearTimeout(t);
    }
  }, [loading, profile]);

  // ── Etats d'affichage (apres tous les hooks) ───────────────────────────────

  // Skeleton pendant le chargement initial (max 5 secondes)
  if (loading && !profile && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-paper py-6 px-4 pb-20 space-y-4">
        <button
          onClick={() => navigate('/')}
          className="text-primary font-semibold flex items-center gap-2 mb-6"
        >
          <ArrowLeft className="w-5 h-5" /> Accueil
        </button>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-zinc-100 space-y-4">
            <div className="w-20 h-20 rounded-full bg-zinc-100 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 bg-zinc-100 rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-zinc-100 rounded w-1/2 animate-pulse" />
            </div>
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-zinc-100 space-y-4">
              <div className="h-4 bg-zinc-100 rounded w-1/4 animate-pulse" />
              <div className="space-y-3">
                <div className="h-3 bg-zinc-100 rounded animate-pulse" />
                <div className="h-3 bg-zinc-100 rounded w-5/6 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Profil introuvable apres chargement OU timeout
  if ((!loading && !profile) || (loadingTimeout && !profile)) {
    return (
      <div className="min-h-screen bg-paper py-6 px-4 pb-20 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
          <p className="text-zinc-600 mb-2 font-semibold">Impossible de charger le profil</p>
          <p className="text-zinc-400 text-sm mb-6">Verifiez votre connexion et reessayez</p>
          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-primary text-white rounded-xl font-semibold"
            >
              Rafraichir
            </button>
            <button onClick={() => navigate('/')} className="px-4 py-2 border border-zinc-200 rounded-xl font-semibold">
              Accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // À ce stade profile est garanti non-null
  const level = levelConfig[profile?.loyalty_level || 'bronze'] || levelConfig.bronze;
  const points = profile?.loyalty_points ?? 0;

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="relative bg-gradient-to-br from-primary via-orange-500 to-red-500 px-4 pt-6 pb-24">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white/20 rounded-full text-white mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-zinc-50 rounded-t-[2.5rem]" />
      </div>

      {/* ── Avatar card ── */}
      <div className="relative -mt-14 px-4 flex justify-center mb-6">
        <div className="relative">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <div className="w-24 h-24 rounded-3xl border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center">
            {info.avatar_url ? (
              <img src={info.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-black text-3xl">{initials}</span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-2 -right-2 w-8 h-8 bg-white border-2 border-zinc-100 rounded-xl shadow-md flex items-center justify-center"
          >
            {uploading
              ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
              : <Camera className="w-4 h-4 text-primary" />}
          </button>
        </div>
      </div>

      {/* ── Name + Level ── */}
      <div className="text-center px-4 mb-6">
        <h1 className="text-xl font-black text-zinc-900">
          {profile?.full_name || user?.email?.split('@')[0]}
        </h1>
        <p className="text-sm text-zinc-400 mt-0.5">{user?.email}</p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <span
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black"
            style={{ color: level.color, background: level.bg }}
          >
            <Star className="w-3 h-3" fill={level.color} />
            {level.label} · {points.toLocaleString('fr-FR')} pts
          </span>
          <button
            onClick={() => navigate('/loyalty')}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-bold"
          >
            <Gift className="w-3 h-3" /> Mes récompenses
          </button>
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div className="px-4 mb-6 grid grid-cols-3 gap-3">
        {[
          { label: 'Commandes', value: profile?.total_orders ?? 0 },
          { label: 'Points', value: points.toLocaleString('fr-FR') },
          { label: 'Niveau', value: level.label },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-zinc-100 p-3 text-center shadow-sm">
            <p className="text-lg font-black text-zinc-900">{s.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="px-4 mb-5">
        <div className="bg-zinc-100 rounded-2xl p-1 flex gap-1">
          {([
            { id: 'info', label: 'Mes infos', icon: User },
            { id: 'password', label: 'Mot de passe', icon: Lock },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === t.id ? 'bg-white text-primary shadow-sm' : 'text-zinc-400'
                }`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4">
        <AnimatePresence mode="wait">
          {tab === 'info' ? (
            <motion.form
              key="info"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={saveInfo}
            >
              <Section title="Informations" icon={User}>
                <Field label="Nom complet" icon={User}>
                  <input
                    type="text"
                    value={info.full_name}
                    onChange={e => setInfo(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Votre nom et prénom"
                    className={inputCls}
                  />
                </Field>
                <Field label="Téléphone" icon={Phone}>
                  <input
                    type="tel"
                    value={info.phone}
                    onChange={e => setInfo(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+229 01 XX XX XX XX"
                    className={inputCls}
                  />
                </Field>
              </Section>

              <div className="mt-4">
                <Section title="Ma localisation" icon={MapPin}>
                  <Field label="Ville" icon={MapPin}>
                    <select
                      value={info.city}
                      onChange={e => setInfo(f => ({ ...f, city: e.target.value }))}
                      className={inputCls}
                    >
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Adresse de livraison par défaut" icon={Edit3}>
                    <input
                      type="text"
                      value={info.address}
                      onChange={e => setInfo(f => ({ ...f, address: e.target.value }))}
                      placeholder="Quartier, rue, repère notable..."
                      className={inputCls}
                    />
                  </Field>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    📍 Cette adresse sera pré-remplie dans votre panier à chaque commande.
                  </p>
                </Section>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-5 w-full btn-primary"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Enregistrement...' : 'Enregistrer le profil'}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={savePassword}
            >
              <Section title="Changer le mot de passe" icon={Shield}>
                {[
                  { key: 'next', label: 'Nouveau mot de passe', placeholder: 'Minimum 8 caractères' },
                  { key: 'confirm', label: 'Confirmer le mot de passe', placeholder: 'Retapez le nouveau mot de passe' },
                ].map(({ key, label, placeholder }) => (
                  <Field key={key} label={label} icon={Lock}>
                    <div className="relative">
                      <input
                        type={showPw[key as keyof typeof showPw] ? 'text' : 'password'}
                        value={pwForm[key as keyof typeof pwForm]}
                        onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className={`${inputCls} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPw(s => ({ ...s, [key]: !s[key as keyof typeof showPw] }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-600"
                      >
                        {showPw[key as keyof typeof showPw]
                          ? <EyeOff className="w-4 h-4" />
                          : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                ))}

                {pwForm.next.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${pwForm.next.length >= i * 2
                              ? i <= 1 ? 'bg-red-400'
                                : i <= 2 ? 'bg-yellow-400'
                                  : i <= 3 ? 'bg-blue-400'
                                    : 'bg-emerald-400'
                              : 'bg-zinc-100'
                            }`}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-zinc-400">
                      {pwForm.next.length < 4
                        ? 'Trop court'
                        : pwForm.next.length < 6
                          ? 'Faible'
                          : pwForm.next.length < 10
                            ? 'Correct'
                            : 'Fort'}
                    </p>
                  </div>
                )}
              </Section>

              <button
                type="submit"
                disabled={saving || !pwForm.next || !pwForm.confirm}
                className="mt-5 w-full btn-primary disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Modifier le mot de passe
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* ── Acces restaurateur ── */}
        {['restaurant_owner', 'manager', 'staff', 'livreur', 'caissier'].includes(profile?.role || '') && (
          <button
            onClick={() => navigate('/restaurant/dashboard')}
            className="w-full flex items-center gap-4 bg-zinc-900 text-white p-4 rounded-2xl"
          >
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Utensils className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold">
                {profile?.role === 'restaurant_owner' ? 'Gerer mon restaurant' : 'Espace restaurant'}
              </p>
              <p className="text-[10px] text-zinc-400">
                {profile?.role === 'restaurant_owner' ? 'Tableau de bord proprietaire' : 
                 profile?.role === 'manager' ? 'Tableau de bord manager' :
                 profile?.role === 'livreur' ? 'Mes livraisons' : 'Espace equipe'}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        )}

        {/* ── Déconnexion ── */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-4 border-2 border-red-100 text-red-500 font-bold text-sm rounded-2xl hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Se déconnecter
        </button>
      </div>
    </div>
  );
}
