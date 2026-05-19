// ✅ FIXED Bug 3: handleToggle() remplace handleSuspend() — active ET désactive correctement
// ✅ FIXED Bug 4: Affichage des erreurs RLS avec SQL de correction
import React, { useState, useEffect } from 'react';
import { Search, CheckCircle2, XCircle, AlertCircle, RefreshCw, Mail, Send, X, AlertTriangle, Info, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
// ✅ FIX Bug 2 : sendEmail ajouté pour remplacer le fetch('/api/email/send') inaccessible sous Vite
import { sendRestaurantStatusEmail, sendEmail } from '@/lib/email';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { RestaurantAvatar } from '@/components/ui/RestaurantAvatar';

// Types d'emails predéfinis
const EMAIL_TEMPLATES = {
  warning: {
    label: 'Avertissement',
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    subject: 'Avertissement - Action requise sur votre restaurant',
    defaultMessage: `Cher(e) {ownerName},

Nous avons constaté un problème avec votre restaurant "{restaurantName}" qui nécessite votre attention immédiate.

[Décrivez le problème ici]

Merci de régulariser cette situation dans les plus brefs délais pour éviter toute suspension de votre compte.

Cordialement,
L'équipe Restafy`
  },
  info: {
    label: 'Information',
    icon: Info,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    subject: 'Information importante - Restafy',
    defaultMessage: `Cher(e) {ownerName},

Nous souhaitons vous informer d'une mise à jour importante concernant votre restaurant "{restaurantName}".

[Votre message ici]

N'hésitez pas à nous contacter si vous avez des questions.

Cordialement,
L'équipe Restafy`
  },
  custom: {
    label: 'Personnalisé',
    icon: MessageSquare,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    subject: '',
    defaultMessage: ''
  }
};

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  is_active: boolean;
  logo_url?: string | null;
  created_at: string;
  owner_email?: string;
  owner_name?: string;
}

const StatusBadge = ({ isActive }: { isActive: boolean }) => (
  <span className={cn(
    'text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border',
    isActive
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : 'bg-red-500/10 text-red-400 border-red-500/20'
  )}>
    {isActive ? '● En ligne' : '● Suspendu'}
  </span>
);

