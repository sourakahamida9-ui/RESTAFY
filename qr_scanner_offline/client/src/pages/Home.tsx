import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { QrCode, Wifi, Lock, Zap, ShieldCheck, Clock, AlertCircle, Download, Share2 } from "lucide-react";
import { useLocation } from "wouter";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { useTokenAuth } from "@/hooks/useTokenAuth";
import { useEffect, useState } from "react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { isSupported, isOnline, registerPeriodicSync } = useServiceWorker();
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  
  // Authentification par token
  const tokenAuth = useTokenAuth({
    autoValidate: true,
    validateInterval: 300, // 5 minutes
    persistToken: true,
  });

  // Enregistrer la synchronisation périodique quand l'utilisateur est connecté
  useEffect(() => {
    if ((isAuthenticated || tokenAuth.isAuthenticated) && isSupported) {
      registerPeriodicSync(300000); // 5 minutes
    }
  }, [isAuthenticated, tokenAuth.isAuthenticated, isSupported, registerPeriodicSync]);

  // Soumettre un token manuellement
  const handleTokenSubmit = async () => {
    if (!tokenInput.trim()) return;
    
    const success = await tokenAuth.authenticate(tokenInput.trim());
    if (success) {
      setTokenInput('');
      setShowTokenInput(false);
    }
  };

  // Formater le temps restant
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return 'Expiré';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}j ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else {
      return `${minutes}min`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f6f3] via-orange-50/40 to-amber-50/20 text-zinc-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 text-white p-2 rounded-xl shadow-inner">
              <QrCode className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 border-l-2 border-zinc-200 pl-3">Agent Restafy</h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Service Worker Status */}
            {isSupported && (
              <div className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-100 flex items-center gap-2">
                {isOnline ? (
                   <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span> En Ligne</span>
                ) : (
                   <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span> Hors-ligne</span>
                )}
              </div>
            )}
            {isAuthenticated ? (
              <>
                <span className="text-sm font-semibold text-zinc-600">Bienvenue, {user?.name}</span>
                <Button className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl shadow-md" onClick={() => navigate("/scanner")}>Accéder au scanner</Button>
              </>
            ) : (
              <Button className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-md" onClick={() => (window.location.href = getLoginUrl())}>
                Connexion Agent
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-24 pb-16">
        <div className="text-center mb-16">
          <span className="text-sm font-bold tracking-widest text-orange-600 uppercase mb-4 block">Plateforme Événementielle RESTAFY</span>
          <h2 className="text-5xl md:text-6xl font-black text-zinc-900 tracking-tight leading-tight mb-8">
            Terminal de Contrôle <br /><span className="text-orange-600">Ultra-Rapide.</span>
          </h2>
          <p className="text-lg md:text-xl text-zinc-600 font-medium mb-10 max-w-2xl mx-auto">
            L'application certifiée pour scanner les billets d'événements en temps réel avec un support 100% hors-ligne. Une fluidité absolue pour vos agents de sécurité.
          </p>
          {isAuthenticated ? (
            <Button size="lg" className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg px-8 py-6 rounded-2xl shadow-xl hover:shadow-orange-600/20 transition-all hover:-translate-y-1" onClick={() => navigate("/scanner")}>
              Lancer le Terminal <QrCode className="ml-2 w-5 h-5"/>
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-lg px-8 py-6 rounded-2xl shadow-xl transition-all hover:-translate-y-1" onClick={() => (window.location.href = getLoginUrl())}>
                S'authentifier <ShieldCheck className="ml-2 w-5 h-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-zinc-900 border-zinc-900 hover:bg-zinc-100 font-bold rounded-2xl" onClick={() => navigate('/login')}>
                Connexion locale
              </Button>
            </div>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
          <Card className="p-8 hover:shadow-xl transition-all border-zinc-100 rounded-[2rem] bg-white/60 backdrop-blur-sm">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100">
              <QrCode className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="font-bold text-xl mb-3 text-zinc-900">Scan Instantané</h3>
            <p className="text-zinc-500 font-medium leading-relaxed">Validation des billets en temps réel avec un feedback visuel et sonore immédiat pour accélérer les flux.</p>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-all border-zinc-100 rounded-[2rem] bg-white/60 backdrop-blur-sm">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-6 border border-amber-100">
              <Wifi className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="font-bold text-xl mb-3 text-zinc-900">Mode Hors-ligne</h3>
            <p className="text-zinc-500 font-medium leading-relaxed">Continuez à scanner même en zone blanche. La synchronisation reprend automatiquement au retour du réseau.</p>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-all border-zinc-100 rounded-[2rem] bg-white/60 backdrop-blur-sm">
            <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mb-6 border border-zinc-200">
              <Lock className="w-7 h-7 text-zinc-700" />
            </div>
            <h3 className="font-bold text-xl mb-3 text-zinc-900">100% Sécurisé</h3>
            <p className="text-zinc-500 font-medium leading-relaxed">Prévention totale des fraudes et billets doublons grâce au système de validation cryptographique Restafy.</p>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-all border-zinc-100 rounded-[2rem] bg-orange-600 text-white shadow-orange-600/20">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/10">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h3 className="font-bold text-xl mb-3">Ultra Performant</h3>
            <p className="text-orange-100 font-medium leading-relaxed">Conçu pour tenir la charge des plus grands festivals. Optimisé pour la batterie de vos appareils.</p>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-20 py-12 text-center text-zinc-400 font-medium border-t border-zinc-200/50 relative z-10">
        <p>© {new Date().getFullYear()} Restafy. Propulsé par l'écosystème événementiel Restafy.</p>
      </footer>
    </div>
  );
}
