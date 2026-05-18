import React, { useState, useEffect, useRef } from 'react';
import {
  Mail, Upload, Send, Search, Plus, Trash2, Users, FileText,
  CheckCircle2, XCircle, RefreshCw, Download, Filter, MoreVertical,
  Eye, Edit2, Copy, AlertTriangle, X, Building2, UserCircle, ChefHat
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authedSendEmailFetch } from '@/lib/email';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface Contact {
  id: string;
  email: string;
  name: string | null;
  source: string;
  tags: string[];
  is_subscribed: boolean;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  sent_at: string | null;
  created_at: string;
}

// Sources d'emails existants
interface ExistingEmail {
  email: string;
  name: string;
  source: 'profiles' | 'restaurants' | 'staff';
  sourceLabel: string;
}

export default function EmailCampaigns() {
  // Tabs
  const [activeTab, setActiveTab] = useState<'contacts' | 'campaigns' | 'send'>('contacts');
  
  // Contacts state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [existingEmails, setExistingEmails] = useState<ExistingEmail[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  
  // Campaigns state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  
  // Send group message state
  const [groupSubject, setGroupSubject] = useState('');
  const [groupMessage, setGroupMessage] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [sendingGroup, setSendingGroup] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0, failed: 0 });
  
  // Modals
  const [showAddContact, setShowAddContact] = useState(false);
  const [showImportCSV, setShowImportCSV] = useState(false);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showSendCampaign, setShowSendCampaign] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  
  // Form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignContent, setCampaignContent] = useState('');
  const [sending, setSending] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all existing emails from database
  const fetchExistingEmails = async () => {
    try {
      const allEmails: ExistingEmail[] = [];
      
      // 1. Fetch from profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email, full_name')
        .not('email', 'is', null);
      
      if (profiles) {
        profiles.forEach(p => {
          if (p.email) {
            allEmails.push({
              email: p.email,
              name: p.full_name || 'Utilisateur',
              source: 'profiles',
              sourceLabel: 'Utilisateur'
            });
          }
        });
      }
      
      // 2. Fetch from restaurants (owner emails)
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id, name, owner_name, owner_id, profiles!restaurants_owner_id_fkey(email)')
        .eq('is_active', true);
      
      if (restaurants) {
        restaurants.forEach((r: any) => {
          if (r.profiles?.email) {
            allEmails.push({
              email: r.profiles.email,
              name: `${r.owner_name || r.name} (Restaurant)`,
              source: 'restaurants',
              sourceLabel: 'Restaurant'
            });
          }
        });
      }
      
      // 3. Fetch from restaurant_staff
      const { data: staff } = await supabase
        .from('restaurant_staff')
        .select('full_name, phone, profile:profiles(email, full_name)')
        .eq('is_active', true);
      
      if (staff) {
        staff.forEach((s: any) => {
          if (s.profile?.email) {
            allEmails.push({
              email: s.profile.email,
              name: s.profile.full_name || s.full_name || 'Staff',
              source: 'staff',
              sourceLabel: 'Staff'
            });
          }
        });
      }
      
      // Remove duplicates by email
      const uniqueEmails = allEmails.reduce((acc: ExistingEmail[], curr) => {
        if (!acc.find(e => e.email.toLowerCase() === curr.email.toLowerCase())) {
          acc.push(curr);
        }
        return acc;
      }, []);
      
      setExistingEmails(uniqueEmails);
    } catch (err) {
      console.error('Error fetching existing emails:', err);
    }
  };

  // Fetch contacts from email_contacts table
  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from('email_contacts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setContacts(data || []);
    } catch (err: any) {
      console.error('Error fetching contacts:', err);
      toast.error('Erreur lors du chargement des contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  // Fetch campaigns
  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCampaigns(data || []);
    } catch (err: any) {
      console.error('Error fetching campaigns:', err);
      toast.error('Erreur lors du chargement des campagnes');
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    fetchCampaigns();
    fetchExistingEmails();
  }, []);

  // Combined list of all emails (contacts + existing)
  const allEmails = [
    ...contacts.filter(c => c.is_subscribed).map(c => ({
      email: c.email,
      name: c.name || 'Contact',
      source: c.source,
      sourceLabel: 'Contact'
    })),
    ...existingEmails
  ].reduce((acc: any[], curr) => {
    if (!acc.find(e => e.email.toLowerCase() === curr.email.toLowerCase())) {
      acc.push(curr);
    }
    return acc;
  }, []);

  // Filter emails based on search and source
  const filteredEmails = allEmails.filter(e => {
    const matchesSearch = e.email.toLowerCase().includes(contactSearch.toLowerCase()) ||
      e.name.toLowerCase().includes(contactSearch.toLowerCase());
    const matchesSource = sourceFilter === 'all' || e.source === sourceFilter || e.sourceLabel === sourceFilter;
    return matchesSearch && matchesSource;
  });

  // Add single contact
  const handleAddContact = async () => {
    if (!newEmail.trim()) {
      toast.error('Email requis');
      return;
    }

    try {
      const { error } = await supabase
        .from('email_contacts')
        .insert({ email: newEmail.trim().toLowerCase(), name: newName.trim() || null, source: 'manual' });
      
      if (error) {
        if (error.code === '23505') {
          toast.error('Cet email existe deja');
        } else {
          throw error;
        }
        return;
      }
      
      toast.success('Contact ajoute');
      setNewEmail('');
      setNewName('');
      setShowAddContact(false);
      fetchContacts();
    } catch (err: any) {
      console.error('Error adding contact:', err);
      toast.error('Erreur lors de l\'ajout');
    }
  };

  // Import CSV
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Skip header if present
        const startIdx = lines[0].toLowerCase().includes('email') ? 1 : 0;
        
        const toInsert: { email: string; name: string | null; source: string }[] = [];
        
        for (let i = startIdx; i < lines.length; i++) {
          const parts = lines[i].split(',').map(p => p.trim().replace(/"/g, ''));
          const email = parts[0];
          const name = parts[1] || null;
          
          if (email && email.includes('@')) {
            toInsert.push({ email: email.toLowerCase(), name, source: 'csv_import' });
          }
        }

        if (toInsert.length === 0) {
          toast.error('Aucun email valide trouve');
          return;
        }

        const { error } = await supabase
          .from('email_contacts')
          .upsert(toInsert, { onConflict: 'email', ignoreDuplicates: true });

        if (error) throw error;

        toast.success(`${toInsert.length} contacts importes`);
        fetchContacts();
        setShowImportCSV(false);
      } catch (err: any) {
        console.error('CSV Import error:', err);
        toast.error('Erreur lors de l\'import');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Delete selected contacts
  const handleDeleteSelected = async () => {
    if (selectedContacts.size === 0) return;
    if (!confirm(`Supprimer ${selectedContacts.size} contact(s) ?`)) return;

    try {
      const { error } = await supabase
        .from('email_contacts')
        .delete()
        .in('id', Array.from(selectedContacts));

      if (error) throw error;

      toast.success(`${selectedContacts.size} contact(s) supprime(s)`);
      setSelectedContacts(new Set());
      fetchContacts();
    } catch (err: any) {
      toast.error('Erreur lors de la suppression');
    }
  };

  // Create campaign
  const handleCreateCampaign = async () => {
    if (!campaignName.trim() || !campaignSubject.trim() || !campaignContent.trim()) {
      toast.error('Tous les champs sont requis');
      return;
    }

    try {
      const { error } = await supabase
        .from('email_campaigns')
        .insert({
          name: campaignName.trim(),
          subject: campaignSubject.trim(),
          html_content: campaignContent.trim(),
          status: 'draft',
        });

      if (error) throw error;

      toast.success('Campagne creee');
      setCampaignName('');
      setCampaignSubject('');
      setCampaignContent('');
      setShowNewCampaign(false);
      fetchCampaigns();
    } catch (err: any) {
      toast.error('Erreur lors de la creation');
    }
  };

  // Send group message
  const handleSendGroupMessage = async () => {
    if (!groupSubject.trim() || !groupMessage.trim()) {
      toast.error('Sujet et message requis');
      return;
    }

    if (selectedRecipients.size === 0) {
      toast.error('Selectionnez au moins un destinataire');
      return;
    }

    const recipients = Array.from(selectedRecipients);
    setSendingGroup(true);
    setSendProgress({ sent: 0, total: recipients.length, failed: 0 });

    let sent = 0;
    let failed = 0;

    for (const email of recipients) {
      const recipient = allEmails.find(e => e.email === email);
      const name = recipient?.name || 'Utilisateur';
      
      try {
        const personalizedMessage = groupMessage
          .replace(/{name}/g, name)
          .replace(/{email}/g, email);

        const res = await authedSendEmailFetch({
          to: email,
          subject: groupSubject,
          htmlContent: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #F27D26 0%, #EF4444 100%); padding: 30px; text-align: center; border-radius: 16px 16px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800;">RESTAFY</h1>
              </div>
              <div style="padding: 30px; background: #fff; border: 1px solid #eee; border-top: none; border-radius: 0 0 16px 16px;">
                <div style="font-size: 15px; line-height: 1.8; color: #333; white-space: pre-wrap;">${personalizedMessage}</div>
              </div>
              <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                Restafy - Cotonou, Benin
              </div>
            </div>
          `,
        });

        if (res.ok) {
          sent++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
      }

      setSendProgress({ sent, total: recipients.length, failed });
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    setSendingGroup(false);
    
    if (failed === 0) {
      toast.success(`${sent} email(s) envoye(s) avec succes!`);
      setGroupSubject('');
      setGroupMessage('');
      setSelectedRecipients(new Set());
    } else {
      toast.warning(`${sent} envoye(s), ${failed} echec(s)`);
    }
  };

  // Toggle recipient selection
  const toggleRecipient = (email: string) => {
    setSelectedRecipients(prev => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  // Select all filtered recipients
  const selectAllFiltered = () => {
    setSelectedRecipients(new Set(filteredEmails.map(e => e.email)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedRecipients(new Set());
  };

  // Get source icon
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'profiles':
      case 'Utilisateur':
        return <UserCircle className="w-4 h-4" />;
      case 'restaurants':
      case 'Restaurant':
        return <Building2 className="w-4 h-4" />;
      case 'staff':
      case 'Staff':
        return <ChefHat className="w-4 h-4" />;
      default:
        return <Mail className="w-4 h-4" />;
    }
  };

  // Get source color
  const getSourceColor = (source: string) => {
    switch (source) {
      case 'profiles':
      case 'Utilisateur':
        return 'bg-blue-500/10 text-blue-400';
      case 'restaurants':
      case 'Restaurant':
        return 'bg-orange-500/10 text-orange-400';
      case 'staff':
      case 'Staff':
        return 'bg-purple-500/10 text-purple-400';
      default:
        return 'bg-zinc-500/10 text-zinc-400';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Campagnes Email</h1>
          <p className="text-zinc-500 mt-1">Gerez vos contacts et envoyez des emails en masse</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
          {(['contacts', 'send', 'campaigns'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              )}
            >
              {tab === 'contacts' ? 'Contacts' : tab === 'send' ? 'Envoi Groupe' : 'Campagnes'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{allEmails.length}</p>
              <p className="text-xs text-zinc-500">Total Emails</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-xl">
              <Building2 className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{existingEmails.filter(e => e.source === 'restaurants').length}</p>
              <p className="text-xs text-zinc-500">Restaurants</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <ChefHat className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{existingEmails.filter(e => e.source === 'staff').length}</p>
              <p className="text-xs text-zinc-500">Staff</p>
            </div>
          </div>
        </div>
        <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{campaigns.length}</p>
              <p className="text-xs text-zinc-500">Campagnes</p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTACTS TAB */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                placeholder="Rechercher un email..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-500 outline-none focus:border-primary/50"
              />
            </div>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white outline-none"
            >
              <option value="all">Toutes sources</option>
              <option value="profiles">Utilisateurs</option>
              <option value="restaurants">Restaurants</option>
              <option value="staff">Staff</option>
              <option value="manual">Manuel</option>
              <option value="csv_import">Import CSV</option>
            </select>
            <button
              onClick={() => setShowAddContact(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              Ajouter
            </button>
            <button
              onClick={() => setShowImportCSV(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-all"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
          </div>

          {/* Emails Table */}
          <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Nom</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingContacts ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center">
                        <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : filteredEmails.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                        Aucun email trouve
                      </td>
                    </tr>
                  ) : (
                    filteredEmails.slice(0, 100).map((email, idx) => (
                      <tr key={`${email.email}-${idx}`} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3">
                          <span className="text-white font-medium">{email.email}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{email.name}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold', getSourceColor(email.source))}>
                            {getSourceIcon(email.source)}
                            {email.sourceLabel}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredEmails.length > 100 && (
              <div className="px-4 py-3 text-center text-zinc-500 text-sm border-t border-white/5">
                Affichage des 100 premiers sur {filteredEmails.length} resultats
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEND GROUP TAB */}
      {activeTab === 'send' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recipients Selection */}
          <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white">Destinataires</h3>
                <span className="text-sm text-zinc-500">{selectedRecipients.size} selectionne(s)</span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    placeholder="Rechercher..."
                    className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white placeholder:text-zinc-600 outline-none text-sm"
                  />
                </div>
                <button
                  onClick={selectAllFiltered}
                  className="px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-semibold"
                >
                  Tout
                </button>
                <button
                  onClick={clearSelection}
                  className="px-3 py-2 bg-white/5 text-zinc-400 hover:bg-white/10 rounded-lg text-xs font-semibold"
                >
                  Aucun
                </button>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {filteredEmails.map((email, idx) => (
                <label
                  key={`${email.email}-${idx}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border-b border-white/5',
                    selectedRecipients.has(email.email) ? 'bg-primary/10' : 'hover:bg-white/5'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedRecipients.has(email.email)}
                    onChange={() => toggleRecipient(email.email)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{email.email}</p>
                    <p className="text-xs text-zinc-500 truncate">{email.name}</p>
                  </div>
                  <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs', getSourceColor(email.source))}>
                    {getSourceIcon(email.source)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Message Composer */}
          <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-white">Composer le message</h3>
            
            <div>
              <label className="block text-sm font-semibold text-zinc-400 mb-2">Sujet</label>
              <input
                type="text"
                value={groupSubject}
                onChange={e => setGroupSubject(e.target.value)}
                placeholder="Sujet de l'email..."
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 outline-none focus:border-primary/50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-zinc-400 mb-2">
                Message <span className="text-zinc-600">(utilisez {'{name}'} pour personnaliser)</span>
              </label>
              <textarea
                value={groupMessage}
                onChange={e => setGroupMessage(e.target.value)}
                placeholder="Bonjour {name},&#10;&#10;Votre message ici..."
                rows={10}
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 outline-none focus:border-primary/50 resize-none"
              />
            </div>

            {sendingGroup && (
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">Envoi en cours...</span>
                  <span className="text-sm text-white font-semibold">{sendProgress.sent}/{sendProgress.total}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(sendProgress.sent / sendProgress.total) * 100}%` }}
                  />
                </div>
                {sendProgress.failed > 0 && (
                  <p className="text-xs text-red-400 mt-2">{sendProgress.failed} echec(s)</p>
                )}
              </div>
            )}

            <button
              onClick={handleSendGroupMessage}
              disabled={sendingGroup || selectedRecipients.size === 0 || !groupSubject.trim() || !groupMessage.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all"
            >
              {sendingGroup ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Envoyer a {selectedRecipients.size} destinataire(s)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* CAMPAIGNS TAB */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewCampaign(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              Nouvelle Campagne
            </button>
          </div>

          <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Sujet</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Envoyes</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {loadingCampaigns ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                      Aucune campagne
                    </td>
                  </tr>
                ) : (
                  campaigns.map(campaign => (
                    <tr key={campaign.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 font-semibold text-white">{campaign.name}</td>
                      <td className="px-4 py-3 text-zinc-400">{campaign.subject}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'px-2 py-1 rounded-lg text-xs font-semibold',
                          campaign.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400' :
                          campaign.status === 'sending' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-zinc-500/10 text-zinc-400'
                        )}>
                          {campaign.status === 'sent' ? 'Envoye' : campaign.status === 'sending' ? 'En cours' : 'Brouillon'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {campaign.sent_count}/{campaign.total_recipients || '-'}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-sm">
                        {new Date(campaign.created_at).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Ajouter un contact</h3>
              <button onClick={() => setShowAddContact(false)} className="p-2 hover:bg-white/5 rounded-xl">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-400 mb-2">Email *</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="email@exemple.com"
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-400 mb-2">Nom</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Nom du contact"
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 outline-none"
              />
            </div>
            <button
              onClick={handleAddContact}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportCSV && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Importer CSV</h3>
              <button onClick={() => setShowImportCSV(false)} className="p-2 hover:bg-white/5 rounded-xl">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            <p className="text-sm text-zinc-400">
              Format attendu: <code className="bg-white/5 px-2 py-1 rounded">email,nom</code>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* New Campaign Modal */}
      {showNewCampaign && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Nouvelle Campagne</h3>
              <button onClick={() => setShowNewCampaign(false)} className="p-2 hover:bg-white/5 rounded-xl">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-400 mb-2">Nom de la campagne</label>
              <input
                type="text"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                placeholder="Ex: Newsletter Mars 2024"
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-400 mb-2">Sujet</label>
              <input
                type="text"
                value={campaignSubject}
                onChange={e => setCampaignSubject(e.target.value)}
                placeholder="Sujet de l'email"
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-400 mb-2">Contenu HTML</label>
              <textarea
                value={campaignContent}
                onChange={e => setCampaignContent(e.target.value)}
                placeholder="<p>Votre contenu ici...</p>"
                rows={10}
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 outline-none resize-none font-mono text-sm"
              />
            </div>
            <button
              onClick={handleCreateCampaign}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold"
            >
              Creer la campagne
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
