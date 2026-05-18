/**
 * Interface restaurant pour l'accès scan des équipes
 * Permet aux membres de l'équipe de scanner via tokens et PIN
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  QrCode,
  ExternalLink,
  Copy,
  Check,
  Smartphone,
  Shield,
  Clock,
  Users,
  Zap,
  Plus,
  Trash2,
  Lock,
  RefreshCw,
} from 'lucide-react';

interface TeamScanConfig {
  id: string;
  memberName: string;
  memberRole: string;
  token: string;
  pin: string;
  scanUrl: string;
  qrCode: string;
  isActive: boolean;
  createdAt: Date;
  expiresAt: Date;
  usageCount: number;
}

export default function RestaurantTeamScan() {
  const { profile } = useAuth();
  const [teamConfigs, setTeamConfigs] = useState<TeamScanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('staff');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    loadTeamScanConfigs();
  }, [profile]);

  const loadTeamScanConfigs = async () => {
    try {
      if (!profile?.restaurant_id) return;

      const { data, error } = await supabase
        .from('team_scan_tokens')
        .select('*')
        .eq('restaurant_id', profile.restaurant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const configs: TeamScanConfig[] = data.map((item: any) => ({
          id: item.id,
          memberName: item.member_name,
          memberRole: item.member_role,
          token: item.token,
          pin: item.pin,
          scanUrl: `https://scan.restafy.shop/team?token=${item.token}`,
          qrCode: item.qr_code,
          isActive: item.is_active,
          createdAt: new Date(item.created_at),
          expiresAt: new Date(item.expires_at),
          usageCount: item.usage_count || 0,
        }));
        setTeamConfigs(configs);
      }
    } catch (error) {
      console.error('[TeamScan] Erreur chargement configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePin = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const createTeamScan = async () => {
    if (!memberName.trim()) {
      toast.error('Veuillez entrer le nom du membre');
      return;
    }

    try {
      setCreating(true);

      const token = generateToken();
      const pin = generatePin();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 6); // Expire dans 6 mois

      const { data, error } = await supabase
        .from('team_scan_tokens')
        .insert({
          restaurant_id: profile?.restaurant_id,
          member_name: memberName.trim(),
          member_role: memberRole,
          token,
          pin,
          is_active: true,
          expires_at: expiresAt.toISOString(),
          usage_count: 0,
        })
        .select()
        .single();

      if (error) throw error;

      const newConfig: TeamScanConfig = {
        id: data.id,
        memberName: data.member_name,
        memberRole: data.member_role,
        token: data.token,
        pin: data.pin,
        scanUrl: `https://scan.restafy.shop/team?token=${data.token}`,
        qrCode: data.qr_code,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        expiresAt: new Date(data.expires_at),
        usageCount: data.usage_count || 0,
      };

      setTeamConfigs([newConfig, ...teamConfigs]);
      setMemberName('');
      toast.success(`Accès scan créé pour ${memberName}`);
    } catch (error) {
      console.error('[TeamScan] Erreur création:', error);
      toast.error('Erreur lors de la création de l\'accès scan');
    } finally {
      setCreating(false);
    }
  };

  const copyScanUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success('Lien scan copié !');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const deleteTeamScan = async (id: string) => {
    try {
      const { error } = await supabase
        .from('team_scan_tokens')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTeamConfigs(teamConfigs.filter(c => c.id !== id));
      toast.success('Accès scan supprimé');
    } catch (error) {
      console.error('[TeamScan] Erreur suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('team_scan_tokens')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      setTeamConfigs(teamConfigs.map(c => 
        c.id === id ? { ...c, isActive: !isActive } : c
      ));
      toast.success(isActive ? 'Accès désactivé' : 'Accès activé');
    } catch (error) {
      console.error('[TeamScan] Erreur activation:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-500" />
          <p className="text-zinc-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-zinc-900 mb-2">
          Scan Équipe
        </h1>
        <p className="text-zinc-600">
          Gérez les accès scan pour votre équipe via tokens et PIN sécurisés
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 border border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-600">Accès actifs</p>
              <p className="text-2xl font-bold text-zinc-900">
                {teamConfigs.filter(c => c.isActive).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-600">Utilisations totales</p>
              <p className="text-2xl font-bold text-zinc-900">
                {teamConfigs.reduce((sum, c) => sum + c.usageCount, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-zinc-600">Sécurité</p>
              <p className="text-2xl font-bold text-zinc-900">PIN + Token</p>
            </div>
          </div>
        </div>
      </div>

      {/* Création nouveau scan */}
      <div className="bg-white rounded-xl p-6 border border-zinc-200 mb-8">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">
          Nouvel Accès Scan
        </h2>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Nom du membre"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            className="flex-1 px-4 py-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <select
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value)}
            className="px-4 py-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="livreur">Livreur</option>
            <option value="caissier">Caissier</option>
          </select>
          <button
            onClick={createTeamScan}
            disabled={!memberName.trim() || creating}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {creating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Créer
              </>
            )}
          </button>
        </div>
      </div>

      {/* Liste des scans */}
      <div className="bg-white rounded-xl border border-zinc-200">
        <div className="p-6 border-b border-zinc-200">
          <h2 className="text-lg font-semibold text-zinc-900">
            Accès Scan Actifs
          </h2>
        </div>

        {teamConfigs.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-600 font-medium">Aucun accès scan créé</p>
            <p className="text-sm text-zinc-500 mt-1">
              Créez votre premier accès pour commencer
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {teamConfigs.map((config) => (
              <div key={config.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-zinc-900">
                        {config.memberName}
                      </h3>
                      <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded-full">
                        {config.memberRole}
                      </span>
                      {!config.isActive && (
                        <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded-full">
                          Inactif
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-zinc-600">
                        <Lock className="w-4 h-4" />
                        <span>PIN: <strong className="text-zinc-900">{config.pin}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-600">
                        <Clock className="w-4 h-4" />
                        <span>Expire: {config.expiresAt.toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-600">
                        <Zap className="w-4 h-4" />
                        <span>Utilisations: {config.usageCount}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={config.scanUrl}
                        className="flex-1 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm"
                      />
                      <button
                        onClick={() => copyScanUrl(config.scanUrl)}
                        className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition"
                        title="Copier le lien"
                      >
                        {copiedUrl === config.scanUrl ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-zinc-600" />
                        )}
                      </button>
                      <button
                        onClick={() => window.open(config.scanUrl, '_blank')}
                        className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition"
                        title="Ouvrir le scan"
                      >
                        <ExternalLink className="w-4 h-4 text-blue-600" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => toggleActive(config.id, config.isActive)}
                      className={`p-2 rounded-lg transition ${
                        config.isActive
                          ? 'bg-green-100 hover:bg-green-200'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      title={config.isActive ? 'Désactiver' : 'Activer'}
                    >
                      <Shield className="w-4 h-4 text-zinc-600" />
                    </button>
                    <button
                      onClick={() => deleteTeamScan(config.id)}
                      className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-zinc-50 rounded-xl p-6">
        <h3 className="font-semibold text-zinc-900 mb-4">
          Comment utiliser le scan équipe
        </h3>
        <ul className="space-y-2 text-sm text-zinc-600">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-600 mt-0.5" />
            <span>Créez un accès scan pour chaque membre de votre équipe</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-600 mt-0.5" />
            <span>Partagez le lien ou le PIN avec le membre</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-600 mt-0.5" />
            <span>Le membre peut scanner les commandes et billets via l'application scan</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-600 mt-0.5" />
            <span>Chaque accès est sécurisé par un PIN unique</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
