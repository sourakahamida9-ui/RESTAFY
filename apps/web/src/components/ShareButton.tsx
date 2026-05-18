// src/components/ShareButton.tsx
// Composant universel de partage pour WhatsApp, Facebook, copie lien, telecharger affiche

import { getAppUrl } from '@/lib/appUrl';
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, X, Copy, Check, Download, MessageCircle, Facebook, Link2, Image } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface ShareButtonProps {
  type: 'event' | 'restaurant' | 'menu';
  entityId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  date?: string;
  location?: string;
  price?: number;
  slug?: string;
  onDownloadPoster?: () => void;
  className?: string;
}

export function ShareButton({
  type,
  entityId,
  title,
  description,
  imageUrl,
  date,
  location,
  price,
  slug,
  onDownloadPoster,
  className = '',
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();

  const baseUrl = getAppUrl();
  const shareUrl = slug
    ? `${baseUrl}/${type === 'event' ? 'e' : 'r'}/${slug}`
    : `${baseUrl}/${type === 'event' ? 'events' : 'restaurant'}/${entityId}`;

  // Message pre-formate pour WhatsApp
  const whatsappMessage = type === 'event'
    ? `🎉 *${title}*\n\n📅 ${date || ''}\n📍 ${location || ''}\n💰 A partir de ${price ? price.toLocaleString() : '0'} FCFA\n\n🎫 Reservez vos billets sur Restafy:\n${shareUrl}`
    : `🍽️ *${title}*\n\n${description || 'Decouvrez le menu de ce restaurant'}\n\n👉 Commander sur Restafy:\n${shareUrl}`;

  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(title)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  // Tracker le partage
  const trackShare = async (platform: string) => {
    try {
      await supabase.from('share_events').insert({
        entity_type: type,
        entity_id: entityId,
        platform,
        user_id: user?.id || null,
      });
    } catch (err) {
      console.error('[ShareButton] Track error:', err);
    }
  };

  const handleWhatsApp = () => {
    trackShare('whatsapp');
    window.open(whatsappUrl, '_blank');
    setOpen(false);
  };

  const handleFacebook = () => {
    trackShare('facebook');
    window.open(facebookShareUrl, '_blank', 'width=600,height=400');
    setOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      trackShare('copy_link');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadPoster = () => {
    trackShare('download_poster');
    onDownloadPoster?.();
    setOpen(false);
  };

  // Utiliser Web Share API si disponible
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description || title,
          url: shareUrl,
        });
        trackShare('native');
      } catch (err) {
        // User cancelled or error
      }
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleNativeShare}
        className={`p-2 rounded-full bg-white/90 backdrop-blur shadow-lg hover:bg-white transition ${className}`}
        aria-label="Partager"
      >
        <Share2 className="w-5 h-5 text-gray-700" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 z-50 max-w-lg mx-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Partager</h3>
                <button onClick={() => setOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-6">
                {/* WhatsApp */}
                <button
                  onClick={handleWhatsApp}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-green-50 transition"
                >
                  <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center">
                    <MessageCircle className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">WhatsApp</span>
                </button>

                {/* Facebook */}
                <button
                  onClick={handleFacebook}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-blue-50 transition"
                >
                  <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center">
                    <Facebook className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">Facebook</span>
                </button>

                {/* Copy Link */}
                <button
                  onClick={handleCopyLink}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-gray-100 transition"
                >
                  <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center">
                    {copied ? <Check className="w-7 h-7 text-green-600" /> : <Link2 className="w-7 h-7 text-gray-700" />}
                  </div>
                  <span className="text-xs font-medium text-gray-700">{copied ? 'Copie!' : 'Copier'}</span>
                </button>

                {/* Download Poster (events only) */}
                {type === 'event' && onDownloadPoster && (
                  <button
                    onClick={handleDownloadPoster}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-orange-50 transition"
                  >
                    <div className="w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center">
                      <Image className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">Affiche</span>
                  </button>
                )}
              </div>

              {/* URL Preview */}
              <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 truncate text-sm text-gray-600">{shareUrl}</div>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 transition"
                >
                  {copied ? 'Copie!' : 'Copier'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default ShareButton;