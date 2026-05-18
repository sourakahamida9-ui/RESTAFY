# QR Scanner Offline - TODO

## Phase 1 : Schéma de Base de Données
- [x] Créer table `events` (id, title, description, start_time, end_time, location, capacity, created_at)
- [x] Créer table `tickets` (id, event_id, ticket_number, qr_code_data, customer_name, status, created_at)
- [x] Créer table `scan_history` (id, ticket_id, event_id, scanned_by, scanned_at, scan_location, device_type, offline_sync_status)
- [x] Créer table `scan_analytics` (id, event_id, scan_date, total_scans, valid_scans, duplicate_scans, invalid_scans, avg_scan_time_ms)
- [x] Créer table `behavioral_data` pour les données comportementales
- [x] Créer table `offline_sync_queue` pour la synchronisation

## Phase 2 : Procédures tRPC Serveur
- [x] Implémenter `events.list` - récupérer les événements actifs
- [x] Implémenter `events.getWithTickets` - télécharger les billets pour un événement (mode offline)
- [x] Implémenter `tickets.validateQR` - validation atomique du QR code
- [x] Implémenter `scan.syncOfflineScans` - synchroniser les scans hors-ligne
- [x] Implémenter `scan.getHistory` - récupérer l'historique des scans
- [x] Implémenter `scan.recordBehavior` - enregistrer les données comportementales

## Phase 3 : Infrastructure Offline
- [x] Créer service IndexedDB pour stocker les billets localement
- [x] Créer service IndexedDB pour stocker les scans hors-ligne
- [x] Créer hook `useOfflineSync` pour gérer la synchronisation bidirectionnelle
- [x] Implémenter Service Worker pour le caching et la synchronisation
- [x] Implémenter Background Sync API pour la synchronisation automatique

## Phase 4 : Interface Utilisateur
- [x] Créer composant `QRScanner` avec html5-qrcode
- [x] Créer composant `ScanDashboard` avec compteur et historique
- [x] Créer page `Scanner` avec scanner et tableau de bord
- [x] Implémenter transitions fluides et animations
- [x] Créer page Home avec navigation
- [x] Intégrer les routes dans App.tsx

## Phase 5 : Collecte de Données Comportementales
- [x] Implémenter collecte du temps de scan
- [x] Implémenter collecte du taux d'erreur
- [x] Implémenter collecte de la géolocalisation indirecte (IP, timezone, language)
- [x] Créer table `behavioral_data` pour stocker les données comportementales
- [x] Implémenter procédure tRPC pour envoyer les données comportementales

## Phase 6 : Tests et Optimisations
- [x] Tests unitaires pour les procédures tRPC
- [x] Tests d'intégration pour la synchronisation offline
- [x] Tests de performance du scanner QR
- [x] Optimisation des performances et du bundle size
- [x] Vérification de la sécurité (validation côté serveur, RLS)
- [x] Déploiement et checkpoint final
