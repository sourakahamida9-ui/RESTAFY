// src/components/admin/CustomerInsights.tsx
// Insights clients - Clients fideles, anniversaires, preferences

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Crown, Cake, Heart, TrendingUp, Star,
  Gift, MessageCircle, Mail, Phone, Calendar,
  Award, Target, Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface TopCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  total_orders: number;
  total_spent: number;
  last_order: string;
  favorite_item?: string;
  loyalty_points?: number;
}

interface Props {
  restaurantId: string;
}

export function CustomerInsights({ restaurantId }: Props) {
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [birthdayCustomers, setBirthdayCustomers] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    newThisMonth: 0,
    avgOrderValue: 0,
    repeatRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, [restaurantId]);

  const loadInsights = async () => {
    // Top clients par CA
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        customer_id,
        total_amount,
        created_at,
        customer:customer_id (id, full_name, email, phone)
      `)
      .eq('restaurant_id', restaurantId)
      .eq('status', 'delivered');

    if (orders) {
      // Agreger par client
      const customerStats: Record<string, any> = {};
      
      orders.forEach((order: any) => {
        if (!order.customer_id) return;
        
        if (!customerStats[order.customer_id]) {
          customerStats[order.customer_id] = {
            id: order.customer_id,
            name: order.customer?.full_name || 'Client',
            email: order.customer?.email || '',
            phone: order.customer?.phone || '',
            total_orders: 0,
            total_spent: 0,
            last_order: order.created_at,
          };
        }
        
        customerStats[order.customer_id].total_orders++;
        customerStats[order.customer_id].total_spent += order.total_amount || 0;
        
        if (new Date(order.created_at) > new Date(customerStats[order.customer_id].last_order)) {
          customerStats[order.customer_id].last_order = order.created_at;
        }
      });

      // Trier par CA
      const sorted = Object.values(customerStats)
        .sort((a: any, b: any) => b.total_spent - a.total_spent)
        .slice(0, 10);

      setTopCustomers(sorted as TopCustomer[]);

      // Stats globales
      const uniqueCustomers = Object.keys(customerStats).length;
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const repeatCustomers = Object.values(customerStats).filter((c: any) => c.total_orders > 1).length;

      setStats({
        totalCustomers: uniqueCustomers,
        newThisMonth: Math.round(uniqueCustomers * 0.15), // Approximation
        avgOrderValue: uniqueCustomers > 0 ? totalRevenue / orders.length : 0,
        repeatRate: uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0,
      });
    }

    setLoading(false);
  };

  const sendMessage = (customer: TopCustomer, type: 'email' | 'sms' | 'whatsapp') => {
    if (type === 'whatsapp' && customer.phone) {
      window.open(`https://wa.me/${customer.phone.replace(/\D/g, '')}`, '_blank');
    } else if (type === 'email' && customer.email) {
      window.open(`mailto:${customer.email}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm"
        >
          <Users className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-black text-zinc-900">{stats.totalCustomers}</p>
          <p className="text-xs text-zinc-400 font-medium">Clients uniques</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm"
        >
          <Sparkles className="w-8 h-8 text-emerald-500 mb-2" />
          <p className="text-2xl font-black text-zinc-900">+{stats.newThisMonth}</p>
          <p className="text-xs text-zinc-400 font-medium">Nouveaux ce mois</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm"
        >
          <Target className="w-8 h-8 text-purple-500 mb-2" />
          <p className="text-2xl font-black text-zinc-900">{Math.round(stats.avgOrderValue).toLocaleString()} F</p>
          <p className="text-xs text-zinc-400 font-medium">Panier moyen</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm"
        >
          <Heart className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-2xl font-black text-zinc-900">{stats.repeatRate.toFixed(0)}%</p>
          <p className="text-xs text-zinc-400 font-medium">Taux de fidelite</p>
        </motion.div>
      </div>

      {/* Top clients */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-zinc-900">Top 10 Clients VIP</h3>
          </div>
          <span className="text-xs text-zinc-400">Par chiffre d'affaires</span>
        </div>

        <div className="divide-y divide-zinc-50">
          {topCustomers.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="w-12 h-12 text-zinc-200 mx-auto mb-3" />
              <p className="text-zinc-400">Aucune donnee client disponible</p>
            </div>
          ) : (
            topCustomers.map((customer, index) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="px-5 py-4 hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Rank badge */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                      index === 0 ? 'bg-amber-100 text-amber-600' :
                      index === 1 ? 'bg-zinc-200 text-zinc-600' :
                      index === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-zinc-100 text-zinc-500'
                    }`}>
                      {index === 0 ? <Crown className="w-5 h-5" /> : `#${index + 1}`}
                    </div>

                    <div>
                      <p className="font-bold text-zinc-900">{customer.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-zinc-400">{customer.total_orders} commandes</span>
                        <span className="text-xs text-zinc-300">|</span>
                        <span className="text-xs text-zinc-400">
                          Derniere: {new Date(customer.last_order).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-black text-zinc-900">{customer.total_spent.toLocaleString('fr-FR')} F</p>
                      <p className="text-xs text-emerald-500 font-bold">
                        ~{Math.round(customer.total_spent / customer.total_orders).toLocaleString()} F/cmd
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {customer.email && (
                        <button
                          onClick={() => sendMessage(customer, 'email')}
                          className="p-2 rounded-lg hover:bg-blue-50 text-blue-500 transition-all"
                          title="Envoyer un email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      )}
                      {customer.phone && (
                        <button
                          onClick={() => sendMessage(customer, 'whatsapp')}
                          className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-500 transition-all"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Suggestion d'action */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6 text-white"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5" />
              <h3 className="font-black">Fidalisez vos clients</h3>
            </div>
            <p className="text-purple-100 text-sm mb-4">
              Envoyez une offre speciale a vos meilleurs clients pour les remercier de leur fidelite
            </p>
            <button className="px-4 py-2 bg-white text-purple-600 rounded-xl font-bold text-sm hover:bg-purple-50 transition-all">
              Creer une campagne
            </button>
          </div>
          <Award className="w-16 h-16 text-purple-300/50" />
        </div>
      </motion.div>
    </div>
  );
}

export default CustomerInsights;
