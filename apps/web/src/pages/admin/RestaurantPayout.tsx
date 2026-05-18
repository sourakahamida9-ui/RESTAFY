/**
 * Page de gestion des revenus et retraits pour restaurant
 * /admin/payout
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { safeParseResponse } from '@/lib/http/safeParseResponse';
import { 
  Wallet, 
  ArrowDownToLine, 
  History, 
  CreditCard,
  Smartphone,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payout_method: string;
  initiated_at: string;
  completed_at?: string;
  failure_reason?: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

interface FinancialSummary {
  available_balance: number;
  pending_payout_amount: number;
  total_earnings: number;
  earnings_this_month: number;
  earnings_last_month: number;
  total_payouts: number;
}

export default function RestaurantPayout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'mobile_money' | 'bank_transfer'>('mobile_money');
  const [processingWithdraw, setProcessingWithdraw] = useState(false);

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    setLoading(true);
    try {
      // Récupérer le profil pour avoir le restaurant_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('restaurant_id')
        .single();

      if (!profile?.restaurant_id) {
        toast.error('Restaurant non trouvé');
        return;
      }

      // Récupérer le résumé financier
      const { data: summaryData } = await supabase
        .from('restaurant_financial_summary')
        .select('*')
        .eq('restaurant_id', profile.restaurant_id)
        .single();

      if (summaryData) {
        setSummary(summaryData);
      }

      // Récupérer l'historique des retraits
      const { data: payoutsData } = await supabase
        .from('restaurant_payouts')
        .select('*')
        .eq('restaurant_id', profile.restaurant_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (payoutsData) {
        setPayouts(payoutsData);
      }

      // Récupérer les transactions récentes
      const { data: transactionsData } = await supabase
        .from('restaurant_transactions')
        .select('*')
        .eq('restaurant_id', profile.restaurant_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (transactionsData) {
        setTransactions(transactionsData);
      }

    } catch (err) {
      console.error('Error loading financial data:', err);
      toast.error('Erreur lors du chargement des données financières');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error('Veuillez entrer un montant valide');
      return;
    }

    const minAmount = 5000;
    if (amount < minAmount) {
      toast.error(`Le montant minimum est de ${minAmount.toLocaleString('fr-FR')} FCFA`);
      return;
    }

    if (amount > (summary?.available_balance || 0)) {
      toast.error('Solde insuffisant');
      return;
    }

    setProcessingWithdraw(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('restaurant_id')
        .single();

      // ✅ Récupérer le token JWT pour l'authentification
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      const response = await fetch('/api/restaurant/payout-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,  // ← Auth JWT requise
        },
        body: JSON.stringify({
          restaurant_id: profile?.restaurant_id,
          amount,
          method: withdrawMethod,
          destination: withdrawMethod === 'mobile_money'
            ? { phone: '+229XXXXXXXX' } // TODO: Récupérer le numéro configuré
            : { bank_account: 'XXXXXXXX' }, // TODO: Récupérer le compte configuré
        }),
      });

      const { ok, status, data, raw, message } = await safeParseResponse(response);
      if (!ok) {
        const details = message || data?.error || data?.details || (typeof data === 'string' ? data.slice(0,160) : null) || 'Erreur lors de la demande de retrait';
        throw new Error(details);
      }

      toast.success('Demande de retrait soumise avec succès !');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      
      // Recharger les données
      loadFinancialData();

    } catch (err: any) {
      console.error('Withdraw error:', err);
      toast.error(err.message || 'Erreur lors du retrait');
    } finally {
      setProcessingWithdraw(false);
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('fr-FR') + ' FCFA';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'processing':
        return <Clock className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-orange-500" />
          Mes Revenus
        </h1>
        <p className="text-gray-600 mt-1">
          Gérez vos encaissements et demandez des retraits
        </p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-green-100">Solde disponible</span>
            <Wallet className="w-6 h-6 text-green-100" />
          </div>
          <div className="text-3xl font-bold">
            {formatAmount(summary?.available_balance || 0)}
          </div>
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={(summary?.available_balance || 0) < 5000}
            className="mt-4 w-full bg-white text-green-600 py-2 rounded-lg font-semibold hover:bg-green-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Retirer
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-500">En cours de retrait</span>
            <Clock className="w-6 h-6 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {formatAmount(summary?.pending_payout_amount || 0)}
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Délais: Mobile Money = instantané, Virement = 24-48h
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-500">Total gagné</span>
            <TrendingUp className="w-6 h-6 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {formatAmount(summary?.total_earnings || 0)}
          </div>
          <div className="mt-4 text-sm text-gray-500">
            {summary?.total_payouts || 0} retraits effectués
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Ce mois</h3>
          <div className="text-2xl font-bold text-green-600">
            +{formatAmount(summary?.earnings_this_month || 0)}
          </div>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <TrendingUp className="w-4 h-4 mr-1" />
            vs mois dernier
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Mois dernier</h3>
          <div className="text-2xl font-bold text-gray-900">
            {formatAmount(summary?.earnings_last_month || 0)}
          </div>
          <div className="mt-2 text-sm text-gray-500">
            Historique de vos revenus
          </div>
        </div>
      </div>

      {/* Recent Payouts */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <History className="w-5 h-5 text-orange-500" />
            Historique des retraits
          </h2>
          <button
            onClick={loadFinancialData}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        {payouts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <ArrowDownToLine className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Aucun retrait effectué</p>
            <p className="text-sm mt-1">Vos retraits apparaîtront ici</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {payouts.map((payout) => (
              <div key={payout.id} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getStatusColor(payout.status)}`}>
                      {getStatusIcon(payout.status)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {formatAmount(payout.amount)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(payout.initiated_at)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payout.status)}`}>
                      {payout.status === 'completed' ? 'Complété' :
                       payout.status === 'processing' ? 'En cours' :
                       payout.status === 'pending' ? 'En attente' :
                       'Échoué'}
                    </span>
                    {payout.payout_method === 'mobile_money' ? (
                      <div className="text-sm text-gray-500 mt-1 flex items-center justify-end gap-1">
                        <Smartphone className="w-3 h-3" />
                        Mobile Money
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 mt-1 flex items-center justify-end gap-1">
                        <Building2 className="w-3 h-3" />
                        Virement
                      </div>
                    )}
                  </div>
                </div>
                {payout.failure_reason && (
                  <div className="mt-2 text-sm text-red-600">
                    Raison: {payout.failure_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-orange-500" />
            Transactions récentes
          </h2>
        </div>
        
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Aucune transaction</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {transactions.slice(0, 5).map((transaction) => (
              <div key={transaction.id} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {transaction.description}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(transaction.created_at)}
                    </div>
                  </div>
                  <div className={`font-semibold ${
                    transaction.type === 'payment_received' ? 'text-green-600' : 
                    transaction.type === 'payout_sent' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {transaction.type === 'payment_received' ? '+' : '-'}
                    {formatAmount(Math.abs(transaction.amount))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Demander un retrait
            </h2>
            
            <div className="mb-4 p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-green-600">Solde disponible</div>
              <div className="text-2xl font-bold text-green-700">
                {formatAmount(summary?.available_balance || 0)}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant (minimum 5 000 FCFA)
                </label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  min="5000"
                  max={summary?.available_balance || 0}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="5000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Méthode de retrait
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setWithdrawMethod('mobile_money')}
                    className={`p-4 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                      withdrawMethod === 'mobile_money'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <Smartphone className="w-6 h-6" />
                    <span className="text-sm font-medium">Mobile Money</span>
                    <span className="text-xs text-gray-500">Instantané</span>
                  </button>
                  <button
                    onClick={() => setWithdrawMethod('bank_transfer')}
                    className={`p-4 rounded-lg border-2 transition flex flex-col items-center gap-2 ${
                      withdrawMethod === 'bank_transfer'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <Building2 className="w-6 h-6" />
                    <span className="text-sm font-medium">Virement bancaire</span>
                    <span className="text-xs text-gray-500">24-48h</span>
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-500 space-y-2">
                <p className="flex justify-between">
                  <span>Frais Kkiapay (1%)</span>
                  <span>{formatAmount((parseFloat(withdrawAmount) || 0) * 0.01)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Frais fixes</span>
                  <span>100 FCFA</span>
                </p>
                <p className="flex justify-between font-semibold text-gray-900 border-t pt-2">
                  <span>Montant net reçu</span>
                  <span>
                    {formatAmount((parseFloat(withdrawAmount) || 0) - ((parseFloat(withdrawAmount) || 0) * 0.01 + 100))}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleWithdraw}
                disabled={processingWithdraw || !withdrawAmount || parseFloat(withdrawAmount) < 5000}
                className="flex-1 py-3 px-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50"
              >
                {processingWithdraw ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  'Confirmer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
