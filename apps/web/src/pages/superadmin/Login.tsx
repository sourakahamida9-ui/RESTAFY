import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { user, error: signInError } = await signIn(
        credentials.email,
        credentials.password
      );

      if (signInError || !user) {
        setError('Identifiants invalides.');
        setLoading(false);
        return;
      }

      // ✅ FIX SÉCURITÉ : on vérifie le profil SANS jamais le créer ici.
      // Si le profil n'existe pas → accès refusé, point final.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        // ✅ JAMAIS créer un profil super_admin ici — c'est une faille critique
        setError(
          'Compte administrateur introuvable. Vérifiez que votre profil existe dans la table profiles avec le rôle super_admin.'
        );
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // ✅ Vérification stricte du rôle
      const isSuperAdmin =
        profile.role === 'super_admin' || profile.role === 'superadmin';

      if (!isSuperAdmin) {
        setError(
          'Accès refusé. Seuls les comptes administrateurs sont autorisés ici.'
        );
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      navigate('/superadmin', { replace: true });
    } catch (err) {
      setError('Erreur lors de la connexion. Veuillez réessayer.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Restricted Access Banner */}
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-600">Zone Administrateur</p>
            <p className="text-xs text-red-600/80">Accès réservé aux administrateurs système</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Admin Panel
          </h1>
          <p className="text-slate-400 text-center text-sm mb-6">
            Connexion administrateur sécurisée
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Email Admin
              </label>
              <Input
                type="email"
                value={credentials.email}
                onChange={(e) =>
                  setCredentials({ ...credentials, email: e.target.value })
                }
                placeholder="admin@restafy.com"
                className="bg-slate-700 border-slate-600 text-white"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Mot de passe
              </label>
              <Input
                type="password"
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
                placeholder="Mot de passe admin"
                className="bg-slate-700 border-slate-600 text-white"
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Connexion...' : 'Accéder au Panel Admin'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-xs text-slate-400 text-center">
              <Lock className="w-3 h-3 inline mr-1" />
              Authentification sécurisée Supabase
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
