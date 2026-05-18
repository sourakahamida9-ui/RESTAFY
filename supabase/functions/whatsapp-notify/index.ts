// supabase/functions/whatsapp-notify/index.ts
// Envoi de messages WhatsApp via Meta Cloud API
// Variables env requises :
//   WHATSAPP_PHONE_NUMBER_ID  — ID du numéro WhatsApp Business
//   WHATSAPP_ACCESS_TOKEN     — Token d'accès permanent Meta

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface WhatsAppTextPayload {
  to: string;
  message: string;
}

interface WhatsAppTemplatePayload {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: unknown[];
}

type NotifyPayload = WhatsAppTextPayload | WhatsAppTemplatePayload;

// ── Normaliser numéro Bénin ────────────────────────────────────────────────
function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s()-]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (!p.startsWith('+')) p = '+229' + p;
  // Retirer le + pour l'API WhatsApp (format E.164 sans +)
  return p.replace(/^\+/, '');
}

// ── Envoyer un message texte libre ────────────────────────────────────────────
async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhone(to),
    type: 'text',
    text: {
      preview_url: false,
      body: message,
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    return {
      success: false,
      error: data?.error?.message ?? `HTTP ${res.status}`,
    };
  }

  return {
    success: true,
    messageId: data?.messages?.[0]?.id,
  };
}

// ── Envoyer un template ───────────────────────────────────────────────────────
async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode = 'fr',
  components: unknown[] = [],
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const body = {
    messaging_product: 'whatsapp',
    to: normalizePhone(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    return {
      success: false,
      error: data?.error?.message ?? `HTTP ${res.status}`,
    };
  }

  return {
    success: true,
    messageId: data?.messages?.[0]?.id,
  };
}

// ── Handler principal ─────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

    if (!phoneNumberId || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'WHATSAPP_PHONE_NUMBER_ID et WHATSAPP_ACCESS_TOKEN requis' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const payload = await req.json() as NotifyPayload;

    if (!payload.to) {
      return new Response(
        JSON.stringify({ error: 'Le champ "to" (numéro destinataire) est requis' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    let result: { success: boolean; messageId?: string; error?: string };

    if ('message' in payload) {
      // Message texte libre
      result = await sendTextMessage(phoneNumberId, accessToken, payload.to, payload.message);
    } else if ('templateName' in payload) {
      // Template approuvé Meta
      result = await sendTemplateMessage(
        phoneNumberId,
        accessToken,
        payload.to,
        payload.templateName,
        (payload as WhatsAppTemplatePayload).languageCode ?? 'fr',
        (payload as WhatsAppTemplatePayload).components ?? [],
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Fournir "message" (texte) ou "templateName" (template)' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur interne';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});