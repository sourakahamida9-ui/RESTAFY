import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatAuthErrorMessage } from '@/lib/formatSupabaseError';
import { validateSignupFields } from '@/lib/signupValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UtensilsCrossed, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function RestaurantSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<'none' | 'dashboard' | 'check_email'>('none');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenChecking, setTokenChecking] = useState(true);
  const [inviteInfo, setInviteInfo] = useState<{ name?: string; description?: string } | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    restaurantName: '',
  });

  // ✅ Vérifier le token dans la base de données au chargement
  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setTokenValid(false);
        setTokenChecking(false);
        return;
      }

      try {
        // Récupérer le token depuis la BD
        const { data } = await supabase
          .from('restaurant_invites')
          .select('id, is_used, expires_at, invite_name, description')
          .eq('token', token)
          .single();

        if (!data) {
          setTokenValid(false);
          setError('Lien d\'invitation invalide.');
          setTokenChecking(false);
          return;
        }

        // Vérifier si le lien a déjà été utilisé
        if (data.is_used) {
          setTokenValid(false);
          setError('Ce lien d\'invitation a déjà été utilisé.');
          setTokenChecking(false);
          return;
        }

        // Vérifier l'expiration
        if (data.expires_at) {
          const expiresDate = new Date(data.expires_at);
          if (expiresDate < new Date()) {
            setTokenValid(false);
            setError('Ce lien d\'invitation a expiré. Veuillez contacter l\'administrateur.');
            setTokenChecking(false);
            return;
          }
        }

        // Token valide!
        setTokenValid(true);
        setInviteInfo({
          name: data.invite_name,
          description: data.description,
        });
      } catch (err) {
        if (import.meta.env.DEV) console.error('[RestaurantSignup] verifyToken:', err);
        setTokenValid(false);
        setError('Lien d\'invitation invalide ou expiré.');
      }

      setTokenChecking(false);
    };

    verifyToken();
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const validationError = validateSignupFields({
      ...formData,
      restaurantName: formData.restaurantName,
    });
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    // 1. Créer le compte utilisateur avec rôle restaurant_owner
    // Le trigger Supabase créera automatiquement le profil ET le restaurant
    const { user, error: signUpError, pendingEmailConfirmation } = await signUp(
      formData.email,
      formData.password,
      formData.fullName,
      formData.phone,
      'restaurant_owner',
      undefined, // pas de restaurant_id ici
      formData.restaurantName // passer le nom du restaurant
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
      // Marquer le token comme utilisé avec infos du restaurant
      const token = searchParams.get('token');
      if (token) {
        // Non-bloquant — pas besoin d'attendre
        supabase
          .from('restaurant_invites')
          .update({
            is_used: true,
            used_by_email: formData.email,
            used_by_restaurant_name: formData.restaurantName,
            used_at: new Date().toISOString(),
          })
          .eq('token', token)
          .then(() => {
            if (import.meta.env.DEV) console.log('[Signup] Token marked as used');
          });
      }

      // ✅ Le restaurant est créé en arrière-plan par useAuth.signUp
      // Le Dashboard gère lui-même le cas restaurant_id null (écran d'attente)
      setSuccess('dashboard');
      setTimeout(() => navigate('/restaurant/dashboard'), 1500);
    }

    setLoading(false);
  };

  // Vérification en cours
  if (tokenChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Vérification du lien...</p>
        </div>
      </div>
    );
  }

  // Token invalide ou manquant
  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Accès refusé</h2>
          <p className="text-zinc-500 mb-6">
            L'inscription restaurant nécessite un lien d'invitation valide.
            <br />
            Contactez l'équipe Restafy pour obtenir votre lien.
          </p>
          <Link to="/login">
            <Button className="bg-orange-600 hover:bg-orange-700 text-white">
              Retour à la connexion
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // E-mail de confirmation (compte créé côté Supabase, lien dans la boîte mail)
  if (success === 'check_email') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-sky-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Vérifiez votre boîte mail</h2>
          <p className="text-zinc-600 text-sm mb-4">
            Un e-mail de confirmation vous a été envoyé. Après avoir cliqué sur le lien, reconnectez-vous avec le même
            e-mail et mot de passe. Votre lien d’invitation reste valide jusqu’à la fin de l’inscription.
          </p>
          <Link to="/login">
            <Button className="bg-orange-600 hover:bg-orange-700 text-white">Aller à la connexion</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Succès — session active
  if (success === 'dashboard') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Restaurant créé !</h2>
          <p className="text-zinc-500">
            Bienvenue sur Restafy. Vous allez être redirigé vers votre tableau de bord...
          </p>
        </div>
      </div>
    );
  }

  // Formulaire d'inscription
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
            Inscription Restaurant Partenaire
          </p>
          <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Lien d'invitation valide
          </div>
        </div>

        {/* Invite Info */}
        {inviteInfo && (inviteInfo.name || inviteInfo.description) && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            {inviteInfo.name && (
              <p className="text-sm font-semibold text-blue-900">{inviteInfo.name}</p>
            )}
            {inviteInfo.description && (
              <p className="text-xs text-blue-700 mt-1">{inviteInfo.description}</p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 mb-4">
            <label className="block text-sm font-semibold text-orange-700 mb-1">
              Nom du restaurant
            </label>
            <Input
              type="text"
              name="restaurantName"
              value={formData.restaurantName}
              onChange={handleInputChange}
              placeholder="Ex: Le Gourmet, Chez Mama..."
              className="bg-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1">
                Votre nom
              </label>
              <Input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Nom complet"
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
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1">
              Email professionnel
            </label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="contact@restaurant.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1">
                Mot de passe
              </label>
              <Input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="8+ car., lettre et chiffre"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1">
                Confirmer
              </label>
              <Input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirmer"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl"
          >
            {loading ? 'Création en cours...' : 'Créer mon restaurant'}
          </Button>
        </form>

        {/* Already have account */}
        <div className="mt-6 text-center">
          <p className="text-zinc-500 text-sm">
            Déjà partenaire ?{' '}
            <Link to="/login" className="text-orange-600 hover:text-orange-700 font-semibold">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
