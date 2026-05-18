import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, Phone, MessageSquare, CheckCircle2,
  ChefHat, Bike, Home as HomeIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '../lib/utils';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

const ShoppingBag = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const statusToStep: Record<string, number> = {
  pending: 1,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  delivering: 4,
  delivered: 5,
};

export default function OrderTracking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, restaurant:restaurants!restaurant_id (name, phone), order_items (item_id, quantity, unit_price)`)
        .eq('id', id)
        .single();

      if (!error && data) setOrder(data);
      setLoading(false);
    };

    fetchOrder();

    // Realtime
    const sub = supabase
      .channel(`order-tracking-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}`,
      }, (payload) => {
        setOrder((prev: any) => ({ ...prev, ...payload.new }));
      })
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, [id]);

  const steps = [
    { id: 1, label: 'Reçue', icon: CheckCircle2, desc: 'Le restaurant a reçu votre commande' },
    { id: 2, label: 'Préparation', icon: ChefHat, desc: 'Le chef prépare votre festin' },
    { id: 3, label: 'Prête', icon: ShoppingBag, desc: 'Votre commande est emballée' },
    { id: 4, label: 'En livraison', icon: Bike, desc: 'Le livreur est en route' },
    { id: 5, label: 'Livrée', icon: HomeIcon, desc: 'Bon appétit !' },
  ];

  const currentStep = order ? (statusToStep[order.status] || 1) : 1;

  if (loading) return <RestafyLoader message="Suivi commande" />;

  if (!order) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 mb-4">Commande introuvable</p>
        <button onClick={() => navigate('/')} className="bg-orange-600 text-white px-6 py-2 rounded-lg">Accueil</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper pb-32">
      <header className="px-4 py-6 flex items-center justify-between bg-white border-b border-zinc-100">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/orders')} className="p-2 bg-zinc-100 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Commande en cours</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">
              {order.restaurant?.name || 'Restaurant'}
            </p>
          </div>
        </div>
        {order.restaurant?.phone && (
          <a href={`tel:${order.restaurant.phone}`} className="p-2 bg-zinc-100 rounded-full text-zinc-600">
            <Phone className="w-5 h-5" />
          </a>
        )}
      </header>

      <div className="px-4 py-8 space-y-8">
        {/* Progress Timeline */}
        <div className="space-y-6">
          {steps.map((step, i) => {
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id;
            const isPending = currentStep < step.id;
            return (
              <div key={step.id} className="flex gap-4 relative">
                {i < steps.length - 1 && (
                  <div className={cn("absolute left-5 top-10 w-0.5 h-10", isCompleted ? "bg-orange-600" : "bg-zinc-100")} />
                )}
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all duration-500",
                  isCompleted ? "bg-orange-600 text-white" :
                    isActive ? "bg-orange-100 text-orange-600 ring-4 ring-orange-100" :
                      "bg-zinc-100 text-zinc-300"
                )}>
                  <step.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 pt-1">
                  <h4 className={cn("font-bold text-sm", isPending ? "text-zinc-300" : "text-zinc-900")}>{step.label}</h4>
                  <p className={cn("text-xs", isPending ? "text-zinc-200" : "text-zinc-500")}>{step.desc}</p>
                </div>
                {isActive && (
                  <div className="pt-1">
                    <span className="text-[8px] font-bold uppercase tracking-widest bg-orange-100 text-orange-600 px-2 py-1 rounded-md animate-pulse">
                      En cours
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-zinc-100 shadow-sm">
          <h3 className="font-bold mb-4">Détails de la commande</h3>
          <div className="space-y-3">
            {(order.order_items || []).map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-zinc-500">x{item.quantity} article</span>
                <span className="font-bold">{(item.unit_price * item.quantity).toLocaleString()}₣</span>
              </div>
            ))}
            <div className="pt-3 border-t border-zinc-50 flex justify-between items-center">
              <span className="font-bold">Total</span>
              <span className="text-xl font-bold text-orange-600">{Number(order.total_amount).toLocaleString()}₣</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
