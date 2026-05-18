// src/pages/admin/MenuImportPhoto.tsx
// Import de menu par photo via Gemini 1.5 Flash (Edge Function)
// Clé Gemini côté serveur uniquement

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  Camera, Upload, Loader2, CheckCircle2, XCircle, Edit2,
  Save, Trash2, Plus, AlertCircle, ChevronRight, ImageIcon,
  Copy, Sparkles, FileImage,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RestafyLoader } from '@/components/ui/RestafyLoader';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ExtractedItem {
  id: string; // UUID local pour le UI
  name: string;
  description: string;
  price: number | null;
  category: string;
  selected: boolean;
  editing: boolean;
}

type ImportStep = 'upload' | 'preview' | 'reviewing' | 'importing' | 'done';
type ImportSourceMode = 'direct' | 'paste_ai';

/** Prompt à coller dans ChatGPT (ou autre IA avec vision) après avoir joint la photo du menu. */
export const AI_MENU_IMPORT_PROMPT_FR = `Tu es un assistant qui extrait un menu de restaurant à partir de l'image jointe.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte avant ou après.

Format exact attendu :
{"success":true,"items":[{"name":"Nom du plat","description":"Courte description ou vide","price":2500,"category":"Plats"}]}

Règles :
- "price" : nombre entier en FCFA, ou null si le prix est illisible ou absent.
- "category" : nom de section (ex. Entrées, Plats, Grillades, Boissons, Desserts) — reprends les titres visibles sur la carte si possible.
- "description" : chaîne vide "" si rien n'est indiqué.
- Liste tous les plats visibles et lisibles sur l'image.
- Si aucun plat n'est lisible : {"success":false,"error":"Aucun menu lisible sur l'image"}`;

function stripJsonFromMarkdown(text: string): string {
  const t = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fenced) return fenced[1].trim();
  return t;
}

function parsePastedMenuJson(raw: string): { ok: true; items: ExtractedItem[] } | { ok: false; error: string } {
  const text = stripJsonFromMarkdown(raw);
  if (!text) return { ok: false, error: 'Collez d’abord le JSON renvoyé par l’IA.' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON invalide. Vérifiez que vous avez copié tout le bloc (sans texte en plus autour).' };
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Le JSON doit être un objet.' };
  }
  const obj = data as { success?: boolean; error?: string; items?: unknown };
  if (obj.success === false) {
    return { ok: false, error: obj.error?.trim() || 'L’IA a indiqué un échec (success: false).' };
  }
  const list = obj.items;
  if (!Array.isArray(list)) {
    return { ok: false, error: 'Le JSON doit contenir un tableau "items".' };
  }
  const out: ExtractedItem[] = [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name) continue;
    const description = typeof r.description === 'string' ? r.description.trim() : '';
    let price: number | null = null;
    if (r.price === null || r.price === undefined) price = null;
    else if (typeof r.price === 'number' && Number.isFinite(r.price)) price = Math.round(r.price);
    else if (typeof r.price === 'string' && r.price.trim()) {
      const n = parseFloat(r.price.replace(/\s/g, '').replace(',', '.'));
      price = Number.isFinite(n) ? Math.round(n) : null;
    }
    const category =
      typeof r.category === 'string' && r.category.trim() ? r.category.trim() : 'Plats';
    out.push({
      id: `paste-ai-${Date.now()}-${i}`,
      name,
      description,
      price,
      category,
      selected: true,
      editing: false,
    });
  }
  if (out.length === 0) {
    return { ok: false, error: 'Aucun plat exploitable dans le JSON (noms vides ou tableau vide).' };
  }
  return { ok: true, items: out };
}

