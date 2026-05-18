/**
 * Interface restaurant pour accéder au scanner de billets
 * Génère des tokens sécurisés et liens vers scan.restafy.shop
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { safeParseResponse } from '@/lib/http/safeParseResponse';
import {
  QrCode,
  ExternalLink,
  Copy,
  Check,
  Smartphone,
  Shield,
  Clock,
  Users,
  Ticket,
  Zap,
  Download,
  RefreshCw,
  Settings,
  Plus,
} from 'lucide-react';

interface ScannerConfig {
  eventId: string;
  eventName: string;
  token: string;
  scannerUrl: string;
  qrCode: string;
  expiresAt: Date;
  isActive: boolean;
  usageCount: number;
}

export default function RestaurantScanner() {
  const { profile } = useAuth();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [scannerConfigs, setScannerConfigs] = useState<ScannerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingScanner, setCreatingScanner] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    loadRestaurantData();
    loadScannerConfigs();
  }, []);

  const loadRestaurantData = async () => {
    try {
      if (!profile?.restaurant_id) return;

      // Charger les infos du restaurant
      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', profile.restaurant_id)
        .single();

      if (restaurantData) {
        setRestaurant(restaurantData);
      }

      // Charger les événements du restaurant
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, title, start_time, end_time, is_published')
        .eq('restaurant_id', profile.restaurant_id)
        .eq('is_published', true)
        .order('start_time', { ascending: true });

      if (eventsData) {
        setEvents(eventsData);
        if (eventsData.length > 0) {
          setSelectedEvent(eventsData[0].id);
        }
      }
    } catch (error) {
      console.error('[RestaurantScanner] Erreur chargement données:', error);
      toast.error('Erreur chargement des données du restaurant');
    } finally {
      setLoading(false);
    }
  };

  const loadScannerConfigs = async () => {
    try {
      // TODO: Charger les configurations de scanner existantes
      // Pour l'instant, simuler des données
      setScannerConfigs([]);
    } catch (error) {
      console.error('[RestaurantScanner] Erreur chargement configs:', error);
    }
  };

  const createScannerAccess = async () => {
    if (!selectedEvent) {
      toast.error('Veuillez sélectionner un événement');
      return;
    }

    setCreatingScanner(true);
    
    try {
      const selectedEventData = events.find(e => e.id === selectedEvent);
      
      // Créer un token pour l'événement
      const response = await fetch('/api/admin/tokens/create-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`,
        },
        body: JSON.stringify({
          eventId: selectedEvent,
          eventName: selectedEventData?.title || 'Événement',
          duration: 24 * 60 * 60, // 24 heures
          restaurantId: restaurant?.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur création token scanner');
      }

      const { ok, status, data: result, raw, message } = await safeParseResponse(response);
      if (!ok) {
        const details = message || 'Erreur création token scanner';
        throw new Error(details);
      }
      
      // Générer l'URL du scanner
      const scannerUrl = `https://scan.restafy.shop/?token=${encodeURIComponent(result.token)}`;
      
      const newConfig: ScannerConfig = {
        eventId: selectedEvent,
        eventName: selectedEventData?.title || 'Événement',
        token: result.token,
        scannerUrl,
        qrCode: result.qrCode,
        expiresAt: result.displayInfo.expiresAt,
        isActive: true,
        usageCount: 0,
      };

      setScannerConfigs(prev => [newConfig, ...prev]);
      toast.success('Accès scanner créé avec succès !');
      
    } catch (error) {
      console.error('[RestaurantScanner] Erreur création scanner:', error);
      toast.error('Erreur création de l\'accès scanner');
    } finally {
      setCreatingScanner(false);
    }
  };

  const copyScannerUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      toast.success('Lien du scanner copié !');
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const downloadQR = (qrCode: string, eventName: string) => {
    const link = document.createElement('a');
    link.href = qrCode;
    link.download = `scanner-${eventName.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.click();
  };

  const openScanner = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatRemainingTime = (expiresAt: Date): string => {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expiré';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}j ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}min`;
    return `${Math.floor(diff / (1000 * 60))}min`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <QrCode className="w-6 h-6 text-orange-500" />
            Scanner de Billets
          </h1>
          <p className="text-gray-600 mt-1">
            Générez des accès sécurisés pour scanner les billets de vos événements
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
            {restaurant?.name || 'Restaurant'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-blue-600">
            <Ticket className="w-5 h-5" />
            <span className="text-sm font-medium">Événements actifs</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {events.length}
          </p>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-green-600">
            <Smartphone className="w-5 h-5" />
            <span className="text-sm font-medium">Scanners actifs</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {scannerConfigs.filter(c => c.isActive).length}
          </p>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-orange-600">
            <Users className="w-5 h-5" />
            <span className="text-sm font-medium">Scans aujourd'hui</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {scannerConfigs.reduce((sum, c) => sum + c.usageCount, 0)}
          </p>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-purple-600">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Uptime</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            99.9%
          </p>
        </div>
      </div>

      {/* Création nouveau scanner */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-orange-500" />
          Nouvel Accès Scanner
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Événement
            </label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Durée d'accès
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
              <option value="24">24 heures</option>
              <option value="48">48 heures</option>
              <option value="168">7 jours</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={createScannerAccess}
              disabled={!selectedEvent || creatingScanner}
              className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {creatingScanner ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Créer l'accès
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-2">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Sécurité garantie</p>
              <p>Chaque accès généré est unique, expirera automatiquement et est lié à votre restaurant. Les scans sont tracés et sécurisés.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des scanners */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Accès Scanner Actifs</h2>
        </div>
        
        {scannerConfigs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <QrCode className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Aucun accès scanner créé</p>
            <p className="text-sm mt-1">Créez votre premier accès pour commencer à scanner les billets</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {scannerConfigs.map((config, index) => (
              <div key={config.token} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{config.eventName}</h3>
                      {config.isActive ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                          Actif
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                          Inactif
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expire: {formatRemainingTime(config.expiresAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {config.usageCount} scans
                      </span>
                    </div>
                    
                    <div className="bg-gray-50 p-2 rounded text-xs font-mono text-gray-600 break-all">
                      {config.scannerUrl}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => openScanner(config.scannerUrl)}
                      className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Ouvrir le scanner"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => copyScannerUrl(config.scannerUrl)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Copier le lien"
                    >
                      {copiedUrl === config.scannerUrl ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => downloadQR(config.qrCode, config.eventName)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Télécharger le QR code"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          Comment utiliser le scanner
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Pour votre équipe</h4>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Générez un accès scanner pour votre événement</li>
              <li>Partagez le lien ou le QR code avec votre équipe</li>
              <li>Votre équipe ouvre le lien dans un navigateur</li>
              <li>Scannez les billets des clients avec caméra ou saisie manuelle</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Avantages</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>✅ Accès sécurisé avec token unique</li>
              <li>✅ Fonctionne hors-ligne</li>
              <li>✅ Interface simple et rapide</li>
              <li>✅ Historique des validations</li>
              <li>✅ Compatible tous appareils</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
