import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid, 
  ShoppingCart, 
  CreditCard, 
  LogOut, 
  Wifi, 
  WifiOff, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ChevronRight,
  Utensils,
  ShoppingBag,
  Truck,
  History,
  Lock,
  Printer,
  CheckCircle2,
  X,
  AlertCircle,
  Keyboard,
  Maximize2,
  Pause,
  Play
} from 'lucide-react';
import { usePOSStore } from '../store/usePOSStore';
import { useRestaurantStore } from '../store/useRestaurantStore';
import type { POSOrderType as OrderType, POSPaymentMethod as PaymentMethod } from '../types';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '../lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { usePOSKeyboard, KeyboardShortcutsHelp } from '../hooks/usePOSKeyboard';
import { toast } from 'sonner';

// --- Components ---

const PINLogin = ({ onLogin }: { onLogin: (pin: string) => Promise<boolean> }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKey = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => setPin(prev => prev.slice(0, -1));

  useEffect(() => {
    if (pin.length === 4) {
      onLogin(pin).then(success => {
        if (!success) {
          setError(true);
          setPin('');
          setTimeout(() => setError(false), 1000);
        }
      });
    }
  }, [pin, onLogin]);

  return (
    <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center z-50">
      <div className="w-full max-w-sm p-8 flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-widest mt-4">RESTAFY POS</h1>
          <p className="text-zinc-500 text-sm font-medium">Entrez votre code PIN caissier</p>
        </div>

        <div className="flex gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i} 
              className={cn(
                "w-4 h-4 rounded-full border-2 transition-all duration-200",
                pin.length > i ? "bg-emerald-500 border-emerald-500 scale-110" : "border-zinc-800",
                error && "bg-red-500 border-red-500 animate-shake"
              )}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => handleKey(n.toString())}
              className="h-20 bg-zinc-900 hover:bg-zinc-800 text-white text-2xl font-bold rounded-2xl transition-colors active:scale-95"
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleKey('0')}
            className="h-20 bg-zinc-900 hover:bg-zinc-800 text-white text-2xl font-bold rounded-2xl transition-colors active:scale-95"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-20 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 text-xl font-bold rounded-2xl transition-colors active:scale-95 flex items-center justify-center"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