/** Messages courts pour l’interface (pas de détails techniques côté client). */
function describeEdgeFunctionHttpError(status: number, _rawText: string): string {
  switch (status) {
    case 401:
      return 'Session expirée ou non autorisée. Déconnectez-vous, reconnectez-vous, puis réessayez.';
    case 403:
      return 'Accès refusé. Reconnectez-vous ou contactez le support.';
    case 404:
    case 405:
      return 'Le service d’analyse n’est pas joignable pour le moment. Réessayez plus tard ou utilisez le collage de JSON ci-dessous.';
    case 413:
      return 'Image trop volumineuse. Réduisez la taille (max. 10 Mo) et réessayez.';
    case 429:
      return 'Trop de demandes. Patientez quelques minutes avant de réessayer.';
    default:
      if (status >= 500) return 'Le service d’analyse est temporairement indisponible. Réessayez plus tard ou utilisez le collage de JSON ci-dessous.';
      if (status > 0) return 'Réponse inattendue du serveur. Réessayez ou utilisez le collage de JSON ci-dessous.';
      return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
  }
}

const ANALYZE_FAILED_USER_MESSAGE =
  'L’analyse automatique n’a pas abouti. Vous pouvez coller un JSON (zone ci-dessous) ou réessayer avec une photo plus nette.';

type GeminiMenuFnPayload = {
  success: boolean;
  error?: string;
  items?: { name: string; description: string; price: number | null; category: string }[];
};

function buildGeminiFunctionUrlCandidates(customFn: string, supabaseUrl: string): string[] {
  const out: string[] = [];
  const add = (u: string) => {
    const t = u.trim().replace(/\/$/, '');
    if (!t) return;
    if (!out.includes(t)) out.push(t);
  };

  if (customFn) {
    add(customFn);
    if (/\/functions\/v1$/i.test(customFn)) add(`${customFn}/gemini-menu-import`);
  }

  if (supabaseUrl) {
    add(`${supabaseUrl}/functions/v1/gemini-menu-import`);
  }

  return out;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function extractMenuFromImage(file: File): Promise<ExtractedItem[]> {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const { data: ref } = await supabase.auth.refreshSession();
    session = ref.session ?? null;
  }
  if (!session?.access_token) {
    throw new Error('Vous devez être connecté pour lancer l’analyse. Reconnectez-vous si besoin.');
  }

  const formData = new FormData();
  formData.append('image', file);

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  const customFn = (import.meta.env.VITE_MENU_IMPORT_FUNCTION_URL ?? '').trim().replace(/\/$/, '');
  const fnUrlCandidates = buildGeminiFunctionUrlCandidates(customFn, supabaseUrl);
  const fnBase = fnUrlCandidates[0] ?? '';

  if (!fnBase) {
    throw new Error('L’application n’est pas correctement configurée pour l’analyse par photo. Contactez l’administrateur.');
  }

  // Appel toujours en fetch + Authorization + apikey : supabase.functions.invoke() avec FormData
  // omet souvent les bons en-têtes / Content-Type et provoque 401, « Failed to fetch » ou corps vide.
  if (!customFn && !anonKey) {
    throw new Error('L’application n’est pas correctement configurée pour l’analyse par photo. Contactez l’administrateur.');
  }

  const mapItems = (list: GeminiMenuFnPayload['items']): ExtractedItem[] =>
    (list ?? []).map((item, i) => ({
      ...item,
      id: `gemini-${Date.now()}-${i}`,
      selected: true,
      editing: false,
    }));

  const callVercelFallback = async (): Promise<ExtractedItem[]> => {
    const base64Image = await fileToBase64(file);
    const res = await fetch('/api/ai/gemini-menu-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Image,
        mimeType: file.type || 'image/jpeg',
      }),
    });
    const raw = await res.text();
    let json: GeminiMenuFnPayload = { success: false };
    try {
      if (raw.trim()) json = JSON.parse(raw) as GeminiMenuFnPayload;
    } catch {
      json = { success: false };
    }
    if (!res.ok || !json.success) {
      throw new Error('vercel_fallback_failed');
    }
    return mapItems(json.items);
  };

  try {
    let data: GeminiMenuFnPayload;
    let rawText = '';
    let res: Response | null = null;
    let lastNetworkError: unknown = null;

    for (const candidate of fnUrlCandidates) {
      try {
        res = await fetch(candidate, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            ...(anonKey ? { apikey: anonKey } : {}),
          },
          body: formData,
        });
        break;
      } catch (e) {
        lastNetworkError = e;
      }
    }
    if (!res) throw (lastNetworkError ?? new Error('Aucune réponse du serveur'));

    rawText = await res.text();
    if (!rawText?.trim()) {
      throw new Error(describeEdgeFunctionHttpError(res.status, ''));
    }

    try {
      data = JSON.parse(rawText) as GeminiMenuFnPayload;
    } catch {
      throw new Error(
        res.ok
          ? `Réponse non JSON de la fonction IA. Extrait : ${rawText.slice(0, 200)}`
          : describeEdgeFunctionHttpError(res.status, rawText),
      );
    }

    if (!res.ok || !data.success) {
      throw new Error(data.error?.trim() || describeEdgeFunctionHttpError(res.status, rawText));
    }

    return mapItems(data.items);
  } catch (supabaseFnErr) {
    try {
      return await callVercelFallback();
    } catch (fallbackErr) {
      if (import.meta.env.DEV) {
        console.error('[MenuImportPhoto] Analyse Edge + fallback Vercel :', supabaseFnErr, fallbackErr);
      }
      throw new Error(ANALYZE_FAILED_USER_MESSAGE);
    }
  }
}

