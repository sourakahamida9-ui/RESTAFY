// src/hooks/usePOSKeyboard.ts
// Hook pour gerer les raccourcis clavier du POS

import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';

export interface POSKeyboardActions {
  onPayment?: () => void;
  onClearCart?: () => void;
  onToggleOrderType?: () => void;
  onSearch?: () => void;
  onLogout?: () => void;
  onPrint?: () => void;
  onNextItem?: () => void;
  onPrevItem?: () => void;
  onSelectItem?: (index: number) => void;
  onIncreaseQty?: () => void;
  onDecreaseQty?: () => void;
  onRemoveItem?: () => void;
  onNextCategory?: () => void;
  onPrevCategory?: () => void;
  onToggleFullscreen?: () => void;
  onQuickAmount?: (amount: number) => void;
  onHoldOrder?: () => void;
  onRecallOrder?: () => void;
  onOpenDrawer?: () => void;
  onPrintLastReceipt?: () => void;
}

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: keyof POSKeyboardActions;
}

export const POS_SHORTCUTS: KeyboardShortcut[] = [
  // Paiement et validation
  { key: 'F12', description: 'Payer / Valider', action: 'onPayment' },
  { key: 'Enter', ctrl: true, description: 'Payer rapidement', action: 'onPayment' },

  // Gestion du panier
  { key: 'Delete', description: 'Supprimer article selectionne', action: 'onRemoveItem' },
  { key: 'Escape', description: 'Annuler / Vider panier', action: 'onClearCart' },
  { key: '+', description: 'Augmenter quantite', action: 'onIncreaseQty' },
  { key: '-', description: 'Diminuer quantite', action: 'onDecreaseQty' },
  { key: 'ArrowUp', description: 'Article precedent', action: 'onPrevItem' },
  { key: 'ArrowDown', description: 'Article suivant', action: 'onNextItem' },

  // Navigation categories
  { key: 'ArrowLeft', description: 'Categorie precedente', action: 'onPrevCategory' },
  { key: 'ArrowRight', description: 'Categorie suivante', action: 'onNextCategory' },

  // Raccourcis articles (1-9)
  { key: '1', description: 'Ajouter article 1', action: 'onSelectItem' },
  { key: '2', description: 'Ajouter article 2', action: 'onSelectItem' },
  { key: '3', description: 'Ajouter article 3', action: 'onSelectItem' },
  { key: '4', description: 'Ajouter article 4', action: 'onSelectItem' },
  { key: '5', description: 'Ajouter article 5', action: 'onSelectItem' },
  { key: '6', description: 'Ajouter article 6', action: 'onSelectItem' },
  { key: '7', description: 'Ajouter article 7', action: 'onSelectItem' },
  { key: '8', description: 'Ajouter article 8', action: 'onSelectItem' },
  { key: '9', description: 'Ajouter article 9', action: 'onSelectItem' },

  // Recherche et navigation
  { key: 'F', ctrl: true, description: 'Rechercher', action: 'onSearch' },
  { key: '/', description: 'Rechercher', action: 'onSearch' },

  // Type de commande
  { key: 'T', ctrl: true, description: 'Changer type commande', action: 'onToggleOrderType' },

  // Impression et caisse
  { key: 'P', ctrl: true, description: 'Imprimer ticket', action: 'onPrint' },
  { key: 'F8', description: 'Imprimer dernier ticket', action: 'onPrintLastReceipt' },
  { key: 'F7', description: 'Ouvrir tiroir-caisse', action: 'onOpenDrawer' },

  // Commandes en attente
  { key: 'H', ctrl: true, description: 'Mettre en attente', action: 'onHoldOrder' },
  { key: 'R', ctrl: true, description: 'Rappeler commande', action: 'onRecallOrder' },

  // Montants rapides (Shift + numero)
  { key: '1', shift: true, description: '1000 FCFA', action: 'onQuickAmount' },
  { key: '2', shift: true, description: '2000 FCFA', action: 'onQuickAmount' },
  { key: '5', shift: true, description: '5000 FCFA', action: 'onQuickAmount' },

  // Systeme
  { key: 'F11', description: 'Plein ecran', action: 'onToggleFullscreen' },
  { key: 'L', ctrl: true, description: 'Deconnexion', action: 'onLogout' },
];

export function usePOSKeyboard(actions: POSKeyboardActions, enabled: boolean = true) {
  const [showHelp, setShowHelp] = useState(false);
  const [selectedCartIndex, setSelectedCartIndex] = useState(0);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Ignorer si on est dans un input (sauf certains raccourcis)
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

    // Afficher l'aide avec F1
    if (event.key === 'F1') {
      event.preventDefault();
      setShowHelp(prev => !prev);
      return;
    }

    const key = event.key;
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const alt = event.altKey;

    // Chercher le raccourci correspondant
    for (const shortcut of POS_SHORTCUTS) {
      const keyMatch = shortcut.key.toLowerCase() === key.toLowerCase();
      const ctrlMatch = !!shortcut.ctrl === ctrl;
      const shiftMatch = !!shortcut.shift === shift;
      const altMatch = !!shortcut.alt === alt;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        // Permettre certains raccourcis meme dans les inputs
        const allowInInput = ['onPayment', 'onClearCart', 'onLogout'].includes(shortcut.action);
        if (isInput && !allowInInput) continue;

        event.preventDefault();

        // Executer l'action
        const actionFn = actions[shortcut.action];
        if (actionFn) {
          // Cas special pour les selections d'articles
          if (shortcut.action === 'onSelectItem' && actions.onSelectItem) {
            const index = parseInt(key) - 1;
            actions.onSelectItem(index);
          }
          // Cas special pour les montants rapides
          else if (shortcut.action === 'onQuickAmount' && actions.onQuickAmount) {
            const amounts: Record<string, number> = { '1': 1000, '2': 2000, '5': 5000 };
            actions.onQuickAmount(amounts[key] || 0);
          }
          else {
            (actionFn as () => void)();
          }
        }
        return;
      }
    }

    // Raccourcis pour la navigation dans le panier (sans modificateurs)
    if (!isInput && !ctrl && !shift && !alt) {
      if (key === 'ArrowUp' && actions.onPrevItem) {
        event.preventDefault();
        setSelectedCartIndex(prev => Math.max(0, prev - 1));
        actions.onPrevItem();
      }
      if (key === 'ArrowDown' && actions.onNextItem) {
        event.preventDefault();
        setSelectedCartIndex(prev => prev + 1);
        actions.onNextItem();
      }
    }
  }, [actions, enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    showHelp,
    setShowHelp,
    selectedCartIndex,
    setSelectedCartIndex,
    shortcuts: POS_SHORTCUTS,
  };
}


// ✅ Le composant JSX KeyboardShortcutsHelp est dans KeyboardShortcutsHelp.tsx
// Re-export pour ne pas casser les imports existants
export { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';

export default usePOSKeyboard;