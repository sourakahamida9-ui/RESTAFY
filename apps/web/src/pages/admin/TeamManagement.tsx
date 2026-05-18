// src/pages/admin/TeamManagement.tsx
// ✅ RÉÉCRITURE COMPLÈTE
// - Ajout membres sans signUp (insertion directe restaurant_staff)
// - Livreurs via delivery_drivers table
// - Toasts Sonner au lieu d'alert()
// - Gestion erreurs robuste

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { authedSendEmailFetch } from '@/lib/email';
import {
  Plus, Trash2, Edit2, Users, CheckCircle, XCircle,
  Loader2, Phone, Bike, Search, X, UserPlus, Mail, Send, AlertCircle,
  Link2, Copy, RefreshCw, Radio, ChevronDown, ChevronUp, BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useDeliveryDrivers } from '@/hooks/useDeliveryDrivers';
import { formatSupabaseErr, isLikelyMissingKioskSql, parseRpcJson } from '@/lib/formatSupabaseError';
import { useNotify } from '@/components/notifications/NotificationProvider';
import { useRestaurantStaffRealtime } from '@/hooks/useRestaurantStaffRealtime';
import {
  getTeamRoleDefinition,
  TEAM_MEMBER_ROLES,
  ORDER_TYPE_REFERENCE,
  PAYMENT_METHOD_REFERENCE,
  ORDER_STATUS_REFERENCE,
  PAYMENT_STATUS_REFERENCE,
} from '@/lib/teamRoles';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

const MAX_EMAILS_PER_DAY = 2;

function normalizeDbRole(role: string) {
  return role === 'superadmin' ? 'super_admin' : role;
}

function kioskRpcFailureMessage(errCode: string | undefined, detail?: string): string {
  const d = detail?.trim();
  switch (errCode) {
    case 'forbidden':
      return 'Accès refusé : compte gérant requis (propriétaire, manager ou rôle « restaurant »). Si besoin, exécutez le script SQL 073 sur Supabase.';
    case 'pin_invalid':
      return 'PIN invalide : 4 à 8 chiffres uniquement.';
    case 'staff_not_found':
      return 'Membre introuvable.';
    case 'update_failed':
      return (
        d ||
        'Aucune mise à jour (vérifiez le membre). Si le problème persiste, exécutez les scripts 072 et 074 sur Supabase.'
      );
    case 'db_error':
      if (d && /gen_salt|function crypt\b|pgcrypto/i.test(d)) {
        return `${d} — exécutez scripts/075-supabase-pgcrypto-search-path.sql sur Supabase (search_path extensions).`;
      }
      if (d && /pin_hash|access_token|does not exist|42703|undefined_column/i.test(d)) {
        return `${d} — exécutez les scripts SQL 072 (+ 074), ou 075 si erreur gen_salt/pgcrypto.`;
      }
      return d || 'Erreur base de données (extension pgcrypto, colonnes 072, etc.).';
    case 'bad_response':
      return 'Réponse serveur illisible. Rechargez la page ou mettez à jour l’application.';
    default:
      return d || 'Action refusée par le serveur.';
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface StaffMember {
  id: string;
  profile_id: string | null;
  restaurant_id: string;
  role: string;
  is_active: boolean;
  shift_start: string | null;
  shift_end: string | null;
  full_name: string | null;   // colonne directe (membres manuels)
  phone: string | null;       // colonne directe
  created_at: string;
  profile?: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    email?: string | null;
  } | null;
}

/** PostgREST peut renvoyer un objet ou un tableau pour la relation embed `profiles`. */
function normalizeEmbedProfile(raw: unknown): StaffMember['profile'] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const p = raw[0];
    return p && typeof p === 'object' ? (p as StaffMember['profile']) : null;
  }
  if (typeof raw === 'object') return raw as StaffMember['profile'];
  return null;
}

// Récupère le nom à afficher (colonne directe OU via profil lié)
function getMemberName(m: StaffMember): string {
  const p = normalizeEmbedProfile(m.profile);
  return p?.full_name || m.full_name || 'Sans nom';
}
function getMemberPhone(m: StaffMember): string {
  const p = normalizeEmbedProfile(m.profile);
  return p?.phone || m.phone || '—';
}
function getMemberInitial(m: StaffMember): string {
  const name = getMemberName(m);
  return name === 'Sans nom' ? '?' : name[0].toUpperCase();
}