function formatMenuImportDbError(err: unknown): string {
  if (!err || typeof err !== 'object') return err instanceof Error ? err.message : 'Erreur inconnue lors de l’import.';
  const e = err as { message?: string; code?: string; details?: string };
  const msg = [e.message, e.details].filter(Boolean).join(' — ') || 'Erreur base de données.';
  const low = msg.toLowerCase();
  if (/duplicate|unique|23505/i.test(msg)) {
    return 'Un plat ou une catégorie porte déjà ce nom. Modifiez les noms ou fusionnez les catégories.';
  }
  if (/row level security|rls|permission denied|42501|policy/i.test(low)) {
    return 'Permission refusée : votre compte ne peut pas modifier ce menu. Vérifiez que le profil est lié au bon restaurant.';
  }
  if (/foreign key|23503/i.test(msg)) {
    return 'Référence invalide (catégorie ou restaurant). Réessayez après avoir vérifié votre menu.';
  }
  return msg;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant ligne item (éditable)
// ─────────────────────────────────────────────────────────────────────────────
interface ItemRowProps {
  item: ExtractedItem;
  onToggle: () => void;
  onChange: (updates: Partial<ExtractedItem>) => void;
  onDelete: () => void;
}

function ItemRow({ item, onToggle, onChange, onDelete }: ItemRowProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-all',
        item.selected ? 'bg-white border-zinc-200' : 'bg-zinc-50 border-zinc-100 opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={item.selected ? 'Désélectionner ce plat' : 'Sélectionner ce plat'}
          aria-pressed={item.selected}
          className={cn(
            'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
            item.selected ? 'border-orange-500 bg-orange-500' : 'border-zinc-300',
          )}
        >
          {item.selected && <CheckCircle2 className="w-4 h-4 text-white" aria-hidden="true" />}
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          {item.editing ? (
            <>
              {/* Nom */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Nom</label>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => onChange({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                />
              </div>
              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Description</label>
                <textarea
                  value={item.description}
                  onChange={(e) => onChange({ description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none"
                />
              </div>
              {/* Prix + Catégorie */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Prix (FCFA)</label>
                  <input
                    type="number"
                    min={0}
                    value={item.price ?? ''}
                    onChange={(e) => onChange({ price: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Catégorie</label>
                  <input
                    type="text"
                    value={item.category}
                    onChange={(e) => onChange({ category: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
              </div>
              {/* Bouton enregistrer édition */}
              <button
                type="button"
                onClick={() => onChange({ editing: false })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 transition-colors"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                Enregistrer
              </button>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-sm text-zinc-900">{item.name || <em className="text-zinc-400">Sans nom</em>}</p>
                  {item.description && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{item.description}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onChange({ editing: true })}
                    aria-label={`Modifier ${item.name}`}
                    className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    aria-label={`Supprimer ${item.name}`}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {item.price != null ? (
                  <span className="text-xs font-black text-orange-600">
                    {item.price.toLocaleString('fr-FR')} FCFA
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" aria-hidden="true" />
                    Prix manquant
                  </span>
                )}
                <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">{item.category}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────────────────────
export default function MenuImportPhoto() {
  const { profile } = useAuth();
  const restaurantId = profile?.restaurant_id;

  const [step, setStep] = useState<ImportStep>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importSourceMode, setImportSourceMode] = useState<ImportSourceMode>('direct');
  const [pasteJsonText, setPasteJsonText] = useState('');
  /** Après échec de l’IA Restafy : afficher le panneau JSON sans forcer le mode « IA externe » (l’utilisateur peut réessayer l’analyse). */
  const [showPasteFallback, setShowPasteFallback] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pasteFallbackRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes(file.type)) {
      toast.error('Format non supporté. Utilisez JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop grande (max 10 MB)');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setStep('preview');
    setError(null);
    setShowPasteFallback(false);
  }, []);

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setStep('reviewing');
    setError(null);

    try {
      const extracted = await extractMenuFromImage(selectedFile);
      if (extracted.length === 0) {
        setError("Aucun plat détecté. Essayez avec une photo plus nette de votre carte.");
        setStep('preview');
        if (importSourceMode === 'direct') {
          setShowPasteFallback(true);
          toast.message('Méthode alternative', {
            description: 'Collez le JSON renvoyé par ChatGPT (ou une autre IA avec vision) dans la zone violette ci-dessous.',
            duration: 7000,
          });
        }
        return;
      }
      setItems(extracted);
      setShowPasteFallback(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ANALYZE_FAILED_USER_MESSAGE;
      setError(msg);
      setStep('preview');
      if (importSourceMode === 'direct') {
        setShowPasteFallback(true);
      }
    }
  };

  const showPastePanel =
    (step === 'upload' && importSourceMode === 'paste_ai') ||
    (step === 'preview' && importSourceMode === 'paste_ai') ||
    (step === 'preview' && showPasteFallback);

  useEffect(() => {
    if (!showPastePanel || !showPasteFallback) return;
    const t = window.setTimeout(() => {
      pasteFallbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
    return () => window.clearTimeout(t);
  }, [showPastePanel, showPasteFallback]);

  const updateItem = useCallback((id: string, updates: Partial<ExtractedItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        name: '',
        description: '',
        price: null,
        category: 'Plats',
        selected: true,
        editing: true,
      },
    ]);
  };

  const handleImport = async () => {
    if (!restaurantId) { toast.error('Restaurant non trouvé'); return; }
    const toImport = items.filter((item) => item.selected && item.name.trim());
    if (toImport.length === 0) {
      toast.error('Sélectionnez au moins un plat à importer');
      return;
    }

    setImporting(true);
    setStep('importing');

    try {
      // Regrouper les catégories uniques — créer ou récupérer leur ID
      const uniqueCategories = [...new Set(toImport.map((item) => item.category.trim()))];
      const categoryMap: Record<string, string> = {};

      for (const catName of uniqueCategories) {
        // Chercher si la catégorie existe déjà
        const { data: existing } = await supabase
          .from('categories')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .ilike('name', catName)
          .maybeSingle();

        if (existing) {
          categoryMap[catName] = existing.id;
        } else {
          // Créer la catégorie
          const { data: created, error } = await supabase
            .from('categories')
            .insert({ restaurant_id: restaurantId, name: catName, sort_order: 0 })
            .select('id')
            .single();
          if (error) throw error;
          categoryMap[catName] = created.id;
        }
      }

      // Insérer les plats
      const itemsToInsert = toImport.map((item) => ({
        restaurant_id: restaurantId,
        name: item.name.trim(),
        description: item.description.trim() || null,
        price: item.price ?? 0,
        category_id: categoryMap[item.category.trim()],
        is_available: true,
      }));

      const { error: insertError } = await supabase.from('items').insert(itemsToInsert);
      if (insertError) throw insertError;

      setImportedCount(itemsToInsert.length);
      setStep('done');
      toast.success(`${itemsToInsert.length} plat${itemsToInsert.length > 1 ? 's' : ''} importé${itemsToInsert.length > 1 ? 's' : ''} !`);
    } catch (err: unknown) {
      const msg = formatMenuImportDbError(err);
      setError(msg);
      setStep('reviewing');
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep('upload');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setItems([]);
    setError(null);
    setImportedCount(0);
    setImportSourceMode('direct');
    setPasteJsonText('');
    setShowPasteFallback(false);
  };

  const copyAiPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_MENU_IMPORT_PROMPT_FR);
      toast.success('Prompt copié — collez-le dans ChatGPT après avoir joint votre photo.');
    } catch {
      toast.error('Impossible de copier (autorisez le presse-papiers ou copiez manuellement).');
    }
  };

  const handleLoadPastedJson = () => {
    setError(null);
    const result = parsePastedMenuJson(pasteJsonText);
    if (result.ok === false) {
      toast.error(result.error);
      return;
    }
    setItems(result.items);
    setStep('reviewing');
    toast.success(`${result.items.length} plat${result.items.length > 1 ? 's' : ''} chargé${result.items.length > 1 ? 's' : ''} depuis le JSON.`);
  };

  const selectedCount = items.filter((i) => i.selected).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Import menu par photo</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Import direct (analyse Restafy) ou bien ChatGPT / autre IA avec vision : copiez le prompt, joignez la photo, puis collez le JSON ici.
        </p>
      </div>

      {/* Barre de progression */}
      <div className="flex items-center gap-2">
        {(['upload', 'reviewing', 'done'] as const).map((s, i) => (
          <React.Fragment key={s}>
            <div className={cn(
              'flex items-center gap-2 text-xs font-bold',
              step === s ? 'text-orange-600' : ['done'].includes(step) && i < 2 ? 'text-zinc-400' : 'text-zinc-300',
            )}>
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-black',
                step === s ? 'bg-orange-600 text-white' :
                  (step === 'done' || (step === 'reviewing' && i === 0)) ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-500',
              )}>
                {i + 1}
              </div>
              <span className="hidden sm:block">
                {s === 'upload'
                  ? importSourceMode === 'paste_ai' && step === 'upload'
                    ? 'IA externe'
                    : 'Photo'
                  : s === 'reviewing'
                    ? 'Correction'
                    : 'Importé'}
              </span>
            </div>
            {i < 2 && <div className={cn('flex-1 h-0.5', i === 0 && step !== 'upload' ? 'bg-zinc-900' : 'bg-zinc-200')} />}
          </React.Fragment>
        ))}
      </div>

      {/* ── STEP: UPLOAD ── */}
      {(step === 'upload' || step === 'preview') && (
        <div className="space-y-4">
          {step === 'upload' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setImportSourceMode('direct'); setError(null); setShowPasteFallback(false); }}
                className={cn(
                  'rounded-2xl border-2 p-4 text-left transition-all',
                  importSourceMode === 'direct'
                    ? 'border-orange-500 bg-orange-50/80 shadow-sm'
                    : 'border-zinc-200 bg-white hover:border-zinc-300',
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileImage className="w-5 h-5 text-orange-600 shrink-0" aria-hidden />
                  <span className="font-bold text-sm text-zinc-900">Importer directement</span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Photo depuis l’appareil ou la galerie, analyse via la fonction Restafy (Gemini).
                </p>
              </button>
              <button
                type="button"
                onClick={() => { setImportSourceMode('paste_ai'); setError(null); setShowPasteFallback(false); }}
                className={cn(
                  'rounded-2xl border-2 p-4 text-left transition-all',
                  importSourceMode === 'paste_ai'
                    ? 'border-violet-500 bg-violet-50/80 shadow-sm'
                    : 'border-zinc-200 bg-white hover:border-zinc-300',
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-violet-600 shrink-0" aria-hidden />
                  <span className="font-bold text-sm text-zinc-900">IA externe (ChatGPT, etc.)</span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Vous envoyez l’image + le prompt dans une autre app, puis vous collez le JSON renvoyé.
                </p>
              </button>
            </div>
          )}

          {step === 'upload' && importSourceMode === 'direct' && (
            <div
              className="border-2 border-dashed border-zinc-200 rounded-3xl p-10 text-center hover:border-orange-300 hover:bg-orange-50/50 transition-all cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Choisir une image de menu"
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-orange-200 transition-colors">
                <ImageIcon className="w-8 h-8 text-orange-600" aria-hidden="true" />
              </div>
              <p className="font-bold text-zinc-900 mb-1">Choisissez une photo de menu</p>
              <p className="text-sm text-zinc-500">JPEG, PNG, WebP — max 10 MB</p>
            </div>
          )}

          {showPastePanel && (
            <div
              ref={pasteFallbackRef}
              className="rounded-3xl border border-violet-200 bg-violet-50/40 p-5 space-y-4 scroll-mt-24"
            >
              {step === 'preview' && showPasteFallback && importSourceMode === 'direct' && (
                <p className="text-sm font-bold text-violet-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
                  Méthode 2 — même photo : envoyez-la à une IA avec vision, puis collez le JSON ici.
                </p>
              )}
              <ol className="text-sm text-zinc-700 space-y-2 list-decimal list-inside">
                <li>Ouvrez ChatGPT (ou un autre outil avec vision).</li>
                <li>Joignez la <strong>photo de votre carte</strong> au message.</li>
                <li>Copiez le prompt ci-dessous, collez-le dans le chat, puis envoyez.</li>
                <li>Copiez <strong>tout le JSON</strong> de la réponse (y compris s’il est dans un bloc markdown).</li>
                <li>Collez-le dans la zone en bas, puis appuyez sur « Charger les plats ».</li>
              </ol>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-widest text-violet-800">Prompt à copier</span>
                  <button
                    type="button"
                    onClick={copyAiPrompt}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" aria-hidden />
                    Copier le prompt
                  </button>
                </div>
                <pre className="text-[11px] leading-relaxed bg-white border border-violet-100 rounded-2xl p-3 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-zinc-800 font-mono">
                  {AI_MENU_IMPORT_PROMPT_FR}
                </pre>
              </div>
              <div className="space-y-2">
                <label htmlFor="paste-menu-json" className="text-xs font-bold uppercase tracking-widest text-zinc-600">
                  Coller la réponse JSON
                </label>
                <textarea
                  id="paste-menu-json"
                  value={pasteJsonText}
                  onChange={(e) => setPasteJsonText(e.target.value)}
                  rows={8}
                  placeholder='{"success":true,"items":[...]}'
                  className="w-full px-3 py-2 border border-zinc-200 rounded-2xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-y min-h-[140px]"
                />
              </div>
              <button
                type="button"
                onClick={handleLoadPastedJson}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-2xl font-bold text-sm hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/20"
              >
                <ChevronRight className="w-4 h-4" aria-hidden />
                Charger les plats
              </button>
            </div>
          )}

          {step === 'preview' && previewUrl && (
            <div className="rounded-2xl overflow-hidden border border-zinc-200">
              <img
                src={previewUrl}
                alt="Aperçu du menu à analyser"
                className="w-full max-h-80 object-contain bg-zinc-50"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4" role="alert">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm text-red-900 space-y-1 min-w-0">
                <p className="font-bold">Analyse impossible</p>
                <p className="text-red-800/95 whitespace-pre-wrap break-words leading-snug">{error}</p>
              </div>
            </div>
          )}

          {/* Actions photo : import direct, ou repli JSON avec photo conservée */}
          {(importSourceMode === 'direct' || (step === 'preview' && showPasteFallback)) && (
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-3 border-2 border-zinc-200 text-zinc-700 rounded-2xl font-bold text-sm hover:bg-zinc-50 transition-colors"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                {step === 'preview' ? 'Changer la photo' : 'Depuis la galerie'}
              </button>

              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-3 border-2 border-zinc-200 text-zinc-700 rounded-2xl font-bold text-sm hover:bg-zinc-50 transition-colors"
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                Prendre une photo
              </button>

              {step === 'preview' && (
                <button
                  onClick={handleAnalyze}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold text-sm hover:bg-orange-700 transition-colors shadow-lg shadow-orange-500/25"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  Analyser avec l'IA
                </button>
              )}
            </div>
          )}

          {/* Inputs fichier cachés */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            aria-hidden="true"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            aria-hidden="true"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
          />
        </div>
      )}

      {/* ── STEP: ANALYZING ── */}
      {step === 'reviewing' && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <RestafyLoader fullscreen={false} message="Analyse de la carte en cours…" size="md" />
          <p className="text-sm text-zinc-500 text-center max-w-sm">Gemini extrait les plats de votre carte</p>
        </div>
      )}

      {/* ── STEP: REVIEW ── */}
      {step === 'reviewing' && items.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-zinc-900">
                {items.length} plat{items.length > 1 ? 's' : ''} détecté{items.length > 1 ? 's' : ''}
              </h2>
              <p className="text-sm text-zinc-500">{selectedCount} sélectionné{selectedCount > 1 ? 's' : ''} pour import</p>
            </div>
            <button
              onClick={addItem}
              className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Ajouter un plat
            </button>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={() => updateItem(item.id, { selected: !item.selected })}
                onChange={(updates) => updateItem(item.id, updates)}
                onDelete={() => deleteItem(item.id)}
              />
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4" role="alert">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm text-red-900 space-y-1 min-w-0">
                <p className="font-bold">Import en base impossible</p>
                <p className="text-red-800/95 whitespace-pre-wrap break-words leading-snug">{error}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={reset}
              className="px-5 py-3 border border-zinc-200 rounded-2xl font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors text-sm"
            >
              Recommencer
            </button>
            <button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-orange-600 text-white rounded-2xl font-bold text-sm hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-orange-500/25"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              )}
              {importing ? 'Import en cours...' : `Importer ${selectedCount} plat${selectedCount > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: IMPORTING ── */}
      {step === 'importing' && (
        <div className="flex flex-col items-center justify-center py-12">
          <RestafyLoader fullscreen={false} message="Ajout des plats à votre menu…" size="md" />
        </div>
      )}

      {/* ── STEP: DONE ── */}
      {step === 'done' && (
        <div className="text-center py-12 space-y-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-600" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-zinc-900 mb-2">Import réussi !</h2>
            <p className="text-zinc-500">
              <strong>{importedCount} plat{importedCount > 1 ? 's' : ''}</strong> ajouté{importedCount > 1 ? 's' : ''} à votre menu avec succès.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="px-6 py-3 border border-zinc-200 rounded-2xl font-bold text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Importer une autre photo
            </button>
            <Link
              to="/restaurant/dashboard/menu"
              className="px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold text-sm hover:bg-orange-700 transition-colors shadow-lg shadow-orange-500/25 inline-flex items-center justify-center"
            >
              Voir mon menu
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}