import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, CreditCard, Smartphone, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface Transaction {
  id: string;
  restaurant_id: string;
  order_id: string;
  total_amount: number;
  commission_amount: number;
  created_at: string;
  status: string;
}

interface RestaurantStats {
  name: string;
  totalRevenue: number;
  totalCommission: number;
  orderCount: number;
}

export default function SuperAdminFinances() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalGMV: 0,
    totalCommission: 0,
    transactionCount: 0,
    avgOrderValue: 0,
    loading: true,
  });
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [restaurantStats, setRestaurantStats] = useState<RestaurantStats[]>([]);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      // Récupérer les données de commandes
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_amount, created_at');

      if (orders) {
        const totalGMV = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const totalCommission = Math.round(totalGMV * 0.15); // 15% commission
        const avgOrderValue = orders.length > 0 ? Math.round(totalGMV / orders.length) : 0;

        setStats({
          totalGMV,
          totalCommission,
          transactionCount: orders.length,
          avgOrderValue,
          loading: false,
        });

        // Organiser les données par mois pour le graphique
        const monthlyStats: Record<string, any> = {};
        orders.forEach(order => {
          const date = new Date(order.created_at);
          const monthKey = `${date.toLocaleString('fr-FR', { month: 'short' })}`;
          
          if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = { month: monthKey, gmv: 0, commission: 0 };
          }
          monthlyStats[monthKey].gmv += order.total_amount || 0;
          monthlyStats[monthKey].commission = Math.round(monthlyStats[monthKey].gmv * 0.15);
        });

        setMonthlyData(Object.values(monthlyStats).slice(-6));
      }

      // Récupérer les dernières transactions
      const { data: recentTransactions } = await supabase
        .from('orders')
        .select('id, total_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentTransactions) {
        setTransactions(recentTransactions as any);
      }

      // Récupérer les stats par restaurant
      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('id, name, total_revenue')
        .order('total_revenue', { ascending: false })
        .limit(5);

      if (restaurantData) {
        setRestaurantStats(restaurantData as any);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching financial data:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  if (stats.loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/superadmin/dashboard')} className="p-2 hover:bg-white/5 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold">Finances</h2>
        </div>
        <div className="text-center py-12 text-zinc-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/superadmin/dashboard')} className="p-2 hover:bg-white/5 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold">Finances & Commissions</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: 'GMV total', v: `${(stats.totalGMV / 1000000).toFixed(2)}M FCFA`, icon: TrendingUp, c: 'text-primary' },
          { l: 'Commissions (15%)', v: `${(stats.totalCommission / 1000000).toFixed(2)}M FCFA`, icon: DollarSign, c: 'text-emerald-400' },
          { l: 'Transactions', v: stats.transactionCount.toLocaleString(), icon: CreditCard, c: 'text-blue-400' },
          { l: 'Ticket moyen', v: `${stats.avgOrderValue.toLocaleString()} FCFA`, icon: Smartphone, c: 'text-purple-400' },
        ].map(s => (
          <div key={s.l} className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-5">
            <s.icon className={`w-5 h-5 mb-3 ${s.c}`} />
            <p className="text-xl md:text-2xl font-bold truncate">{s.v}</p>
            <p className="text-xs text-zinc-500 mt-1">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GMV Chart */}
        <div className="lg:col-span-2 bg-[#1A1A1A] border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold mb-4">Évolution du GMV</h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, color: '#fff' }} />
                <Line type="monotone" dataKey="gmv" stroke="#FF6B00" strokeWidth={2} />
                <Line type="monotone" dataKey="commission" stroke="#22C55E" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-zinc-500">Pas de données disponibles</div>
          )}
        </div>

        {/* Top Restaurants */}
        <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold mb-4">Top 5 Restaurants</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {restaurantStats.length > 0 ? (
              restaurantStats.map((r, i) => (
                <div key={r.name} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-xs font-medium truncate">{r.name}</span>
                  </div>
                  <span className="text-xs font-bold text-primary whitespace-nowrap">{((r.totalRevenue || 0) / 1000).toFixed(0)}k</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-500">Pas de données</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-6">
        <h3 className="font-bold mb-4">Dernières Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-zinc-500">
                {['ID Transaction', 'Montant', 'Commission', 'Date', 'Statut'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.length > 0 ? (
                transactions.map(t => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-zinc-400">{t.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 font-bold">{(t.total_amount / 1000).toFixed(0)}k FCFA</td>
                    <td className="px-4 py-3 text-emerald-400 font-bold">{((t.total_amount * 0.15) / 1000).toFixed(1)}k FCFA</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{new Date(t.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Complétée
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 text-xs">
                    Aucune transaction trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
