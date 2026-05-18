// src/hooks/KeyboardShortcutsHelp.tsx
// ✅ Séparé de usePOSKeyboard.ts car JSX doit être dans un .tsx

import React from 'react';
import { POS_SHORTCUTS, KeyboardShortcut } from './usePOSKeyboard';

export function KeyboardShortcutsHelp({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const groupedShortcuts = {
    'Paiement': POS_SHORTCUTS.filter(s => ['onPayment'].includes(s.action)),
    'Panier': POS_SHORTCUTS.filter(s => ['onRemoveItem', 'onClearCart', 'onIncreaseQty', 'onDecreaseQty', 'onPrevItem', 'onNextItem'].includes(s.action)),
    'Navigation': POS_SHORTCUTS.filter(s => ['onPrevCategory', 'onNextCategory', 'onSearch', 'onToggleOrderType'].includes(s.action)),
    'Articles rapides': POS_SHORTCUTS.filter(s => s.action === 'onSelectItem').slice(0, 4),
    'Impression': POS_SHORTCUTS.filter(s => ['onPrint', 'onPrintLastReceipt', 'onOpenDrawer'].includes(s.action)),
    'Commandes': POS_SHORTCUTS.filter(s => ['onHoldOrder', 'onRecallOrder'].includes(s.action)),
    'Systeme': POS_SHORTCUTS.filter(s => ['onToggleFullscreen', 'onLogout'].includes(s.action)),
  };

  const formatKey = (shortcut: KeyboardShortcut) => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key);
    return parts.join(' + ');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-zinc-900 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-zinc-800">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-wider">Raccourcis Clavier</h2>
            <p className="text-zinc-500 text-sm">Appuyez sur F1 pour afficher/masquer</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
          >
            ✕
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto grid grid-cols-2 gap-6">
          {Object.entries(groupedShortcuts).map(([group, shortcuts]) => (
            <div key={group} className="space-y-3">
              <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest">{group}</h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between bg-zinc-800/50 px-3 py-2 rounded-xl">
                    <span className="text-sm text-zinc-300">{shortcut.description}</span>
                    <kbd className="px-2 py-1 bg-zinc-700 rounded-lg text-xs font-mono text-emerald-400 font-bold">
                      {formatKey(shortcut)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-zinc-800/50 border-t border-zinc-800 text-center">
          <p className="text-xs text-zinc-500">
            Astuce : Les touches 1-9 ajoutent rapidement les articles affichés
          </p>
        </div>
      </div>
    </div>
  );
}