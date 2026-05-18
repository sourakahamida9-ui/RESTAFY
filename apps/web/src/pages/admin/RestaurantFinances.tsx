import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@supabase/supabase-js';
import { safeParseResponse } from '@/lib/http/safeParseResponse';
import { 
  Wallet, ArrowUpRight, ArrowDownLeft, TrendingUp, 
  Clock, CheckCircle, XCircle, DollarSign, CreditCard
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export default function RestaurantFinances() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);

  useEffect(() => {
    loadFinances();
  }, [user]);

  const loadFinances = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Récupérer le restaurant de l'utilisateur
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('owner_id', user.id)
        .single();

      if (!restaurant) return;

      // Récupérer les paiements confirmés pour ce restaurant
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });

      // Calculer le solde total
      const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      const totalPayouts = payments?.reduce((sum, p) => {
        if (p.provider_response?.payout_status === 'completed') {
          return sum + (p.amount || 0);
        }
        return sum;
      }, 0) || 0;

      setBalance(totalRevenue - totalPayouts);
      setTransactions(payments || []);
    } catch (error) {
      console.error('Erreur lors du chargement des finances:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayout = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) return;
    if (parseFloat(payoutAmount) > balance) {
      alert('Solde insuffisant');
      return;
    }

    setPayoutLoading(true);
    try {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id, owner_id')
        .eq('owner_id', user?.id)
        .single();

      if (!restaurant) return;

      // Initier un payout
      const response = await fetch('/api/payouts/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(payoutAmount),
          restaurant_id: restaurant.id,
          recipient_name: user?.user_metadata?.full_name || 'Restaurant Owner',
          recipient_phone: user?.user_metadata?.phone || '',
        }),
      });

      const { ok, status, data, raw, message } = await safeParseResponse(response);

      if (ok) {
        alert('Demande de retrait envoyée avec succès !');
        setPayoutAmount('');
        loadFinances();
      } else {
        alert(`Erreur: ${message || data?.error || 'Impossible de traiter la demande'}`);
      }
    } catch (error) {
      console.error('Erreur lors du retrait:', error);
      alert('Une erreur est survenue lors du retrait');
    } finally {
      setPayoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Gestion Financière</h1>

      {/* Solde */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium mb-1">Solde disponible</p>
            <p className="text-4xl font-bold">{balance.toLocaleString()} XOF</p>
          </div>
          <Wallet className="w-16 h-16 text-blue-200" />
        </div>
      </div>

      {/* Formulaire de retrait */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <ArrowUpRight className="w-5 h-5" />
          Demander un retrait
        </h2>
        <div className="flex gap-4">
          <input
            type="number"
            value={payoutAmount}
            onChange={(e) => setPayoutAmount(e.target.value)}
            placeholder="Montant en XOF"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handlePayout}
            disabled={payoutLoading || !payoutAmount}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            {payoutLoading ? 'Traitement...' : 'Retirer'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Montant minimum: 5 000 XOF • Frais: 2%
        </p>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Historique des transactions
        </h2>
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <ArrowDownLeft className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {transaction.transaction_ref || 'Paiement'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(transaction.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-600">
                  +{transaction.amount?.toLocaleString()} XOF
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {transaction.status}
                </p>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              Aucune transaction pour le moment
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
