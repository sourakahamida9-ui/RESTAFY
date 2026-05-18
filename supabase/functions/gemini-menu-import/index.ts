// supabase/functions/gemini-menu-import/index.ts
// Import menu par photo via Gemini 1.5 Flash

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-authorization',
  'Access-Control-Max-Age': '86400',
};

interface ExtractedMenuItem {
  name: string;
  description: string;
  price: number | null;
  category: string;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
    finishReason?: string;
  }>;
  error?: { message: string; code: number };
}

// Convertit un ArrayBuffer en base64 sans exploser la call stack
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function extractMenuFromImage(
  base64Image: string,
  mimeType: string,
  apiKey: string,
): Promise<ExtractedMenuItem[]> {
  const prompt = `Tu es un assistant spécialisé dans l'extraction de menus de restaurant.
Analyse cette image de menu de restaurant et extrais TOUS les plats visibles.

Réponds UNIQUEMENT avec un tableau JSON valide, sans aucun texte avant ou après, sans markdown, sans backticks.
Format exact attendu :
[
  {
    "name": "Nom du plat",
    "description": "Description du plat (ou chaîne vide si absente)",
    "price": 2500,
    "category": "Catégorie (ex: Entrées, Plats principaux, Desserts, Boissons)"
  }
]

Règles :
- "price" doit être un nombre entier (FCFA) ou null si non lisible
- "name" est obligatoire et non vide
- "description" peut être vide ""
- "category" doit regrouper logiquement les plats
- Ne pas inventer de plats, extraire uniquement ce qui est visible
- Si l'image n'est pas un menu, retourne []`;

  // REST Generative Language API : champs en camelCase (inlineData, mimeType)
  // 1.5-flash : compatible avec la plupart des clés AI Studio ; surcharger avec GEMINI_MODEL (ex. gemini-2.0-flash) si besoin.
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-1.5-flash';
  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Image,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topK: 32,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${rawText.slice(0, 300)}`);
  }

  let data: GeminiResponse;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Réponse Gemini non-JSON: ${rawText.slice(0, 200)}`);
  }

  // Vérifier erreur dans la réponse
  if (data.error) {
    throw new Error(`Gemini: ${data.error.message}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!text.trim()) {
    const reason = data?.candidates?.[0]?.finishReason;
    throw new Error(`Gemini n'a retourné aucun texte (finishReason: ${reason ?? 'unknown'})`);
  }

  // Nettoyer les backticks markdown si présents
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  let parsed: ExtractedMenuItem[];

  const tryParse = (raw: string): unknown => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  // 1) Réponse déjà JSON (mode responseMimeType: application/json)
  let root = tryParse(cleaned);
  if (root === null) {
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) root = tryParse(jsonMatch[0]);
  }

  if (root === null) {
    throw new Error(`JSON non trouvé dans la réponse Gemini. Reçu: ${cleaned.slice(0, 200)}`);
  }

  if (Array.isArray(root)) {
    parsed = root as ExtractedMenuItem[];
  } else if (root && typeof root === 'object' && Array.isArray((root as { items?: unknown }).items)) {
    parsed = (root as { items: ExtractedMenuItem[] }).items;
  } else if (root && typeof root === 'object' && Array.isArray((root as { menu?: unknown }).menu)) {
    parsed = (root as { menu: ExtractedMenuItem[] }).menu;
  } else {
    throw new Error('Gemini n\'a pas retourné un tableau de plats (array ou { items: [] })');
  }

  // Valider et sanitiser
  return parsed
    .filter((item) => item && typeof item.name === 'string' && item.name.trim().length > 0)
    .map((item) => ({
      name: String(item.name).trim().slice(0, 150),
      description: item.description ? String(item.description).trim().slice(0, 500) : '',
      price: typeof item.price === 'number' && item.price >= 0 ? Math.round(item.price) : null,
      category: item.category ? String(item.category).trim().slice(0, 100) : 'Plats',
    }));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'POST uniquement' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // ✅ Auth JWT requise - Supabase vérifie automatiquement quand verify_jwt = true
  // Mais nous devons vérifier le rôle autorisé
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ success: false, error: 'Authentification requise' }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // Le JWT est déjà validé par Supabase, on vérifie juste la présence
  const jwt = authHeader.slice(7);
  if (!jwt || jwt.length < 10) {
    return new Response(
      JSON.stringify({ success: false, error: 'Token invalide' }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'GEMINI_API_KEY non configurée côté serveur' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const contentType = req.headers.get('content-type') ?? '';
    let base64Image: string;
    let mimeType: string;

    if (contentType.includes('application/json')) {
      let body: { image?: string; mimeType?: string };
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'Corps JSON invalide' }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      base64Image = body.image ?? '';
      mimeType = body.mimeType ?? 'image/jpeg';

      if (!base64Image) {
        return new Response(
          JSON.stringify({ success: false, error: 'Champ "image" (base64) requis' }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
    } else if (contentType.includes('multipart/form-data')) {
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: 'FormData invalide' }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      const file = formData.get('image') as File | null;
      if (!file) {
        return new Response(
          JSON.stringify({ success: false, error: 'Champ "image" (fichier) requis' }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      if (!allowedTypes.includes(file.type)) {
        return new Response(
          JSON.stringify({ success: false, error: `Type non supporté. Acceptés: ${allowedTypes.join(', ')}` }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      if (file.size > 10 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ success: false, error: 'Image trop grande (max 10 MB)' }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }

      const buffer = await file.arrayBuffer();
      // Utiliser la fonction chunk-safe pour éviter le stack overflow
      base64Image = arrayBufferToBase64(buffer);
      mimeType = file.type;
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Content-Type doit être application/json ou multipart/form-data' }),
        { status: 415, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const items = await extractMenuFromImage(base64Image, mimeType, geminiKey);

    return new Response(
      JSON.stringify({
        success: true,
        items,
        count: items.length,
        message: `${items.length} plat${items.length > 1 ? 's' : ''} extrait${items.length > 1 ? 's' : ''}`,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne';
    console.error('[gemini-menu-import] Erreur:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