const ReceiptModal = ({ orderId, onClose }: { orderId: string; onClose: () => void }) => {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white text-black w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="p-8 flex flex-col items-center gap-4 overflow-y-auto max-h-[80vh] print:p-0 print:max-h-none">
          {/* ASCII Logo */}
          <pre className="text-[8px] leading-[1] font-mono whitespace-pre text-center">
{`
  ____  _____ ____ _____  _  _____ _   _ 
 |  _ \\| ____/ ___|_   _|/ \\|  ___| \\ | |
 | |_) |  _| \\___ \\ | | / _ \\ |_  |  \\| |
 |  _ <| |___ ___) || |/ ___ \\  _| | |\\  |
 |_| \\_\\_____|____/ |_/_/   \\_\\_|   |_| \\_|
`}
          </pre>
          
          <div className="text-center border-b border-dashed border-zinc-300 w-full pb-4">
            <h2 className="font-bold text-xl uppercase tracking-widest">REÇU DE CAISSE</h2>
            <p className="text-xs text-zinc-500 mt-1">ID: {orderId}</p>
            <p className="text-xs text-zinc-500">{new Date().toLocaleString('fr-FR')}</p>
          </div>

          <div className="w-full space-y-2 py-4 border-b border-dashed border-zinc-300">
            <div className="flex justify-between text-sm font-bold">
              <span>ARTICLE</span>
              <span>TOTAL</span>
            </div>
            {/* Mock items for receipt preview */}
            <div className="flex justify-between text-sm">
              <span>1x Burger Royal</span>
              <span>4 500 FCFA</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>2x Jus d'Orange</span>
              <span>2 000 FCFA</span>
            </div>
          </div>

          <div className="w-full space-y-1 py-4">
            <div className="flex justify-between text-lg font-black">
              <span>TOTAL</span>
              <span>6 500 FCFA</span>
            </div>
            <div className="flex justify-between text-xs text-zinc-500">
              <span>MÉTHODE</span>
              <span>ESPECES</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 pt-4">
            <QRCodeSVG value={orderId} size={100} />
            <div className="text-center bg-zinc-100 p-3 rounded-2xl w-full">
              <p className="text-[10px] font-bold uppercase text-zinc-500">Fidélité Restafy</p>
              <p className="text-sm font-black text-emerald-600">+250 points gagnés !</p>
              <p className="text-xs font-medium">Total: 8 750 pts</p>
            </div>
            <p className="text-[10px] text-zinc-400 italic">Merci de votre visite !</p>
          </div>
        </div>

        <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex gap-3 print:hidden">
          <button 
            onClick={onClose}
            className="flex-1 h-12 rounded-xl font-bold text-zinc-500 hover:bg-zinc-200 transition-colors"
          >
            Fermer
          </button>
          <button 
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex-[2] h-12 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors"
          >
            <Printer className="w-5 h-5" />
            {isPrinting ? 'Impression...' : 'Imprimer Reçu'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const PaymentModal = ({ total, onComplete, onClose }: { total: number; onComplete: (method: PaymentMethod, received?: number) => void; onClose: () => void }) => {
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [received, setReceived] = useState('');
  const change = method === 'cash' ? (parseFloat(received) || 0) - total : 0;

  const handleComplete = () => {
    if (method) {
      onComplete(method, parseFloat(received));
    }
  };

  const ussdCodes = {
    'ussd-mtn': '*880*',
    'ussd-moov': '*155*',
    'ussd-celtiis': '*123*'
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-zinc-900 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-zinc-800"
      >
        <div className="p-8 flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-widest">PAIEMENT</h2>
              <p className="text-zinc-500 font-medium">Sélectionnez le mode de règlement</p>
            </div>
            <div className="text-right">
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">À PAYER</p>
              <p className="text-4xl font-black text-emerald-500">{total.toLocaleString()} FCFA</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { id: 'cash', label: 'Espèces', icon: CreditCard, color: 'bg-emerald-500' },
              { id: 'ussd-mtn', label: 'MTN MoMo', icon: Wifi, color: 'bg-yellow-500' },
              { id: 'ussd-moov', label: 'Moov Money', icon: Wifi, color: 'bg-blue-500' },
              { id: 'ussd-celtiis', label: 'Celtiis', icon: Wifi, color: 'bg-red-500' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id as PaymentMethod)}
                className={cn(
                  "p-6 rounded-3xl flex flex-col items-center gap-3 transition-all border-2",
                  method === m.id 
                    ? "bg-zinc-800 border-emerald-500 scale-105" 
                    : "bg-zinc-800/50 border-transparent hover:bg-zinc-800"
                )}
              >
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", m.color)}>
                  <m.icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-bold text-white">{m.label}</span>
              </button>
            ))}
          </div>

          {method === 'cash' && (
            <div className="bg-zinc-800/50 p-6 rounded-3xl space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">MONTANT REÇU</label>
                <input
                  type="number"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  placeholder="Entrez le montant..."
                  className="bg-zinc-900 border-2 border-zinc-800 rounded-2xl p-4 text-2xl font-black text-white focus:border-emerald-500 outline-none w-full"
                  autoFocus
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 font-bold">MONNAIE À RENDRE</span>
                <span className={cn(
                  "text-3xl font-black",
                  change >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {change.toLocaleString()} FCFA
                </span>
              </div>
            </div>
          )}

          {method && method.startsWith('ussd') && (
            <div className="bg-zinc-800/50 p-8 rounded-3xl flex flex-col items-center gap-6 text-center">
              <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border-4 border-emerald-500/20">
                <Wifi className="w-10 h-10 text-emerald-500" />
              </div>
              <div>
                <p className="text-zinc-400 font-medium mb-2">Demandez au client de composer :</p>
                <p className="text-5xl font-black text-white tracking-tighter">
                  {ussdCodes[method as keyof typeof ussdCodes]}...#
                </p>
              </div>
              <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-full">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Attente de confirmation manuelle</span>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 h-16 rounded-2xl font-bold text-zinc-500 hover:bg-zinc-800 transition-colors"
            >
              Annuler
            </button>
            <button
              disabled={!method || (method === 'cash' && change < 0)}
              onClick={handleComplete}
              className="flex-[2] h-16 bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95"
            >
              VALIDER LA COMMANDE
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main Page ---

export default function POSPage() {
  const { 
    session, 
    login, 
    logout, 
    cart, 
    addToCart, 
    removeFromCart, 
    updateQuantity,
    updateItemNotes,
    currentOrder,
    setOrderType,
    setTableNumber,
    selectedCategory,
    setCategory,
    completeOrder,
    isOffline,
    setOffline
  } = usePOSStore();

  const { profile } = useAuth();
  const { menuItems, loading: menuLoading, error: menuError, fetchMenuForRestaurant } = useRestaurantStore();
  const [showPayment, setShowPayment] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCartIndex, setSelectedCartIndex] = useState(0);
  const [heldOrders, setHeldOrders] = useState<any[]>([]);
  const [showHeldOrders, setShowHeldOrders] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const restaurantId = profile?.restaurant_id;

  useEffect(() => {
    if (!session || !restaurantId) return;
    void fetchMenuForRestaurant(restaurantId);
  }, [session, restaurantId, fetchMenuForRestaurant]);

  useEffect(() => {
    if (menuError) toast.error(menuError);
  }, [menuError]);

  // Catégories et filtres (données alignées sur Supabase : category + is_available)
  const categories = useMemo(
    () => Array.from(new Set(menuItems.map((item) => item.category).filter(Boolean))),
    [menuItems],
  );
  const filteredItems = useMemo(
    () =>
      menuItems.filter((item) => {
        const matchesCategory = !selectedCategory || item.category === selectedCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch && item.is_available;
      }),
    [menuItems, selectedCategory, searchQuery],
  );
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Raccourcis clavier
  const { showHelp, setShowHelp, shortcuts } = usePOSKeyboard({
    onPayment: () => {
      if (cart.length > 0) {
        setShowPayment(true);
        toast.success('Mode paiement active (F12)', { duration: 1500 });
      } else {
        toast.error('Panier vide!');
      }
    },
    onClearCart: () => {
      if (cart.length > 0) {
        cart.forEach(item => removeFromCart(item.id));
        toast.info('Panier vide');
      }
    },
    onToggleOrderType: () => {
      const types: OrderType[] = ['dine-in', 'takeaway', 'delivery'];
      const currentIdx = types.indexOf(currentOrder.type);
      const nextType = types[(currentIdx + 1) % types.length];
      setOrderType(nextType);
      toast.info(`Type: ${nextType === 'dine-in' ? 'Sur place' : nextType === 'takeaway' ? 'A emporter' : 'Livraison'}`);
    },
    onSearch: () => {
      searchInputRef.current?.focus();
    },
    onLogout: () => {
      if (cart.length === 0) {
        logout();
      } else {
        toast.error('Finalisez ou videz le panier avant de vous deconnecter');
      }
    },
    onPrint: () => {
      if (lastOrderId) {
        window.print();
      } else {
        toast.error('Aucun ticket a imprimer');
      }
    },
    onNextItem: () => {
      setSelectedCartIndex(prev => Math.min(cart.length - 1, prev + 1));
    },
    onPrevItem: () => {
      setSelectedCartIndex(prev => Math.max(0, prev - 1));
    },
    onSelectItem: (index: number) => {
      const picked = filteredItems[index];
      if (picked) {
        addToCart({ id: picked.id, name: picked.name, price: picked.price });
        toast.success(`${picked.name} ajoute`);
      }
    },
    onIncreaseQty: () => {
      if (cart[selectedCartIndex]) {
        updateQuantity(cart[selectedCartIndex].id, 1);
      }
    },
    onDecreaseQty: () => {
      if (cart[selectedCartIndex]) {
        updateQuantity(cart[selectedCartIndex].id, -1);
      }
    },
    onRemoveItem: () => {
      if (cart[selectedCartIndex]) {
        removeFromCart(cart[selectedCartIndex].id);
        setSelectedCartIndex(prev => Math.max(0, prev - 1));
      }
    },
    onNextCategory: () => {
      const currentIdx = selectedCategory ? categories.indexOf(selectedCategory) : -1;
      const nextIdx = (currentIdx + 1) % (categories.length + 1);
      setCategory(nextIdx === 0 ? null : categories[nextIdx - 1] as string);
    },
    onPrevCategory: () => {
      const currentIdx = selectedCategory ? categories.indexOf(selectedCategory) : 0;
      const prevIdx = currentIdx <= 0 ? categories.length : currentIdx - 1;
      setCategory(prevIdx === 0 ? null : categories[prevIdx - 1] as string);
    },
    onToggleFullscreen: () => {
      if (!document.fullscreenElement && containerRef.current) {
        containerRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    },
    onHoldOrder: () => {
      if (cart.length > 0) {
        setHeldOrders(prev => [...prev, { cart: [...cart], type: currentOrder.type, tableNumber: currentOrder.tableNumber }]);
        cart.forEach(item => removeFromCart(item.id));
        toast.success('Commande mise en attente (Ctrl+H)');
      }
    },
    onRecallOrder: () => {
      if (heldOrders.length > 0) {
        setShowHeldOrders(true);
      } else {
        toast.info('Aucune commande en attente');
      }
    },
    onOpenDrawer: () => {
      toast.info('Signal tiroir-caisse envoye');
      // TODO: Integrer avec le materiel
    },
    onPrintLastReceipt: () => {
      if (lastOrderId) {
        setLastOrderId(lastOrderId); // Force re-render du receipt
        window.print();
      }
    },
  }, !!session);

  // Sync online status
  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOffline]);

  if (!session) {
    return <PINLogin onLogin={login} />;
  }

  if (!restaurantId) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center z-50 p-8 text-center">
        <AlertCircle className="w-14 h-14 text-amber-500 mb-4" aria-hidden />
        <h1 className="text-xl font-black text-white uppercase tracking-widest">POS indisponible</h1>
        <p className="text-zinc-400 text-sm mt-2 max-w-md">
          Aucun restaurant n’est associé à votre compte. Connectez-vous avec un profil lié à un établissement, ou
          ouvrez le POS depuis le tableau de bord restaurant.
        </p>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-8 px-6 py-3 rounded-2xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700"
        >
          Déconnexion
        </button>
      </div>
    );
  }

  const handleCompletePayment = async (method: PaymentMethod, received?: number) => {
    const orderId = await completeOrder(method, received);
    setLastOrderId(orderId);
    setShowPayment(false);
    toast.success('Paiement valide!');
  };

  const recallHeldOrder = (index: number) => {
    const held = heldOrders[index];
    if (held) {
      held.cart.forEach((line: { id: string; name: string; price: number; quantity: number }) => {
        for (let i = 0; i < line.quantity; i++) {
          addToCart({ id: line.id, name: line.name, price: line.price });
        }
      });
      setOrderType(held.type);
      if (held.tableNumber) setTableNumber(held.tableNumber);
      setHeldOrders(prev => prev.filter((_, i) => i !== index));
      setShowHeldOrders(false);
      toast.success('Commande rappelee');
    }
  };

  return (
    <div ref={containerRef} className="h-screen bg-zinc-950 flex flex-col overflow-hidden select-none relative">
      {menuLoading && (
        <div
          className="absolute inset-0 z-[45] bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3"
          aria-busy="true"
          aria-label="Chargement du menu"
        >
          <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-zinc-300">Chargement du menu…</p>
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Held Orders Modal */}
      {showHeldOrders && heldOrders.length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 w-full max-w-md rounded-3xl overflow-hidden border border-zinc-800"
          >
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Pause className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-black text-white">Commandes en attente</h3>
              </div>
              <button onClick={() => setShowHeldOrders(false)} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {heldOrders.map((held, i) => (
                <button
                  key={i}
                  onClick={() => recallHeldOrder(i)}
                  className="w-full p-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-left transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-400 uppercase">
                      {held.type === 'dine-in' ? 'Sur place' : held.type === 'takeaway' ? 'A emporter' : 'Livraison'}
                      {held.tableNumber && ` - Table ${held.tableNumber}`}
                    </span>
                    <span className="text-emerald-500 font-black">
                      {held.cart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0).toLocaleString()} F
                    </span>
                  </div>
                  <p className="text-sm text-white">{held.cart.length} article{held.cart.length > 1 ? 's' : ''}</p>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b border-zinc-900 px-6 flex items-center justify-between bg-zinc-950/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Utensils className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-black text-white uppercase tracking-widest text-sm">RESTAFY POS</h1>
          </div>
          <div className="h-6 w-px bg-zinc-800" />
          <div className="flex items-center gap-2 text-zinc-400">
            <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center">
              <span className="text-xs font-black">{session.cashierName[0]}</span>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">{session.cashierName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Held orders indicator */}
          {heldOrders.length > 0 && (
            <button
              onClick={() => setShowHeldOrders(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all"
            >
              <Pause className="w-3 h-3" />
              {heldOrders.length} en attente
            </button>
          )}
          
          {/* Keyboard shortcuts help */}
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 text-zinc-500 hover:text-emerald-500 hover:bg-zinc-900 rounded-xl transition-all"
            title="Raccourcis clavier (F1)"
          >
            <Keyboard className="w-5 h-5" />
          </button>
          
          {/* Fullscreen */}
          <button
            onClick={() => {
              if (!document.fullscreenElement && containerRef.current) {
                containerRef.current.requestFullscreen();
              } else {
                document.exitFullscreen();
              }
            }}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-xl transition-all"
            title="Plein ecran (F11)"
          >
            <Maximize2 className="w-5 h-5" />
          </button>

          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
            isOffline ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
          )}>
            {isOffline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
            {isOffline ? 'Hors-ligne' : 'Connecte'}
          </div>
          <button 
            onClick={logout}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-xl transition-all"
            title="Deconnexion (Ctrl+L)"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Categories (15%) */}
        <aside className="w-48 border-r border-zinc-900 bg-zinc-950/30 min-h-0 overflow-y-auto p-4 flex flex-col gap-3 shrink-0">
          <button
            onClick={() => setCategory(null)}
            className={cn(
              "p-4 rounded-2xl text-left transition-all flex flex-col gap-2",
              !selectedCategory ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
            )}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Tout</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'p-4 rounded-2xl text-left transition-all flex flex-col gap-2',
                selectedCategory === cat
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800',
              )}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                {cat[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="text-xs font-black uppercase tracking-widest truncate">{cat}</span>
            </button>
          ))}
        </aside>

        {/* Center: Items (55%) — min-h-0 obligatoire pour que overflow-y + grid calculent la hauteur */}
        <section className="flex-1 flex min-h-0 flex-col bg-zinc-950 overflow-hidden">
          <div className="p-6 shrink-0">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Rechercher un plat... (appuyez sur /)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border-2 border-zinc-900 rounded-2xl py-4 pl-12 pr-4 text-white font-medium focus:border-emerald-500 outline-none transition-all"
              />
              <kbd className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-800 rounded text-[10px] font-mono text-zinc-500">/</kbd>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 pt-0 grid auto-rows-max gap-5 sm:gap-6 content-start items-start [grid-template-columns:repeat(2,minmax(0,1fr))] lg:[grid-template-columns:repeat(3,minmax(0,1fr))] xl:[grid-template-columns:repeat(4,minmax(0,1fr))]">
            {!menuLoading && filteredItems.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center px-4">
                <Utensils className="w-12 h-12 text-zinc-600 mb-3" aria-hidden />
                <p className="text-zinc-300 font-bold">Aucun plat à afficher</p>
                <p className="text-zinc-500 text-sm mt-1 max-w-sm">
                  Ajoutez des articles et catégories depuis le menu du dashboard, ou vérifiez que des plats sont marqués
                  disponibles.
                </p>
              </div>
            )}
            {filteredItems.map((item, index) => (
              <motion.button
                key={item.id}
                layout={false}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => addToCart({ id: item.id, name: item.name, price: item.price })}
                className="group relative aspect-square w-full min-w-0 max-w-full shrink-0 overflow-hidden rounded-[2rem] border-2 border-transparent bg-zinc-900 transition-all hover:border-emerald-500 [aspect-ratio:1/1]"
              >
                {/* Pas de flex-col ici : sinon hauteur = seul le petit bloc en flux → cartes écrasées / chevauchées */}
                {index < 9 && (
                  <div className="absolute top-3 left-3 z-20 flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800/90">
                    <kbd className="text-xs font-mono font-bold text-emerald-400">{index + 1}</kbd>
                  </div>
                )}
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-60 transition-opacity group-hover:opacity-80"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-800/80">
                    <Utensils className="h-14 w-14 text-zinc-600" aria-hidden />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-5 text-left">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">{item.category}</p>
                  <h3 className="mb-1 line-clamp-2 text-sm font-bold leading-snug text-white sm:text-base">{item.name}</h3>
                  <p className="font-black text-emerald-400">{item.price.toLocaleString()} FCFA</p>
                </div>
                <div className="absolute right-4 top-4 z-20 flex h-8 w-8 translate-y-2 items-center justify-center rounded-full bg-emerald-500 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                  <Plus className="h-5 w-5 text-white" />
                </div>
              </motion.button>
            ))}
          </div>
        </section>

        {/* Right: Ticket (30%) */}
        <aside className="w-96 min-w-[min(100%,24rem)] max-w-full border-l border-zinc-900 bg-zinc-950 flex flex-col min-h-0 shrink-0">
          <div className="p-6 border-b border-zinc-900 shrink-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-500" />
                Ticket
              </h2>
              <span className="bg-zinc-900 px-3 py-1 rounded-full text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                {cart.length} Items
              </span>
            </div>

            <div className="flex gap-2">
              {[
                { id: 'dine-in', label: 'Sur place', icon: Utensils },
                { id: 'takeaway', label: 'À emporter', icon: ShoppingBag },
                { id: 'delivery', label: 'Livraison', icon: Truck },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setOrderType(type.id as OrderType)}
                  className={cn(
                    "flex-1 p-3 rounded-2xl flex flex-col items-center gap-2 transition-all border-2",
                    currentOrder.type === type.id 
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                      : "bg-zinc-900 border-transparent text-zinc-500 hover:bg-zinc-800"
                  )}
                >
                  <type.icon className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{type.label}</span>
                </button>
              ))}
            </div>

            {currentOrder.type === 'dine-in' && (
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="N° Table"
                  value={currentOrder.tableNumber || ''}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full bg-zinc-900 border-2 border-zinc-900 rounded-xl p-3 text-sm font-bold text-white focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
            <AnimatePresence mode="popLayout">
              {cart.map((item) => (
                <motion.div
                  key={item.id}
                  layout={false}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-900 group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-white">{item.name}</h4>
                      <p className="text-xs text-emerald-500 font-black">{item.price.toLocaleString()} FCFA</p>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="p-1.5 text-zinc-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center bg-zinc-900 rounded-xl p-1">
                      <button 
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-black text-white">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Notes..."
                      value={item.notes}
                      onChange={(e) => updateItemNotes(item.id, e.target.value)}
                      className="bg-transparent border-none text-[10px] text-zinc-500 focus:text-white outline-none text-right w-24 italic"
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-4 opacity-50">
                <div className="w-16 h-16 rounded-full border-4 border-dashed border-zinc-800 flex items-center justify-center">
                  <ShoppingCart className="w-8 h-8" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest">Panier Vide</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-zinc-900/30 border-t border-zinc-900 shrink-0">
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total TTC</p>
                <p className="text-3xl font-black text-white">{total.toLocaleString()} <span className="text-xs text-zinc-500">FCFA</span></p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">TVA (18%)</p>
                <p className="text-sm font-bold text-zinc-400">{(total * 0.18).toLocaleString()} FCFA</p>
              </div>
            </div>

            <button
              disabled={cart.length === 0}
              onClick={() => setShowPayment(true)}
              className="w-full h-16 bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <CreditCard className="w-6 h-6" />
              PAYER MAINTENANT
            </button>
          </div>
        </aside>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showPayment && (
          <PaymentModal 
            total={total} 
            onClose={() => setShowPayment(false)}
            onComplete={handleCompletePayment}
          />
        )}
        {lastOrderId && (
          <ReceiptModal 
            orderId={lastOrderId} 
            onClose={() => setLastOrderId(null)} 
          />
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Hint */}
      <div className="fixed bottom-4 left-4 flex gap-2 pointer-events-none">
        <div className="bg-zinc-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-2">
          <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400">F1</kbd>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Payer</span>
        </div>
        <div className="bg-zinc-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-2">
          <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400">ESC</kbd>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Annuler</span>
        </div>
      </div>
    </div>
  );
}
