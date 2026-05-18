import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Monitor, ArrowRight, MapPin, CheckCircle2, Smartphone, UtensilsCrossed, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { cn } from '../lib/utils';

type Role = 'client' | 'restaurant' | 'pos';

const ROLES = [
  { id: 'client' as Role,     title: 'Je commande',         icon: UtensilsCrossed, emoji: '🍽️', desc: 'Trouvez les meilleurs plats autour de vous.' },
  { id: 'restaurant' as Role, title: 'Je suis un restaurant',icon: ChefHat,         emoji: '🏪', desc: 'Gérez menus, commandes et événements.' },
  { id: 'pos' as Role,        title: 'Je gère la caisse',    icon: Monitor,         emoji: '🖥️', desc: 'Point de vente rapide, mode hors-ligne.' },
];

const USSD_OPERATORS = [
  { id: 'mtn',    name: 'MTN MoMo',      color: 'bg-yellow-400 text-black', code: '*880*NUMERO*MONTANT#' },
  { id: 'moov',   name: 'Moov Money',    color: 'bg-blue-600 text-white',   code: '*155*1*1*NUMERO*MONTANT#' },
  { id: 'celtiis',name: 'Celtiis Cash',  color: 'bg-emerald-600 text-white',code: '*123*1*NUMERO*MONTANT#' },
];

