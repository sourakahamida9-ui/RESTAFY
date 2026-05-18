import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { formatAuthErrorMessage } from '@/lib/formatSupabaseError';
import { validateSignupFields } from '@/lib/signupValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UtensilsCrossed, ArrowLeft } from 'lucide-react';

export default function ClientSignup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<'none' | 'logged_in' | 'check_email'>('none');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const validationError = validateSignupFields(formData);
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    const { user, error: signUpError, pendingEmailConfirmation } = await signUp(
      formData.email,
      formData.password,
      formData.fullName,
      formData.phone,
      'client' // Toujours client sur cette page
    );

    if (signUpError) {
      setError(formatAuthErrorMessage(signUpError));
      setLoading(false);
      return;
    }

    if (pendingEmailConfirmation) {
      setSuccess('check_email');
      setLoading(false);
      return;
    }

    if (user) {
      setSuccess('logged_in');
      setTimeout(() => navigate('/'), 2000);
    }
    setLoading(false);
  };

  if (success === 'check_email') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-sky-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Vérifiez votre boîte mail</h2>
          <p className="text-zinc-600 text-sm mb-4">
            Un message de confirmation vous a été envoyé. Ouvrez-le et cliquez sur le lien pour activer votre compte,
            puis connectez-vous avec le même e-mail et mot de passe.
          </p>
          <Link
            to="/login"
            className="inline-block text-orange-600 hover:text-orange-700 font-semibold text-sm"
          >
            Aller à la connexion
          </Link>
        </div>
      </div>
    );
  }

  if (success === 'logged_in') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Compte créé !</h2>
          <p className="text-zinc-500">Bienvenue sur Restafy. Vous allez être redirigé...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-700 mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-600/20">
            <UtensilsCrossed className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tighter">
            RESTAFY<span className="text-orange-600">.</span>
          </h1>
          <p className="text-zinc-500 mt-2 text-sm">
            Créez votre compte client
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              required
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
              required
            />
          </div>

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
              placeholder="8+ caractères, lettre et chiffre"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1">
              Confirmer le mot de passe
            </label>
            <Input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Retapez votre mot de passe"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl"
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </Button>
        </form>

        {/* Switch to login */}
        <div className="mt-6 text-center">
          <p className="text-zinc-500 text-sm">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-orange-600 hover:text-orange-700 font-semibold">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
