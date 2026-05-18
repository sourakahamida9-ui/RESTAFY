// Restafy types — types primitifs proviennent de @restafy/shared (monorepo).
// Les types liés à des libs front (lucide-react pour LoyaltyLevel) restent locaux.
export * from '@restafy/shared/types';
export * from './loyalty';
// NE PAS ré-exporter src/types.ts ici pour éviter les conflits
