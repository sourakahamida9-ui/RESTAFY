// src/pages/auth/RestaurantLogin.tsx
// Connexion partenaires — motion design sobre (mesh, stagger, micro-interactions)
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import {
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Building2,
  LayoutDashboard,
  ShoppingBag,
  ClipboardList,
  Users,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';

const RESTAURANT_ROLES = [
  'restaurant_owner',
  'restaurant',
  'manager',
  'staff',
  'livreur',
  'caissier',
];

const FEATURES = [
  { icon: LayoutDashboard, label: 'Tableau de bord en temps réel' },
  { icon: ShoppingBag, label: 'Flux commandes synchronisé' },
  { icon: ClipboardList, label: 'Carte & catalogue centralisés' },
  { icon: Users, label: 'Équipe, rôles et accès sécurisés' },
  { icon: BarChart3, label: 'Indicateurs et exports' },
] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 28 },
  },
};

/** Variants neutres si l’utilisateur demande moins d’animations (accessibilité). */
const reducedContainerVariants = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0, delayChildren: 0 } },
};
const reducedItemVariants = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0 },
};

export default function RestaurantLogin() {
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const { user, profile, loading, signIn, error: authLoadError, signOut } = useAuth();
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '' });

  useEffect(() => {
    if (!loading && user && profile) {
      const role = profile.role;
      if (RESTAURANT_ROLES.includes(role)) {
        navigate('/restaurant/dashboard', { replace: true });
      } else if (role === 'super_admin') {
        navigate('/superadmin', { replace: true });
      } else {
        setError('Cet espace est réservé aux restaurants partenaires.');
      }
    }
  }, [user, profile, loading, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) return;
    setFormLoading(true);
    setError(null);

    const { error: signInError } = await signIn(formData.email, formData.password);

    if (signInError) {
      const msg = signInError.message;
      if (msg.includes('Invalid login credentials')) {
        setError('Email ou mot de passe incorrect.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Confirmez votre email avant de vous connecter.');
      } else if (msg.includes('Too many requests')) {
        setError('Trop de tentatives. Patientez quelques minutes.');
      } else {
        setError(msg);
      }
    }
    setFormLoading(false);
  };

  const blobTransition = prefersReducedMotion
    ? undefined
    : { duration: 14, repeat: Infinity, repeatType: 'reverse' as const, ease: 'easeInOut' as const };

  return (
    <div className="min-h-screen flex bg-zinc-50">
      {/* Panneau gauche — desktop : mesh animé + preuves produit */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-1/2 relative overflow-hidden bg-zinc-950 text-white">
        {/* Fond mesh (blobs) — inspiration dashboards SaaS premium */}
        <div className="absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage:
                'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
          {!prefersReducedMotion && (
            <>
              <motion.div
                className="absolute -top-24 -left-20 w-[min(85vw,520px)] h-[min(85vw,520px)] rounded-full bg-orange-500/25 blur-[100px]"
                animate={{ x: [0, 24, 0], y: [0, 18, 0], scale: [1, 1.06, 1] }}
                transition={blobTransition}
              />
              <motion.div
                className="absolute bottom-0 right-0 w-[min(70vw,440px)] h-[min(70vw,440px)] rounded-full bg-amber-400/15 blur-[90px]"
                animate={{ x: [0, -20, 0], y: [0, -14, 0], scale: [1, 1.05, 1] }}
                transition={{ ...blobTransition, duration: 18 }}
              />
              <motion.div
                className="absolute top-1/3 right-1/4 w-[min(50vw,320px)] h-[min(50vw,320px)] rounded-full bg-zinc-500/20 blur-[80px]"
                animate={{ opacity: [0.25, 0.45, 0.25] }}
                transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' as const }}
              />
            </>
          )}
          {prefersReducedMotion && (
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/15 via-transparent to-amber-500/10" />
          )}
        </div>

        <motion.div
          className="relative z-10 flex flex-col justify-center px-14 xl:px-20 py-16 w-full max-w-lg mx-auto"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="mb-10"
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              <span className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              Espace partenaires
            </div>
          </motion.div>

          <motion.div
            className="flex items-center gap-4 mb-8"
            initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20">
              <Building2 className="h-6 w-6 text-orange-400" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-3xl xl:text-4xl font-semibold tracking-tight text-white">
                RESTAFY<span className="text-orange-400">.</span>
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5 font-medium">Pilotage restaurant</p>
            </div>
          </motion.div>

          <p className="text-zinc-400 text-[15px] leading-relaxed mb-10 max-w-md">
            Une console unique pour les commandes, l’équipe et la performance — conçue pour les
            enseignes qui exigent fiabilité et clarté.
          </p>

          <motion.ul
            className="space-y-0"
            variants={prefersReducedMotion ? reducedContainerVariants : containerVariants}
            initial="hidden"
            animate="show"
          >
            {FEATURES.map(({ icon: Icon, label }) => (
              <motion.li
                key={label}
                variants={prefersReducedMotion ? reducedItemVariants : itemVariants}
                className="flex items-center gap-4 py-3.5 border-t border-white/[0.06] first:border-t-0 first:pt-0"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                  <Icon className="h-4 w-4 text-orange-400/90" strokeWidth={1.75} />
                </span>
                <span className="text-sm text-zinc-300 font-medium leading-snug">{label}</span>
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>
      </div>

      {/* Formulaire */}
      <div className="w-full lg:w-[48%] xl:w-1/2 flex items-center justify-center p-6 sm:p-10">
        <motion.div
          className="w-full max-w-[420px]"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Accent supérieur type blocs login SaaS */}
          <motion.div
            className="h-[3px] w-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600 mb-8 origin-left"
            initial={prefersReducedMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />

          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <motion.div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            >
              <Building2 className="h-6 w-6 text-orange-500" strokeWidth={1.5} />
            </motion.div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              RESTAFY<span className="text-orange-500">.</span>
            </h1>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mt-1">
              Partenaires
            </p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-zinc-900 tracking-tight">Connexion</h2>
            <p className="text-zinc-500 text-sm mt-1.5 leading-relaxed">
              Accédez à votre espace professionnel sécurisé.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key={error}
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="flex items-start gap-3 p-4 bg-red-50/90 border border-red-100 rounded-2xl backdrop-blur-sm">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium leading-snug">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!loading && user && !profile && (
            <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left mb-6">
              <p className="text-sm font-semibold text-amber-900">Profil non chargé</p>
              <p className="text-xs text-amber-800 leading-relaxed">
                {authLoadError?.message ??
                  'Impossible de récupérer votre fiche utilisateur. Déconnectez-vous puis réessayez.'}
              </p>
              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
              >
                Se déconnecter
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Email professionnel
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="contact@monrestaurant.com"
                required
                autoComplete="username"
                className="w-full px-4 py-3.5 bg-white border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400/80 transition-all placeholder:text-zinc-300"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Mot de passe
                </label>
                <Link
                  to="/login?forgot=true"
                  className="text-xs text-orange-600 hover:text-orange-700 font-semibold transition-colors"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3.5 bg-white border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400/80 transition-all pr-12 placeholder:text-zinc-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={formLoading || !formData.email || !formData.password || (!!user && !profile)}
              whileTap={prefersReducedMotion || formLoading ? undefined : { scale: 0.985 }}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm rounded-xl transition-colors shadow-lg shadow-zinc-900/10 disabled:opacity-50 disabled:cursor-not-allowed ring-1 ring-white/10"
            >
              {formLoading ? (
                <>
                  <span
                    className={
                      prefersReducedMotion
                        ? 'h-4 w-4 rounded-full border-2 border-white/40 border-t-white'
                        : 'h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent'
                    }
                    aria-hidden
                  />
                  Connexion…
                </>
              ) : (
                <>
                  Accéder au tableau de bord
                  <ArrowRight className="w-4 h-4 opacity-90" />
                </>
              )}
            </motion.button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-zinc-50 px-3 text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                ou
              </span>
            </div>
          </div>

          <div className="space-y-3 text-center text-sm">
            <p className="text-zinc-600">
              Nouveau partenaire ?{' '}
              <Link
                to="/restaurant/signup"
                className="text-orange-600 hover:text-orange-700 font-semibold transition-colors"
              >
                Créer un compte restaurant
              </Link>
            </p>
            <p className="text-zinc-400 text-sm">
              Vous êtes un client ?{' '}
              <Link
                to="/login"
                className="text-zinc-600 hover:text-zinc-900 font-medium underline underline-offset-2 decoration-zinc-300"
              >
                Connexion client
              </Link>
            </p>
          </div>

          <motion.div
            className="mt-10 flex items-center justify-center gap-2 text-[11px] text-zinc-400 font-medium"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={2} />
            <span>Connexion chiffrée — réservée aux comptes partenaires vérifiés</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
