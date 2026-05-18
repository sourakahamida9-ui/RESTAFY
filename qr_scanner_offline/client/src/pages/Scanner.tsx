import { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { QRScanner, type QRScanResult } from '@/components/QRScanner';
import { ScanDashboard } from '@/components/ScanDashboard';
import { trpc } from '@/lib/trpc';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { saveScan, getEventStatistics } from '@/lib/db';
import { LogOut, Download } from 'lucide-react';

interface EventData {
  id: number;
  title: string;
  location?: string;
  startTime: Date;
}

/**
 * Main scanner page with QR scanning and dashboard
 */
export default function Scanner() {
  const { user, logout } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [eventStats, setEventStats] = useState({ totalTickets: 0, scannedTickets: 0, scanPercentage: 0 });

  const { isOnline, isSyncing, pendingScans, performSync } = useOfflineSync(selectedEvent?.id || 0);
  const validateQR = trpc.tickets.validateQR.useMutation();
  const eventsList = trpc.events.list.useQuery();
  const eventWithTickets = trpc.events.getWithTickets.useQuery(
    { eventId: selectedEvent?.id || 0 },
    { enabled: !!selectedEvent }
  );

  // Update event statistics when selected
  useEffect(() => {
    if (selectedEvent) {
      const updateStats = async () => {
        const stats = await getEventStatistics(selectedEvent.id);
        setEventStats(stats);
      };
      updateStats();
      const interval = setInterval(updateStats, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedEvent]);

  const handleScan = async (qrCodeData: string): Promise<QRScanResult> => {
    if (!selectedEvent) {
      return {
        success: false,
        status: 'error',
        message: 'No event selected',
      };
    }

    const startTime = Date.now();

    try {
      // Validate QR code
      const result = await validateQR.mutateAsync({
        qrCodeData,
        eventId: selectedEvent.id,
        deviceType: /Mobile|Android|iPhone/.test(navigator.userAgent) ? 'mobile' : 'desktop',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language || 'unknown',
      });

      const scanTimeMs = Date.now() - startTime;

      // Save to local DB
      if (result.success) {
        await saveScan({
          ticketId: 0, // Will be resolved on sync
          ticketNumber: result.ticket?.ticketNumber || '',
          qrCodeData,
          scannedAt: Date.now(),
          scanTimeMs,
          deviceType: /Mobile|Android|iPhone/.test(navigator.userAgent) ? 'mobile' : 'desktop',
          syncStatus: 'synced',
          eventId: selectedEvent.id,
        });

        // Record behavioral data
        // await trpc.scan.recordBehavior.mutate({
        //   eventId: selectedEvent.id,
        //   eventType: 'scan_success',
        //   scanTimeMs,
        //   deviceType: /Mobile|Android|iPhone/.test(navigator.userAgent) ? 'mobile' : 'desktop',
        //   timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        //   language: navigator.language || 'unknown',
        // });

        // Update local stats
        const stats = await getEventStatistics(selectedEvent.id);
        setEventStats(stats);
      }

      return {
        success: result.success,
        status: result.status as 'success' | 'duplicate' | 'invalid' | 'error',
        message: result.message,
        ticket: result.ticket ? {
          ticketNumber: result.ticket.ticketNumber,
          customerName: result.ticket.customerName,
          customerEmail: result.ticket.customerEmail || undefined,
        } : undefined,
      };
    } catch (error) {
      const scanTimeMs = Date.now() - startTime;

      // Save failed scan to local DB for analytics
      await saveScan({
        ticketId: 0, // Will be resolved on sync
        ticketNumber: '',
        qrCodeData,
        scannedAt: Date.now(),
        scanTimeMs,
        deviceType: /Mobile|Android|iPhone/.test(navigator.userAgent) ? 'mobile' : 'desktop',
        syncStatus: 'pending',
        eventId: selectedEvent.id,
      });

      // Record failed scan for analytics
      // await trpc.scan.recordBehavior.mutate({
      //   eventId: selectedEvent.id,
      //   eventType: 'scan_failed',
      //   scanTimeMs,
      //   errorType: error instanceof Error ? error.message : 'Unknown error',
      //   deviceType: /Mobile|Android|iPhone/.test(navigator.userAgent) ? 'mobile' : 'desktop',
      //   timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      //   language: navigator.language || 'unknown',
      // });

      return {
        success: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Scan error',
        ticket: undefined,
      };
    }
  };

  const handleDownloadTickets = async () => {
    if (!selectedEvent || !eventWithTickets.data) return;

    try {
      const dataStr = JSON.stringify(eventWithTickets.data.tickets, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tickets-${selectedEvent.id}-${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading tickets:', error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f6f3] font-sans">
        <Card className="p-8 max-w-md w-full rounded-3xl border-zinc-100 shadow-xl">
          <h1 className="text-2xl font-black mb-4 tracking-tight">Terminal Restafy</h1>
          <p className="text-zinc-500 font-medium mb-6">Veuillez vous connecter pour accéder au scanner</p>
          <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl" onClick={() => window.location.href = '/'}>
            Retour à l'Accueil
          </Button>
        </Card>
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-[#f8f6f3] p-4 lg:p-8 font-sans">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-zinc-900 border-l-4 border-orange-600 pl-3">Terminal - Événement</h1>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>

          {eventsList.isLoading ? (
            <Card className="p-8 text-center">
              <p className="text-gray-600">Chargement des événements...</p>
            </Card>
          ) : eventsList.data && eventsList.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eventsList.data.map(event => (
                <Card
                  key={event.id}
                  className="p-6 cursor-pointer hover:shadow-xl transition-all border-zinc-100 rounded-3xl group bg-white/80 backdrop-blur-sm"
                  onClick={() => setSelectedEvent({
                    id: event.id,
                    title: event.title,
                    location: event.location || undefined,
                    startTime: new Date(event.startTime),
                  })}
                >
                  <h3 className="text-lg font-bold mb-2 group-hover:text-orange-600 transition-colors">{event.title}</h3>
                  <p className="text-sm text-zinc-500 font-medium mb-2">{event.description}</p>
                  <p className="text-sm text-zinc-400 mb-1">📍 {event.location}</p>
                  <p className="text-xs font-bold text-zinc-400 mb-3 uppercase tracking-widest mt-4">
                    {event.scannedTickets} / {event.totalTickets} billets
                  </p>
                  <div className="w-full bg-zinc-100 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${event.totalTickets > 0 ? (event.scannedTickets / event.totalTickets) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-gray-600">Aucun événement disponible</p>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f3] p-4 lg:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 border-l-4 border-orange-600 pl-3">{selectedEvent.title}</h1>
                  {selectedEvent.location && <p className="text-gray-600 mt-1">📍 {selectedEvent.location}</p>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTickets}
              disabled={!eventWithTickets.data}
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger billets
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEvent(null)}
            >
              Changer d'événement
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scanner */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Scanner QR</h2>
              <QRScanner
                onScan={handleScan}
                eventId={selectedEvent.id}
                isOffline={!isOnline}
              />
            </Card>
          </div>

          {/* Stats Sidebar */}
          <div className="space-y-4">
            <Card className="p-6 bg-white border-zinc-100 rounded-3xl shadow-sm">
              <h3 className="font-bold text-lg mb-6">Statistiques</h3>
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Billets validés</p>
                  <p className="text-4xl font-black tracking-tight text-emerald-500">{eventStats.scannedTickets}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Capacité totale</p>
                  <p className="text-2xl font-black tracking-tight text-zinc-900">{eventStats.totalTickets}</p>
                </div>
                <div>
                  <div className="w-full bg-zinc-100 rounded-full h-2 mt-4">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${eventStats.scanPercentage}%` }}
                    />
                  </div>
                  <p className="text-xs font-bold text-zinc-500 mt-2">{eventStats.scanPercentage}% Rempli</p>
                </div>
              </div>
            </Card>

            {/* Sync Status */}
            <Card className={`p-4 border-2 rounded-2xl shadow-sm ${
              isOnline ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-200'
            }`}>
              <p className={`text-sm font-bold flex items-center ${
                isOnline ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {isOnline ? '✓ Réseau Connecté' : '⚠ Mode Hors-ligne'}
              </p>
              {pendingScans > 0 && (
                <p className="text-xs font-bold text-amber-600 mt-2">{pendingScans} scan(s) en attente...</p>
              )}
              {isSyncing && (
                <p className="text-xs font-bold text-orange-600 mt-2">Synchronisation en cours...</p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-4 font-bold border-zinc-200 hover:bg-zinc-100"
                onClick={performSync}
                disabled={isSyncing || isOnline}
              >
                {isSyncing ? 'Synchronisation...' : 'Synchroniser'}
              </Button>
            </Card>
          </div>
        </div>

        {/* Dashboard */}
        <div className="mt-8">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Tableau de bord</h2>
            <ScanDashboard
              eventId={selectedEvent.id}
              isOnline={isOnline}
              pendingScans={pendingScans}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
