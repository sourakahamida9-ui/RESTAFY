# Dashboard Redesign - Guide de Restructuration Restafy

## Principes appliqués (Suivant le guide UX/UI Cotonou)

### 1. Mobile First - 80% des utilisateurs
- Navigation en **barre du bas** (5 icônes max)
- Interface optimisée pour **connexion 3G instable**
- Texte minimum **16px** pour lisibilité
- Boutons **48px minimum** pour pouce
- **Pas de scrolling horizontal**

### 2. Écran Commandes - Le cœur de l'app
**Caractéristiques:**
- 3 compteurs en haut: En attente, Préparation, CA du jour
- Chaque commande visible en **3 secondes**
- Statut avec couleur claire: jaune=nouvelle, orange=prep, vert=prête
- **2 boutons seulement** par commande
- Pas de menus déroulants, pas de popups
- Changement statut en **1 tap**

**Structure:**
```
┌─────────────────────────────┐
│  EN ATTENTE  │  PREP  │  CA │
├─────────────────────────────┤
│ #001  CLIENT  │ 2000F  │JAUNE
│ [Détails...]  │        │
│ [Accepter] [Refuser]   │
├─────────────────────────────┤
│ #002  CLIENT  │ 1500F  │ORANGE
│ [Détails...]  │        │
│ [Prête]       │        │
└─────────────────────────────┘
```

### 3. Navigation Mobile Bottom Nav
**Ordre recommandé:**
1. Commandes 🛒 (avec badge nombre en attente)
2. Menu 🍽️
3. Caisse POS 💳
4. Événements 📅
5. Paramètres ⚙️

**Bonus:** Menu secondaire avec "Plus" → Équipe, Analytics, Promos

### 4. Caisse POS - Approche Clavier
**Design:**
- Menu en **grille** à gauche (2-3 colonnes sur mobile)
- Résumé commande à **droite** (ou bas sur mobile)
- **1 tap** ajoute un article
- **Long press** enlève l'article
- Total **toujours visible**
- Bouton **"Encaisser"** orange, grand, centré

**Feedback:**
- Chaque tap donne réponse en < 200ms
- Animation pour ajouter/retirer
- Spinner si ça charge
- Message vert si succès

### 5. Paramètres - Sections claires
**Organisations:**
- Section 1: Mon restaurant
- Section 2: Livraison
- Section 3: Paiements
- Section 4: Équipe
- Section 5: Sécurité

**Chaque section = page séparée**
- Pas 20 champs sur une page
- Bouton "Enregistrer" sticky (toujours visible)
- Grisé si aucun changement
- Orange si modif non sauvegardée

## Fichiers créés

### 1. MobileBottomNav.tsx (90 lignes)
- Navigation en barre du bas
- 5 icônes avec labels
- Badge pour nombre commandes
- Responsive & accessible

### 2. OrdersDashboard.tsx (233 lignes)
- 3 compteurs: Attente, Préparation, CA
- Liste commandes avec statut couleur
- Click pour voir détails
- Dark mode kitchen-friendly
- Boutons d'action (Accepter/Refuser/Prête)

### 3. CaissePOS_Optimized.tsx (214 lignes)
- Grille menu à gauche
- Résumé commande à droite (responsive)
- Boutons +/- pour quantité
- Sélection méthode paiement
- Bouton "Encaisser" prominent

## Prochaines étapes

1. ✅ Créer MobileBottomNav
2. ✅ Créer OrdersDashboard optimisé
3. ✅ Créer CaissePOS optimisé
4. ⏳ Refactoriser AdminLayout pour utiliser MobileBottomNav
5. ⏳ Remplacer les anciens CaissePOS/Dashboard
6. ⏳ Optimiser Menu page
7. ⏳ Réorganiser Settings en sections

## Design tokens appliqués

- **Primaire:** Orange (#FF6B35 / #FF5722)
- **Fond:** Dark gray (#111827 - kitchen friendly)
- **Succès:** Green
- **En attente:** Yellow (#FCD34D)
- **Préparation:** Orange (#FB923C)
- **Prête:** Green (#10B981)
- **Erreur:** Red (#EF4444)

## Mesures de performance

- **Chargement progressif:** Skeletons d'abord
- **Feedback < 200ms:** Animations rapides
- **Texte lisible:** 16px min body, 14px min secondaire
- **Boutons:** 48px minimum de hauteur
- **Contraste:** WCAG AA minimum

## Messages en français local

- ✅ "Encaisser" vs "Payer" (familier)
- ✅ "En attente" vs "Pending" (local)
- ✅ "Prête" vs "Ready" (naturel)
- ✅ "CA du jour" vs "Daily Revenue" (local)
