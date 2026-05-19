// ✅ FIXED Bug 1: Supprimé checkAdminAccess() qui utilisait sessionStorage au lieu de Supabase auth
// ✅ FIXED Bug 2: Supprimé wrapper min-h-screen conflictant avec SuperAdminLayout
import { getAppUrl } from '@/lib/appUrl';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Copy, Trash2, Check, Plus, Loader, Link2, Calendar, User, AlertCircle } from 'lucide-react';

interface Invite {
  id: string;
  token: string;
  created_at: string;
  invite_name?: string;
  description?: string;
  expires_at?: string;
  is_used: boolean;
  used_at?: string;
  used_by_email?: string;
  used_by_restaurant_name?: string;
  created_by_email?: string;
}

export default function RestaurantInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    invite_name: '',
    description: '',
    expires_days: 30,
  });
  // ✅ FIXED: checkAdminAccess() avec sessionStorage SUPPRIMÉ
  // La protection est déjà gérée par ProtectedRoute requiredRoles={['super_admin']} dans App.tsx

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('restaurant_invites')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        if (fetchError.code === '42501' || fetchError.message?.includes('policy')) {
          setError('Politique RLS manquante. Exécutez le SQL de correction ci-dessous.');
        } else {
          setError('Impossible de charger les invitations. Veuillez réessayer.');
        }
        return;
      }
      setInvites(data || []);
    } catch (err: any) {
      setError('Une erreur inattendue est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const rand = Array.from({ length: 9 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `RESTAFY-${Date.now().toString(36).toUpperCase()}-${rand}`;
  };

  const createInvite = async () => {
    setGenerating(true);
    setError(null);
    try {
      const token = generateToken();
      const expiresAt = formData.expires_days ? new Date(Date.now() + formData.expires_days * 24 * 60 * 60 * 1000).toISOString() : null;
      
      const { error: insertError } = await supabase
        .from('restaurant_invites')
        .insert({
          token,
          is_used: false,
          invite_name: formData.invite_name || null,
          description: formData.description || null,
          expires_at: expiresAt,
        });

      if (insertError) {
        if (insertError.code === '42501' || insertError.message?.includes('policy')) {
          setError('RLS bloque l\'insertion. Exécutez le SQL de correction ci-dessous.');
        } else {
          setError('Impossible de créer l\'invitation. Veuillez réessayer.');
        }
        return;
      }
      
      // Reset form
      setFormData({ invite_name: '', description: '', expires_days: 30 });
      setShowForm(false);
      await fetchInvites();
    } catch (err: any) {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setGenerating(false);
    }
  };

  const deleteInvite = async (id: string) => {
    if (!confirm('Supprimer ce lien d\'invitation ?')) return;
    try {
      const { error: delError } = await supabase
        .from('restaurant_invites')
        .delete()
        .eq('id', id);
      if (delError) throw delError;
      setInvites(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      alert('Impossible de supprimer le lien. Veuillez réessayer.');
    }
  };

  const copyToClipboard = (token: string) => {
    const url = `${getAppUrl()}/restaurant/signup?token=${token}`;
    navigator.clipboard.writeText(url).catch(() => {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    setCopied(token);
    setTimeout(() => setCopied(null), 2500);
  };

  const usedCount = invites.filter(i => i.is_used).length;
  const activeCount = invites.filter(i => !i.is_used).length;

  return (
    // ✅ FIXED: Plus de min-h-screen/bg wrapper — rendu dans SuperAdminLayout
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Liens d'Invitation</h2>
          <p className="text-zinc-500 text-sm mt-0.5">
            {invites.length} liens · {activeCount} actifs · {usedCount} utilisés
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> 
          {showForm ? 'Annuler' : 'Créer un lien'}
        </button>
      </div>

      {/* Formulaire de création personnalisée */}
      {showForm && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-white">Créer un lien d'invitation personnalisé</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Nom du lien (optionnel)</label>
              <input
                type="text"
                value={formData.invite_name}
                onChange={(e) => setFormData({ ...formData, invite_name: e.target.value })}
                placeholder="Ex: Restaurant XYZ - Cotonou"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Expiration (jours)</label>
              <select
                value={formData.expires_days}
                onChange={(e) => setFormData({ ...formData, expires_days: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={0}>Pas d'expiration</option>
                <option value={7}>7 jours</option>
                <option value={14}>14 jours</option>
                <option value={30}>30 jours</option>
                <option value={60}>60 jours</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Description / Notes (optionnel)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Lien partagé par WhatsApp. Restaurant confirmé le 20 mars."
              rows={2}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            onClick={createInvite}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl transition-all"
          >
            {generating ? (
              <><Loader className="w-4 h-4 animate-spin" /> Génération...</>
            ) : (
              <>Créer le lien</>
            )}
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: invites.length, color: 'text-white' },
          { label: 'Disponibles', value: activeCount, color: 'text-emerald-400' },
          { label: 'Utilisés', value: usedCount, color: 'text-zinc-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Erreur avec SQL hint */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-400 mb-1">{error}</p>
              {error.includes('RLS') && (
                <div className="mt-2 bg-black/30 rounded-lg p-3">
                  <p className="text-xs font-bold text-zinc-400 mb-2">SQL à exécuter dans Supabase Dashboard → SQL Editor :</p>
                  <pre className="text-xs text-emerald-400 whitespace-pre-wrap font-mono">{`-- Autoriser super_admin à gérer les invitations
CREATE POLICY "superadmin_invites_all" ON restaurant_invites
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'superadmin')
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'superadmin')
  )
);`}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500">
          <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
          Chargement...
        </div>
      ) : invites.length === 0 ? (
        <div className="text-center py-16 bg-[#1A1A1A] rounded-2xl border border-white/5">
          <Link2 className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-400 font-semibold">Aucun lien créé</p>
          <p className="text-xs text-zinc-600 mt-1">Cliquez sur "Créer un lien" pour commencer</p>
        </div>
      ) : (
        <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Nom du lien', 'Token', 'Créé le', 'Expire le', 'Statut', 'Restaurant', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invites.map((invite) => {
                const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
                const isExpiringSoon = invite.expires_at && new Date(invite.expires_at) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) && !isExpired;
                
                return (
                <tr key={invite.id} className={`hover:bg-white/[0.02] transition-colors ${isExpired ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-4">
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">{invite.invite_name || '(sans nom)'}</p>
                      {invite.description && <p className="text-[10px] text-zinc-500 mt-1">{invite.description}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <code className="text-[10px] font-mono text-zinc-300 bg-black/30 px-2 py-1 rounded block w-max">
                      {invite.token.slice(0, 12)}...
                    </code>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(invite.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {invite.expires_at ? (
                      <div className={`text-xs font-medium ${
                        isExpired ? 'text-red-400' : isExpiringSoon ? 'text-yellow-400' : 'text-zinc-400'
                      }`}>
                        {new Date(invite.expires_at).toLocaleDateString('fr-FR')}
                        {isExpired && ' (expiré)'}
                        {isExpiringSoon && ' (bientôt)'}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600">Jamais</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border ${
                      isExpired
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : invite.is_used
                        ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {isExpired ? '● Expiré' : invite.is_used ? '● Utilisé' : '● Actif'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {invite.used_by_restaurant_name ? (
                      <div className="text-xs text-zinc-300">
                        <p className="font-semibold">{invite.used_by_restaurant_name}</p>
                        <p className="text-zinc-500 text-[10px]">{invite.used_by_email}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyToClipboard(invite.token)}
                        title="Copier le lien complet"
                        className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all"
                      >
                        {copied === invite.token
                          ? <Check className="w-4 h-4 text-emerald-400" />
                          : <Copy className="w-4 h-4" />}
                      </button>
                      {!invite.is_used && !isExpired && (
                        <button
                          onClick={() => deleteInvite(invite.id)}
                          title="Supprimer ce lien"
                          className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info format URL */}
      <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4">
        <p className="text-xs font-bold text-zinc-500 mb-1">Format du lien envoyé au restaurant :</p>
        <code className="text-xs text-zinc-300 break-all">
          {getAppUrl()}/restaurant/signup?token=<span className="text-primary">TOKEN</span>
        </code>
      </div>
    </div>
  );
}
