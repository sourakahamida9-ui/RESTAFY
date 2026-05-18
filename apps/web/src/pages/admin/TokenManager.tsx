/**
 * Interface Admin pour la gestion des tokens QR Scanner
 * Permet de créer, partager et gérer les tokens d'accès
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  QrCode,
  Copy,
  Check,
  Download,
  Share2,
  Clock,
  Users,
  Settings,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Calendar,
  Link,
  Shield,
  Smartphone,
  Zap,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

// Types
interface TokenInfo {
  id: string;
  token: string;
  type: 'event_scan' | 'temporary' | 'admin';
  title: string;
  description: string;
  eventName?: string;
  eventId?: string;
  permissions: string[];
  expiresAt: Date;
  createdAt: Date;
  isActive: boolean;
  usageCount: number;
  lastUsed?: Date;
  qrCode?: string;
  shortUrl?: string;
}

interface CreateTokenForm {
  type: 'event_scan' | 'temporary' | 'admin';
  eventId?: string;
  eventName?: string;
  duration: number; // en heures
  permissions: string[];
  customPurpose?: string;
}

const TokenManager: React.FC = () => {
  const { profile } = useAuth();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  const [createForm, setCreateForm] = useState<CreateTokenForm>({
    type: 'event_scan',
    duration: 24,
    permissions: ['scan:qr', 'read:events'],
  });

  // Charger les tokens existants
  useEffect(() => {
    loadTokens();
    loadEvents();
  }, []);

  const loadTokens = async () => {
    try {
      setLoading(true);
      // TODO: Remplacer par l'appel API réel
      // const { data, error } = await supabase.functions.invoke('admin-list-tokens');
      
      // Simulation pour l'instant
      setTokens([]);
    } catch (error) {
      console.error('[TokenManager] Erreur chargement tokens:', error);
      toast.error('Erreur chargement des tokens');
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, start_time, end_time')
        .eq('is_published', true)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('[TokenManager] Erreur chargement événements:', error);
    }
  };

  const createToken = async () => {
    try {
      let tokenData;

      if (createForm.type === 'event_scan' && createForm.eventId) {
        // Token pour événement spécifique
        tokenData = await createEventToken({
          eventId: createForm.eventId,
          eventName: createForm.eventName || '',
          duration: createForm.duration * 3600, // Convertir en secondes
        });
      } else if (createForm.type === 'temporary') {
        // Token temporaire
        tokenData = await createTemporaryToken({
          permissions: createForm.permissions,
          duration: createForm.duration * 3600,
        });
      } else {
        // Token admin
        tokenData = await createAdminToken({
          adminId: profile?.id || '',
          duration: createForm.duration * 3600,
        });
      }

      const newToken: TokenInfo = {
        id: crypto.randomUUID(),
        token: tokenData.token,
        type: createForm.type,
        title: tokenData.displayInfo.title,
        description: tokenData.displayInfo.description,
        eventName: createForm.eventName,
        eventId: createForm.eventId,
        permissions: createForm.permissions,
        expiresAt: tokenData.displayInfo.expiresAt,
        createdAt: new Date(),
        isActive: true,
        usageCount: 0,
        qrCode: tokenData.qrCode,
        shortUrl: tokenData.shortUrl,
      };

      setTokens(prev => [newToken, ...prev]);
      setSelectedToken(newToken);
      setShowCreateForm(false);
      
      // Reset form
      setCreateForm({
        type: 'event_scan',
        duration: 24,
        permissions: ['scan:qr', 'read:events'],
      });

      toast.success('Token créé avec succès !');
    } catch (error) {
      console.error('[TokenManager] Erreur création token:', error);
      toast.error('Erreur création du token');
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token).then(() => {
      setCopiedToken(token);
      toast.success('Token copié !');
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Lien copié !');
    });
  };

  const downloadQR = (qrCode: string, title: string) => {
    const link = document.createElement('a');
    link.href = qrCode;
    link.download = `qr-${title.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.click();
  };

  const revokeToken = async (tokenId: string) => {
    try {
      // TODO: Appel API pour révoquer
      setTokens(prev => prev.map(t => 
        t.id === tokenId ? { ...t, isActive: false } : t
      ));
      toast.success('Token révoqué');
    } catch (error) {
      console.error('[TokenManager] Erreur révocation token:', error);
      toast.error('Erreur révocation du token');
    }
  };

  const getTokenIcon = (type: string) => {
    switch (type) {
      case 'event_scan': return <Calendar className="w-4 h-4" />;
      case 'temporary': return <Clock className="w-4 h-4" />;
      case 'admin': return <Shield className="w-4 h-4" />;
      default: return <QrCode className="w-4 h-4" />;
    }
  };

  const getTokenColor = (type: string) => {
    switch (type) {
      case 'event_scan': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'temporary': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'admin': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatRemainingTime = (expiresAt: Date) => {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expiré';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}j ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}min`;
    return `${Math.floor(diff / (1000 * 60))} minutes`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--r-text)] flex items-center gap-2">
            <QrCode className="w-6 h-6 text-orange-500" />
            Gestion des Tokens Scanner
          </h1>
          <p className="text-[color:var(--r-text-muted)] mt-1">
            Créez et gérez les tokens d'accès pour l'application QR Scanner
          </p>
        </div>
        
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau Token
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="r-admin-card p-4">
          <div className="flex items-center gap-2 text-blue-600">
            <QrCode className="w-5 h-5" />
            <span className="text-sm font-medium">Tokens Actifs</span>
          </div>
          <p className="text-2xl font-bold text-[color:var(--r-text)] mt-1">
            {tokens.filter(t => t.isActive).length}
          </p>
        </div>

        <div className="r-admin-card p-4">
          <div className="flex items-center gap-2 text-green-600">
            <Users className="w-5 h-5" />
            <span className="text-sm font-medium">Scans Total</span>
          </div>
          <p className="text-2xl font-bold text-[color:var(--r-text)] mt-1">
            {tokens.reduce((sum, t) => sum + t.usageCount, 0)}
          </p>
        </div>

        <div className="r-admin-card p-4">
          <div className="flex items-center gap-2 text-orange-600">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Expirés</span>
          </div>
          <p className="text-2xl font-bold text-[color:var(--r-text)] mt-1">
            {tokens.filter(t => t.expiresAt < new Date()).length}
          </p>
        </div>

        <div className="r-admin-card p-4">
          <div className="flex items-center gap-2 text-purple-600">
            <Smartphone className="w-5 h-5" />
            <span className="text-sm font-medium">Téléchargements</span>
          </div>
          <p className="text-2xl font-bold text-[color:var(--r-text)] mt-1">
            {/* TODO: Compter les téléchargements réels */}
            0
          </p>
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="r-admin-card p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-[color:var(--r-text)] mb-4">Créer un Token</h2>
            
            <div className="space-y-4">
              {/* Type de token */}
              <div>
                <label className="block text-sm font-medium text-[color:var(--r-text)] mb-2">
                  Type de Token
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'event_scan', label: 'Événement', icon: <Calendar className="w-4 h-4" /> },
                    { value: 'temporary', label: 'Temporaire', icon: <Clock className="w-4 h-4" /> },
                    { value: 'admin', label: 'Admin', icon: <Shield className="w-4 h-4" /> },
                  ].map(type => (
                    <button
                      key={type.value}
                      onClick={() => setCreateForm(prev => ({ ...prev, type: type.value as any }))}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        createForm.type === type.value
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {type.icon}
                        <span className="text-sm font-medium">{type.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Événement (si type event_scan) */}
              {createForm.type === 'event_scan' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Événement
                    </label>
                    <select
                      value={createForm.eventId || ''}
                      onChange={(e) => {
                        const event = events.find(ev => ev.id === e.target.value);
                        setCreateForm(prev => ({
                          ...prev,
                          eventId: e.target.value,
                          eventName: event?.title || '',
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Sélectionner un événement</option>
                      {events.map(event => (
                        <option key={event.id} value={event.id}>
                          {event.title} - {new Date(event.start_time).toLocaleDateString('fr-FR')}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Durée */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Durée de validité (heures)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={createForm.duration}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Entre 1h et 7 jours (168h)
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={createToken}
                disabled={createForm.type === 'event_scan' && !createForm.eventId}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tokens List */}
      <div className="r-admin-card overflow-hidden">
        <div className="p-4 border-b border-[var(--r-input-border)]">
          <h2 className="text-lg font-semibold text-[color:var(--r-text)]">Tokens Créés</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-[color:var(--r-text-muted)]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Chargement des tokens...
          </div>
        ) : tokens.length === 0 ? (
          <div className="p-8 text-center text-[color:var(--r-text-muted)]">
            <QrCode className="w-12 h-12 mx-auto mb-4 text-[color:var(--r-text-muted)]" />
            <p>Aucun token créé</p>
            <p className="text-sm mt-1">Créez votre premier token pour commencer</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--r-input-border)]">
            {tokens.map(token => (
              <div key={token.id} className="p-4 hover:bg-[var(--r-surface)] transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getTokenIcon(token.type)}
                      <h3 className="font-semibold text-[color:var(--r-text)]">{token.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getTokenColor(token.type)}`}>
                        {token.type === 'event_scan' ? 'Événement' : 
                         token.type === 'temporary' ? 'Temporaire' : 'Admin'}
                      </span>
                      {token.isActive ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    
                    <p className="text-sm text-[color:var(--r-text-muted)] mb-2">{token.description}</p>

                    <div className="flex items-center gap-4 text-xs text-[color:var(--r-text-muted)]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expire: {formatRemainingTime(token.expiresAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {token.usageCount} utilisations
                      </span>
                      {token.lastUsed && (
                        <span>
                          Dernier usage: {token.lastUsed.toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setSelectedToken(token)}
                      className="p-2 text-[color:var(--r-text-muted)] hover:text-[color:var(--r-text)] hover:bg-[var(--r-surface)] rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => copyToken(token.token)}
                      className="p-2 text-[color:var(--r-text-muted)] hover:text-[color:var(--r-text)] hover:bg-[var(--r-surface)] rounded-lg transition-colors"
                    >
                      {copiedToken === token.token ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    
                    {token.isActive && (
                      <button
                        onClick={() => revokeToken(token.id)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Token Detail Modal */}
      {selectedToken && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="r-admin-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[color:var(--r-text)]">{selectedToken.title}</h2>
              <button
                onClick={() => setSelectedToken(null)}
                className="p-2 text-[color:var(--r-text-muted)] hover:text-[color:var(--r-text)] hover:bg-[var(--r-surface)] rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* QR Code */}
              <div className="text-center">
                <h3 className="text-sm font-medium text-[color:var(--r-text)] mb-3">QR Code d'accès</h3>
                {selectedToken.qrCode ? (
                  <img
                    src={selectedToken.qrCode}
                    alt="QR Code"
                    className="w-48 h-48 mx-auto border-2 border-[var(--r-input-border)] rounded-lg"
                  />
                ) : (
                  <div className="w-48 h-48 mx-auto border-2 border-[var(--r-input-border)] rounded-lg flex items-center justify-center bg-[var(--r-surface)]">
                    <QrCode className="w-16 h-16 text-[color:var(--r-text-muted)]" />
                  </div>
                )}
                
                {selectedToken.qrCode && (
                  <button
                    onClick={() => downloadQR(selectedToken.qrCode!, selectedToken.title)}
                    className="mt-3 flex items-center gap-2 px-3 py-2 bg-[var(--r-surface)] text-[color:var(--r-text)] rounded-lg hover:bg-[var(--r-surface-hover)] transition-colors mx-auto"
                  >
                    <Download className="w-4 h-4" />
                    Télécharger QR
                  </button>
                )}
              </div>

              {/* Token Info */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-[color:var(--r-text)] mb-2">Token</h3>
                  <div className="bg-[var(--r-surface)] p-3 rounded-lg font-mono text-xs break-all">
                    {selectedToken.token}
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => copyToken(selectedToken.token)}
                    className="mt-2 flex items-center gap-2 px-3 py-2 bg-[var(--r-surface)] text-[color:var(--r-text)] rounded-lg hover:bg-[var(--r-surface-hover)] transition-colors w-full"
                  >
                    {copiedToken === selectedToken.token ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copiedToken === selectedToken.token ? 'Copié !' : 'Copier'}
                  </button>
                </div>

                {selectedToken.shortUrl && (
                  <div>
                    <h3 className="text-sm font-medium text-[color:var(--r-text)] mb-2">Lien direct</h3>
                    <div className="bg-[var(--r-surface)] p-3 rounded-lg text-xs break-all">
                      {selectedToken.shortUrl}
                    </div>
                    <button
                      onClick={() => copyUrl(selectedToken.shortUrl!)}
                      className="mt-2 flex items-center gap-2 px-3 py-2 bg-[var(--r-surface)] text-[color:var(--r-text)] rounded-lg hover:bg-[var(--r-surface-hover)] transition-colors w-full"
                    >
                      <Link className="w-4 h-4" />
                      Copier le lien
                    </button>
                  </div>
                )}
                
                <div>
                  <h3 className="text-sm font-medium text-[color:var(--r-text)] mb-2">Informations</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[color:var(--r-text-muted)]">Type:</span>
                      <span className="font-medium text-[color:var(--r-text)]">{selectedToken.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[color:var(--r-text-muted)]">Créé le:</span>
                      <span className="font-medium text-[color:var(--r-text)]">{selectedToken.createdAt.toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[color:var(--r-text-muted)]">Expire le:</span>
                      <span className="font-medium text-[color:var(--r-text)]">{selectedToken.expiresAt.toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[color:var(--r-text-muted)]">Utilisations:</span>
                      <span className="font-medium text-[color:var(--r-text)]">{selectedToken.usageCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[color:var(--r-text-muted)]">Statut:</span>
                      <span className={`font-medium ${selectedToken.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedToken.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-[color:var(--r-text)] mb-2">Permissions</h3>
                  <div className="flex flex-wrap gap-1">
                    {selectedToken.permissions.map(permission => (
                      <span key={permission} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Fonctions API (à implémenter avec Supabase Edge Functions)
async function createEventToken(data: { eventId: string; eventName: string; duration: number }) {
  // TODO: Appeler l'API Supabase Edge Function
  const response = await fetch('/api/admin/tokens/create-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) throw new Error('Erreur création token événement');
  return response.json();
}

async function createTemporaryToken(data: { permissions: string[]; duration: number }) {
  // TODO: Appeler l'API Supabase Edge Function
  const response = await fetch('/api/admin/tokens/create-temporary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) throw new Error('Erreur création token temporaire');
  return response.json();
}

async function createAdminToken(data: { adminId: string; duration: number }) {
  // TODO: Appeler l'API Supabase Edge Function
  const response = await fetch('/api/admin/tokens/create-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) throw new Error('Erreur création token admin');
  return response.json();
}

export default TokenManager;
