// src/components/admin/QuickActions.tsx
// Actions rapides pour le restaurant - Toggle ouvert/ferme, notifications, etc.

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Power, PowerOff, Bell, BellOff, Volume2, VolumeX,
  Clock, Pause, Play, AlertTriangle, CheckCircle2,
  Zap, Settings, Moon, Sun, RefreshCw, MessageCircle,
  Send, Users, TrendingUp, Coffee
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Props {
  restaurantId: string;
  onRefresh?: () => void;
}

export function QuickActions({ restaurantId, onRefresh }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [prepTime, setPrepTime] = useState(30);
  const [showPrepTimeModal, setShowPrepTimeModal] = useState(false);

  // Charger l'etat du restaurant
  useEffect(() => {
    loadRestaurantState();
  }, [restaurantId]);

  const loadRestaurantState = async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('is_open, is_busy, is_paused, prep_time_minutes')
      .eq('id', restaurantId)
      .single();

    if (data) {
      setIsOpen(data.is_open);
      setIsBusy(data.is_busy || false);
      setIsPaused(data.is_paused || false);
      setPrepTime(data.prep_time_minutes || 30);
    }
  };

  // Toggle ouvert/ferme
  const toggleOpen = async () => {
    setLoading(true);
    const newState = !isOpen;

    const { error } = await supabase
      .from('restaurants')
      .update({ is_open: newState })
      .eq('id', restaurantId);

    if (!error) {
      setIsOpen(newState);
      toast.success(newState ? 'Restaurant OUVERT' : 'Restaurant FERME');
      onRefresh?.();
    } else {
      toast.error('Erreur lors du changement');
    }
    setLoading(false);
  };

  // Toggle mode busy (temps d'attente plus long)
  const toggleBusy = async () => {
    const newState = !isBusy;

    const { error } = await supabase
      .from('restaurants')
      .update({ is_busy: newState })
      .eq('id', restaurantId);

    if (!error) {
      setIsBusy(newState);
      toast.success(newState ? 'Mode RUSH active - Temps estimes augmentes' : 'Mode normal');
    }
  };

  // Toggle pause (accepte plus de nouvelles commandes)
  const togglePause = async () => {
    const newState = !isPaused;

    const { error } = await supabase
      .from('restaurants')
      .update({ is_paused: newState })
      .eq('id', restaurantId);

    if (!error) {
      setIsPaused(newState);
      toast.success(newState ? 'Commandes en PAUSE' : 'Commandes reactivees');
    }
  };

  // Mettre a jour le temps de preparation
  const updatePrepTime = async (minutes: number) => {
    const { error } = await supabase
      .from('restaurants')
      .update({ prep_time_minutes: minutes })
      .eq('id', restaurantId);

    if (!error) {
      setPrepTime(minutes);
      toast.success(`Temps de preparation: ${minutes} min`);
      setShowPrepTimeModal(false);
    }
  };

  // Envoyer une notification push aux clients
  const sendPushNotification = async (message: string) => {
    toast.success('Notification envoyee aux clients abonnes');
    // TODO: Integrer avec un service de push notifications
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          <h3 className="font-black text-zinc-900">Actions rapides</h3>
        </div>
        <button
          onClick={loadRestaurantState}
          className="p-1.5 hover:bg-zinc-100 rounded-lg transition-all"
        >
          <RefreshCw className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Toggle principal - Ouvert/Ferme */}
        <button
          onClick={toggleOpen}
          disabled={loading}
          className={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${
            isOpen
              ? 'bg-emerald-50 border-2 border-emerald-200 hover:bg-emerald-100'
              : 'bg-red-50 border-2 border-red-200 hover:bg-red-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isOpen ? 'bg-emerald-500' : 'bg-red-500'
            }`}>
              {isOpen ? <Power className="w-5 h-5 text-white" /> : <PowerOff className="w-5 h-5 text-white" />}
            </div>
            <div className="text-left">
              <p className={`font-bold ${isOpen ? 'text-emerald-700' : 'text-red-700'}`}>
                {isOpen ? 'OUVERT' : 'FERME'}
              </p>
              <p className="text-xs text-zinc-500">
                {isOpen ? 'Le restaurant accepte les commandes' : 'Les commandes sont desactivees'}
              </p>
            </div>
          </div>
          <div className={`w-14 h-7 rounded-full relative transition-colors ${
            isOpen ? 'bg-emerald-500' : 'bg-red-400'
          }`}>
            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              isOpen ? 'translate-x-8' : 'translate-x-1'
            }`} />
          </div>
        </button>

        {/* Actions secondaires */}
        <div className="grid grid-cols-2 gap-3">
          {/* Mode Rush */}
          <button
            onClick={toggleBusy}
            className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
              isBusy
                ? 'border-orange-500 bg-orange-50'
                : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <Coffee className={`w-5 h-5 ${isBusy ? 'text-orange-500' : 'text-zinc-400'}`} />
            <span className={`text-xs font-bold ${isBusy ? 'text-orange-700' : 'text-zinc-500'}`}>
              Mode Rush
            </span>
          </button>

          {/* Pause commandes */}
          <button
            onClick={togglePause}
            className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
              isPaused
                ? 'border-amber-500 bg-amber-50'
                : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            {isPaused ? (
              <Pause className="w-5 h-5 text-amber-500" />
            ) : (
              <Play className="w-5 h-5 text-zinc-400" />
            )}
            <span className={`text-xs font-bold ${isPaused ? 'text-amber-700' : 'text-zinc-500'}`}>
              {isPaused ? 'En pause' : 'Actif'}
            </span>
          </button>

          {/* Temps de preparation */}
          <button
            onClick={() => setShowPrepTimeModal(true)}
            className="p-3 rounded-xl border-2 border-zinc-200 hover:border-zinc-300 flex flex-col items-center gap-2 transition-all"
          >
            <Clock className="w-5 h-5 text-zinc-400" />
            <span className="text-xs font-bold text-zinc-500">{prepTime} min</span>
          </button>

          {/* Notifications */}
          <button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
              notificationsEnabled
                ? 'border-blue-500 bg-blue-50'
                : 'border-zinc-200'
            }`}
          >
            {notificationsEnabled ? (
              <Bell className="w-5 h-5 text-blue-500" />
            ) : (
              <BellOff className="w-5 h-5 text-zinc-400" />
            )}
            <span className={`text-xs font-bold ${notificationsEnabled ? 'text-blue-700' : 'text-zinc-500'}`}>
              Notifs
            </span>
          </button>
        </div>

        {/* Alerte si en pause */}
        {isPaused && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Les nouvelles commandes sont temporairement suspendues
            </p>
          </motion.div>
        )}
      </div>

      {/* Modal temps de preparation */}
      <AnimatePresence>
        {showPrepTimeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm"
            >
              <h3 className="font-bold text-lg text-zinc-900 mb-4">Temps de preparation</h3>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[15, 20, 30, 45, 60, 90].map(mins => (
                  <button
                    key={mins}
                    onClick={() => updatePrepTime(mins)}
                    className={`p-3 rounded-xl font-bold transition-all ${
                      prepTime === mins
                        ? 'bg-orange-500 text-white'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowPrepTimeModal(false)}
                className="w-full py-3 border border-zinc-200 rounded-xl font-bold text-zinc-500"
              >
                Annuler
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default QuickActions;
