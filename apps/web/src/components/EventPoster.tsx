// src/components/EventPoster.tsx
// Generateur d'affiche visuelle pour evenements (canvas -> PNG)

import { getAppUrl } from '@/lib/appUrl';
import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export interface EventPosterData {
  id: string;
  title: string;
  imageUrl?: string;
  date: string;
  time: string;
  location: string;
  restaurantName: string;
  tickets: Array<{ name: string; price: number }>;
  slug?: string;
}

export interface EventPosterHandle {
  downloadPoster: (format?: 'instagram' | 'whatsapp') => Promise<void>;
}

interface EventPosterProps {
  event: EventPosterData;
  visible?: boolean;
}

export const EventPoster = forwardRef<EventPosterHandle, EventPosterProps>(
  ({ event, visible = false }, ref) => {
    const posterRef = useRef<HTMLDivElement>(null);
    const baseUrl = typeof window !== 'undefined' ? getAppUrl() : '';
    const eventUrl = event.slug ? `${baseUrl}/e/${event.slug}` : `${baseUrl}/events/${event.id}`;

    // Expose download method to parent
    useImperativeHandle(ref, () => ({
      downloadPoster: async (format: 'instagram' | 'whatsapp' = 'instagram') => {
        if (!posterRef.current) return;

        try {
          // Set dimensions based on format
          const width = format === 'instagram' ? 1080 : 1280;
          const height = format === 'instagram' ? 1080 : 720;

          posterRef.current.style.width = `${width}px`;
          posterRef.current.style.height = `${height}px`;
          posterRef.current.style.display = 'flex';

          // Lazy-load html-to-image — only pulled in when user actually clicks
          // "Download poster". Saves ~25KB on routes that just render <EventPoster>.
          const { toPng } = await import('html-to-image');
          const dataUrl = await toPng(posterRef.current, {
            width,
            height,
            pixelRatio: 2,
            quality: 1,
            backgroundColor: '#1A1A1A',
          });

          // Download
          const link = document.createElement('a');
          link.download = `${event.title.replace(/\s+/g, '-')}-affiche-${format}.png`;
          link.href = dataUrl;
          link.click();

          // Reset display
          if (!visible) {
            posterRef.current.style.display = 'none';
          }
        } catch (err) {
          console.error('[EventPoster] Download error:', err);
        }
      },
    }));

    // Format price display
    const minPrice = event.tickets.length > 0
      ? Math.min(...event.tickets.map((t) => t.price))
      : 0;
    const maxPrice = event.tickets.length > 0
      ? Math.max(...event.tickets.map((t) => t.price))
      : 0;
    const priceDisplay = minPrice === maxPrice
      ? `${minPrice.toLocaleString()} FCFA`
      : `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()} FCFA`;

    return (
      <div
        ref={posterRef}
        style={{
          width: visible ? '100%' : '1080px',
          height: visible ? 'auto' : '1080px',
          aspectRatio: visible ? '1/1' : undefined,
          display: visible ? 'flex' : 'none',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Sora', 'Inter', sans-serif",
          backgroundColor: '#1A1A1A',
        }}
      >
        {/* Background Image with Overlay */}
        {event.imageUrl && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${event.imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'brightness(0.4)',
            }}
          />
        )}

        {/* Gradient Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(255,107,0,0.3) 0%, rgba(26,26,26,0.95) 70%)',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: visible ? '24px' : '60px',
          }}
        >
          {/* Header - Logo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div
              style={{
                backgroundColor: 'rgba(255,107,0,0.2)',
                borderRadius: '12px',
                padding: '8px 16px',
              }}
            >
              <span style={{ color: '#FF6B00', fontWeight: 800, fontSize: visible ? '14px' : '24px' }}>
                EVENEMENT
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: visible ? '32px' : '48px',
                  height: visible ? '32px' : '48px',
                  backgroundColor: '#FF6B00',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ color: 'white', fontWeight: 900, fontSize: visible ? '16px' : '24px' }}>R</span>
              </div>
              <span style={{ color: 'white', fontWeight: 800, fontSize: visible ? '16px' : '28px' }}>Restafy</span>
            </div>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Event Title */}
          <h1
            style={{
              color: 'white',
              fontWeight: 900,
              fontSize: visible ? '28px' : '72px',
              lineHeight: 1.1,
              marginBottom: visible ? '16px' : '32px',
              textShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            {event.title}
          </h1>

          {/* Event Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: visible ? '8px' : '16px', marginBottom: visible ? '16px' : '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: visible ? '36px' : '48px',
                  height: visible ? '36px' : '48px',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: visible ? '16px' : '24px' }}>📅</span>
              </div>
              <span style={{ color: 'white', fontSize: visible ? '14px' : '28px', fontWeight: 600 }}>
                {event.date} a {event.time}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: visible ? '36px' : '48px',
                  height: visible ? '36px' : '48px',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: visible ? '16px' : '24px' }}>📍</span>
              </div>
              <span style={{ color: 'white', fontSize: visible ? '14px' : '28px', fontWeight: 600 }}>
                {event.location}
              </span>
            </div>
          </div>

          {/* Footer - Price + QR + CTA */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginTop: 'auto',
            }}
          >
            {/* Price & CTA */}
            <div>
              <div
                style={{
                  backgroundColor: '#FF6B00',
                  borderRadius: '16px',
                  padding: visible ? '12px 20px' : '20px 32px',
                  marginBottom: visible ? '8px' : '16px',
                }}
              >
                <span style={{ color: 'white', fontWeight: 800, fontSize: visible ? '20px' : '36px' }}>
                  {priceDisplay}
                </span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: visible ? '12px' : '20px' }}>
                Organisé par <span style={{ color: '#FF6B00', fontWeight: 700 }}>{event.restaurantName}</span>
              </p>
            </div>

            {/* QR Code */}
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: visible ? '8px' : '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <QRCodeSVG
                value={eventUrl}
                size={visible ? 80 : 140}
                level="H"
                includeMargin={false}
                fgColor="#1A1A1A"
              />
              <span
                style={{
                  color: '#1A1A1A',
                  fontSize: visible ? '8px' : '12px',
                  fontWeight: 700,
                  marginTop: '4px',
                }}
              >
                Scannez pour reserver
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: visible ? '40px' : '60px',
            backgroundColor: '#FF6B00',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: 'white', fontWeight: 800, fontSize: visible ? '14px' : '24px' }}>
            RESERVEZ SUR RESTAFY.APP
          </span>
        </div>
      </div>
    );
  }
);

EventPoster.displayName = 'EventPoster';

export default EventPoster;
