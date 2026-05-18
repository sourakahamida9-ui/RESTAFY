// src/pages/Home.tsx — Interface refonte complète
import React, { useState, useMemo, useRef, useId } from 'react';
import type { Database } from '@/lib/supabase';
import {
  Search, Star, Clock, Heart, Grid3X3, List,
  RotateCcw, ChevronRight, Zap,
  Timer, X, SlidersHorizontal,
  ArrowRight, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRestaurants } from '@/hooks/useRestaurant';
import { RestafyLoader } from '@/components/ui/RestafyLoader';
import { EmptyState } from '@/components/EmptyState';
import { OptimizedImg } from '@/components/OptimizedImg';

// ─── Types ────────────────────────────────────────────────────────────────────
type Restaurant = Database['public']['Tables']['restaurants']['Row'];
type PriceFilter = 'economique' | 'medium' | 'premium' | null;
type TimeFilter = 30 | 45 | null;
type SortBy = 'recommended' | 'rating' | 'time' | 'price';

// ─── Avatar / Banner helpers ──────────────────────────────────────────────────
const PALETTES = [
  ['#F27D26', '#EF4444'], ['#8B5CF6', '#6366F1'], ['#10B981', '#059669'],
  ['#F59E0B', '#D97706'], ['#EC4899', '#DB2777'], ['#14B8A6', '#0D9488'],
];
const BANNER_GRADIENTS = [
  'from-orange-400 to-red-500', 'from-purple-500 to-indigo-600',
  'from-emerald-400 to-teal-600', 'from-amber-400 to-orange-500',
  'from-pink-500 to-rose-600', 'from-teal-400 to-cyan-600',
];

function getInitials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function RestaurantAvatar({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const [err, setErr] = useState(false);
  const [from, to] = PALETTES[name.charCodeAt(0) % PALETTES.length];
  if (logoUrl && !err)
    return (
      <OptimizedImg
        src={logoUrl}
        alt={name}
        sizes="40px"
        referrerPolicy="no-referrer"
        className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
        onError={() => setErr(true)}
      />
    );
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm flex-shrink-0"
      style={{ background: `linear-gradient(135deg,${from},${to})` }}>
      {getInitials(name)}
    </div>
  );
}

function RestaurantBannerBg({
  bannerUrl,
  name,
  priority = false,
}: { bannerUrl?: string | null; name: string; priority?: boolean }) {
  const [err, setErr] = useState(false);
  const g = BANNER_GRADIENTS[name.charCodeAt(0) % BANNER_GRADIENTS.length];
  if (bannerUrl && !err)
    return (
      <OptimizedImg
        src={bannerUrl}
        alt={name}
        priority={priority}
        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 320px"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover"
        onError={() => setErr(true)}
      />
    );
  return (
    <div className={`w-full h-full bg-gradient-to-br ${g} flex items-center justify-center`}>
      <span className="text-white/20 text-5xl font-black">{getInitials(name)}</span>
    </div>
  );
}

