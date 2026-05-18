import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { AlertCircle, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface QRScanResult {
  success: boolean;
  status: 'success' | 'duplicate' | 'invalid' | 'error';
  message: string;
  ticket?: {
    ticketNumber: string;
    customerName: string;
    customerEmail?: string;
  };
}

interface QRScannerProps {
  onScan: (qrCodeData: string) => Promise<QRScanResult>;
  eventId: number;
  isOffline?: boolean;
}

/**
 * QR Scanner component with html5-qrcode
 * Provides real-time QR code scanning with visual feedback
 */
export function QRScanner({ onScan, eventId, isOffline = false }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<QRScanResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);
  const lastScannedRef = useRef<string>('');
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scanCount, setScanCount] = useState(0);

  useEffect(() => {
    const initScanner = async () => {
      try {
        scannerRef.current = new Html5QrcodeScanner(
          'qr-scanner-container',
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false,
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
          },
          false
        );

        await scannerRef.current.render(
          async (decodedText) => {
            const code = decodedText.trim();
            if (processingRef.current) return;
            if (code === lastScannedRef.current) return;
            lastScannedRef.current = code;
            processingRef.current = true;
            setIsProcessing(true);
            try {
              const result = await onScanRef.current(code);
              setLastScan(result);
              setScanCount(prev => prev + 1);

              if (result.success) {
                await scannerRef.current?.pause();
                setTimeout(() => {
                  scannerRef.current?.resume();
                }, 3000);
              }
            } catch (error) {
              setLastScan({
                success: false,
                status: 'error',
                message: error instanceof Error ? error.message : 'Scan error',
              });
            } finally {
              processingRef.current = false;
              setIsProcessing(false);
              if (cooldownRef.current) clearTimeout(cooldownRef.current);
              cooldownRef.current = setTimeout(() => {
                if (lastScannedRef.current === code) lastScannedRef.current = '';
                cooldownRef.current = null;
              }, 5000);
            }
          },
          (error) => {
            console.debug('QR scan error:', error);
          }
        );

        setIsScanning(true);
      } catch (error) {
        console.error('Failed to initialize QR scanner:', error);
        setLastScan({
          success: false,
          status: 'error',
          message: 'Failed to initialize camera',
        });
      }
    };

    initScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'duplicate':
        return 'bg-orange-50 border-orange-200';
      case 'invalid':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'duplicate':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'invalid':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Scanner Container */}
      <Card className="overflow-hidden bg-black">
        <div id="qr-scanner-container" className="w-full" style={{ minHeight: '400px' }} />
      </Card>

      {/* Offline Indicator */}
      {isOffline && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-orange-600" />
          <span className="text-sm text-orange-700 font-medium">Mode hors-ligne - Les scans seront synchronisés</span>
        </div>
      )}

      {/* Scan Status Feedback */}
      {lastScan && (
        <Card className={`p-4 border-2 ${getStatusColor(lastScan.status)}`}>
          <div className="flex items-start gap-3">
            {isProcessing ? (
              <Loader2 className="w-5 h-5 text-gray-600 animate-spin mt-0.5" />
            ) : (
              getStatusIcon(lastScan.status)
            )}
            <div className="flex-1">
              <p className="font-semibold text-sm">{lastScan.message}</p>
              {lastScan.ticket && (
                <div className="mt-2 text-sm space-y-1">
                  <p className="text-gray-700">
                    <span className="font-medium">Billet:</span> {lastScan.ticket.ticketNumber}
                  </p>
                  <p className="text-gray-700">
                    <span className="font-medium">Client:</span> {lastScan.ticket.customerName}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Scan Counter */}
      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <span className="text-sm font-medium text-blue-900">Billets scannés</span>
        <span className="text-2xl font-bold text-blue-600">{scanCount}</span>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            if (scannerRef.current) {
              if (isScanning) {
                scannerRef.current.pause();
                setIsScanning(false);
              } else {
                scannerRef.current.resume();
                setIsScanning(true);
              }
            }
          }}
          className="flex-1"
        >
          {isScanning ? 'Pause' : 'Reprendre'}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setLastScan(null);
            setScanCount(0);
          }}
          className="flex-1"
        >
          Réinitialiser
        </Button>
      </div>
    </div>
  );
}
