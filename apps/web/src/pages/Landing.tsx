// src/pages/Landing.tsx — Page d'accueil Restafy
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Clock, Star, ArrowRight, ChevronDown,
  Utensils, Truck, Shield, Smartphone, Store, Users, CreditCard, CheckCircle2
} from 'lucide-react';
import { useRestaurants } from '@/hooks/useRestaurant';

// Stats animées
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const duration = 1500;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{count.toLocaleString('fr-FR')}{suffix}</span>;
}

// Restaurant card mini
function RestaurantPreview({ restaurant, onClick }: { restaurant: any; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all cursor-pointer group"
    >
      <div className="h-36 bg-gradient-to-br from-orange-400 to-red-500 relative overflow-hidden">
        {restaurant.banner_url ? (
          <img src={restaurant.banner_url} alt={restaurant.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/30 text-4xl font-black">{restaurant.name.charAt(0)}</span>
          </div>
        )}
        <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1">
          <Clock className="w-3 h-3 text-orange-500" />
          <span className="text-xs font-bold text-zinc-700">{restaurant.delivery_time_min}-{restaurant.delivery_time_max} min</span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-zinc-900 truncate group-hover:text-orange-600 transition-colors">{restaurant.name}</h3>
        <p className="text-xs text-zinc-400 mt-1 capitalize">{restaurant.cuisine_type || 'Restaurant'}</p>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="text-sm font-bold text-zinc-700">{restaurant.avg_rating?.toFixed(1) || '4.5'}</span>
          </div>
          <span className={`text-xs font-semibold ${restaurant.delivery_fee === 0 ? 'text-emerald-600' : 'text-zinc-500'}`}>
            {restaurant.delivery_fee === 0 ? 'Livraison gratuite' : `${restaurant.delivery_fee} FCFA`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { restaurants, loading } = useRestaurants();
  const topRestaurants = restaurants
    .filter(r => r.is_active)
    .sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))
    .slice(0, 6);

  const stats = [
    { icon: Store, value: restaurants.length || 50, label: 'Restaurants', suffix: '+' },
    { icon: Users, value: 5000, label: 'Clients satisfaits', suffix: '+' },
    { icon: Truck, value: 15000, label: 'Livraisons', suffix: '+' },
    { icon: Star, value: 4.8, label: 'Note moyenne', suffix: '/5' },
  ];

  const features = [
    { icon: Utensils, title: 'Large choix', desc: 'Des dizaines de restaurants et cuisines du Benin' },
    { icon: Clock, title: 'Livraison rapide', desc: 'Recevez votre commande en 30 min ou moins' },
    { icon: Shield, title: 'Paiement securise', desc: 'Payez par Mobile Money MTN, Moov ou en especes' },
    { icon: Smartphone, title: 'Facile a utiliser', desc: 'Commandez en quelques clics depuis votre telephone' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-lg">R</span>
            </div>
            <span className="font-black text-xl text-zinc-900">Restafy</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#restaurants" className="text-sm font-medium text-zinc-600 hover:text-orange-600 transition-colors">Restaurants</a>
            <a href="#comment-ca-marche" className="text-sm font-medium text-zinc-600 hover:text-orange-600 transition-colors">Comment ca marche</a>
            <button onClick={() => navigate('/login')} className="text-sm font-medium text-zinc-600 hover:text-orange-600 transition-colors">Connexion</button>
          </nav>
          <button
            onClick={() => navigate('/restaurants')}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-orange-200"
          >
            Commander
          </button>
        </div>
      </header>

      {/* Hero Section - Full screen */}
      <section className="min-h-screen flex items-center justify-center pt-16 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-red-50" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-200/20 rounded-full blur-3xl" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left content */}
            <div className="text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-semibold mb-6"
              >
                <MapPin className="w-4 h-4" />
                Disponible a Cotonou, Porto-Novo & Abomey-Calavi
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-black text-zinc-900 leading-tight"
              >
                Vos plats preferes
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">
                  livres chez vous
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 text-lg text-zinc-600 max-w-lg mx-auto lg:mx-0"
              >
                Decouvrez les meilleurs restaurants du Benin et commandez en quelques clics. 
                Livraison rapide, paiement securise.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <button
                  onClick={() => navigate('/restaurants')}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-xl shadow-orange-200 hover:shadow-orange-300 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  Commander maintenant
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="bg-white hover:bg-zinc-50 text-zinc-700 font-bold text-lg px-8 py-4 rounded-2xl border-2 border-zinc-200 transition-all hover:-translate-y-0.5"
                >
                  Creer un compte
                </button>
              </motion.div>

              {/* Trust badges */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-10 flex items-center gap-6 justify-center lg:justify-start text-sm text-zinc-500"
              >
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 border-2 border-white flex items-center justify-center text-white text-xs font-bold">
                        {String.fromCharCode(65 + i)}
                      </div>
                    ))}
                  </div>
                  <span>5000+ clients</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold">4.8/5</span>
                  <span>avis</span>
                </div>
              </motion.div>
            </div>

            {/* Right - Food illustration / Preview cards */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="relative hidden lg:block"
            >
              <div className="relative w-full aspect-square max-w-lg mx-auto">
                {/* Main circle background */}
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 rounded-full opacity-10" />
                
                {/* Floating food cards */}
                <div className="absolute top-8 left-0 bg-white rounded-2xl shadow-xl p-4 w-48">
                  <div className="h-24 bg-gradient-to-br from-orange-300 to-red-400 rounded-xl mb-3" />
                  <div className="h-3 bg-zinc-200 rounded w-3/4 mb-2" />
                  <div className="h-2 bg-zinc-100 rounded w-1/2" />
                </div>
                
                <div className="absolute top-1/3 right-0 bg-white rounded-2xl shadow-xl p-4 w-52">
                  <div className="h-28 bg-gradient-to-br from-amber-300 to-orange-400 rounded-xl mb-3" />
                  <div className="h-3 bg-zinc-200 rounded w-2/3 mb-2" />
                  <div className="h-2 bg-zinc-100 rounded w-1/2" />
                </div>
                
                <div className="absolute bottom-8 left-1/4 bg-white rounded-2xl shadow-xl p-4 w-44">
                  <div className="h-20 bg-gradient-to-br from-red-300 to-pink-400 rounded-xl mb-3" />
                  <div className="h-3 bg-zinc-200 rounded w-4/5 mb-2" />
                  <div className="h-2 bg-zinc-100 rounded w-2/3" />
                </div>

                {/* Delivery badge */}
                <div className="absolute bottom-1/4 right-8 bg-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Truck className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Livraison</p>
                    <p className="text-sm font-bold text-zinc-900">15-30 min</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-400"
        >
          <span className="text-xs">Decouvrir</span>
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-zinc-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <stat.icon className="w-8 h-8 text-orange-400 mx-auto mb-3" />
                <div className="text-3xl sm:text-4xl font-black">
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-zinc-400 text-sm mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Restaurants Section */}
      <section id="restaurants" className="py-20 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl font-black text-zinc-900"
            >
              Restaurants populaires
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="mt-4 text-zinc-600 max-w-2xl mx-auto"
            >
              Decouvrez les restaurants les mieux notes par nos clients
            </motion.p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {topRestaurants.map((restaurant) => (
                <RestaurantPreview
                  key={restaurant.id}
                  restaurant={restaurant}
                  onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                />
              ))}
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <button
              onClick={() => navigate('/restaurants')}
              className="bg-white hover:bg-zinc-100 text-zinc-900 font-bold px-8 py-4 rounded-2xl border-2 border-zinc-200 transition-all inline-flex items-center gap-2 hover:-translate-y-0.5"
            >
              Voir tous les restaurants
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="comment-ca-marche" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl font-black text-zinc-900"
            >
              Pourquoi choisir Restafy ?
            </motion.h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="font-bold text-lg text-zinc-900 mb-2">{feature.title}</h3>
                <p className="text-zinc-500 text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 bg-zinc-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-black mb-6">
                Sécurité & Sérieux
              </h2>
              <h3 className="text-xl font-bold text-orange-400 mb-4">
                Construit sur des bases solides
              </h3>
              <p className="text-zinc-300 mb-6">
                Vos données transitent en HTTPS ; l'architecture s'appuie sur des services managés. Les paiements Mobile Money suivent les parcours des opérateurs — pas un circuit opaque « maison ».
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold">MTN Mobile Money</p>
                    <p className="text-sm text-zinc-400">Paiement direct via MTN</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold">Moov Money</p>
                    <p className="text-sm text-zinc-400">Paiement direct via Moov</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold">Celtiis Cash</p>
                    <p className="text-sm text-zinc-400">Paiement direct via Celtiis</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold">Kkiapay</p>
                    <p className="text-sm text-zinc-400">Mobile Money & Cartes bancaires</p>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-zinc-800 rounded-2xl p-8"
            >
              <div className="flex items-center gap-2 mb-6">
                <Shield className="w-6 h-6 text-green-400" />
                <h3 className="font-bold text-lg">Connexion sécurisée (HTTPS)</h3>
              </div>
              <p className="text-zinc-300 mb-6">
                Une infrastructure de paiement robuste. Grâce à notre partenaire technique Kkiapay, vos transactions sont traitées via les canaux officiels avec une sécurité de niveau bancaire.
              </p>
              <div className="border-t border-zinc-700 pt-6">
                <h4 className="font-bold mb-3">Le choix du paiement, c'est vous qui décidez</h4>
                <ul className="space-y-2 text-zinc-300 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    Pour les commandes sur place : paiement en ligne via Kkiapay, en espèces, ou directement au restaurant
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    Pour la livraison : paiement en ligne via Kkiapay ou Mobile Money
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    Normalisation automatique des numéros (+229 par défaut)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    Aucune commande créée si le paiement échoue
                  </li>
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-orange-500 to-red-500 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl lg:text-5xl font-black"
          >
            Pret a commander ?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-orange-100 max-w-2xl mx-auto"
          >
            Rejoignez des milliers de clients satisfaits et profitez des meilleurs restaurants du Benin
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <button
              onClick={() => navigate('/restaurants')}
              className="bg-white hover:bg-zinc-100 text-orange-600 font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-xl hover:-translate-y-0.5"
            >
              Commander maintenant
            </button>
            <button
              onClick={() => navigate('/partner')}
              className="bg-transparent hover:bg-white/10 text-white font-bold text-lg px-8 py-4 rounded-2xl border-2 border-white/50 transition-all hover:-translate-y-0.5"
            >
              Devenir partenaire
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-zinc-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-black text-lg">R</span>
                </div>
                <span className="font-black text-xl">Restafy</span>
              </div>
              <p className="text-zinc-400 text-sm">
                La meilleure plateforme de livraison de repas au Benin
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Liens rapides</h4>
              <ul className="space-y-2 text-zinc-400 text-sm">
                <li><a href="#restaurants" className="hover:text-white transition-colors">Restaurants</a></li>
                <li><a href="#comment-ca-marche" className="hover:text-white transition-colors">Comment ca marche</a></li>
                <li><button onClick={() => navigate('/partner')} className="hover:text-white transition-colors">Devenir partenaire</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-zinc-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Centre d'aide</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contactez-nous</a></li>
                <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Contact</h4>
              <ul className="space-y-2 text-zinc-400 text-sm">
                <li>Cotonou, Benin</li>
                <li>+229 XX XX XX XX</li>
                <li>contact@restafy.shop</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-zinc-800 mt-12 pt-8 text-center text-zinc-500 text-sm">
            <p>2024 Restafy. Tous droits reserves.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