// ─── Composant principal ─────────────────────────────────────────────────────
export default function TeamManagement() {
  const { profile, user } = useAuth();
  const { notify } = useNotify();
  const restaurantId = profile?.restaurant_id;

  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'staff' | 'drivers'>('staff');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showReferencePanel, setShowReferencePanel] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);

  const [showDriverModal, setShowDriverModal] = useState(false);
  const [driverForm, setDriverForm] = useState({ name: '', phone: '' });
  const [savingDriver, setSavingDriver] = useState(false);
  
  // Email to team state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailsSentToday, setEmailsSentToday] = useState(0);
  const [loadingEmailCount, setLoadingEmailCount] = useState(true);

  const [canManageKiosk, setCanManageKiosk] = useState(false);
  const [inviteMember, setInviteMember] = useState<StaffMember | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitePayload, setInvitePayload] = useState<{
    access_token: string;
    has_pin: boolean;
    restaurant_name: string | null;
  } | null>(null);
  const [invitePinDraft, setInvitePinDraft] = useState('');
  const [savingInvitePin, setSavingInvitePin] = useState(false);

  const { drivers, availableDrivers, addDriver, removeDriver, toggleAvailability } =
    useDeliveryDrivers(restaurantId || null);

  const defaultForm = {
    full_name: '',
    phone: '',
    role: 'staff' as string,
    is_active: true,
    shift_start: '08:00',
    shift_end: '17:00',
    kiosk_pin: '',
  };
  const [form, setForm] = useState(defaultForm);
  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // ─── Fetch emails sent today ─────────────────────────────────────────────
  const fetchEmailsSentToday = async () => {
    if (!restaurantId) return;
    setLoadingEmailCount(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count, error } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .eq('type', 'team_message');
      
      if (!error) {
        setEmailsSentToday(count || 0);
      }
    } catch (err) {
      console.error('Error fetching email count:', err);
    } finally {
      setLoadingEmailCount(false);
    }
  };

  // ─── Fetch membres ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) { setLoading(false); return; }
    fetchMembers();
    fetchEmailsSentToday();
  }, [restaurantId]);

  useEffect(() => {
    if (!user?.id || !restaurantId || !profile) {
      setCanManageKiosk(false);
      return;
    }
    const r = normalizeDbRole(profile.role as string);
    if (r === 'restaurant_owner' || r === 'manager' || r === 'restaurant') {
      setCanManageKiosk(true);
      return;
    }
    void supabase
      .from('restaurant_staff')
      .select('role')
      .eq('restaurant_id', restaurantId)
      .eq('profile_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const tr = (data?.role || '').toString();
        setCanManageKiosk(['chef', 'manager'].includes(tr));
      });
  }, [user?.id, restaurantId, profile]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurant_staff')
        .select(`
          id,
          profile_id,
          restaurant_id,
          role,
          is_active,
          shift_start,
          shift_end,
          full_name,
          phone,
          access_token,
          created_at,
          profile:profiles(full_name, phone, avatar_url)
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((m: any) => ({
        ...m,
        profile: normalizeEmbedProfile(m.profile),
      })) as StaffMember[];
      setMembers(normalized);
    } catch (err: any) {
      console.error('[Team] Fetch error:', err);
      toast.error('Erreur chargement équipe');
    } finally {
      setLoading(false);
    }
  };

  const { channelState: staffRtState } = useRestaurantStaffRealtime(restaurantId ?? null, (event) => {
    void fetchMembers();
    const verb =
      event === 'INSERT' ? 'Nouveau membre' : event === 'UPDATE' ? 'Membre mis à jour' : 'Membre retiré';
    toast.message(verb, { description: 'Liste équipe synchronisée (temps réel).' });
    try {
      notify('team', 'Équipe', `${verb} — ouvrez l’onglet pour voir le détail.`, undefined, '/restaurant/dashboard/team');
    } catch {
      /* non bloquant */
    }
  });

  // ─── Ajouter membre ───────────────────────────────────────────────────────
  const handleSaveMember = async () => {
    if (!restaurantId) { toast.error('Restaurant introuvable'); return; }
    if (!form.full_name.trim()) { toast.error('Le nom est obligatoire'); return; }
    
    // ✅ VALIDATION SUPPLÉMENTAIRE
    if (form.phone && !/^\+?[0-9\s-]{8,20}$/.test(form.phone.trim())) {
      toast.error('Format de téléphone invalide');
      return;
    }
    if (!form.role) {
      toast.error('Le rôle est obligatoire');
      return;
    }

    setSaving(true);
    try {
      if (editingMember) {
        // ── Mise à jour ──
        const { error } = await supabase
          .from('restaurant_staff')
          .update({
            role: form.role,
            is_active: form.is_active,
            shift_start: form.shift_start || null,
            shift_end: form.shift_end || null,
            full_name: form.full_name.trim(),
            phone: form.phone.trim() || null,
          })
          .eq('id', editingMember.id);

        if (error) throw error;

        // Si lié à un profil, mettre à jour aussi le profil
        if (editingMember.profile_id) {
          await supabase
            .from('profiles')
            .update({ full_name: form.full_name.trim(), phone: form.phone.trim() || null })
            .eq('id', editingMember.profile_id);
        }

        const pinCleanEdit = form.kiosk_pin.replace(/\D/g, '');
        if (pinCleanEdit.length >= 4) {
          const { data: pinRes, error: pinErr } = await supabase.rpc('owner_set_staff_kiosk_pin', {
            p_staff_id: editingMember.id,
            p_pin: pinCleanEdit,
          });
          if (pinErr) {
            toast.error(`PIN non enregistré : ${formatSupabaseErr(pinErr)}`);
          } else {
            const pr = parseRpcJson<{ ok?: boolean; error?: string; detail?: string }>(pinRes);
            if (!pr?.ok) {
              toast.error(`PIN non enregistré : ${kioskRpcFailureMessage(pr?.error, pr?.detail)}`);
            } else {
              toast.success('PIN équipe enregistré');
            }
          }
        }

        setMembers(prev => prev.map(m =>
          m.id === editingMember.id
            ? {
              ...m,
              role: form.role,
              is_active: form.is_active,
              shift_start: form.shift_start,
              shift_end: form.shift_end,
              full_name: form.full_name.trim(),
              phone: form.phone.trim() || null,
              profile: m.profile
                ? { ...m.profile, full_name: form.full_name.trim(), phone: form.phone.trim() }
                : null,
            }
            : m
        ));
        toast.success('Membre mis à jour ✅');
      } else {
        // ── Ajout ──
        // ✅ CORRECTION CRITIQUE : On insert directement dans restaurant_staff
        // avec les colonnes full_name/phone — PAS de signUp Auth
        const { data, error } = await supabase
          .from('restaurant_staff')
          .insert({
            restaurant_id: restaurantId,
            profile_id: null,
            role: form.role,
            is_active: form.is_active,
            shift_start: form.shift_start || null,
            shift_end: form.shift_end || null,
            full_name: form.full_name.trim(),
            phone: form.phone.trim() || null,
          })
          .select('*')
          .single();

        if (error) throw error;

        const pinClean = form.kiosk_pin.replace(/\D/g, '');
        if (pinClean.length >= 4 && data?.id) {
          const { data: pinRes, error: pinErr } = await supabase.rpc('owner_set_staff_kiosk_pin', {
            p_staff_id: data.id,
            p_pin: pinClean,
          });
          if (pinErr) {
            toast.error(`Membre ajouté, mais PIN : ${formatSupabaseErr(pinErr)}`);
          } else {
            const pr = parseRpcJson<{ ok?: boolean; error?: string; detail?: string }>(pinRes);
            if (!pr?.ok) {
              toast.error(`Membre ajouté, mais PIN : ${kioskRpcFailureMessage(pr?.error, pr?.detail)}`);
            }
          }
        }

        setMembers(prev => [{ ...data, profile: null }, ...prev]);
        toast.success(`${form.full_name} ajouté à l'équipe 🎉`);
      }

      closeModal();
    } catch (err: unknown) {
      console.error('[Team] Save error:', err);
      toast.error(formatSupabaseErr(err) || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ─── Supprimer ────────────────────────────────────────────────────────────
  const handleDelete = async (memberId: string, name: string) => {
    if (!confirm(`Supprimer ${name} de l'équipe ?`)) return;
    try {
      const { error } = await supabase
        .from('restaurant_staff')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success('Membre supprimé');
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    }
  };

  // ─── Toggle actif ─────────────────────────────────────────────────────────
  const handleToggle = async (member: StaffMember) => {
    const newVal = !member.is_active;
    try {
      const { error } = await supabase
        .from('restaurant_staff')
        .update({ is_active: newVal })
        .eq('id', member.id);
      if (error) throw error;
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_active: newVal } : m));
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    }
  };

  // ─── Send Email to Team ─────────────────────────────────────────────────
  const handleSendEmailToTeam = async () => {
    if (emailsSentToday >= MAX_EMAILS_PER_DAY) {
      toast.error(`Limite atteinte: ${MAX_EMAILS_PER_DAY} emails/jour maximum`);
      return;
    }
    
    if (!emailSubject.trim() || !emailMessage.trim()) {
      toast.error('Sujet et message requis');
      return;
    }
    
    if (selectedMembers.size === 0) {
      toast.error('Selectionnez au moins un membre');
      return;
    }
    
    // Get emails from selected members
    const membersWithEmail = members.filter(m => 
      selectedMembers.has(m.id) && m.profile?.email
    );
    
    if (membersWithEmail.length === 0) {
      toast.error('Aucun membre selectionne n\'a d\'email');
      return;
    }
    
    setSendingEmail(true);
    let sent = 0;
    let failed = 0;
    
    for (const member of membersWithEmail) {
      const email = member.profile?.email;
      if (!email) continue;
      
      const name = getMemberName(member);
      const personalizedMessage = emailMessage
        .replace(/{name}/g, name)
        .replace(/{role}/g, getTeamRoleDefinition(member.role).label);
      
      try {
        const res = await authedSendEmailFetch({
          to: email,
          subject: emailSubject,
          htmlContent: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); padding: 24px; text-align: center; border-radius: 16px 16px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 800;">Message de l'equipe</h1>
              </div>
              <div style="padding: 24px; background: #fff; border: 1px solid #eee; border-top: none; border-radius: 0 0 16px 16px;">
                <p style="margin: 0 0 16px 0; color: #666;">Bonjour ${name},</p>
                <div style="font-size: 15px; line-height: 1.7; color: #333; white-space: pre-wrap;">${personalizedMessage}</div>
              </div>
            </div>
          `,
        });
        
        if (res.ok) {
          sent++;
          // Log the email
          await supabase.from('email_logs').insert({
            recipient: email,
            subject: emailSubject,
            type: 'team_message',
            success: true,
          });
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }
    
    setSendingEmail(false);
    
    if (sent > 0) {
      toast.success(`${sent} email(s) envoye(s)`);
      setEmailsSentToday(prev => prev + 1);
      setShowEmailModal(false);
      setEmailSubject('');
      setEmailMessage('');
      setSelectedMembers(new Set());
    }
    
    if (failed > 0) {
      toast.error(`${failed} email(s) echoue(s)`);
    }
  };

  // ─── Toggle member selection for email ────────────────────────────────────
  const toggleMemberSelection = (id: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ─── Modal helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingMember(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (m: StaffMember) => {
    setEditingMember(m);
    setForm({
      full_name: getMemberName(m) === 'Sans nom' ? '' : getMemberName(m),
      phone: getMemberPhone(m) === '—' ? '' : getMemberPhone(m),
      role: m.role,
      is_active: m.is_active,
      shift_start: m.shift_start || '08:00',
      shift_end: m.shift_end || '17:00',
      kiosk_pin: '',
    });
    setShowModal(true);
  };

  const kioskLinkFromToken = (token: string) =>
    `${window.location.origin}/restaurant/equipe/${token}`;

  const openKioskInvite = async (m: StaffMember) => {
    setInviteMember(m);
    setInvitePayload(null);
    setInvitePinDraft('');
    setInviteLoading(true);
    try {
      const { data, error } = await supabase.rpc('owner_get_staff_kiosk_invite', {
        p_staff_id: m.id,
      });
      if (error) throw error;
      const j = parseRpcJson<{
        ok?: boolean;
        error?: string;
        detail?: string;
        access_token?: string;
        has_pin?: boolean;
        restaurant_name?: string | null;
      }>(data);
      if (!j) {
        toast.error(kioskRpcFailureMessage('bad_response'));
        setInviteMember(null);
        return;
      }
      if (!j?.ok) {
        toast.error(kioskRpcFailureMessage(j.error, j.detail));
        setInviteMember(null);
        return;
      }
      if (!j.access_token) {
        toast.error('Jeton d’accès manquant');
        setInviteMember(null);
        return;
      }
      setInvitePayload({
        access_token: j.access_token,
        has_pin: Boolean(j.has_pin),
        restaurant_name: j.restaurant_name ?? null,
      });
    } catch (e: unknown) {
      console.error(e);
      toast.error(formatSupabaseErr(e));
      setInviteMember(null);
    } finally {
      setInviteLoading(false);
    }
  };

  const saveInvitePinOnly = async () => {
    if (!inviteMember) return;
    const clean = invitePinDraft.replace(/\D/g, '');
    if (clean.length < 4) {
      toast.error('PIN : 4 à 8 chiffres');
      return;
    }
    setSavingInvitePin(true);
    try {
      const { data, error } = await supabase.rpc('owner_set_staff_kiosk_pin', {
        p_staff_id: inviteMember.id,
        p_pin: clean,
      });
      if (error) throw error;
      const body = parseRpcJson<{ ok?: boolean; error?: string; detail?: string }>(data);
      if (!body) {
        toast.error(kioskRpcFailureMessage('bad_response'));
        return;
      }
      if (!body.ok) {
        toast.error(kioskRpcFailureMessage(body.error, body.detail));
        return;
      }
      toast.success('PIN enregistré');
      setInvitePayload((p) => (p ? { ...p, has_pin: true } : p));
    } catch (e: unknown) {
      const msg = formatSupabaseErr(e);
      toast.error(
        isLikelyMissingKioskSql(msg)
          ? `${msg} — exécutez les scripts SQL 072 (et 073) sur Supabase.`
          : msg,
      );
    } finally {
      setSavingInvitePin(false);
    }
  };

  const regenerateKioskLink = async () => {
    if (!inviteMember || !confirm('Régénérer le lien ? L’ancien lien ne fonctionnera plus.')) return;
    setInviteLoading(true);
    try {
      const { data, error } = await supabase.rpc('owner_regenerate_staff_access_token', {
        p_staff_id: inviteMember.id,
      });
      if (error) throw error;
      const j = parseRpcJson<{ ok?: boolean; access_token?: string; error?: string; detail?: string }>(data);
      if (!j?.ok || !j.access_token) {
        toast.error(j ? kioskRpcFailureMessage(j.error, j.detail) : kioskRpcFailureMessage('bad_response'));
        return;
      }
      setInvitePayload({
        access_token: j.access_token,
        has_pin: invitePayload?.has_pin ?? false,
        restaurant_name: invitePayload?.restaurant_name ?? null,
      });
      toast.success('Nouveau lien généré');
    } catch (e: unknown) {
      toast.error(formatSupabaseErr(e));
    } finally {
      setInviteLoading(false);
    }
  };

  const copyKioskLink = async () => {
    if (!invitePayload) return;
    const url = kioskLinkFromToken(invitePayload.access_token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié');
    } catch {
      toast.error('Copie impossible');
    }
  };

  const shareKioskWhatsApp = () => {
    if (!inviteMember || !invitePayload) return;
    const phone = getMemberPhone(inviteMember).replace(/\D/g, '');
    const url = kioskLinkFromToken(invitePayload.access_token);
    const name = getMemberName(inviteMember);
    const pinHint =
      invitePinDraft.replace(/\D/g, '') ||
      (invitePayload.has_pin ? '(PIN déjà défini — celui communiqué au membre)' : '(définir le PIN dans ce panneau)');
    const body = encodeURIComponent(
      `Bonjour ${name},\n\nVoici ton accès équipe Restafy (commandes) :\n${url}\n\nCode PIN : ${pinHint}\n\nGarde ce code confidentiel.`,
    );
    if (phone.length >= 8) {
      window.open(`https://wa.me/${phone}?text=${body}`, '_blank', 'noopener,noreferrer');
    } else {
      window.open(`https://wa.me/?text=${body}`, '_blank', 'noopener,noreferrer');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingMember(null);
    setForm(defaultForm);
  };

  // ─── Ajouter livreur ─────────────────────────────────────────────────────
  const handleAddDriver = async () => {
    if (!driverForm.name.trim() || !driverForm.phone.trim()) {
      toast.error('Nom et téléphone obligatoires');
      return;
    }
    setSavingDriver(true);
    const ok = await addDriver(driverForm.name.trim(), driverForm.phone.trim());
    if (ok) {
      setDriverForm({ name: '', phone: '' });
      setShowDriverModal(false);
    }
    setSavingDriver(false);
  };

  // ─── Filtrage ─────────────────────────────────────────────────────────────
  const filtered = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    const roleStr = m.role ?? '';
    const byRole = roleFilter === 'all' || roleStr === roleFilter;
    if (!byRole) return false;
    return (
      getMemberName(m).toLowerCase().includes(q) ||
      getMemberPhone(m).toLowerCase().includes(q) ||
      getTeamRoleDefinition(roleStr).label.toLowerCase().includes(q) ||
      roleStr.toLowerCase().includes(q)
    );
  });

  const activeCount = members.filter(m => m.is_active).length;

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RestafyLoader fullscreen={false} message="Chargement de l’équipe…" size="md" />
      </div>
    );
  }

  if (!restaurantId) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-zinc-500">
        <p>Aucun restaurant associé à votre compte.</p>
      </div>
    );
  }

  return (
    <div className="r-page-shell !max-w-none">
      <div className="mx-auto w-full max-w-[92rem] space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="r-admin-card flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between p-5 lg:p-6">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-[color:var(--r-text)]">Équipe & livraison</h1>
              {activeTab === 'staff' && staffRtState === 'subscribed' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                  <Radio className="h-3 w-3 animate-pulse" aria-hidden />
                  Temps réel
                </span>
              )}
              {activeTab === 'staff' && staffRtState === 'error' && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5" title="Vérifiez Database → Replication pour restaurant_staff sur Supabase">
                  Sync manuelle (realtime indispo)
                </span>
              )}
            </div>
            <p className="text-[color:var(--r-text-muted)] text-sm mt-1 max-w-xl">
              Mobile, WhatsApp et FCFA au quotidien : gérez les postes, les PIN kiosque et les livreurs en un seul endroit.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {activeTab === 'staff' && (
              <button
                onClick={() => setShowEmailModal(true)}
                disabled={emailsSentToday >= MAX_EMAILS_PER_DAY}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-colors"
                title={emailsSentToday >= MAX_EMAILS_PER_DAY ? `Limite: ${MAX_EMAILS_PER_DAY} emails/jour` : 'Envoyer un email'}
              >
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">Email</span>
                {!loadingEmailCount && (
                  <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">
                    {emailsSentToday}/{MAX_EMAILS_PER_DAY}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={activeTab === 'staff' ? openAdd : () => setShowDriverModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              {activeTab === 'staff' ? 'Ajouter membre' : 'Ajouter livreur'}
            </button>
          </div>
        </div>

        {/* ── Onglets ────────────────────────────────────────────────────── */}
        <div className="flex gap-1 r-admin-card rounded-2xl p-1 w-fit border-[var(--r-input-border)]">
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'staff'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-[color:var(--r-text-muted)] hover:bg-[var(--r-surface)]'
              }`}
          >
            <Users className="w-4 h-4" />
            Équipe ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'drivers'
              ? 'bg-orange-500 text-white'
              : 'text-[color:var(--r-text-muted)] hover:text-[color:var(--r-text)]'
            }`}
          >
            <Bike className="w-4 h-4" />
            Livreurs ({drivers.length})
          </button>
        </div>

        {/* ── ONGLET STAFF ───────────────────────────────────────────────── */}
        {activeTab === 'staff' && (
          <>
            <button
              onClick={() => setShowReferencePanel(!showReferencePanel)}
              className="flex w-full items-center justify-between gap-2 rounded-2xl border border-[var(--r-input-border)] r-admin-card px-4 py-3 text-left text-sm font-bold text-[color:var(--r-text)] shadow-sm hover:bg-[var(--r-surface)]"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-orange-500 shrink-0" />
                Rôles équipe, statuts commande & paiements (référence Afrique de l’Ouest)
              </span>
              {showReferencePanel ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
            </button>

            <AnimatePresence>
              {showReferencePanel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden rounded-2xl border border-[var(--r-input-border)] r-admin-card"
                >
                  <div className="grid gap-6 p-4 md:grid-cols-2 lg:grid-cols-3 max-h-[min(70vh,520px)] overflow-y-auto">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-orange-600 mb-2">Rôles fiche équipe</p>
                      <ul className="space-y-3 text-xs text-[color:var(--r-text-muted)]">
                        {TEAM_MEMBER_ROLES.map((r) => (
                          <li key={r.value} className="border-b border-zinc-100 pb-2 last:border-0">
                            <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold mb-1 ${r.badgeClass}`}>
                              {r.label}
                            </span>
                            <p className="mt-1 leading-relaxed text-[color:var(--r-text)]">{r.description}</p>
                            <ul className="mt-1 list-disc pl-4 text-[color:var(--r-text-muted)]">
                              {r.capabilities.map((c) => (
                                <li key={c}>{c}</li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-orange-600 mb-2">Commandes & paiements (enums)</p>
                      <p className="text-[11px] text-zinc-500 mb-2">Types et statuts utilisés côté commandes / caisse.</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Type de commande</p>
                      <ul className="text-xs text-zinc-600 space-y-1 mb-3">
                        {ORDER_TYPE_REFERENCE.map((o) => (
                          <li key={o.value}>
                            <code className="text-[10px] bg-zinc-100 px-1 rounded">{o.value}</code> — {o.label}. {o.hint}
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Statut commande</p>
                      <ul className="text-xs text-zinc-600 space-y-1 mb-3">
                        {ORDER_STATUS_REFERENCE.map((o) => (
                          <li key={o.value}>
                            <code className="text-[10px] bg-zinc-100 px-1 rounded">{o.value}</code> — {o.label}. {o.hint}
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Moyen de paiement</p>
                      <ul className="text-xs text-zinc-600 space-y-1 mb-3">
                        {PAYMENT_METHOD_REFERENCE.map((o) => (
                          <li key={o.value}>
                            <code className="text-[10px] bg-zinc-100 px-1 rounded">{o.value}</code> — {o.label}. {o.hint}
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Statut paiement</p>
                      <ul className="text-xs text-zinc-600 space-y-1">
                        {PAYMENT_STATUS_REFERENCE.map((o) => (
                          <li key={o.value}>
                            <code className="text-[10px] bg-zinc-100 px-1 rounded">{o.value}</code> — {o.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="md:col-span-2 lg:col-span-1">
                      <p className="text-xs font-black uppercase tracking-wider text-orange-600 mb-2">Astuces terrain</p>
                      <ul className="text-xs text-zinc-600 space-y-2 list-disc pl-4">
                        <li>Numéro au format international (+229, +225…) pour WhatsApp et rappels.</li>
                        <li>
                          Lien équipe + PIN : pas besoin de compte e-mail — adapté aux équipes qui travaillent surtout au téléphone.
                        </li>
                        <li>Manager et chef peuvent annuler une commande depuis le kiosque (selon scripts SQL kiosk).</li>
                        <li>
                          Si le badge « temps réel » ne s’affiche pas : Supabase → Database → Replication → activer{' '}
                          <code className="bg-zinc-100 px-1 rounded text-[10px]">restaurant_staff</code>.
                        </li>
                        <li>
                          Erreur enum <code className="text-[10px] bg-zinc-100 px-1 rounded">user_role</code> en ajoutant
                          un chef / caissier : exécutez <code className="text-[10px] bg-zinc-100 px-1 rounded">scripts/084-restaurant-staff-role-text.sql</code> sur Supabase.
                        </li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stats */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { icon: <Users className="w-5 h-5 text-blue-600" />, label: 'Total', value: members.length, bg: 'bg-blue-100' },
                { icon: <CheckCircle className="w-5 h-5 text-green-600" />, label: 'Actifs', value: activeCount, bg: 'bg-green-100' },
                { icon: <XCircle className="w-5 h-5 text-red-500" />, label: 'Inactifs', value: members.length - activeCount, bg: 'bg-red-100' },
              ].map(s => (
                <div key={s.label} className="r-admin-card border border-[var(--r-input-border)] rounded-2xl p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center`}>{s.icon}</div>
                  <div>
                    <p className="text-xs font-bold text-[color:var(--r-text-muted)] uppercase tracking-widest">{s.label}</p>
                    <p className="text-2xl font-black text-[color:var(--r-text)]">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, téléphone ou rôle…"
                className="w-full pl-9 pr-4 py-2.5 bg-[var(--r-input-bg)] border border-[var(--r-input-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 text-[color:var(--r-text)]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRoleFilter('all')}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  roleFilter === 'all' ? 'bg-orange-500 text-white' : 'r-admin-card border border-[var(--r-input-border)] text-[color:var(--r-text-muted)] hover:bg-[var(--r-surface)]'
                }`}
              >
                Tous ({members.length})
              </button>
              {TEAM_MEMBER_ROLES.map((r) => {
                const n = members.filter((m) => m.role === r.value).length;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRoleFilter(r.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                      roleFilter === r.value ? 'bg-orange-500 text-white' : 'r-admin-card border border-[var(--r-input-border)] text-[color:var(--r-text-muted)] hover:bg-[var(--r-surface)]'
                    }`}
                  >
                    {r.label} ({n})
                  </button>
                );
              })}
            </div>

            {/* Liste */}
            {filtered.length === 0 ? (
              <div className="text-center py-16 r-admin-card rounded-2xl border border-[var(--r-input-border)]">
                <UserPlus className="w-12 h-12 text-[color:var(--r-text-muted)] mx-auto mb-3" />
                <p className="text-[color:var(--r-text-muted)] font-bold">
                  {members.length === 0 ? 'Aucun membre dans l\'équipe' : 'Aucun résultat'}
                </p>
                {members.length === 0 && (
                  <button onClick={openAdd} className="mt-3 text-sm text-orange-500 font-bold hover:underline">
                    + Ajouter le premier membre
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {filtered.map(member => {
                    const roleInfo = getTeamRoleDefinition(member.role);
                    return (
                      <motion.div
                        key={member.id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="r-admin-card border border-[var(--r-input-border)] rounded-2xl p-5 space-y-4 hover:shadow-sm transition-shadow"
                      >
                        {/* Ligne nom + toggle */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-black text-lg">
                              {getMemberInitial(member)}
                            </div>
                            <div>
                              <p className="font-bold text-[color:var(--r-text)]">{getMemberName(member)}</p>
                              <p className="text-xs text-[color:var(--r-text-muted)] flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {getMemberPhone(member)}
                              </p>
                            </div>
                          </div>
                          {/* Toggle actif */}
                          <button
                            onClick={() => handleToggle(member)}
                            className={`w-11 h-6 rounded-full relative transition-colors ${member.is_active ? 'bg-green-500' : 'bg-[var(--r-surface)]'
                              }`}
                          >
                            <span className={`absolute top-1 w-4 h-4 bg-[var(--r-surface)] rounded-full shadow transition-transform ${member.is_active ? 'right-1' : 'left-1'
                              }`} />
                          </button>
                        </div>

                        {/* Rôle + shift */}
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${roleInfo.badgeClass}`}>
                            {roleInfo.label}
                          </span>
                          {member.shift_start && member.shift_end && (
                            <span className="text-xs text-zinc-400 font-medium">
                              {member.shift_start} – {member.shift_end}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 pt-1 border-t border-zinc-50">
                          {canManageKiosk && (
                            <button
                              type="button"
                              onClick={() => void openKioskInvite(member)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-colors"
                            >
                              <Link2 className="w-3.5 h-3.5" /> Lien + PIN (équipe)
                            </button>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEdit(member)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-blue-600 hover:bg-blue-50 rounded-xl text-xs font-bold transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Modifier
                            </button>
                            <button
                              onClick={() => handleDelete(member.id, getMemberName(member))}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Supprimer
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {/* ── ONGLET LIVREURS ────────────────────────────────────────────── */}
        {activeTab === 'drivers' && (
          <>
            {/* Stats livreurs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <Bike className="w-5 h-5 text-purple-600" />, label: 'Total', value: drivers.length, bg: 'bg-purple-100' },
                { icon: <CheckCircle className="w-5 h-5 text-green-600" />, label: 'Disponibles', value: availableDrivers.length, bg: 'bg-green-100' },
                { icon: <Loader2 className="w-5 h-5 text-orange-500" />, label: 'En livraison', value: drivers.length - availableDrivers.length, bg: 'bg-orange-100' },
              ].map(s => (
                <div key={s.label} className="r-admin-card border border-[var(--r-input-border)] rounded-2xl p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center`}>{s.icon}</div>
                  <div>
                    <p className="text-xs font-bold text-[color:var(--r-text-muted)] uppercase tracking-widest">{s.label}</p>
                    <p className="text-2xl font-black text-[color:var(--r-text)]">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Liste livreurs */}
            {drivers.length === 0 ? (
              <div className="text-center py-16 r-admin-card rounded-2xl border border-[var(--r-input-border)]">
                <Bike className="w-12 h-12 text-[color:var(--r-text-muted)] mx-auto mb-3" />
                <p className="text-[color:var(--r-text-muted)] font-bold">Aucun livreur ajouté</p>
                <button
                  onClick={() => setShowDriverModal(true)}
                  className="mt-3 text-sm text-orange-500 font-bold hover:underline"
                >
                  + Ajouter le premier livreur
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {drivers.map(driver => (
                  <motion.div
                    key={driver.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="r-admin-card border border-[var(--r-input-border)] rounded-2xl p-5 space-y-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-black text-lg">
                          {driver.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-[color:var(--r-text)]">{driver.name}</p>
                          <p className="text-xs text-[color:var(--r-text-muted)]">{driver.phone}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleAvailability(driver.id, driver.is_available)}
                        className={`w-11 h-6 rounded-full relative transition-colors ${driver.is_available ? 'bg-green-500' : 'bg-[var(--r-surface)]'
                          }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-[var(--r-surface)] rounded-full shadow transition-transform ${driver.is_available ? 'right-1' : 'left-1'
                          }`} />
                      </button>
                    </div>

                    <div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${driver.is_available
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                        }`}>
                        {driver.is_available ? '✅ Disponible' : '🛵 En livraison'}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1 border-t border-zinc-50">
                      <a
                        href={`https://wa.me/${driver.phone.replace('+', '')}?text=Bonjour+${encodeURIComponent(driver.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-green-600 hover:bg-green-50 rounded-xl text-xs font-bold transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                      <button
                        onClick={() => removeDriver(driver.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Retirer
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODAL STAFF ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="r-admin-card rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-[color:var(--r-text)]">
                  {editingMember ? 'Modifier le membre' : 'Nouveau membre'}
                </h2>
                <button onClick={closeModal} className="p-2 hover:bg-[var(--r-surface)] rounded-xl">
                  <X className="w-4 h-4 text-[color:var(--r-text-muted)]" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[color:var(--r-text-muted)] uppercase tracking-wide mb-1 block">
                    Nom complet *
                  </label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={e => setF('full_name', e.target.value)}
                    placeholder="Ex: Jean Dupont"
                    className="w-full px-3 py-2.5 border border-[var(--r-input-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-[var(--r-input-bg)] text-[color:var(--r-text)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[color:var(--r-text-muted)] uppercase tracking-wide mb-1 block">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setF('phone', e.target.value)}
                    placeholder="+229 97 00 00 00"
                    className="w-full px-3 py-2.5 border border-[var(--r-input-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-[var(--r-input-bg)] text-[color:var(--r-text)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[color:var(--r-text-muted)] uppercase tracking-wide mb-1 block">
                    PIN accès équipe (optionnel, 4–8 chiffres)
                  </label>
                  <input
                    type="text"
                    name="restafy-staff-kiosk-pin"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={8}
                    value={form.kiosk_pin}
                    onChange={e => setF('kiosk_pin', e.target.value)}
                    placeholder="Pour le lien /restaurant/equipe/…"
                    className="input-pin-obscured w-full px-3 py-2.5 border border-[var(--r-input-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 font-mono tracking-wider bg-[var(--r-input-bg)] text-[color:var(--r-text)]"
                  />
                  <p className="text-[11px] text-[color:var(--r-text-muted)] mt-1">
                    Permet à ce membre de se connecter avec le lien unique (sans compte Supabase). Laissez vide pour définir plus tard via « Lien + PIN ».
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-[color:var(--r-text-muted)] uppercase tracking-wide mb-1 block">
                    Rôle
                  </label>
                  <select
                    value={form.role}
                    onChange={e => setF('role', e.target.value)}
                    className="w-full px-3 py-2.5 border border-[var(--r-input-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-[var(--r-input-bg)] text-[color:var(--r-text)]"
                  >
                    {TEAM_MEMBER_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[color:var(--r-text-muted)] mt-1.5 leading-relaxed">
                    {getTeamRoleDefinition(form.role).description}
                  </p>
                  <ul className="mt-1 text-[10px] text-[color:var(--r-text-muted)] list-disc pl-4 space-y-0.5">
                    {getTeamRoleDefinition(form.role).capabilities.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[color:var(--r-text-muted)] uppercase tracking-wide mb-1 block">
                      Début shift
                    </label>
                    <input
                      type="time"
                      value={form.shift_start}
                      onChange={e => setF('shift_start', e.target.value)}
                      className="w-full px-3 py-2.5 border border-[var(--r-input-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-[var(--r-input-bg)] text-[color:var(--r-text)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[color:var(--r-text-muted)] uppercase tracking-wide mb-1 block">
                      Fin shift
                    </label>
                    <input
                      type="time"
                      value={form.shift_end}
                      onChange={e => setF('shift_end', e.target.value)}
                      className="w-full px-3 py-2.5 border border-[var(--r-input-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-[var(--r-input-bg)] text-[color:var(--r-text)]"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setF('is_active', !form.is_active)}
                    className={`w-11 h-6 rounded-full relative transition-colors ${form.is_active ? 'bg-green-500' : 'bg-[var(--r-surface)]'
                      }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-[var(--r-surface)] rounded-full shadow transition-transform ${form.is_active ? 'right-1' : 'left-1'
                      }`} />
                  </div>
                  <span className="text-sm font-bold text-[color:var(--r-text)]">
                    {form.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="flex-1 py-3 border border-[var(--r-input-border)] rounded-xl font-bold text-sm text-[color:var(--r-text)] hover:bg-[var(--r-surface)] transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveMember}
                  disabled={saving}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingMember ? 'Mettre à jour' : 'Ajouter'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL LIVREUR ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showDriverModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end lg:items-center justify-center p-4"
            onClick={() => setShowDriverModal(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="r-admin-card rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-[color:var(--r-text)]">Nouveau livreur</h2>
                <button onClick={() => setShowDriverModal(false)} className="p-2 hover:bg-[var(--r-surface)] rounded-xl">
                  <X className="w-4 h-4 text-[color:var(--r-text-muted)]" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-[color:var(--r-text-muted)] uppercase tracking-wide mb-1 block">Nom</label>
                  <input
                    type="text"
                    value={driverForm.name}
                    onChange={e => setDriverForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Koffi Agbemafle"
                    className="w-full px-3 py-2.5 border border-[var(--r-input-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-[var(--r-input-bg)] text-[color:var(--r-text)]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[color:var(--r-text-muted)] uppercase tracking-wide mb-1 block">
                    Numéro WhatsApp (Bénin)
                  </label>
                  <input
                    type="tel"
                    value={driverForm.phone}
                    onChange={e => setDriverForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+229 97 00 00 00"
                    className="w-full px-3 py-2.5 border border-[var(--r-input-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-[var(--r-input-bg)] text-[color:var(--r-text)]"
                  />
                  <p className="text-xs text-[color:var(--r-text-muted)] mt-1">Format accepté : +229XXXXXXXX ou 00229XXXXXXXX</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDriverModal(false)}
                  className="flex-1 py-3 border border-[var(--r-input-border)] rounded-xl font-bold text-sm text-[color:var(--r-text)] hover:bg-[var(--r-surface)]"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddDriver}
                  disabled={savingDriver}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {savingDriver && <Loader2 className="w-4 h-4 animate-spin" />}
                  Ajouter
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL LIEN KIOSK ÉQUIPE ───────────────────────────────────────────── */}
      <AnimatePresence>
        {inviteMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setInviteMember(null); setInvitePayload(null); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="r-admin-card rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-[color:var(--r-text)]">Accès équipe</h2>
                <button
                  type="button"
                  onClick={() => { setInviteMember(null); setInvitePayload(null); }}
                  className="p-2 hover:bg-[var(--r-surface)] rounded-xl"
                >
                  <X className="w-5 h-5 text-[color:var(--r-text-muted)]" />
                </button>
              </div>
              <p className="text-sm text-[color:var(--r-text-muted)]">
                {getMemberName(inviteMember)}
                {invitePayload?.restaurant_name ? ` · ${invitePayload.restaurant_name}` : ''}
              </p>
              {inviteLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
              ) : invitePayload ? (
                <>
                  <div>
                    <label className="text-xs font-bold text-[color:var(--r-text-muted)] uppercase tracking-wide mb-1 block">Lien</label>
                    <p className="text-xs break-all bg-[var(--r-surface)] border border-[var(--r-input-border)] rounded-xl p-3 font-mono text-[color:var(--r-text)]">
                      {kioskLinkFromToken(invitePayload.access_token)}
                    </p>
                  </div>
                  <p className="text-xs text-[color:var(--r-text-muted)]">
                    {invitePayload.has_pin
                      ? 'Un PIN est déjà défini. Vous pouvez en enregistrer un nouveau ci-dessous.'
                      : 'Définissez un PIN pour que le membre puisse ouvrir le lien.'}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="restafy-invite-kiosk-pin"
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={8}
                      value={invitePinDraft}
                      onChange={e => setInvitePinDraft(e.target.value)}
                      placeholder="Nouveau PIN"
                      className="input-pin-obscured flex-1 px-3 py-2.5 border border-[var(--r-input-border)] rounded-xl text-sm font-mono tracking-wider bg-[var(--r-input-bg)] text-[color:var(--r-text)]"
                    />
                    <button
                      type="button"
                      disabled={savingInvitePin}
                      onClick={() => void saveInvitePinOnly()}
                      className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      {savingInvitePin ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer PIN'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => void copyKioskLink()}
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 bg-[var(--r-surface)] hover:bg-[var(--r-surface-hover)] rounded-xl text-xs font-bold text-[color:var(--r-text)]"
                    >
                      <Copy className="w-4 h-4" /> Copier lien
                    </button>
                    <button
                      type="button"
                      onClick={() => shareKioskWhatsApp()}
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold"
                    >
                      <Phone className="w-4 h-4" /> WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => void regenerateKioskLink()}
                      disabled={inviteLoading}
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 border border-amber-200 bg-amber-50 text-amber-900 rounded-xl text-xs font-bold"
                    >
                      <RefreshCw className="w-4 h-4" /> Nouveau lien
                    </button>
                  </div>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL EMAIL EQUIPE ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEmailModal(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="r-admin-card rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[var(--r-input-border)]">
                <div>
                  <h2 className="text-xl font-black text-[color:var(--r-text)]">Envoyer un email</h2>
                  <p className="text-sm text-[color:var(--r-text-muted)] mt-1">
                    {emailsSentToday}/{MAX_EMAILS_PER_DAY} emails envoyes aujourd'hui
                  </p>
                </div>
                <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-[var(--r-surface)] rounded-xl">
                  <X className="w-5 h-5 text-[color:var(--r-text-muted)]" />
                </button>
              </div>

              {emailsSentToday >= MAX_EMAILS_PER_DAY ? (
                <div className="p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-[color:var(--r-text)] mb-2">Limite atteinte</h3>
                  <p className="text-[color:var(--r-text-muted)]">
                    Vous avez atteint la limite de {MAX_EMAILS_PER_DAY} emails par jour.
                    Reessayez demain.
                  </p>
                </div>
              ) : (
                <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                  {/* Member selection */}
                  <div>
                    <label className="text-xs font-bold text-[color:var(--r-text-muted)] uppercase tracking-wide mb-2 block">
                      Destinataires ({selectedMembers.size} selectionnes)
                    </label>
                    <div className="border border-[var(--r-input-border)] rounded-xl max-h-40 overflow-y-auto">
                      {members.filter(m => m.profile?.email).length === 0 ? (
                        <p className="p-4 text-center text-[color:var(--r-text-muted)] text-sm">
                          Aucun membre avec email
                        </p>
                      ) : (
                        members.filter(m => m.profile?.email).map(member => (
                          <label
                            key={member.id}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-[var(--r-surface)] last:border-0 transition-colors ${
                              selectedMembers.has(member.id) ? 'bg-[var(--r-surface)]' : 'hover:bg-[var(--r-surface-hover)]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedMembers.has(member.id)}
                              onChange={() => toggleMemberSelection(member.id)}
                              className="w-4 h-4 rounded border-zinc-300 text-blue-500 focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-[color:var(--r-text)] text-sm">{getMemberName(member)}</p>
                              <p className="text-xs text-zinc-500 truncate">{member.profile?.email}</p>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${getTeamRoleDefinition(member.role).badgeClass}`}>
                              {getTeamRoleDefinition(member.role).label}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setSelectedMembers(new Set(members.filter(m => m.profile?.email).map(m => m.id)))}
                        className="text-xs text-blue-500 hover:underline"
                      >
                        Tout selectionner
                      </button>
                      <button
                        onClick={() => setSelectedMembers(new Set())}
                        className="text-xs text-zinc-400 hover:underline"
                      >
                        Tout deselectionner
                      </button>
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1 block">
                      Sujet
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      placeholder="Ex: Rappel reunion d'equipe"
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1 block">
                      Message <span className="text-zinc-400 font-normal">(utilisez {'{name}'} pour personnaliser)</span>
                    </label>
                    <textarea
                      value={emailMessage}
                      onChange={e => setEmailMessage(e.target.value)}
                      placeholder="Bonjour {name},&#10;&#10;Votre message ici..."
                      rows={6}
                      className="w-full px-4 py-3 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Footer */}
              {emailsSentToday < MAX_EMAILS_PER_DAY && (
                <div className="flex gap-3 p-6 border-t border-zinc-100 bg-zinc-50">
                  <button
                    onClick={() => setShowEmailModal(false)}
                    className="flex-1 py-3 border border-zinc-200 rounded-xl font-bold text-sm text-zinc-700 hover:bg-white transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSendEmailToTeam}
                    disabled={sendingEmail || selectedMembers.size === 0 || !emailSubject.trim() || !emailMessage.trim()}
                    className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {sendingEmail ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Envoi...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Envoyer ({selectedMembers.size})
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
