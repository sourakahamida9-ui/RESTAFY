// src/components/admin/AutoReports.tsx
// Rapports automatiques par Email et WhatsApp - quotidien/hebdomadaire

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, MessageCircle, Calendar, Clock, Bell, Settings,
  CheckCircle2, AlertCircle, Send, Download, FileText,
  TrendingUp, DollarSign, ShoppingBag, Users, ChevronRight,
  Plus, Trash2, Edit2, Save, X, BarChart3
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ReportConfig {
  id: string;
  name: string;
  type: 'daily' | 'weekly' | 'monthly';
  channels: ('email' | 'whatsapp')[];
  recipients: { email?: string; phone?: string; name: string }[];
  time: string; // HH:mm
  dayOfWeek?: number; // 0-6 pour weekly
  dayOfMonth?: number; // 1-31 pour monthly
  enabled: boolean;
  includeMetrics: string[];
  lastSent?: string;
}

interface Props {
  restaurantId: string;
}

const METRICS_OPTIONS = [
  { id: 'revenue', label: 'Chiffre d\'affaires', icon: DollarSign },
  { id: 'orders', label: 'Nombre de commandes', icon: ShoppingBag },
  { id: 'avg_ticket', label: 'Panier moyen', icon: TrendingUp },
  { id: 'top_items', label: 'Articles les plus vendus', icon: BarChart3 },
  { id: 'customers', label: 'Nouveaux clients', icon: Users },
  { id: 'peak_hours', label: 'Heures de pointe', icon: Clock },
];

