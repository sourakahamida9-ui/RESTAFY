import { getAppUrl } from '@/lib/appUrl';
import React, { useState, useEffect } from 'react';
import { Search, Store, CheckCircle2, XCircle, Clock, ArrowLeft, Loader2, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { sendRestaurantApprovalEmail } from '@/lib/email';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  owner?: { full_name: string | null; email: string | null; phone: string | null };
}

type Tab = 'pending' | 'active' | 'suspended';

export default function SuperAdminRestaurants() {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => { fetchRestaurants(); }, []);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select(`
          id, name, slug, is_active, created_at,
          owner:profiles!profiles_restaurant_id_fkey(full_name, email:id, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch owner emails separately via profiles with restaurant_id
      const enriched = await Promise.all((data || []).map(async (r) => {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('restaurant_id', r.id)
          .eq('role', 'restaurant_owner')
          .single();
        // Get email from auth — we approximate with profile id
        return { ...r, owner: ownerProfile || null };
      }));

      setRestaurants(enriched as Restaurant[]);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error fetching restaurants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (r: Restaurant) => {
    setActionLoading(r.id);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ is_active: true })
        .eq('id', r.id);
      if (error) throw error;

      setRestaurants(prev => prev.map(x => x.id === r.id ? { ...x, is_active: true } : x));

      // Send approval email — fetch owner auth email
      try {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .eq('restaurant_id', r.id)
          .eq('role', 'restaurant_owner')
          .single();

        if (ownerProfile?.id) {
          // Get email via auth admin — fallback to profile id as email hint
          const { data: authUser } = await supabase.auth.admin?.getUserById?.(ownerProfile.id) || { data: null };
          const ownerEmail = (authUser as any)?.user?.email;

          if (ownerEmail) {
            await sendRestaurantApprovalEmail({
              ownerName: ownerProfile.full_name || 'Propriétaire',
              ownerEmail,
              restaurantName: r.name,
              dashboardUrl: `${getAppUrl()}/restaurant/dashboard`,
            });
            showToast(`✅ ${r.name} approuvé — email envoyé à ${ownerEmail}`);
          } else {
            showToast(`✅ ${r.name} approuvé (email non trouvé)`);
          }
        } else {
          showToast(`✅ ${r.name} approuvé`);
        }
      } catch (emailErr) {
        if (import.meta.env.DEV) console.error('Email error (non-blocking):', emailErr);
        showToast(`✅ ${r.name} approuvé (email non envoyé)`);
      }
    } catch (err) {
      showToast('Erreur lors de l\'approbation', false);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (r: Restaurant) => {
    if (!confirm(`Suspendre "${r.name}" ?`)) return;
    setActionLoading(r.id);
    const { error } = await supabase
      .from('restaurants')
      .update({ is_active: false })
      .eq('id', r.id);
    if (!error) {
      setRestaurants(prev => prev.map(x => x.id === r.id ? { ...x, is_active: false } : x));
      showToast(`${r.name} suspendu`);
    }
    setActionLoading(null);
  };

  const filtered = restaurants.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    if (tab === 'pending') return matchSearch && !r.is_active;
    if (tab === 'active') return matchSearch && r.is_active;
    if (tab === 'suspended') return matchSearch && !r.is_active;
    return matchSearch;
  });

  // For the "pending" tab, show restaurants that have never been active
  // For "suspended" tab, restaurants manually set to inactive  
  // Since we can't distinguish between "never approved" and "suspended" without a DB column,
  // we show all inactive restaurants in "pending" and keep suspended as a subset
  const pendingCount = restaurants.filter(r => !r.is_active).length;
  const activeCount = restaurants.filter(r => r.is_active).length;

  const TABS: { id: Tab; label: string; count: number; color: string }[] = [
    { id: 'pending', label: '⏳ En attente', count: pendingCount, color: 'text-amber-400 border-amber-400' },
    { id: 'active', label: '✅ Actifs', count: activeCount, color: 'text-emerald-400 border-emerald-400' },
    { id: 'suspended', label: '🚫 Suspendus', count: pendingCount, color: 'text-red-400 border-red-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl text-sm font-bold shadow-2xl transition-all',
          toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        )}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/superadmin/dashboard')} className="p-2 hover:bg-white/5 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold">Restaurants</h2>
            <p className="text-zinc-500 text-sm">{restaurants.length} total · {pendingCount} en attente d'approbation</p>
          </div>
        </div>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && tab !== 'pending' && (
        <button
          onClick={() => setTab('pending')}
          className="w-full flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4 text-amber-400 hover:bg-amber-500/15 transition-colors text-left"
        >
          <Clock className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-bold text-sm">{pendingCount} restaurant{pendingCount > 1 ? 's' : ''} en attente d'approbation</p>
            <p className="text-xs text-amber-500/70">Cliquez pour les voir et les approuver</p>
          </div>
        </button>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1A1A1A] rounded-xl p-1 border border-white/5">
        {TABS.filter(t => t.id !== 'suspended').map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all',
              tab === t.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {t.label}
            <span className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-black',
              tab === t.id ? 'bg-white/20' : 'bg-white/5'
            )}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un restaurant..."
          className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-primary/50 text-white placeholder:text-zinc-600"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          {tab === 'pending' ? '✅ Aucun restaurant en attente' : 'Aucun restaurant trouvé'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-5 flex items-center gap-4 hover:border-white/10 transition-colors">
              {/* Avatar */}
              <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary font-black text-xl flex-shrink-0">
                {r.name[0].toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-white">{r.name}</p>
                  <span className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                    r.is_active
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  )}>
                    {r.is_active ? '● Actif' : '● En attente'}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">/{r.slug}</p>
                {r.owner && (
                  <p className="text-xs text-zinc-600 mt-1">
                    Propriétaire : {r.owner.full_name || 'Inconnu'}
                    {r.owner.phone && ` · ${r.owner.phone}`}
                  </p>
                )}
                <p className="text-[10px] text-zinc-600 mt-0.5">
                  Inscrit le {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {actionLoading === r.id ? (
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                ) : (
                  <>
                    {!r.is_active && (
                      <button
                        onClick={() => handleApprove(r)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all text-sm font-bold border border-emerald-500/20"
                        title="Approuver et envoyer email"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approuver
                      </button>
                    )}
                    {r.is_active && (
                      <button
                        onClick={() => handleSuspend(r)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all text-sm font-bold border border-red-500/20"
                        title="Suspendre"
                      >
                        <XCircle className="w-4 h-4" />
                        Suspendre
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}