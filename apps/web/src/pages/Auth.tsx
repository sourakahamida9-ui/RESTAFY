// src/pages/Auth.tsx
// ✅ FIX BUILD : import Layout supprimé
// Auth.tsx a son propre layout plein-écran — il n'a pas besoin de Layout
// L'import './components/Layout' depuis src/pages/ est un chemin invalide
// (cherche src/pages/components/Layout qui n'existe pas)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UtensilsCrossed } from 'lucide-react';

export default function Auth() {
  const navigate = useNavigate();
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'client' as 'client' | 'restaurant_owner',
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setInfoMessage(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    const { user, error: signInError } = await signIn(
      formData.email,
      formData.password
    );

    if (signInError) {
      const msg = signInError.message;
      if (msg.includes('Invalid login credentials')) {
        setError('Email ou mot de passe incorrect.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Veuillez confirmer votre adresse email avant de vous connecter.');
      } else if (msg.includes('Too many requests')) {
        setError('Trop de tentatives. Attendez quelques minutes.');
      } else {
        setError(msg);
      }
      setLoading(false);
      return;
    }

    if (user) {
      const { supabase } = await import('@/lib/supabase');

      let profileData = null;
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase
          .from('profiles')
          .select('role, restaurant_id')
          .eq('id', user.id)
          .maybeSingle();
        if (data) { profileData = data; break; }
        await new Promise(r => setTimeout(r, 800));
      }

      if (!profileData) {
        const meta = user.user_metadata;
        const role = meta?.role || 'client';
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          full_name: meta?.full_name || '',
          phone: meta?.phone || '',
          role,
          loyalty_points: 0,
          total_orders: 0,
          has_completed_onboarding: false,
        }, { onConflict: 'id' });
        profileData = { role, restaurant_id: null };
      }

      const role = profileData?.role;
      if (['restaurant_owner', 'restaurant', 'manager', 'staff', 'livreur', 'caissier'].includes(role)) {
        navigate('/restaurant/dashboard');
      } else if (role === 'super_admin') {
        navigate('/superadmin');
      } else {
        navigate('/');
      }
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    const { user, error: signUpError, pendingEmailConfirmation } = await signUp(
      formData.email,
      formData.password,
      formData.fullName,
      formData.phone,
      formData.role
    );

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (pendingEmailConfirmation) {
      setMode('signin');
      setInfoMessage(
        'Compte créé : un e-mail de confirmation vous a été envoyé. Cliquez sur le lien dans le message, puis reconnectez-vous ici.',
      );
      setLoading(false);
      return;
    }

    if (user) {
      if (formData.role === 'restaurant_owner') {
        navigate('/create-restaurant');
      } else {
        navigate('/');
      }
    }
    setLoading(false);
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null);
    setInfoMessage(null);
    setFormData({ email: '', password: '', fullName: '', phone: '', role: 'client' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-600/20">
            <UtensilsCrossed className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tighter">
            RESTAFY<span className="text-orange-600">.</span>
          </h1>
          <p className="text-zinc-500 mt-2 text-sm">
            {mode === 'signin'
              ? 'Connectez-vous à votre compte'
              : 'Créez votre compte gratuitement'}
          </p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
            {error}
          </div>
        )}

        {infoMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-sm">
            {infoMessage}
          </div>
        )}

        {/* Formulaire */}
        <form
          onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}
          className="space-y-4"
        >
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">
                  Nom complet
                </label>
                <Input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="Votre nom et prénom"
                  required={mode === 'signup'}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">
                  Téléphone
                </label>
                <Input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+229 01 XX XX XX XX"
                  required={mode === 'signup'}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">
                  Type de compte
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-orange-600 focus:border-transparent text-sm"
                >
                  <option value="client">Client — Commander des repas</option>
                  <option value="restaurant_owner">
                    Restaurateur — Gérer mon restaurant
                  </option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1">
              Adresse email
            </label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="vous@exemple.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1">
              Mot de passe
            </label>
            <Input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="••••••••"
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl"
          >
            {loading
              ? 'Chargement...'
              : mode === 'signin'
                ? 'Se connecter'
                : 'Créer mon compte'}
          </Button>
        </form>

        {/* Changer de mode */}
        <div className="mt-6 text-center">
          <p className="text-zinc-500 text-sm">
            {mode === 'signin'
              ? "Pas encore de compte ? "
              : 'Déjà un compte ? '}
            <button
              onClick={switchMode}
              className="text-orange-600 hover:text-orange-700 font-semibold"
            >
              {mode === 'signin' ? "S'inscrire" : 'Se connecter'}
            </button>
          </p>
        </div>

        {/* Lien restaurant */}
        <div className="mt-4 text-center">
          <p className="text-zinc-400 text-xs">
            Restaurant partenaire ?{' '}
            <a
              href="/restaurant/login"
              className="text-orange-500 hover:text-orange-600 font-semibold"
            >
              Connexion espace restaurant
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}