// ─── Restaurant Card ──────────────────────────────────────────────────────────
const RestaurantCard = React.memo(function RestaurantCard({
  restaurant,
  onClick,
  imagePriority = false,
}: {
  restaurant: Restaurant;
  onClick: () => void;
  imagePriority?: boolean;
}) {
  const [liked, setLiked] = useState(false);
  const title = `Ouvrir ${restaurant.name}, voir le menu`;
  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="bg-white rounded-[20px] overflow-hidden border border-gray-100/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] transition-all duration-300 cursor-pointer flex flex-col group/card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 hover:-translate-y-1.5 motion-reduce:hover:translate-y-0"
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 transition-transform duration-500 group-hover/card:scale-105">
          <RestaurantBannerBg bannerUrl={restaurant.banner_url} name={restaurant.name} priority={imagePriority} />
        </div>

        {/* Gradient overlay bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Overlay sombre si fermé */}
        {!restaurant.is_open && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center">
            <span className="bg-black/70 backdrop-blur-md text-white text-xs font-bold px-5 py-2 rounded-full tracking-wide border border-white/10">
              FERMÉ
            </span>
          </div>
        )}

        {/* Badge temps de livraison */}
        <div className="absolute bottom-2.5 left-2.5 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
          <Clock className="w-3 h-3 text-orange-500" />
          <span className="text-[11px] font-bold text-gray-700">
            {restaurant.delivery_time_min}–{restaurant.delivery_time_max} min
          </span>
        </div>

        {/* Bouton favoris */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setLiked(v => !v); }}
          aria-label={liked ? `Retirer ${restaurant.name} des favoris` : `Ajouter ${restaurant.name} aux favoris`}
          aria-pressed={liked}
          className="absolute top-2.5 right-2.5 w-11 h-11 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm hover:bg-white hover:scale-110 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          <Heart className={`w-4 h-4 transition-all duration-200 ${liked ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-300 hover:text-red-400'}`} aria-hidden />
        </button>

        {/* Badge vérifié si top rated */}
        {(restaurant.avg_rating || 0) >= 4.5 && (
          <div className="absolute top-2.5 left-2.5 bg-gradient-to-r from-amber-400 to-orange-400 text-black text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md shadow-amber-400/20">
            <Star className="w-2.5 h-2.5 fill-black" /> TOP
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="font-bold text-gray-900 leading-tight line-clamp-1 text-[15px]">{restaurant.name}</h3>
          <div className="flex items-center gap-1 flex-shrink-0 bg-amber-50 px-2 py-0.5 rounded-lg">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-xs font-black text-amber-700">{restaurant.avg_rating?.toFixed(1) || '–'}</span>
          </div>
        </div>

        <p className="text-[12px] text-gray-400 mb-3 capitalize line-clamp-1">
          {restaurant.cuisine_type || 'Restaurant'}{restaurant.city ? ` · ${restaurant.city}` : ''}
        </p>

        <div className="flex items-center gap-3 text-[12px] text-gray-500 mt-auto mb-3">
          <span className={`font-semibold ${restaurant.delivery_fee === 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
            {restaurant.delivery_fee === 0 ? '✓ Livraison gratuite' : `Livraison ${restaurant.delivery_fee.toLocaleString('fr-FR')} FCFA`}
          </span>
          {(restaurant.total_reviews || 0) > 0 && (
            <>
              <span className="text-gray-200">·</span>
              <span>{restaurant.total_reviews} avis</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={e => { e.stopPropagation(); onClick(); }}
          className="w-full py-2.5 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-500 hover:to-orange-600 text-orange-600 hover:text-white font-bold text-[13px] rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 group border border-orange-100 hover:border-orange-500 hover:shadow-lg hover:shadow-orange-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        >
          Voir le menu
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" aria-hidden />
        </button>
      </div>
    </article>
  );
});

// ─── Restaurant List Card ────────────────────────────────────────────────────
function RestaurantListCard({
  restaurant,
  onClick,
  imagePriority = false,
}: { restaurant: Restaurant; onClick: () => void; imagePriority?: boolean }) {
  const label = `Ouvrir ${restaurant.name}, voir le menu`;
  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-4 p-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2"
      onClick={onClick}
    >
      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 relative">
        <RestaurantBannerBg bannerUrl={restaurant.banner_url} name={restaurant.name} priority={imagePriority} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900 truncate">{restaurant.name}</h3>
          {!restaurant.is_open && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Fermé</span>}
        </div>
        <p className="text-xs text-gray-400 mt-0.5 capitalize">{restaurant.cuisine_type || 'Restaurant'}</p>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
          <span className="flex items-center gap-1 font-bold text-amber-500">
            <Star className="w-3 h-3 fill-amber-400" />{restaurant.avg_rating?.toFixed(1) || '–'}
          </span>
          <span className="text-gray-200">·</span>
          <span>{restaurant.delivery_time_min}–{restaurant.delivery_time_max} min</span>
          <span className="text-gray-200">·</span>
          <span className={restaurant.delivery_fee === 0 ? 'text-emerald-600 font-semibold' : ''}>
            {restaurant.delivery_fee === 0 ? 'Gratuit' : `${restaurant.delivery_fee.toLocaleString()} FCFA`}
          </span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
    </article>
  );
}

// ─── Filter Sidebar ───────────────────────────────────────────────────────────
function FilterSidebar({
  cuisines, cuisineFilters, setCuisineFilters,
  priceFilter, setPriceFilter,
  timeFilter, setTimeFilter,
  hasActive, onReset,
  openOnly, setOpenOnly,
}: any) {
  const openFilterLabelId = useId();
  const PRICE_OPTIONS = [
    { id: 'economique', label: 'Économique', desc: 'Livraison < 500 FCFA' },
    { id: 'medium', label: 'Moyen', desc: 'Livraison < 1000 FCFA' },
    { id: 'premium', label: 'Premium', desc: 'Livraison libre' },
  ];
  const TIME_OPTIONS = [
    { val: 30, label: '< 30 min', Icon: Timer },
    { val: 45, label: '< 45 min', Icon: Zap },
  ];

  return (
    <aside className="w-full space-y-3">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-orange-500" />
            <h2 className="font-black text-gray-900 text-[15px]">Filtres</h2>
          </div>
          {hasActive && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 text-[11px] text-orange-600 font-bold bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3 h-3" aria-hidden /> Réinitialiser
            </button>
          )}
        </div>

        {/* Ouvert maintenant */}
        <div className="mb-5 pb-5 border-b border-gray-50">
          <div className="flex items-center justify-between gap-3">
            <span id={openFilterLabelId} className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" aria-hidden />
              Ouvert maintenant
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={openOnly}
              aria-labelledby={openFilterLabelId}
              onClick={() => setOpenOnly((v: boolean) => !v)}
              className={`relative w-10 shrink-0 rounded-full transition-colors duration-200 flex items-center px-0.5 py-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${openOnly ? 'bg-orange-500' : 'bg-gray-200'}`}
              style={{ height: '22px' }}
            >
              <span
                className={`block w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-out ${openOnly ? 'translate-x-[18px]' : 'translate-x-0'}`}
              />
            </button>
          </div>
        </div>

        {/* Catégories */}
        <div className="mb-5 pb-5 border-b border-gray-50">
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Cuisine</h3>
          <div className="flex flex-wrap gap-2">
            {cuisines.map((c: string) => (
              <button
                key={c}
                type="button"
                aria-pressed={cuisineFilters.includes(c)}
                onClick={() => setCuisineFilters((prev: string[]) =>
                  prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
                )}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 border ${cuisineFilters.includes(c)
                  ? 'bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-200'
                  : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700'
                  }`}
              >
                {c}
                {cuisineFilters.includes(c) && <X className="w-3 h-3 inline ml-1 -mr-0.5" aria-hidden />}
              </button>
            ))}
          </div>
        </div>

        {/* Temps */}
        <div className="mb-5 pb-5 border-b border-gray-50">
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Temps de livraison</h3>
          <div className="space-y-2">
            {TIME_OPTIONS.map(t => (
              <button
                key={t.val}
                type="button"
                aria-pressed={timeFilter === t.val}
                onClick={() => setTimeFilter((prev: TimeFilter) => prev === t.val ? null : t.val as TimeFilter)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-all text-left ${timeFilter === t.val
                  ? 'bg-orange-50 border-orange-300 text-orange-700'
                  : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-orange-200'
                  }`}
              >
                <t.Icon className="w-4 h-4 text-orange-500 flex-shrink-0" aria-hidden />
                {t.label}
                {timeFilter === t.val && <div className="ml-auto w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center"><div className="w-2 h-2 bg-white rounded-full" /></div>}
              </button>
            ))}
          </div>
        </div>

        {/* Prix livraison */}
        <div>
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Frais de livraison</h3>
          <div className="space-y-2">
            {PRICE_OPTIONS.map(p => (
              <button
                key={p.id}
                type="button"
                aria-pressed={priceFilter === p.id}
                onClick={() => setPriceFilter((prev: PriceFilter) => prev === p.id ? null : p.id as PriceFilter)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all ${priceFilter === p.id
                  ? 'bg-orange-50 border-orange-300'
                  : 'bg-gray-50 border-gray-100 hover:border-orange-200'
                  }`}
              >
                <span className={`font-bold block ${priceFilter === p.id ? 'text-orange-700' : 'text-gray-700'}`}>{p.label}</span>
                <span className="text-[11px] text-gray-400">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CTA reset si filtres actifs */}
      {hasActive && (
        <button
          type="button"
          onClick={onReset}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-orange-200 transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" aria-hidden />
          Effacer tous les filtres
        </button>
      )}
    </aside>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const { restaurants, loading, error, refetch } = useRestaurants();
  const searchRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [cuisineFilters, setCuisineFilters] = useState<string[]>([]);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('recommended');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const availableCuisines = useMemo(() => {
    const types = restaurants.map(r => r.cuisine_type).filter(Boolean) as string[];
    return Array.from(new Set(types)).slice(0, 10);
  }, [restaurants]);

  const openNowTotal = useMemo(() => restaurants.filter(r => r.is_open).length, [restaurants]);

  const resetFilters = () => {
    setCuisineFilters([]); setPriceFilter(null); setTimeFilter(null);
    setOpenOnly(false); setSortBy('recommended'); setSearchQuery('');
  };

  const hasActiveFilters = cuisineFilters.length > 0 || priceFilter || timeFilter || openOnly;

  const filtered = useMemo(() => {
    let list = restaurants.filter(r =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.cuisine_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.address || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (openOnly) list = list.filter(r => r.is_open);
    if (cuisineFilters.length > 0) list = list.filter(r => r.cuisine_type && cuisineFilters.includes(r.cuisine_type));
    if (timeFilter === 30) list = list.filter(r => r.delivery_time_max <= 30);
    if (timeFilter === 45) list = list.filter(r => r.delivery_time_max <= 45);
    if (priceFilter === 'economique') list = list.filter(r => r.delivery_fee < 500);
    if (priceFilter === 'medium') list = list.filter(r => r.delivery_fee < 1000);
    if (sortBy === 'rating') list = [...list].sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
    if (sortBy === 'time') list = [...list].sort((a, b) => a.delivery_time_max - b.delivery_time_max);
    if (sortBy === 'price') list = [...list].sort((a, b) => a.delivery_fee - b.delivery_fee);
    return list;
  }, [restaurants, searchQuery, cuisineFilters, priceFilter, timeFilter, openOnly, sortBy]);

  const openNow = useMemo(() => filtered.filter(r => r.is_open), [filtered]);
  const closedR = useMemo(() => filtered.filter(r => !r.is_open), [filtered]);

  const activeFilterCount = cuisineFilters.length + (priceFilter ? 1 : 0) + (timeFilter ? 1 : 0) + (openOnly ? 1 : 0);

  const favorisPreview =
    !searchQuery && !openOnly
      ? openNow.filter(r => (r.avg_rating || 0) >= 4.5).slice(0, 5)
      : [];
  const showFavorisSection = favorisPreview.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── HERO — SIGNATURE DARK DESIGN ─────────────────────────────────── */}
      <section className="relative bg-[#08080A] overflow-hidden min-h-[55vh] sm:min-h-[52vh] flex items-center">
        {/* Multi-layered gradient orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] w-[420px] h-[420px] sm:w-[650px] sm:h-[650px]">
            <div className="home-hero-orb-a absolute inset-0 bg-gradient-to-br from-orange-500/60 via-red-500/30 to-transparent rounded-full blur-[100px] sm:blur-[140px]" />
          </div>
          <div className="absolute top-[20%] right-[10%] w-[250px] h-[250px] sm:w-[350px] sm:h-[350px]">
            <div className="home-hero-orb-b absolute inset-0 bg-gradient-to-br from-purple-600/40 via-indigo-500/20 to-transparent rounded-full blur-[80px] sm:blur-[120px]" />
          </div>
          <div className="absolute bottom-[15%] left-[5%] w-[200px] h-[200px] sm:w-[300px] sm:h-[300px]">
            <div className="home-hero-orb-c absolute inset-0 bg-gradient-to-tr from-amber-500/30 via-orange-400/15 to-transparent rounded-full blur-[70px] sm:blur-[100px]" />
          </div>
        </div>

        {/* Grid pattern — subtler */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] sm:bg-[size:56px_56px]" />

        {/* Top edge glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-16">
          <div className="max-w-3xl mx-auto text-center">

            {/* Signature visuelle — trait organique + typo serrée (pas de pastille « startup ») */}
            <div className="flex flex-col items-center gap-3 mb-6 sm:mb-7" aria-hidden>
              <svg className="w-20 sm:w-24 h-4 text-orange-500/90" viewBox="0 0 96 16" fill="none">
                <path
                  d="M2 10C18 4 34 14 48 8s30-8 46-2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.85}
                />
                <path
                  d="M8 14c12-6 24 4 40-2s28-6 40 2"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity={0.35}
                />
              </svg>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 font-semibold tracking-[0.42em] uppercase">
                Golfe du Bénin · cuisines vivantes
              </p>
            </div>

            {/* font-sans : même pile que le body (system-ui d’abord) → moins de CLS qu’avec Syne au LCP */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.35rem] font-black text-white leading-[1.06] tracking-tight mb-3 sm:mb-4 px-1">
              Commandez
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-orange-400 to-amber-200 drop-shadow-[0_0_28px_rgba(249,115,22,0.25)]">
                où ça compte pour vous.
              </span>
            </h1>

            <p className="text-zinc-400 text-sm sm:text-base lg:text-lg max-w-xl mx-auto mb-6 sm:mb-8 leading-relaxed px-2">
              Menus tenus à jour, horaires réels, livraison ou sur place selon chaque maison — et fidélité lorsque le restaurant l’active. Pas de catalogue fantôme.
            </p>

            {/* Search bar — glassmorphism */}
            <div className="relative max-w-xl mx-auto px-2">
              {/* Glow behind search */}
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 via-red-500/10 to-orange-500/20 rounded-[20px] blur-xl opacity-0 transition-opacity duration-500" style={{ opacity: searchQuery ? 0.6 : 0 }} />
              <label htmlFor="home-restaurant-search" className="sr-only">
                Rechercher un restaurant par nom, cuisine ou adresse
              </label>
              <div className="relative flex items-center bg-white/[0.06] backdrop-blur-md border border-white/[0.08] rounded-2xl overflow-hidden transition-all duration-300 focus-within:border-orange-500/40 focus-within:bg-white/[0.09] focus-within:shadow-[0_0_30px_rgba(249,115,22,0.1)]">
                <div className="pl-4 pr-2 sm:pr-3 flex-shrink-0" aria-hidden>
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-500" />
                </div>
                <input
                  id="home-restaurant-search"
                  ref={searchRef}
                  type="search"
                  autoComplete="off"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un restaurant..."
                  className="flex-1 py-3.5 sm:py-4 pr-2 sm:pr-4 text-white placeholder-zinc-600 text-sm sm:text-[15px] outline-none bg-transparent min-w-0"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Effacer la recherche"
                    className="px-2 text-zinc-500 hover:text-zinc-300 flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 rounded-lg"
                  >
                    <X className="w-4 h-4" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => searchRef.current?.focus()}
                  aria-label="Aller au champ de recherche"
                  className="m-1.5 min-h-11 min-w-11 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-all flex-shrink-0 shadow-lg shadow-orange-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <span className="hidden sm:inline">Rechercher</span>
                  <ArrowRight className="w-4 h-4 sm:hidden" aria-hidden />
                </button>
              </div>
            </div>

            {/* Stats : hauteur réservée pour limiter le CLS quand les données arrivent */}
            <div className="min-h-[5.5rem] flex items-center justify-center mt-8 sm:mt-10" aria-live="polite">
              {!loading && restaurants.length > 0 ? (
                <div className="flex items-center justify-center gap-6 sm:gap-10">
                  {[
                    { value: openNowTotal, label: 'Ouverts maintenant', color: 'text-emerald-400' },
                    { value: restaurants.length, label: 'Adresses', color: 'text-white' },
                    { value: availableCuisines.length, label: 'Styles de cuisine', color: 'text-white' },
                  ].map((stat, i) => (
                    <React.Fragment key={stat.label}>
                      {i > 0 && <div className="w-px h-10 bg-gradient-to-b from-transparent via-zinc-700 to-transparent" aria-hidden />}
                      <div className="text-center">
                        <div className={`text-xl sm:text-2xl font-black ${stat.color}`}>{stat.value}</div>
                        <div className="text-zinc-500 text-[10px] sm:text-xs uppercase tracking-wider mt-0.5">{stat.label}</div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center gap-6 sm:gap-10 w-full opacity-40" aria-hidden>
                  {['stat-open', 'stat-total', 'stat-cuisines'].map((slot, i) => (
                    <React.Fragment key={slot}>
                      {i > 0 && <div className="w-px h-10 bg-gradient-to-b from-transparent via-zinc-700 to-transparent" />}
                      <div className="text-center w-16 sm:w-20">
                        <div className="text-xl sm:text-2xl font-black text-zinc-600">—</div>
                        <div className="text-[10px] sm:text-xs uppercase tracking-wider mt-0.5 text-zinc-600">&nbsp;</div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Bottom fade to content */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 to-transparent" />
      </section>

      {/* ── CONTENU PRINCIPAL ────────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8 lg:py-10 pb-32 lg:pb-8">

        {loading ? (
          <div className="min-h-[min(70vh,560px)] flex flex-col items-center justify-center py-16 sm:py-24">
            <RestafyLoader fullscreen={false} message="Chargement des restaurants..." />
          </div>
        ) : (
          <div className="flex gap-8 lg:gap-10 items-start">

            {/* ═══ COLONNE GAUCHE — Filtres (desktop uniquement) ════════════ */}
            <div className="hidden lg:block w-56 xl:w-64 flex-shrink-0 sticky top-6">
              <FilterSidebar
                cuisines={availableCuisines}
                cuisineFilters={cuisineFilters}
                setCuisineFilters={setCuisineFilters}
                priceFilter={priceFilter}
                setPriceFilter={setPriceFilter}
                timeFilter={timeFilter}
                setTimeFilter={setTimeFilter}
                hasActive={hasActiveFilters}
                onReset={resetFilters}
                openOnly={openOnly}
                setOpenOnly={setOpenOnly}
              />
            </div>

            {/* ═══ COLONNE CENTRALE — Restaurants ══════════════════════════ */}
            <main className="flex-1 min-w-0">

              {/* Barre de contrôles */}
              <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                <div>
                  <h2 className="text-xl font-black text-gray-900">
                    {searchQuery ? `Résultats pour "${searchQuery}"` : 'Restaurants à Cotonou'}
                  </h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {filtered.length} restaurant{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Mobile: bouton filtres */}
                  <button
                    type="button"
                    onClick={() => setShowMobileFilters(true)}
                    className="lg:hidden flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 shadow-sm relative"
                  >
                    <SlidersHorizontal className="w-4 h-4" aria-hidden />
                    Filtres
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {/* Tri */}
                  <div className="relative">
                    <label htmlFor="home-sort-select" className="sr-only">
                      Trier les restaurants
                    </label>
                    <select
                      id="home-sort-select"
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as SortBy)}
                      className="appearance-none pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none cursor-pointer shadow-sm hover:border-orange-300 transition-colors"
                    >
                      <option value="recommended">Recommandés</option>
                      <option value="rating">Meilleures notes</option>
                      <option value="time">Livraison rapide</option>
                      <option value="price">Livraison gratuite</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" aria-hidden />
                  </div>

                  {/* Vue grille / liste */}
                  <div className="hidden sm:flex items-center gap-0.5 bg-gray-100 p-1 rounded-xl" role="group" aria-label="Mode d’affichage des restaurants">
                    {([['grid', Grid3X3, 'Grille'], ['list', List, 'Liste']] as const).map(([mode, Icon, label]) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={viewMode === mode}
                        aria-label={label}
                        onClick={() => setViewMode(mode)}
                        className={`p-2 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 ${viewMode === mode ? 'bg-white shadow-sm text-orange-600' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <Icon className="w-4 h-4" aria-hidden />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tags filtres actifs */}
              {hasActiveFilters && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {cuisineFilters.map(c => (
                      <span key={c} className="flex items-center gap-1.5 bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1.5 rounded-lg">
                        {c}
                        <button type="button" aria-label={`Retirer le filtre cuisine ${c}`} onClick={() => setCuisineFilters(p => p.filter(x => x !== c))} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600">
                          <X className="w-3 h-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                    {openOnly && (
                      <span className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-lg">
                        Ouvert
                        <button type="button" aria-label="Retirer le filtre ouverts maintenant" onClick={() => setOpenOnly(false)} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700">
                          <X className="w-3 h-3" aria-hidden />
                        </button>
                      </span>
                    )}
                    {timeFilter && (
                      <span className="flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-lg">
                        &lt; {timeFilter} min
                        <button type="button" aria-label="Retirer le filtre temps de livraison" onClick={() => setTimeFilter(null)} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">
                          <X className="w-3 h-3" aria-hidden />
                        </button>
                      </span>
                    )}
                  </div>
              )}

              {error && (
                <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 space-y-2">
                  <p className="font-bold">Impossible de charger les restaurants</p>
                  <p className="text-red-600/90 text-xs leading-relaxed">
                    Ce n’est pas toujours un problème de connexion internet. Détail technique :
                  </p>
                  <pre className="text-[11px] font-mono bg-white/80 border border-red-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words text-red-800">
                    {error.message}
                  </pre>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Réessayer
                  </button>
                </div>
              )}

              {/* Section : TOP Favoris */}
              {showFavorisSection && (
                <section className="mb-10">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-[11px] font-black text-orange-600 uppercase tracking-widest flex items-center gap-1">
                      <span className="text-lg">⭐</span> Nos Favoris
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-orange-200 to-transparent" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5 lg:gap-6">
                    {favorisPreview.map((r, i) => (
                      <RestaurantCard
                        key={r.id}
                        restaurant={r}
                        imagePriority={i === 0}
                        onClick={() => navigate(`/restaurant/${r.id}`)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Section : Ouverts */}
              {openNow.length > 0 && (
                <section className="mb-8">
                  {!searchQuery && !openOnly && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                      <h3 className="font-black text-gray-700 text-sm">Ouverts maintenant</h3>
                      <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-100">
                        {openNow.length}
                      </span>
                    </div>
                  )}

                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5 lg:gap-6">
                      {openNow
                        .filter(r => !(!searchQuery && !openOnly && (r.avg_rating || 0) >= 4.5))
                        .map((r, i) => (
                          <RestaurantCard
                            key={r.id}
                            restaurant={r}
                            imagePriority={!showFavorisSection && i === 0}
                            onClick={() => navigate(`/restaurant/${r.id}`)}
                          />
                        ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {openNow
                        .filter(r => !(!searchQuery && !openOnly && (r.avg_rating || 0) >= 4.5))
                        .map((r, i) => (
                          <RestaurantListCard
                            key={r.id}
                            restaurant={r}
                            imagePriority={!showFavorisSection && i === 0}
                            onClick={() => navigate(`/restaurant/${r.id}`)}
                          />
                        ))}
                    </div>
                  )}
                </section>
              )}

              {/* Section : Fermés */}
              {closedR.length > 0 && (
                <section className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-gray-100" />
                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-2">Ouvrira plus tard</span>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                  <div className={`opacity-60 ${viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 lg:gap-6'
                    : 'space-y-3'}`}
                  >
                    {closedR.slice(0, 8).map(r => viewMode === 'grid'
                      ? <RestaurantCard key={r.id} restaurant={r} onClick={() => navigate(`/restaurant/${r.id}`)} />
                      : <RestaurantListCard key={r.id} restaurant={r} onClick={() => navigate(`/restaurant/${r.id}`)} />
                    )}
                  </div>
                </section>
              )}

              {/* Empty state */}
              {filtered.length === 0 && (
                <div className="py-16">
                  <EmptyState
                    type={searchQuery ? 'no-results' : 'no-restaurants'}
                    title={searchQuery ? 'Aucun résultat' : 'Aucun restaurant'}
                    description={searchQuery ? 'Essayez de modifier votre recherche ou vos filtres' : 'Aucun restaurant disponible pour le moment'}
                    action={hasActiveFilters || searchQuery
                      ? { label: 'Réinitialiser', onClick: resetFilters }
                      : undefined}
                  />
                </div>
              )}
            </main>

          </div>
        )}
      </div>

      {/* ── Mobile filters drawer ─────────────────────────────────────────── */}
      {showMobileFilters && (
          <>
            <div
              className="fixed inset-0 z-40 cursor-pointer bg-black/40 lg:hidden"
              aria-hidden
              onClick={() => setShowMobileFilters(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="home-mobile-filters-title"
              className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-gray-50 z-50 overflow-y-auto p-4 lg:hidden shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 id="home-mobile-filters-title" className="font-black text-gray-900">Filtres</h2>
                <button type="button" aria-label="Fermer les filtres" onClick={() => setShowMobileFilters(false)} className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
                  <X className="w-4 h-4" aria-hidden />
                </button>
              </div>
              <FilterSidebar
                cuisines={availableCuisines}
                cuisineFilters={cuisineFilters}
                setCuisineFilters={setCuisineFilters}
                priceFilter={priceFilter}
                setPriceFilter={setPriceFilter}
                timeFilter={timeFilter}
                setTimeFilter={setTimeFilter}
                hasActive={hasActiveFilters}
                onReset={() => { resetFilters(); setShowMobileFilters(false); }}
                openOnly={openOnly}
                setOpenOnly={setOpenOnly}
              />
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="w-full mt-4 py-3.5 bg-orange-500 text-white font-black rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-600"
              >
                Voir {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}
    </div>
  );
}