export default function OnboardingFlow() {
  const navigate = useNavigate();
  const { setHasOnboarded, setUserRole, setUserName, setLocation } = useUserStore();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [loc, setLoc] = useState('Cotonou');
  const [ussdConfig, setUssdConfig] = useState<string[]>([]);
  const TOTAL_STEPS = 4;

  const finish = () => {
    if (role) setUserRole(role);
    if (name) setUserName(name);
    setLocation(`${loc} 📍`);
    setHasOnboarded(true);
    if (role === 'restaurant') navigate('/restaurant/dashboard');
    else if (role === 'pos') navigate('/pos');
    else navigate('/');
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {step > 1 && (
        <div className="px-6 pt-8 pb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Étape {step - 1}/{TOTAL_STEPS - 1}</span>
            <span className="text-[10px] font-bold text-primary">
              {['', 'Votre rôle', 'Vos infos', 'Paiements', 'C\'est parti !'][step] || ''}
            </span>
          </div>
          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* STEP 1: Splash */}
        {step === 1 && (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
              className="w-28 h-28 bg-primary rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary/30 mb-8"
            >
              <UtensilsCrossed className="text-white w-14 h-14" />
            </motion.div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
              <h1 className="text-5xl font-black tracking-tighter mb-2">RESTAFY<span className="text-primary">.</span></h1>
              <p className="text-lg text-zinc-500 mb-2">Ne mangez pas. <span className="text-primary font-bold italic">Savourez.</span></p>
              <p className="text-sm text-zinc-400 mb-12">La plateforme numéro 1 au Bénin pour commander, gérer et savourer.</p>
              <div className="grid grid-cols-3 gap-4 mb-12">
                {[['6+', 'Restaurants'], ['35', 'Min livraison'], ['4.8★', 'Note moy.']].map(([v, l]) => (
                  <div key={l} className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100">
                    <p className="text-xl font-black text-primary">{v}</p>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{l}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep(2)} className="btn-primary w-full text-lg py-5">
                Commencer <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* STEP 2: Role */}
        {step === 2 && (
          <motion.div key="role" initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }}
            className="flex-1 flex flex-col px-6 py-8"
          >
            <h2 className="text-3xl font-black mb-1">Qui êtes-vous ?</h2>
            <p className="text-zinc-500 text-sm mb-8">Choisissez votre profil pour personnaliser votre expérience.</p>
            <div className="space-y-4 flex-1">
              {ROLES.map((r) => (
                <motion.button
                  key={r.id} whileTap={{ scale: 0.97 }}
                  onClick={() => setRole(r.id)}
                  className={cn(
                    'w-full p-5 rounded-3xl border-2 flex items-center gap-4 transition-all text-left',
                    role === r.id ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' : 'border-zinc-100 bg-white'
                  )}
                >
                  <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0', role === r.id ? 'bg-primary/20' : 'bg-zinc-100')}>
                    {r.emoji}
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{r.title}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{r.desc}</p>
                  </div>
                  {role === r.id && <CheckCircle2 className="w-6 h-6 text-primary ml-auto flex-shrink-0" />}
                </motion.button>
              ))}
            </div>
            <button
              onClick={() => role && setStep(3)}
              disabled={!role}
              className={cn('btn-primary w-full mt-8 py-5', !role && 'opacity-40 cursor-not-allowed')}
            >
              Continuer <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* STEP 3: Setup info */}
        {step === 3 && (
          <motion.div key="info" initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }}
            className="flex-1 flex flex-col px-6 py-8"
          >
            <h2 className="text-3xl font-black mb-1">Vos informations</h2>
            <p className="text-zinc-500 text-sm mb-8">Personnalisez votre expérience.</p>
            <div className="space-y-5 flex-1">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block">
                  {role === 'restaurant' ? 'Nom du restaurant' : 'Votre prénom'}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={role === 'restaurant' ? 'Ex: Chez Maman Béatrice' : 'Ex: Hamida'}
                  className="w-full p-4 rounded-2xl border-2 border-zinc-100 focus:border-primary outline-none font-bold text-lg bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block">
                  Votre ville
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['Cotonou', 'Porto-Novo', 'Parakou'].map((city) => (
                    <button
                      key={city}
                      onClick={() => setLoc(city)}
                      className={cn(
                        'p-3 rounded-2xl border-2 text-sm font-bold transition-all flex items-center gap-2 justify-center',
                        loc === city ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-100 bg-white text-zinc-500'
                      )}
                    >
                      <MapPin className="w-3 h-3" /> {city}
                    </button>
                  ))}
                </div>
              </div>
              {role === 'client' && (
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block">Cuisine préférée</label>
                  <div className="flex flex-wrap gap-2">
                    {['🍗 Africaine', '🍕 Italienne', '🍔 Fast-food', '🐟 Poisson', '🥗 Sain'].map(c => (
                      <button key={c} className="px-3 py-2 rounded-xl bg-white border-2 border-zinc-100 text-xs font-bold hover:border-primary hover:text-primary transition-all">
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setStep(4)} className="btn-primary w-full mt-8 py-5">
              Continuer <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* STEP 4: USSD / Final */}
        {step === 4 && (
          <motion.div key="final" initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }}
            className="flex-1 flex flex-col px-6 py-8"
          >
            {role === 'restaurant' ? (
              <>
                <h2 className="text-3xl font-black mb-1">Codes de paiement</h2>
                <p className="text-zinc-500 text-sm mb-6">Configurez vos codes USSD. Les clients paieront directement vers votre compte.</p>
                <div className="space-y-4 flex-1">
                  {USSD_OPERATORS.map((op) => (
                    <div key={op.id} className="bg-white border-2 border-zinc-100 rounded-2xl p-4">
                      <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold mb-3', op.color)}>
                        <Smartphone className="w-4 h-4" /> {op.name}
                      </div>
                      <input
                        placeholder={`Votre numéro ${op.name}`}
                        className="w-full p-3 rounded-xl border border-zinc-100 text-sm font-bold outline-none focus:border-primary bg-zinc-50"
                      />
                      <p className="text-[10px] text-zinc-400 mt-2 font-mono">{op.code}</p>
                    </div>
                  ))}
                  <p className="text-[11px] text-zinc-400 text-center">Vous pourrez modifier ces codes plus tard dans les paramètres.</p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
                  className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6"
                >
                  <Sparkles className="w-10 h-10 text-emerald-500" />
                </motion.div>
                <h2 className="text-3xl font-black mb-2">C'est prêt ! 🎉</h2>
                <p className="text-zinc-500 mb-4">
                  {name ? `Bienvenue, ${name} !` : 'Bienvenue !'} Votre compte est configuré.
                </p>
                <div className="bg-white rounded-2xl p-5 border border-zinc-100 w-full text-left space-y-3 mb-4">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Votre profil</p>
                  {name && <p className="text-sm font-bold">👤 {name}</p>}
                  <p className="text-sm font-bold">📍 {loc}</p>
                  <p className="text-sm font-bold">
                    {role === 'client' ? '🍽️ Client' : role === 'pos' ? '🖥️ Caissier' : '—'}
                  </p>
                </div>
              </div>
            )}
            <button onClick={finish} className="btn-primary w-full mt-6 py-5 text-lg">
              {role === 'restaurant' ? 'Accéder au dashboard' : role === 'pos' ? 'Ouvrir la caisse' : 'Découvrir Restafy'} 🚀
            </button>
            {role === 'client' && (
              <button 
                onClick={() => { 
                  finish(); 
                  // Navigate to feature tutorial after finish for clients
                  setTimeout(() => navigate('/tutorial'), 300);
                }} 
                className="w-full py-3 mt-3 text-sm text-orange-600 font-medium"
              >
                Voir le guide des fonctionnalités →
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
