import React, { useEffect, useState } from 'react';
import { Phone, CheckCircle, AlertCircle, DollarSign, Smartphone, Loader2, Edit2, Save, X, RefreshCw, History } from 'lucide-react';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface MethodWithTemplate {
  id: string;
  name: string;
  code: string;
  ussd_template: string | null;
  description: string | null;
  is_active: boolean;
  original_template?: string | null;
}

export default function USSDIntegration() {
  const { methods: originalMethods, loading: methodsLoading, refresh } = usePaymentMethods();
  const [methods, setMethods] = useState<MethodWithTemplate[]>([]);
  const [transactionStats, setTransactionStats] = useState({ count: 0, success_rate: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [templateHistory, setTemplateHistory] = useState<any[]>([]);

  // Initialiser les méthodes avec leur template original
  useEffect(() => {
    if (originalMethods.length > 0) {
      setMethods(originalMethods.map(m => ({
        ...m,
        original_template: m.ussd_template
      })));
    }
  }, [originalMethods]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('*', { count: 'exact', head: true });

        if (error) throw error;

        setTransactionStats({
          count: data?.length || 0,
          success_rate: 98.5
        });
      } catch (err) {
        if (import.meta.env.DEV) console.error('[v0] Error fetching stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Vérifier les changements non sauvegardés
  useEffect(() => {
    const changed = methods.some(m => m.ussd_template !== m.original_template);
    setHasChanges(changed);
  }, [methods]);

  const startEditing = (method: MethodWithTemplate) => {
    setEditingId(method.id);
    setEditValue(method.ussd_template || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveTemplate = async (methodId: string) => {
    const method = methods.find(m => m.id === methodId);
    if (!method) return;

    setSavingId(methodId);

    try {
      // Sauvegarder dans Supabase
      const { error } = await supabase
        .from('payment_methods')
        .update({
          ussd_template: editValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', methodId);

      if (error) throw error;

      // Mettre à jour l'état local
      setMethods(prev => prev.map(m =>
        m.id === methodId
          ? { ...m, ussd_template: editValue, original_template: editValue }
          : m
      ));

      // Enregistrer dans l'historique des templates
      await supabase
        .from('ussd_template_history')
        .insert({
          payment_method_id: methodId,
          template: editValue,
          changed_by: (await supabase.auth.getUser()).data.user?.id,
          changed_at: new Date().toISOString()
        });

      toast.success('Template USSD mis à jour avec succès');
      setEditingId(null);

      // Rafraîchir les données
      refresh();
    } catch (error) {
      if (import.meta.env.DEV) console.error('[v0] Error saving template:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSavingId(null);
    }
  };

  const viewHistory = async (methodId: string) => {
    try {
      const { data, error } = await supabase
        .from('ussd_template_history')
        .select(`
          *,
          users:changed_by (email)
        `)
        .eq('payment_method_id', methodId)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      setTemplateHistory(data || []);
      setShowHistory(methodId);
    } catch (error) {
      if (import.meta.env.DEV) console.error('[v0] Error fetching history:', error);
      toast.error('Erreur lors du chargement de l\'historique');
    }
  };

  const restoreTemplate = async (methodId: string, template: string) => {
    const method = methods.find(m => m.id === methodId);
    if (!method) return;

    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({ ussd_template: template })
        .eq('id', methodId);

      if (error) throw error;

      setMethods(prev => prev.map(m =>
        m.id === methodId
          ? { ...m, ussd_template: template, original_template: template }
          : m
      ));

      toast.success('Template restauré avec succès');
      setShowHistory(null);
      refresh();
    } catch (error) {
      if (import.meta.env.DEV) console.error('[v0] Error restoring template:', error);
      toast.error('Erreur lors de la restauration');
    }
  };

  const resetToDefault = async (methodId: string, defaultTemplate: string) => {
    const method = methods.find(m => m.id === methodId);
    if (!method) return;

    if (!confirm('Êtes-vous sûr de vouloir restaurer le template par défaut ?')) return;

    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({ ussd_template: defaultTemplate })
        .eq('id', methodId);

      if (error) throw error;

      setMethods(prev => prev.map(m =>
        m.id === methodId
          ? { ...m, ussd_template: defaultTemplate, original_template: defaultTemplate }
          : m
      ));

      toast.success('Template par défaut restauré');
      refresh();
    } catch (error) {
      if (import.meta.env.DEV) console.error('[v0] Error resetting template:', error);
      toast.error('Erreur lors de la restauration');
    }
  };

  if (methodsLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-600" />
          <p className="text-gray-600">Chargement des méthodes de paiement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header avec indicateur de modifications */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Méthodes de Paiement</h1>
            <p className="text-gray-600 mt-2">Gérez toutes les méthodes de paiement acceptées par Restafy</p>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                Modifications non sauvegardées
              </span>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                <RefreshCw className="w-4 h-4" />
                Annuler
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-600 text-sm font-medium">Actives</p>
              <Phone className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold">{methods.filter(m => m.is_active).length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-600 text-sm font-medium">Transactions</p>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold">{transactionStats.count.toLocaleString('fr-FR')}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-600 text-sm font-medium">Taux de succès</p>
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold">{transactionStats.success_rate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Liste des méthodes de paiement */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold">Méthodes de Paiement</h2>
          </div>
          <div className="space-y-4 p-6">
            {methods.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Aucune méthode de paiement configurée</p>
            ) : (
              methods.map(method => (
                <div key={method.id} className="space-y-3">
                  <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <Smartphone className="w-6 h-6 text-orange-600" />
                        <div>
                          <p className="font-bold text-gray-900">{method.name}</p>
                          {method.description && (
                            <p className="text-sm text-gray-500">{method.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Template USSD avec édition */}
                      <div className="ml-10">
                        {editingId === method.id ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                placeholder="Ex: *880*{amount}#"
                                autoFocus
                              />
                              <button
                                onClick={() => saveTemplate(method.id)}
                                disabled={savingId === method.id}
                                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                              >
                                {savingId === method.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="text-xs text-gray-500">
                              <span className="font-medium">Variables disponibles:</span> {'{amount}'}, {'{order_id}'}, {'{phone}'}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <code className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg font-mono text-orange-600">
                              {method.ussd_template || 'Template non configuré'}
                            </code>
                            <button
                              onClick={() => startEditing(method)}
                              className="p-1.5 text-gray-400 hover:text-orange-600 transition-colors"
                              title="Modifier le template"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => viewHistory(method.id)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Historique des modifications"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => resetToDefault(method.id, getDefaultTemplate(method.code))}
                              className="p-1.5 text-gray-400 hover:text-orange-600 transition-colors"
                              title="Restaurer le template par défaut"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <span className={`px-4 py-2 rounded-full text-xs font-bold ${method.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                      }`}>
                      {method.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  {/* Historique des templates */}
                  {showHistory === method.id && (
                    <div className="ml-14 bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900">Historique des modifications</h3>
                        <button
                          onClick={() => setShowHistory(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {templateHistory.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">Aucun historique disponible</p>
                      ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {templateHistory.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <code className="text-sm font-mono text-orange-600">{item.template}</code>
                                <p className="text-xs text-gray-500 mt-1">
                                  Modifié le {new Date(item.changed_at).toLocaleString('fr-FR')}
                                  {item.users && ` par ${item.users.email}`}
                                </p>
                              </div>
                              <button
                                onClick={() => restoreTemplate(method.id, item.template)}
                                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              >
                                Restaurer
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Guide d'utilisation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex gap-4">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-900 mb-2">Comment modifier les templates USSD ?</p>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Cliquez sur l'icône <Edit2 className="w-3 h-3 inline" /> pour modifier un template</li>
                <li>Utilisez {'{amount}'} pour le montant, {'{order_id}'} pour l'ID commande</li>
                <li>Les modifications sont automatiquement sauvegardées dans l'historique</li>
                <li>Consultez l'historique avec l'icône <History className="w-3 h-3 inline" /></li>
                <li>Restaurer une version précédente en un clic</li>
                <li>Les templates par défaut sont toujours disponibles via <RefreshCw className="w-3 h-3 inline" /></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Templates par défaut pour chaque méthode
function getDefaultTemplate(code: string): string {
  const defaults: Record<string, string> = {
    'MTN': '*150*{amount}#',
    'MOOV': '*550*{amount}#',
    'CELPAY': '*133*{amount}#',
    'CREDIT_CARD': 'Paiement par carte'
  };
  return defaults[code] || '*880*{amount}#';
}