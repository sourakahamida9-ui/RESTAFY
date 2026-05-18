import { useState, useEffect } from 'react';
import { Download, X, Monitor, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallPromptProps {
  variant?: 'banner' | 'button' | 'modal';
  className?: string;
}

export function PWAInstallPrompt({ variant = 'banner', className = '' }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'desktop' | 'mobile'>('desktop');

  useEffect(() => {
    // Detect platform
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setPlatform(isMobile ? 'mobile' : 'desktop');

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if app was installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isInstalled || !deferredPrompt) return null;

  // Button variant - simple install button
  if (variant === 'button') {
    return (
      <button
        onClick={handleInstall}
        className={`flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors ${className}`}
      >
        <Download className="w-4 h-4" />
        Installer l'application
      </button>
    );
  }

  // Modal variant - for restaurant dashboard
  if (variant === 'modal' && showBanner) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl">
          <div className="flex justify-between items-start mb-4">
            <div className="w-14 h-14 bg-gradient-to-br from-primary to-orange-600 rounded-xl flex items-center justify-center">
              <Monitor className="w-7 h-7 text-white" />
            </div>
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Installer Restafy Pro
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Installez l'application sur votre ordinateur pour gerer votre restaurant plus facilement.
            Acces rapide, notifications en temps reel, mode hors-ligne.
          </p>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <span className="text-green-600">1</span>
              </div>
              Acces direct depuis le bureau
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <span className="text-green-600">2</span>
              </div>
              Notifications push pour les commandes
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <span className="text-green-600">3</span>
              </div>
              Fonctionne meme hors connexion
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 py-3 px-4 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              Plus tard
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 py-3 px-4 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Installer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Banner variant - default
  if (!showBanner) return null;

  return (
    <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 p-4 z-50 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-primary to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
          {platform === 'desktop' ? (
            <Monitor className="w-6 h-6 text-white" />
          ) : (
            <Smartphone className="w-6 h-6 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
            Installer Restafy
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Acces rapide depuis votre {platform === 'desktop' ? 'bureau' : 'ecran d\'accueil'}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleDismiss}
          className="flex-1 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Plus tard
        </button>
        <button
          onClick={handleInstall}
          className="flex-1 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
        >
          <Download className="w-4 h-4" />
          Installer
        </button>
      </div>
    </div>
  );
}

// Hook to detect PWA installation status
export function useIsPWAInstalled() {
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check display mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    // iOS Safari
    const isIOSStandalone = (navigator as any).standalone === true;
    
    setIsInstalled(isStandalone || isIOSStandalone);

    const handler = () => setIsInstalled(true);
    window.addEventListener('appinstalled', handler);
    
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  return isInstalled;
}
