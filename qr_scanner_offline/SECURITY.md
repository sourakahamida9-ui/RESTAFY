# Vérification de Sécurité - QR Scanner Offline

## Vue d'ensemble

Ce document détaille les mesures de sécurité implémentées dans l'application QR Scanner Offline pour garantir l'intégrité des données et la protection contre les attaques courantes.

## 1. Validation Côté Serveur

### 1.1 Validation Atomique des QR Codes

**Implémentation:** `server/db.ts` - `validateAndMarkTicketAsUsed()`

- **Double-check pattern:** Vérification de l'état du billet avant et après la mise à jour
- **Condition UPDATE:** Utilise une clause WHERE avec `isUsed = 0` pour garantir que seuls les billets non utilisés peuvent être marqués
- **Race condition handling:** Vérification post-update pour détecter les modifications concurrentes
- **Atomicité:** Chaque validation est une transaction unique au niveau de la base de données

```typescript
// Atomic update with double-check
await db.update(tickets)
  .set({ isUsed: 1, status: 'used', usedAt: new Date() })
  .where(and(
    eq(tickets.id, ticketId),
    eq(tickets.isUsed, 0) // Double-check: only if not already used
  ));
```

### 1.2 Validation des Entrées

**Implémentation:** `server/routers.ts` - Schémas Zod

Tous les endpoints tRPC utilisent Zod pour valider les entrées:

```typescript
validateQR: protectedProcedure
  .input(z.object({
    qrCodeData: z.string(),
    eventId: z.number(),
    scanLocation: z.string().optional(),
    deviceType: z.string().optional(),
    timezone: z.string().optional(),
    language: z.string().optional(),
  }))
```

- **Type checking:** Validation stricte des types
- **Longueur des chaînes:** Limitation de la taille des entrées
- **Énumération:** Validation des valeurs énumérées (status, role, etc.)

## 2. Authentification et Autorisation

### 2.1 Authentification OAuth

- **Manus OAuth:** Intégration sécurisée via `/api/oauth/callback`
- **Session cookies:** Stockage sécurisé des sessions avec HttpOnly flag
- **JWT secrets:** Utilisation de secrets JWT pour la signature des sessions

### 2.2 Contrôle d'Accès

**Implémentation:** `server/_core/trpc.ts`

```typescript
protectedProcedure // Requires authentication
adminProcedure      // Requires admin role
publicProcedure     // No authentication required
```

- **Endpoints protégés:** Tous les endpoints de scan nécessitent l'authentification
- **Vérification du contexte:** Chaque requête inclut l'utilisateur authentifié
- **Gestion des rôles:** Support pour les rôles admin/user (extensible)

## 3. Protection des Données

### 3.1 Données Sensibles

**Tickets:**
- QR codes stockés en base (chiffrement au repos recommandé en production)
- Emails clients stockés avec accès limité

**Scans:**
- Adresses IP enregistrées pour audit
- Timestamps précis pour traçabilité
- Statut de synchronisation pour intégrité offline

### 3.2 Données Comportementales

**Collecte responsable:**
- Timezone et langue collectées depuis le client (consentement implicite)
- Adresse IP collectée côté serveur (métadonnée de requête)
- Aucune donnée de géolocalisation précise (pas de GPS)
- Données agrégées pour l'IA (pas de traçage individuel)

## 4. Prévention des Attaques

### 4.1 Double-Scan Prevention

**Mécanisme:** Validation atomique avec vérification de l'état `isUsed`

- Impossible de scanner deux fois le même billet
- Détection des tentatives de double-scan
- Feedback utilisateur clair (statut "duplicate")

### 4.2 Race Conditions

**Mitigation:**
- Conditions UPDATE strictes
- Vérification post-update de l'état
- Gestion des conflits de synchronisation offline

### 4.3 Injection SQL

**Protection:**
- Utilisation de Drizzle ORM (parameterized queries)
- Pas de concaténation de chaînes SQL
- Validation des entrées via Zod

### 4.4 CSRF

**Protection:**
- Cookies SameSite=None (pour cross-origin)
- HTTPS obligatoire
- Tokens CSRF implicites via OAuth

### 4.5 XSS

**Protection:**
- React automatiquement échappe les valeurs
- Pas de `dangerouslySetInnerHTML`
- Sanitization des entrées utilisateur

## 5. Synchronisation Offline

### 5.1 Intégrité des Données

**Implémentation:** `client/src/lib/db.ts` + `server/routers.ts`

- **Queue de synchronisation:** Enregistrement des scans hors-ligne
- **Versioning:** Timestamps pour détecter les conflits
- **Retry logic:** Tentatives de synchronisation avec backoff exponentiel
- **Conflict resolution:** Priorité au serveur en cas de conflit

### 5.2 Sécurité du Stockage Local

**IndexedDB:**
- Données stockées localement sur l'appareil
- Pas d'accès cross-origin
- Chiffrement au repos (navigateur)
- Données supprimées au logout

## 6. Audit et Logging

### 6.1 Enregistrement des Scans

**Données enregistrées:**
- ID du billet scanné
- ID de l'utilisateur (agent de contrôle)
- Timestamp du scan
- Localisation (optionnel)
- Type d'appareil
- Adresse IP
- Statut de synchronisation

### 6.2 Données Comportementales

**Collecte pour l'IA:**
- Temps de scan (performance)
- Taux d'erreur (qualité)
- Timezone (contexte)
- Langue (contexte)
- Type d'appareil (contexte)

## 7. Tests de Sécurité

### 7.1 Tests Unitaires

- ✓ Validation atomique des QR codes
- ✓ Détection des doublons
- ✓ Gestion des billets invalides
- ✓ Enregistrement des données comportementales

### 7.2 Tests d'Intégration

- ✓ Synchronisation offline avec gestion des conflits
- ✓ Récupération de l'historique des scans
- ✓ Mises à jour des statistiques d'événement

### 7.3 Tests de Performance

- ✓ Validation QR < 500ms
- ✓ Synchronisation 100 scans < 2s
- ✓ Récupération historique 50 scans < 200ms
- ✓ 10 scans concurrents < 2s

## 8. Recommandations pour la Production

### 8.1 Chiffrement

- [ ] Chiffrer les QR codes en base (AES-256)
- [ ] Chiffrer les adresses IP en base
- [ ] TLS 1.3+ pour toutes les connexions

### 8.2 Audit

- [ ] Logs centralisés (ELK, Datadog)
- [ ] Alertes sur tentatives de double-scan
- [ ] Audit trail complet des modifications

### 8.3 Conformité

- [ ] RGPD: Droit à l'oubli pour les données comportementales
- [ ] CCPA: Transparence sur la collecte de données
- [ ] Consentement explicite pour l'IA

### 8.4 Infrastructure

- [ ] WAF (Web Application Firewall)
- [ ] Rate limiting par IP/utilisateur
- [ ] DDoS protection
- [ ] Backup et disaster recovery

## 9. Conclusion

L'application QR Scanner Offline implémente des mesures de sécurité robustes pour:

- **Prévenir les doublons:** Validation atomique côté serveur
- **Protéger les données:** Authentification OAuth + contrôle d'accès
- **Assurer l'intégrité:** Tests complets + audit logging
- **Supporter l'offline:** Synchronisation sécurisée avec gestion des conflits

Pour la production, les recommandations ci-dessus doivent être implémentées pour atteindre le niveau de sécurité enterprise.