export default function SuperAdminRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rlsError, setRlsError] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [emailType, setEmailType] = useState<'warning' | 'info' | 'custom'>('warning');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Open email modal
  const openEmailModal = (restaurant: Restaurant, type: 'warning' | 'info' | 'custom' = 'warning') => {
    setSelectedRestaurant(restaurant);
    setEmailType(type);
    const template = EMAIL_TEMPLATES[type];
    const subject = template.subject
      .replace('{restaurantName}', restaurant.name)
      .replace('{ownerName}', restaurant.owner_name || 'Proprietaire');
    const message = template.defaultMessage
      .replace(/{restaurantName}/g, restaurant.name)
      .replace(/{ownerName}/g, restaurant.owner_name || 'Proprietaire');
    setEmailSubject(subject);
    setEmailMessage(message);
    setShowEmailModal(true);
  };

  // ✅ FIX Bug 2 : fetch('/api/email/send') remplacé par sendEmail() direct
  // La route Next.js /api/email/send n'est pas disponible dans un projet Vite
  const handleSendEmail = async () => {
    if (!selectedRestaurant || !emailSubject.trim() || !emailMessage.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    if (!selectedRestaurant.owner_email) {
      toast.error('Email du proprietaire introuvable');
      return;
    }

    setSendingEmail(true);
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${emailSubject}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; margin: 0; padding: 30px 0;">
          <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #F27D26 0%, #EF4444 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800;">RESTAFY</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 12px;">Administration</p>
            </div>
            <div style="padding: 30px;">
              <h2 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 18px;">${emailSubject}</h2>
              <div style="color: #666; font-size: 14px; line-height: 1.8; white-space: pre-wrap;">${emailMessage}</div>
            </div>
            <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">Cet email a été envoyé par l'équipe Restafy</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await sendEmail({
        to: selectedRestaurant.owner_email,
        subject: emailSubject,
        htmlContent,
        textContent: emailMessage,
      });

      if (!result.success) {
        const errMsg = result.error instanceof Error
          ? result.error.message
          : 'Erreur lors de l\'envoi';
        throw new Error(errMsg);
      }

      if (import.meta.env.DEV) console.log('[Email] Email envoyé avec succès à:', selectedRestaurant.owner_email);
      toast.success(`Email envoyé à ${selectedRestaurant.owner_email}`);
      setShowEmailModal(false);
      setSelectedRestaurant(null);
      setEmailSubject('');
      setEmailMessage('');
    } catch (error: any) {
      if (import.meta.env.DEV) console.error('[Email] Error:', error);
      toast.error('Impossible d\'envoyer l\'email. Veuillez réessayer.');
    } finally {
      setSendingEmail(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      setRlsError(false);
      setGeneralError(null);

      // FIX: jointure profiles!owner_id supprimée (causait schema cache error)
      // Deux requêtes séparées : restaurants + profiles IN(owner_ids)
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, slug, owner_id, is_active, logo_url, created_at')
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === '42501' || error.message?.includes('policy') || error.message?.includes('permission')) {
          setRlsError(true);
        } else {
          setGeneralError('Impossible de charger les restaurants. Veuillez réessayer.');
        }
        return;
      }

      const ownerIds = [...new Set((data || []).map((r: any) => r.owner_id).filter(Boolean))];
      let profilesMap: Record<string, { email: string; full_name: string }> = {};
      if (ownerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', ownerIds);
        (profilesData || []).forEach((p: any) => {
          profilesMap[p.id] = { email: p.email, full_name: p.full_name };
        });
      }

      const mapped = (data || []).map((r: any) => ({
        ...r,
        owner_email: profilesMap[r.owner_id]?.email ?? null,
        owner_name: profilesMap[r.owner_id]?.full_name ?? null,
      }));
      setRestaurants(mapped);
    } catch (err: any) {
      setGeneralError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED Bug 3: Toggle unifié — active si inactif, suspend si actif
  const handleToggleStatus = async (restaurant: Restaurant) => {
    const newStatus = !restaurant.is_active;
    const action = newStatus ? 'activer' : 'suspendre';

    if (!confirm(`Voulez-vous ${action} "${restaurant.name}" ?`)) return;

    try {
      setActionLoading(restaurant.id);
      const { error } = await supabase
        .from('restaurants')
        .update({ is_active: newStatus })
        .eq('id', restaurant.id);

      if (error) {
        if (error.code === '42501' || error.message?.includes('policy')) {
          setRlsError(true);
        } else {
          toast.error('Impossible de modifier le statut. Veuillez réessayer.');
        }
        return;
      }

      // Mise à jour locale optimiste
      setRestaurants(prev =>
        prev.map(r => r.id === restaurant.id ? { ...r, is_active: newStatus } : r)
      );

      // ✅ Envoyer un email au propriétaire
      if (restaurant.owner_email) {
        sendRestaurantStatusEmail({
          ownerName: restaurant.owner_name || 'Propriétaire',
          ownerEmail: restaurant.owner_email,
          restaurantName: restaurant.name,
          isActive: newStatus,
        }).then(result => {
          if (!result.success) { if (import.meta.env.DEV) console.warn('[Email] Notification non envoyée:', result.error); }
          else {
            if (import.meta.env.DEV) console.log('[Email] Notification envoyée à:', restaurant.owner_email);
          }
        });
      } else {
        if (import.meta.env.DEV) console.warn('[Email] Email du propriétaire introuvable pour:', restaurant.name);
      }
    } catch (err: any) {
      toast.error(`Erreur inattendue : ${err instanceof Error ? err.message : 'Erreur'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = restaurants.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.slug.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = restaurants.filter(r => r.is_active).length;
  const suspendedCount = restaurants.filter(r => !r.is_active).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Restaurants</h2>
          <p className="text-zinc-500 text-sm">Chargement...</p>
        </div>
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Restaurants</h2>
          <p className="text-zinc-500 text-sm">
            {restaurants.length} total · {activeCount} actifs · {suspendedCount} suspendus
          </p>
        </div>
        <button
          onClick={fetchRestaurants}
          className="p-2 hover:bg-white/5 rounded-lg transition-all text-zinc-400 hover:text-white"
          title="Rafraîchir"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ✅ FIXED Bug 4: Affichage erreur RLS avec SQL de correction */}
      {rlsError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-400 mb-1">Politique RLS manquante — Super Admin ne peut pas voir les restaurants</p>
              <div className="mt-2 bg-black/30 rounded-lg p-3">
                <p className="text-xs font-bold text-zinc-400 mb-2">SQL à exécuter dans Supabase → SQL Editor :</p>
                <pre className="text-xs text-emerald-400 whitespace-pre-wrap font-mono">{`-- Super admin peut lire TOUS les restaurants
CREATE POLICY "superadmin_read_all_restaurants" ON restaurants
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'superadmin')
  )
);

-- Super admin peut modifier le statut des restaurants
CREATE POLICY "superadmin_update_restaurants" ON restaurants
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'superadmin')
  )
);`}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {generalError && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-400">{generalError}</p>
        </div>
      )}

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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: restaurants.length, color: 'text-white' },
          { label: 'Actifs', value: activeCount, color: 'text-emerald-400' },
          { label: 'Suspendus', value: suspendedCount, color: 'text-red-400' },
          { label: 'Revenu Total', value: '0 FCFA', color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-zinc-500">
              {['Restaurant', 'Slug', 'Date Création', 'Statut', 'Actions'].map(h => (
                <th key={h} className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length > 0 ? filtered.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <RestaurantAvatar 
                      src={r.logo_url} 
                      name={r.name} 
                      className="w-9 h-9 rounded-xl flex-shrink-0"
                    />
                    <p className="font-bold text-white text-sm">{r.name}</p>
                  </div>
                </td>
                <td className="px-4 py-4 text-zinc-400 text-xs">{r.slug}</td>
                <td className="px-4 py-4 text-zinc-400 text-xs whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-4">
                  <StatusBadge isActive={r.is_active} />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Email button - more visible */}
                    <button
                      onClick={() => openEmailModal(r, 'custom')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded-lg text-xs font-bold transition-all"
                      title="Envoyer un email"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Email</span>
                    </button>

                    {/* Warning button */}
                    <button
                      onClick={() => openEmailModal(r, 'warning')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg text-xs font-bold transition-all"
                      title="Envoyer un avertissement"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Avertir</span>
                    </button>

                    {/* Toggle status button */}
                    <button
                      onClick={() => handleToggleStatus(r)}
                      disabled={actionLoading === r.id}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50',
                        r.is_active
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      )}
                      title={r.is_active ? 'Suspendre' : 'Activer'}
                    >
                      {actionLoading === r.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : r.is_active ? (
                        <><XCircle className="w-3.5 h-3.5" /> Suspendre</>
                      ) : (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> Activer</>
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  {search ? 'Aucun restaurant trouvé pour cette recherche' : 'Aucun restaurant enregistré'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Email Modal */}
      {showEmailModal && selectedRestaurant && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className={cn('p-3 rounded-xl', EMAIL_TEMPLATES[emailType].bgColor)}>
                  {React.createElement(EMAIL_TEMPLATES[emailType].icon, {
                    className: cn('w-5 h-5', EMAIL_TEMPLATES[emailType].color)
                  })}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Envoyer un email</h3>
                  <p className="text-sm text-zinc-500">A: {selectedRestaurant.owner_email || 'Email non disponible'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-2 hover:bg-white/5 rounded-xl transition-all text-zinc-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email Type Selector */}
            <div className="p-4 border-b border-white/5">
              <div className="flex gap-2">
                {(Object.keys(EMAIL_TEMPLATES) as Array<keyof typeof EMAIL_TEMPLATES>).map((type) => {
                  const template = EMAIL_TEMPLATES[type];
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        setEmailType(type);
                        const newTemplate = EMAIL_TEMPLATES[type];
                        if (type !== 'custom') {
                          setEmailSubject(newTemplate.subject.replace('{restaurantName}', selectedRestaurant.name));
                          setEmailMessage(newTemplate.defaultMessage
                            .replace(/{restaurantName}/g, selectedRestaurant.name)
                            .replace(/{ownerName}/g, selectedRestaurant.owner_name || 'Proprietaire')
                          );
                        }
                      }}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
                        emailType === type
                          ? `${template.bgColor} ${template.color} ring-2 ring-current/20`
                          : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                      )}
                    >
                      {React.createElement(template.icon, { className: 'w-4 h-4' })}
                      {template.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Restaurant Info */}
              <div className="bg-white/5 rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-bold text-lg">
                  {selectedRestaurant.name[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-white">{selectedRestaurant.name}</p>
                  <p className="text-sm text-zinc-500">{selectedRestaurant.owner_name || 'Proprietaire inconnu'}</p>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-semibold text-zinc-400 mb-2">Sujet</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Sujet de l'email..."
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 outline-none focus:border-primary/50 transition-all"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-semibold text-zinc-400 mb-2">Message</label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder="Votre message..."
                  rows={12}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 outline-none focus:border-primary/50 transition-all resize-none font-mono text-sm"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/5 flex items-center justify-between">
              <p className="text-xs text-zinc-500">
                L'email sera envoye via Resend
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 hover:bg-white/5 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !selectedRestaurant.owner_email}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingEmail ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Envoyer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
