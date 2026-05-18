// ✅ BUG FIX #9 : rôles 'caissier' ajouté dans la redirection post-login
// (Login.tsx est utilisé pour les clients ET parfois les restaurants)
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UtensilsCrossed } from 'lucide-react';

// Rôles centralisés — cohérent avec App.tsx
const RESTAURANT_ROLES = [
  'restaurant_owner',
  'restaurant',
  'manager',
  'staff',
  'livreur',
  'caissier', // ← ajouté
];

export default function Login() {
  const navigate = useNavigate();
  const { user, profile, loading, signIn, error: authLoadError, signOut } = useAuth();
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // ✅ Redirection basée sur le profil Supabase — pas de hardcode
  useEffect(() => {
    if (!loading && user && profile) {
      const role = profile.role;
      if (RESTAURANT_ROLES.includes(role)) {
        navigate('/restaurant/dashboard', { replace: true });
      } else if (role === 'super_admin' || (role as string) === 'superadmin') {
        navigate('/superadmin', { replace: true });
      } else {
        // Rôle 'client' ou tout autre → accueil
        navigate('/', { replace: true });
      }
    }
  }, [user, profile, loading, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    const { error: signInError } = await signIn(
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
        setError('Trop de tentatives. Attendez quelques minutes avant de réessayer.');
      } else {
        setError(msg);
      }
      setFormLoading(false);
      return;
    }

    // La redirection est gérée par le useEffect ci-dessus
    setFormLoading(false);
  };

  // Si déjà connecté et profil chargé → ne pas afficher le formulaire
  if (!loading && user && profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-500">Redirection en cours...</p>
      </div>
    );
  }

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
            Connectez-vous à votre compte
          </p>
        </div>

        {/* Erreur */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="Votre mot de passe"
              required
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            disabled={formLoading || loading || (!!user && !profile)}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl"
          >
            {formLoading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>

        {/* Mot de passe oublié */}
        <div className="mt-4 text-center">
          <Link
            to="/forgot-password"
            className="text-sm text-zinc-500 hover:text-orange-600"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        {/* Liens */}
        <div className="mt-6 text-center border-t border-zinc-100 pt-6 space-y-3">
          <p className="text-zinc-500 text-sm">
            Pas encore de compte ?{' '}
            <Link
              to="/signup"
              className="text-orange-600 hover:text-orange-700 font-semibold"
            >
              Créer un compte client
            </Link>
          </p>
          <p className="text-zinc-400 text-xs">
            Restaurant partenaire ?{' '}
            <Link
              to="/restaurant/login"
              className="text-orange-500 hover:text-orange-600 font-semibold"
            >
              Connexion espace restaurant
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
