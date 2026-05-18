/**
 * Composant pour afficher le lien vers le scanner de billets
 * Intégré dans l'interface restaurant pour accès rapide
 */

import React, { useState } from 'react';
import { QrCode, ExternalLink, Copy, Check, Shield, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { safeParseResponse } from '@/lib/http/safeParseResponse';

interface RestaurantScannerLinkProps {
  restaurantId: string;
  eventId?: string;
  eventName?: string;
  compact?: boolean;
}

export default function RestaurantScannerLink({ 
  restaurantId, 
  eventId, 
  eventName, 
  compact = false 
}: RestaurantScannerLinkProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const generateScannerLink = async () => {
    setLoading(true);
    try {
      // Générer un token pour le scanner
      const response = await fetch('/api/admin/tokens/create-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: eventId || 'default',
          eventName: eventName || 'Scanner Restaurant',
          duration: 24 * 60 * 60, // 24 heures
          restaurantId,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur génération token scanner');
      }

      const { ok, status, data: result, raw, message } = await safeParseResponse(response);
      if (!ok) {
        const details = message || 'Erreur génération token scanner';
        throw new Error(details);
      }
      
      // Construire l'URL du scanner
      const scannerUrl = `https://scan.restafy.shop/validator?token=${encodeURIComponent(result.token)}`;
      
      // Copier le lien
      await navigator.clipboard.writeText(scannerUrl);
      setCopied(true);
      toast.success('Lien du scanner copié !');
      
      // Ouvrir dans un nouvel onglet
      window.open(scannerUrl, '_blank', 'noopener,noreferrer');
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[ScannerLink] Erreur génération lien:', error);
      toast.error('Erreur génération du lien scanner');
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        onClick={generateScannerLink}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 animate-spin border-2 border-orange-600 border-t-transparent rounded-full" />
            Génération...
          </>
        ) : (
          <>
            <QrCode className="w-4 h-4" />
            Scanner
          </>
        )}
      </button>
    );
  }

  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200">
      <div className="flex items-start gap-4">
        <div className="bg-orange-600 text-white p-3 rounded-xl">
          <QrCode className="w-6 h-6" />
        </div>
        
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-lg mb-2">
            Scanner de Billets
          </h3>
          <p className="text-gray-600 text-sm mb-4">
            Accédez à l'interface de validation pour scanner les billets de vos événements en temps réel.
          </p>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Shield className="w-3 h-3" />
              Accès sécurisé
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Smartphone className="w-3 h-3" />
              Multi-appareils
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <QrCode className="w-3 h-3" />
              Scan rapide
            </div>
          </div>
          
          <button
            onClick={generateScannerLink}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                Génération en cours...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Ouvrir le Scanner
              </>
            )}
          </button>
          
          {copied && (
            <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
              <Check className="w-4 h-4" />
              Lien copié dans le presse-papiers
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