const DAYS_OF_WEEK = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function AutoReports({ restaurantId }: Props) {
  const [configs, setConfigs] = useState<ReportConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingConfig, setEditingConfig] = useState<ReportConfig | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sendingTest, setSendingTest] = useState<string | null>(null);

  // Charger les configurations
  useEffect(() => {
    loadConfigs();
  }, [restaurantId]);

  const loadConfigs = async () => {
    const { data } = await supabase
      .from('report_configs')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (data) {
      setConfigs(data.map((d: any) => ({
        id: d.id,
        name: d.name,
        type: d.report_type,
        channels: d.channels || [],
        recipients: d.recipients || [],
        time: d.send_time || '08:00',
        dayOfWeek: d.day_of_week,
        dayOfMonth: d.day_of_month,
        enabled: d.enabled,
        includeMetrics: d.include_metrics || [],
        lastSent: d.last_sent,
      })));
    }
    setLoading(false);
  };

  const saveConfig = async (config: ReportConfig) => {
    const payload = {
      restaurant_id: restaurantId,
      name: config.name,
      report_type: config.type,
      channels: config.channels,
      recipients: config.recipients,
      send_time: config.time,
      day_of_week: config.dayOfWeek,
      day_of_month: config.dayOfMonth,
      enabled: config.enabled,
      include_metrics: config.includeMetrics,
    };

    if (config.id && !config.id.startsWith('new-')) {
      await supabase.from('report_configs').update(payload).eq('id', config.id);
    } else {
      await supabase.from('report_configs').insert(payload);
    }

    toast.success('Configuration sauvegardee');
    loadConfigs();
    setEditingConfig(null);
    setShowAddModal(false);
  };

  const deleteConfig = async (id: string) => {
    await supabase.from('report_configs').delete().eq('id', id);
    toast.success('Rapport supprime');
    loadConfigs();
  };

  const toggleConfig = async (id: string, enabled: boolean) => {
    await supabase.from('report_configs').update({ enabled }).eq('id', id);
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, enabled } : c));
    toast.success(enabled ? 'Rapport active' : 'Rapport desactive');
  };

  const sendTestReport = async (config: ReportConfig) => {
    setSendingTest(config.id);
    
    try {
      // Generer le rapport de test
      const reportData = await generateReportData(config);
      
      // Envoyer via les canaux configures
      for (const channel of config.channels) {
        if (channel === 'email') {
          await sendEmailReport(config, reportData);
        } else if (channel === 'whatsapp') {
          await sendWhatsAppReport(config, reportData);
        }
      }
      
      toast.success('Rapport de test envoye!');
    } catch (error) {
      toast.error('Erreur lors de l\'envoi du rapport');
    }
    
    setSendingTest(null);
  };

  const generateReportData = async (config: ReportConfig) => {
    const now = new Date();
    let startDate: Date;
    
    switch (config.type) {
      case 'daily':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', startDate.toISOString())
      .lt('created_at', now.toISOString());

    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
    const totalOrders = orders?.length || 0;
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const deliveredOrders = orders?.filter(o => o.status === 'delivered').length || 0;

    return {
      period: config.type,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      metrics: {
        revenue: totalRevenue,
        orders: totalOrders,
        avg_ticket: avgTicket,
        delivered: deliveredOrders,
        cancelled: orders?.filter(o => o.status === 'cancelled').length || 0,
      },
    };
  };

  const sendEmailReport = async (config: ReportConfig, data: any) => {
    // Appeler l'API d'envoi d'email
    const emailRecipients = config.recipients.filter(r => r.email);
    
    for (const recipient of emailRecipients) {
      await fetch('/api/send-report-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient.email,
          name: recipient.name,
          restaurantId,
          reportType: config.type,
          data,
        }),
      });
    }
  };

  const sendWhatsAppReport = async (config: ReportConfig, data: any) => {
    // Generer le message WhatsApp
    const phoneRecipients = config.recipients.filter(r => r.phone);
    const message = formatWhatsAppMessage(config, data);
    
    for (const recipient of phoneRecipients) {
      // Ouvrir WhatsApp Web avec le message pre-rempli
      const whatsappUrl = `https://wa.me/${recipient.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  const formatWhatsAppMessage = (config: ReportConfig, data: any) => {
    const periodLabel = config.type === 'daily' ? 'Quotidien' : config.type === 'weekly' ? 'Hebdomadaire' : 'Mensuel';
    
    return `📊 *Rapport ${periodLabel} - Restafy*

💰 *Chiffre d'affaires:* ${data.metrics.revenue.toLocaleString('fr-FR')} FCFA
📦 *Commandes:* ${data.metrics.orders}
🎯 *Panier moyen:* ${Math.round(data.metrics.avg_ticket).toLocaleString('fr-FR')} FCFA
✅ *Livrees:* ${data.metrics.delivered}
❌ *Annulees:* ${data.metrics.cancelled}

_Genere automatiquement par Restafy_`;
  };

  const createNewConfig = (): ReportConfig => ({
    id: `new-${Date.now()}`,
    name: 'Nouveau rapport',
    type: 'daily',
    channels: ['email'],
    recipients: [],
    time: '08:00',
    enabled: true,
    includeMetrics: ['revenue', 'orders', 'avg_ticket'],
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-zinc-900">Rapports automatiques</h2>
          <p className="text-sm text-zinc-500">Configurez l'envoi automatique de vos rapports par email et WhatsApp</p>
        </div>
        <button
          onClick={() => {
            setEditingConfig(createNewConfig());
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-orange-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 transition-all"
        >
          <Plus className="w-4 h-4" />
          Nouveau rapport
        </button>
      </div>

      {/* Liste des rapports */}
      <div className="space-y-4">
        {configs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center">
            <FileText className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-zinc-700 mb-2">Aucun rapport configure</h3>
            <p className="text-zinc-400 mb-6">Creez votre premier rapport automatique pour recevoir vos statistiques regulierement</p>
            <button
              onClick={() => {
                setEditingConfig(createNewConfig());
                setShowAddModal(true);
              }}
              className="px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all"
            >
              Creer un rapport
            </button>
          </div>
        ) : (
          configs.map(config => (
            <motion.div
              key={config.id}
              layout
              className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden"
            >
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    config.type === 'daily' ? 'bg-blue-100' :
                    config.type === 'weekly' ? 'bg-purple-100' : 'bg-emerald-100'
                  }`}>
                    <Calendar className={`w-6 h-6 ${
                      config.type === 'daily' ? 'text-blue-600' :
                      config.type === 'weekly' ? 'text-purple-600' : 'text-emerald-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900">{config.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        config.type === 'daily' ? 'bg-blue-100 text-blue-700' :
                        config.type === 'weekly' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {config.type === 'daily' ? 'Quotidien' : config.type === 'weekly' ? 'Hebdomadaire' : 'Mensuel'}
                      </span>
                      <span className="text-xs text-zinc-400">a {config.time}</span>
                      <div className="flex items-center gap-1">
                        {config.channels.includes('email') && (
                          <Mail className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        {config.channels.includes('whatsapp') && (
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Toggle enabled */}
                  <button
                    onClick={() => toggleConfig(config.id, !config.enabled)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      config.enabled ? 'bg-emerald-500' : 'bg-zinc-200'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      config.enabled ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>

                  {/* Test send */}
                  <button
                    onClick={() => sendTestReport(config)}
                    disabled={sendingTest === config.id}
                    className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-all disabled:opacity-50"
                    title="Envoyer un rapport de test"
                  >
                    {sendingTest === config.id ? (
                      <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => {
                      setEditingConfig(config);
                      setShowAddModal(true);
                    }}
                    className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => {
                      if (confirm('Supprimer ce rapport ?')) {
                        deleteConfig(config.id);
                      }
                    }}
                    className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Recipients preview */}
              {config.recipients.length > 0 && (
                <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-100">
                  <p className="text-xs text-zinc-400 font-medium">
                    Destinataires: {config.recipients.map(r => r.name).join(', ')}
                  </p>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {showAddModal && editingConfig && (
          <ReportConfigModal
            config={editingConfig}
            onSave={saveConfig}
            onClose={() => {
              setShowAddModal(false);
              setEditingConfig(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Modal de configuration
function ReportConfigModal({
  config,
  onSave,
  onClose,
}: {
  config: ReportConfig;
  onSave: (config: ReportConfig) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(config);
  const [newRecipient, setNewRecipient] = useState({ name: '', email: '', phone: '' });

  const addRecipient = () => {
    if (newRecipient.name && (newRecipient.email || newRecipient.phone)) {
      setForm(prev => ({
        ...prev,
        recipients: [...prev.recipients, { ...newRecipient }],
      }));
      setNewRecipient({ name: '', email: '', phone: '' });
    }
  };

  const removeRecipient = (index: number) => {
    setForm(prev => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index),
    }));
  };

  const toggleMetric = (metricId: string) => {
    setForm(prev => ({
      ...prev,
      includeMetrics: prev.includeMetrics.includes(metricId)
        ? prev.includeMetrics.filter(m => m !== metricId)
        : [...prev.includeMetrics, metricId],
    }));
  };

  const toggleChannel = (channel: 'email' | 'whatsapp') => {
    setForm(prev => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter(c => c !== channel)
        : [...prev.channels, channel],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="text-lg font-black text-zinc-900">
            {config.id.startsWith('new-') ? 'Nouveau rapport' : 'Modifier le rapport'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-xl transition-all">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Nom */}
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-2">Nom du rapport</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none"
              placeholder="Ex: Rapport quotidien ventes"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-2">Frequence</label>
            <div className="grid grid-cols-3 gap-3">
              {(['daily', 'weekly', 'monthly'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setForm(prev => ({ ...prev, type }))}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    form.type === type
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <Calendar className={`w-5 h-5 mx-auto mb-2 ${form.type === type ? 'text-orange-500' : 'text-zinc-400'}`} />
                  <p className={`text-sm font-bold ${form.type === type ? 'text-orange-700' : 'text-zinc-600'}`}>
                    {type === 'daily' ? 'Quotidien' : type === 'weekly' ? 'Hebdomadaire' : 'Mensuel'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Heure d'envoi */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-zinc-700 mb-2">Heure d'envoi</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm(prev => ({ ...prev, time: e.target.value }))}
                className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:border-orange-500 outline-none"
              />
            </div>
            {form.type === 'weekly' && (
              <div>
                <label className="block text-sm font-bold text-zinc-700 mb-2">Jour de la semaine</label>
                <select
                  value={form.dayOfWeek || 1}
                  onChange={(e) => setForm(prev => ({ ...prev, dayOfWeek: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:border-orange-500 outline-none"
                >
                  {DAYS_OF_WEEK.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Canaux */}
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-2">Canaux d'envoi</label>
            <div className="flex gap-3">
              <button
                onClick={() => toggleChannel('email')}
                className={`flex-1 p-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                  form.channels.includes('email')
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-zinc-200 text-zinc-500'
                }`}
              >
                <Mail className="w-5 h-5" />
                <span className="font-bold">Email</span>
              </button>
              <button
                onClick={() => toggleChannel('whatsapp')}
                className={`flex-1 p-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                  form.channels.includes('whatsapp')
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-zinc-200 text-zinc-500'
                }`}
              >
                <MessageCircle className="w-5 h-5" />
                <span className="font-bold">WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Destinataires */}
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-2">Destinataires</label>
            <div className="space-y-2 mb-3">
              {form.recipients.map((r, i) => (
                <div key={i} className="flex items-center justify-between bg-zinc-50 px-4 py-2 rounded-xl">
                  <div>
                    <p className="font-medium text-zinc-800">{r.name}</p>
                    <p className="text-xs text-zinc-400">
                      {r.email && `${r.email}`}
                      {r.email && r.phone && ' | '}
                      {r.phone && `${r.phone}`}
                    </p>
                  </div>
                  <button onClick={() => removeRecipient(i)} className="text-red-400 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Nom"
                value={newRecipient.name}
                onChange={(e) => setNewRecipient(prev => ({ ...prev, name: e.target.value }))}
                className="px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={newRecipient.email}
                onChange={(e) => setNewRecipient(prev => ({ ...prev, email: e.target.value }))}
                className="px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
              <input
                type="tel"
                placeholder="WhatsApp"
                value={newRecipient.phone}
                onChange={(e) => setNewRecipient(prev => ({ ...prev, phone: e.target.value }))}
                className="px-3 py-2 border border-zinc-200 rounded-xl text-sm"
              />
              <button
                onClick={addRecipient}
                className="px-3 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Metriques */}
          <div>
            <label className="block text-sm font-bold text-zinc-700 mb-2">Metriques a inclure</label>
            <div className="grid grid-cols-2 gap-2">
              {METRICS_OPTIONS.map(metric => (
                <button
                  key={metric.id}
                  onClick={() => toggleMetric(metric.id)}
                  className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-all ${
                    form.includeMetrics.includes(metric.id)
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-zinc-200'
                  }`}
                >
                  <metric.icon className={`w-4 h-4 ${form.includeMetrics.includes(metric.id) ? 'text-orange-500' : 'text-zinc-400'}`} />
                  <span className={`text-sm font-medium ${form.includeMetrics.includes(metric.id) ? 'text-orange-700' : 'text-zinc-600'}`}>
                    {metric.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-zinc-200 rounded-xl font-bold text-zinc-600 hover:bg-zinc-50"
          >
            Annuler
          </button>
          <button
            onClick={() => onSave(form)}
            className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Sauvegarder
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default AutoReports;
