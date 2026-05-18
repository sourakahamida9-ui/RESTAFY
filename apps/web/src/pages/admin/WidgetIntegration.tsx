/**
 * Interface d'intégration du widget RESTAFY
 * Permet aux restaurants de générer et copier le code d'embed iframe
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getAppUrl } from '@/lib/appUrl';
import {
  Code2,
  Copy,
  Check,
  ExternalLink,
  Settings,
  Eye,
  EyeOff,
  Smartphone,
  Monitor,
  Palette,
  Globe,
  Zap,
  Shield,
  RefreshCw,
  Download,
  QrCode,
  Info,
} from 'lucide-react';

interface WidgetConfig {
  theme: 'light' | 'dark';
  lang: 'fr' | 'en';
  view: 'menu' | 'reservation' | 'commande';
  color: 'terracotta' | 'blue' | 'green' | 'purple' | 'orange';
}

interface PreviewSettings {
  width: number;
  height: number;
  scale: number;
}

export default function WidgetIntegration() {
  const { profile } = useAuth();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>({
    theme: 'light',
    lang: 'fr',
    view: 'menu',
    color: 'terracotta',
  });
  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>({
    width: 400,
    height: 700,
    scale: 0.5,
  });
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRestaurantData();
  }, [profile?.restaurant_id]);

  const loadRestaurantData = async () => {
    try {
      if (!profile?.restaurant_id) return;

      const { data, error } = await supabase
        .from('restaurants')
        .select('slug, name')
        .eq('id', profile.restaurant_id)
        .single();

      if (error) throw error;
      setRestaurant(data);
    } catch (error) {
      console.error('[WidgetIntegration] Erreur chargement restaurant:', error);
      toast.error('Erreur chargement des données du restaurant');
    } finally {
      setLoading(false);
    }
  };

  // Sanitize slug pour éviter URL malformée si la valeur DB contient un '?'
  // ou des slashes parasites (toutes deux brisaient l'URL d'intégration en prod).
  const safeSlug = (s: string | null | undefined) =>
    String(s ?? '').trim().replace(/^\/+|[\/?#].*$/g, '');

  // Générer le code d'intégration
  const generateEmbedCode = () => {
    if (!restaurant) return '';

    const baseUrl = getAppUrl().replace(/[?/]+$/, '');
    const params = new URLSearchParams({
      theme: widgetConfig.theme,
      lang: widgetConfig.lang,
      view: widgetConfig.view,
      color: widgetConfig.color,
    });

    const widgetUrl = `${baseUrl}/widget/${safeSlug(restaurant.slug)}?${params.toString()}`;

    return `<iframe 
  src="${widgetUrl}" 
  width="100%" 
  height="700px" 
  frameborder="0" 
  allow="payment"
  style="border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
</iframe>`;
  };

  // Générer l'URL du widget
  const generateWidgetUrl = () => {
    if (!restaurant) return '';

    const baseUrl = getAppUrl().replace(/[?/]+$/, '');
    const params = new URLSearchParams({
      theme: widgetConfig.theme,
      lang: widgetConfig.lang,
      view: widgetConfig.view,
      color: widgetConfig.color,
    });

    return `${baseUrl}/widget/${safeSlug(restaurant.slug)}?${params.toString()}`;
  };

  // Copier le code
  const copyEmbedCode = () => {
    const code = generateEmbedCode();
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode('embed');
      toast.success('Code d\'intégration copié !');
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  // Copier l'URL
  const copyWidgetUrl = () => {
    const url = generateWidgetUrl();
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode('url');
      toast.success('URL du widget copiée !');
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  // Télécharger le code
  const downloadEmbedCode = () => {
    const code = generateEmbedCode();
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `restafy-widget-${restaurant?.slug}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Obtenir la couleur hex
  const getColorHex = (color: string) => {
    const colorMap: Record<string, string> = {
      terracotta: '#FF6B35',
      blue: '#3B82F6',
      green: '#10B981',
      purple: '#8B5CF6',
      orange: '#F97316',
    };
    return colorMap[color] || colorMap.terracotta;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Restaurant non trouvé</h2>
          <p className="text-gray-600">Impossible de charger les informations du restaurant.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Code2 className="w-6 h-6 text-orange-500" />
            Intégration Widget
          </h1>
          <p className="text-gray-600 mt-1">
            Intégrez RESTAFY directement sur votre site web avec un simple code iframe
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
            {restaurant.name}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="space-y-6">
          {/* Personnalisation */}
          <div className="r-admin-card p-6">
            <h2 className="text-lg font-semibold text-[color:var(--r-text)] mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-orange-500" />
              Personnalisation
            </h2>
            
            <div className="space-y-4">
              {/* Thème */}
              <div>
                <label className="block text-sm font-medium text-[color:var(--r-text)] mb-2">
                  Thème
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'light', label: 'Clair', icon: '☀️' },
                    { value: 'dark', label: 'Sombre', icon: '🌙' },
                  ].map(theme => (
                    <button
                      key={theme.value}
                      onClick={() => setWidgetConfig(prev => ({ ...prev, theme: theme.value as 'light' | 'dark' }))}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        widgetConfig.theme === theme.value
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-[var(--r-input-border)] hover:border-orange-500/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{theme.icon}</span>
                        <span className="font-medium">{theme.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Langue */}
              <div>
                <label className="block text-sm font-medium text-[color:var(--r-text)] mb-2">
                  Langue
                </label>
                <select
                  value={widgetConfig.lang}
                  onChange={(e) => setWidgetConfig(prev => ({ ...prev, lang: e.target.value as 'fr' | 'en' }))}
                  className="w-full px-3 py-2 border border-[var(--r-input-border)] rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-[var(--r-input-bg)] text-[var(--r-text)]"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>

              {/* Vue par défaut */}
              <div>
                <label className="block text-sm font-medium text-[color:var(--r-text)] mb-2">
                  Vue par défaut
                </label>
                <select
                  value={widgetConfig.view}
                  onChange={(e) => setWidgetConfig(prev => ({ ...prev, view: e.target.value as 'menu' | 'reservation' | 'commande' }))}
                  className="w-full px-3 py-2 border border-[var(--r-input-border)] rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-[var(--r-input-bg)] text-[var(--r-text)]"
                >
                  <option value="menu">Menu</option>
                  <option value="commande">Commande</option>
                  <option value="reservation">Réservation</option>
                </select>
              </div>

              {/* Couleur principale */}
              <div>
                <label className="block text-sm font-medium text-[color:var(--r-text)] mb-2">
                  Couleur principale
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'terracotta', label: 'Terracotta', hex: '#FF6B35' },
                    { value: 'blue', label: 'Bleu', hex: '#3B82F6' },
                    { value: 'green', label: 'Vert', hex: '#10B981' },
                    { value: 'purple', label: 'Violet', hex: '#8B5CF6' },
                    { value: 'orange', label: 'Orange', hex: '#F97316' },
                  ].map(color => (
                    <button
                      key={color.value}
                      onClick={() => setWidgetConfig(prev => ({ ...prev, color: color.value as any }))}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        widgetConfig.color === color.value
                          ? 'border-gray-800 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border border-gray-300"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="font-medium text-sm">{color.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Code d'intégration */}
          <div className="r-admin-card p-6">
            <h2 className="text-lg font-semibold text-[color:var(--r-text)] mb-4 flex items-center gap-2">
              <Code2 className="w-5 h-5 text-orange-500" />
              Code d'intégration
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--r-text)] mb-2">
                  Code HTML à copier
                </label>
                <div className="relative">
                  <pre className="bg-[var(--r-surface)] p-4 rounded-lg text-xs font-mono text-[color:var(--r-text)] overflow-x-auto border border-[var(--r-input-border)]">
                    {generateEmbedCode()}
                  </pre>
                  <button
                    onClick={copyEmbedCode}
                    className="absolute top-2 right-2 p-2 text-[color:var(--r-text-muted)] hover:text-[color:var(--r-text)] hover:bg-[var(--r-surface)] rounded-lg transition-colors"
                  >
                    {copiedCode === 'embed' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={copyEmbedCode}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copiedCode === 'embed' ? 'Copié !' : 'Copier le code'}
                </button>
                
                <button
                  onClick={downloadEmbedCode}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </button>
              </div>
            </div>
          </div>

          {/* URL directe */}
          <div className="r-admin-card p-6">
            <h2 className="text-lg font-semibold text-[color:var(--r-text)] mb-4 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-orange-500" />
              Lien direct
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--r-text)] mb-2">
                  URL du widget
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={generateWidgetUrl()}
                    readOnly
                    className="w-full px-3 py-2 pr-10 border border-[var(--r-input-border)] rounded-lg bg-[var(--r-surface)] text-sm font-mono text-[color:var(--r-text)]"
                  />
                  <button
                    onClick={copyWidgetUrl}
                    className="absolute top-2 right-2 p-2 text-[color:var(--r-text-muted)] hover:text-[color:var(--r-text)] hover:bg-[var(--r-surface)] rounded-lg transition-colors"
                  >
                    {copiedCode === 'url' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={() => window.open(generateWidgetUrl(), '_blank')}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Ouvrir dans un nouvel onglet
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-6">
          <div className="r-admin-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[color:var(--r-text)] flex items-center gap-2">
                <Eye className="w-5 h-5 text-orange-500" />
                Aperçu en direct
              </h2>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="p-2 text-[color:var(--r-text-muted)] hover:text-[color:var(--r-text)] hover:bg-[var(--r-surface)] rounded-lg transition-colors"
                >
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                
                <select
                  value={`${previewSettings.width}x${previewSettings.height}`}
                  onChange={(e) => {
                    const [width, height] = e.target.value.split('x').map(Number);
                    setPreviewSettings(prev => ({ ...prev, width, height }));
                  }}
                  className="text-sm px-2 py-1 border border-[var(--r-input-border)] rounded-lg bg-[var(--r-input-bg)] text-[color:var(--r-text)]"
                >
                  <option value="400x700">400x700</option>
                  <option value="600x800">600x800</option>
                  <option value="800x1000">800x1000</option>
                </select>
              </div>
            </div>

            {showPreview && (
              <div className="border border-[var(--r-input-border)] rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b border-[var(--r-input-border)]">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Widget RESTAFY - {restaurant.name}</span>
                    <span>{previewSettings.width} × {previewSettings.height}</span>
                  </div>
                </div>
                
                <WidgetPreviewIframe
                  url={generateWidgetUrl()}
                  width={previewSettings.width}
                  height={previewSettings.height}
                  scale={previewSettings.scale}
                  restaurantName={restaurant.name}
                />
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Instructions d'intégration
            </h3>
            
            <div className="space-y-4 text-sm text-blue-800">
              <div>
                <h4 className="font-medium mb-2">1. Copiez le code HTML</h4>
                <p className="text-blue-700">
                  Utilisez le bouton "Copier le code" pour copier le code iframe dans votre presse-papiers.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">2. Collez dans votre site</h4>
                <p className="text-blue-700">
                  Insérez le code dans le HTML de votre site web à l'endroit où vous voulez que le widget apparaisse.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">3. Personnalisez si besoin</h4>
                <p className="text-blue-700">
                  Modifiez les paramètres de l'URL pour adapter le widget à votre design (thème, couleur, langue, vue par défaut).
                </p>
              </div>
              
              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                <h4 className="font-medium mb-2">Paramètres disponibles :</h4>
                <ul className="space-y-1 font-mono text-xs">
                  <li>?theme=light|dark</li>
                  <li>?lang=fr|en</li>
                  <li>?view=menu|commande|reservation</li>
                  <li>?color=terracotta|blue|green|purple|orange</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Stable iframe wrapper — only reloads when the URL actually changes.
 * Prevents the iframe from flickering on parent re-renders.
 */
function WidgetPreviewIframe({
  url,
  width,
  height,
  scale,
  restaurantName,
}: {
  url: string;
  width: number;
  height: number;
  scale: number;
  restaurantName: string;
}) {
  const stableUrl = useMemo(() => url, [url]);
  return (
    <div
      className="bg-white"
      style={{
        width,
        height,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        overflow: 'hidden',
      }}
    >
      <iframe
        src={stableUrl}
        width="100%"
        height="100%"
        frameBorder="0"
        allow="payment"
        style={{ borderRadius: '8px' }}
        title={`Widget RESTAFY - ${restaurantName}`}
      />
    </div>
  );
}
