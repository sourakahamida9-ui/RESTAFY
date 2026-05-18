import { useEffect, useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import {
  getPendingSyncs,
  markScansAsSynced,
  getPendingSyncQueueItems,
  updateSyncQueueItem,
} from '@/lib/db';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingScans: number;
  lastSyncTime?: Date;
  syncError?: string;
}

/**
 * Hook to manage offline sync and bidirectional synchronization
 */
export function useOfflineSync(eventId: number) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingScans: 0,
  });

  const syncOfflineScans = trpc.scan.syncOfflineScans.useMutation();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      performSync();
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Perform sync operation
  const performSync = useCallback(async () => {
    if (syncStatus.isSyncing) return;

    setSyncStatus(prev => ({ ...prev, isSyncing: true, syncError: undefined }));

    try {
      // Get pending scans from IndexedDB
      const pendingScans = await getPendingSyncs();

      if (pendingScans.length === 0) {
        setSyncStatus(prev => ({
          ...prev,
          isSyncing: false,
          pendingScans: 0,
          lastSyncTime: new Date(),
        }));
        return;
      }

      // Sync to server
      const result = await syncOfflineScans.mutateAsync({
        eventId,
        scans: pendingScans.map(scan => ({
          qrCodeData: scan.qrCodeData,
          scannedAt: scan.scannedAt,
          scanTimeMs: scan.scanTimeMs,
          deviceType: scan.deviceType,
        })),
      });

      // Mark successfully synced scans
      const successfulScanIds = pendingScans
        .filter(scan => result.results.find(r => r.qrCodeData === scan.qrCodeData && r.success))
        .map(scan => scan.id!)
        .filter(id => id > 0);

      if (successfulScanIds.length > 0) {
        await markScansAsSynced(successfulScanIds);
      }

      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        pendingScans: result.failed,
        lastSyncTime: new Date(),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        syncError: errorMessage,
      }));
    }
  }, [eventId, syncStatus.isSyncing, syncOfflineScans]);

  // Update pending scans count
  useEffect(() => {
    const updatePendingCount = async () => {
      const pending = await getPendingSyncs();
      setSyncStatus(prev => ({ ...prev, pendingScans: pending.length }));
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    ...syncStatus,
    performSync,
  };
}

/**
 * Hook to register Background Sync API for automatic sync
 */
export function useBackgroundSync(eventId: number) {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
      console.warn('Background Sync API not supported');
      return;
    }

    const registerSync = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register(`qr-scan-sync-${eventId}`);
      } catch (error) {
        console.error('Failed to register background sync:', error);
      }
    };

    registerSync();
  }, [eventId]);
}
