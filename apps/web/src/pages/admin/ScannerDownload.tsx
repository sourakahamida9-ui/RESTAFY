/**
 * Page de téléchargement et distribution de l'application QR Scanner
 * Permet à l'admin de générer des liens de téléchargement et de suivre les installations
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Download,
  Smartphone as SmartphoneIcon,
  Monitor as MonitorIcon,
  Copy,
  Check,
  QrCode,
  Users,
  TrendingUp,
  Globe,
  RefreshCw,
  Package,
  Apple,
} from 'lucide-react';

interface DownloadStats {
  totalDownloads: number;
  activeInstallations: number;
  platforms: {
    android: number;
    ios: number;
    web: number;
    desktop: number;
  };
  recentDownloads: Array<{
    id: string;
    platform: string;
    userAgent: string;
    timestamp: Date;
    ip: string;
    country?: string;
  }>;
}

interface DownloadLink {
  platform: string;
  url: string;
  version: string;
  size: string;
  requirements: string;
  icon: React.ReactNode;
}

export default function ScannerDownload() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DownloadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [showQR, setShowQR] = useState<string | null>(null);

  // Liens de téléchargement
  const downloadLinks: DownloadLink[] = [
    {
      platform: 'Android',
      url: 'https://scanner.restafy.shop/android/latest.apk',
      version: '1.2.0',
      size: '15.2 MB',
      requirements: 'Android 8.0+',
      icon: <SmartphoneIcon className="w-5 h-5" />,
    },
    {
      platform: 'iOS',
      url: 'https://apps.apple.com/app/restafy-scanner',
      version: '1.2.0',
      size: '18.5 MB',
      requirements: 'iOS 14.0+',
      icon: <Apple className="w-5 h-5" />,
    },
    {
      platform: 'Web',
      url: 'https://scanner.restafy.shop',
      version: '1.2.0',
      size: '2.1 MB',
      requirements: 'Chrome/Safari/Firefox',
      icon: <Globe className="w-5 h-5" />,
    },
    {
      platform: 'Desktop',
      url: 'https://scanner.restafy.shop/desktop',
      version: '1.2.0',
      size: '22.8 MB',
      requirements: 'Windows 10+ / macOS 10.15+',
      icon: <MonitorIcon className="w-5 h-5" />,
    },
  ];

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      // TODO: Remplacer par l'appel API réel
      // const { data, error } = await supabase.functions.invoke('admin-scanner-stats');
      
      // Simulation pour l'instant
      setStats({
        totalDownloads: 1247,
        activeInstallations: 892,
        platforms: {
          android: 543,
          ios: 312,
          web: 287,
          desktop: 105,
        },
        recentDownloads: [
          {
            id: '1',
            platform: 'android',
            userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S908N)',
            timestamp: new Date(Date.now() - 1000 * 60 * 5),
            ip: '192.168.1.100',
            country: 'Bénin',
          },
          {
            id: '2',
            platform: 'web',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
            timestamp: new Date(Date.now() - 1000 * 60 * 15),
            ip: '192.168.1.101',
            country: 'France',
          },
        ],
      });
    } catch (error) {
      console.error('[ScannerDownload] Erreur chargement stats:', error);
      toast.error('Erreur chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (url: string, platform: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(platform);
      toast.success('Lien copié !');
      setTimeout(() => setCopiedLink(null), 2000);
    });
  };

  const generateQR = async (url: string, platform: string) => {
    try {
      // TODO: Générer QR code
      setShowQR(platform);
    } catch (error) {
      console.error('[ScannerDownload] Erreur génération QR:', error);
      toast.error('Erreur génération du QR code');
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'android': return <SmartphoneIcon className="w-4 h-4" />;
      case 'ios': return <Apple className="w-4 h-4" />;
      case 'web': return <Globe className="w-4 h-4" />;
      case 'desktop': return <MonitorIcon className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'android': return 'text-green-600 bg-green-50 border-green-200';
      case 'ios': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'web': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'desktop': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Download className="w-6 h-6 text-orange-500" />
            Distribution QR Scanner
          </h1>
          <p className="text-gray-600 mt-1">
            Gérez le téléchargement et la distribution de l'application scanner
          </p>
        </div>
        
        <button
          onClick={loadStats}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-blue-600">
              <Download className="w-5 h-5" />
              <span className="text-sm font-medium">Téléchargements</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.totalDownloads.toLocaleString('fr-FR')}
            </p>
            <p className="text-xs text-gray-500 mt-1">Total depuis le lancement</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-green-600">
              <SmartphoneIcon className="w-5 h-5" />
              <span className="text-sm font-medium">Installations actives</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {stats.activeInstallations.toLocaleString('fr-FR')}
            </p>
            <p className="text-xs text-gray-500 mt-1">Appareils connectés</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-orange-600">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium">Taux d'adoption</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {Math.round((stats.activeInstallations / stats.totalDownloads) * 100)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Installations / téléchargements</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-purple-600">
              <Users className="w-5 h-5" />
              <span className="text-sm font-medium">Plateformes</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {Object.keys(stats.platforms).length}
            </p>
            <p className="text-xs text-gray-500 mt-1">Disponibles</p>
          </div>
        </div>
      )}

      {/* Distribution Links */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Liens de Téléchargement</h2>
          <p className="text-sm text-gray-600 mt-1">
            Partagez ces liens avec vos équipes pour qu'elles téléchargent l'application
          </p>
        </div>
        
        <div className="p-4 space-y-4">
          {downloadLinks.map((link) => (
            <div key={link.platform} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getPlatformColor(link.platform)}`}>
                    {link.icon}
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-gray-900">{link.platform}</h3>
                    <p className="text-sm text-gray-600">
                      Version {link.version} - {link.size}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {link.requirements}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyLink(link.url, link.platform)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {copiedLink === link.platform ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  
                  <button
                    onClick={() => generateQR(link.url, link.platform)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
              
              {/* URL Display */}
              <div className="mt-3 bg-gray-50 p-2 rounded text-xs font-mono text-gray-600 break-all">
                {link.url}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Distribution */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Platform Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition par Plateforme</h3>
            <div className="space-y-3">
              {Object.entries(stats.platforms).map(([platform, count]) => (
                <div key={platform} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(platform)}
                    <span className="text-sm font-medium capitalize">{platform}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${(count / stats.totalDownloads) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Downloads */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Téléchargements Récents</h3>
            <div className="space-y-3">
              {stats.recentDownloads.slice(0, 5).map((download) => (
                <div key={download.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded ${getPlatformColor(download.platform)}`}>
                      {getPlatformIcon(download.platform)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{download.platform}</p>
                      <p className="text-xs text-gray-500">
                        {download.timestamp.toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{download.country}</p>
                    <p className="text-xs text-gray-400">
                      {download.timestamp.toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Installation Instructions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Guide d'Installation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <SmartphoneIcon className="w-4 h-4 text-green-600" />
              Android
            </h4>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Téléchargez le fichier APK depuis le lien ci-dessus</li>
              <li>Autorisez l'installation de sources inconnues</li>
              <li>Installez l'application</li>
              <li>Scannez le QR code d'accès fourni par l'admin</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-600" />
              Web (PWA)
            </h4>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Ouvrez le lien web dans votre navigateur</li>
              <li>Cliquez sur "Installer l'application"</li>
              <li>L'application s'installera sur votre appareil</li>
              <li>Accédez directement depuis votre écran d'accueil</li>
            </ol>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                QR Code {showQR}
              </h3>
              <button
                onClick={() => setShowQR(null)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-center">
              {/* TODO: Afficher le QR code */}
              <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                <QrCode className="w-16 h-16 text-gray-400" />
              </div>
            </div>
            
            <p className="text-sm text-gray-600 text-center mt-4">
              Scannez ce code pour télécharger l'application {showQR}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
