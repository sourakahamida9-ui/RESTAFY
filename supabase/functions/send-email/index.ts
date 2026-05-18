// ✅ Migré de Brevo → Resend
// ✅ FIX Networking Error : l'API Resend ne supporte pas les appels directs depuis le navigateur (CORS).
//    Cette Edge Function sert de proxy server-side sécurisé.
// Secret requis dans Supabase Dashboard → Settings → Edge Functions → Secrets : RESEND_API_KEY

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_API_URL = "https://api.resend.com/emails";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  attachment?: Array<{ content: string; name: string }>;
}

serve(async (req) => {
  // ── CORS preflight ────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    // ── Auth JWT Supabase ────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ── Validation clé API ───────────────────────────────────────────────────
    if (!RESEND_API_KEY) {
      console.error("[send-email] RESEND_API_KEY not configured in Supabase secrets");
      return new Response(
        JSON.stringify({
          error: "Email service not configured",
          hint: "Add RESEND_API_KEY in Supabase Dashboard → Settings → Edge Functions → Secrets",
        }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ── Parser le body ───────────────────────────────────────────────────────
    const body: SendEmailRequest = await req.json();

    if (!body.to || !body.subject || !body.htmlContent) {
      return new Response(
        JSON.stringify({ error: "Champs requis manquants : to, subject, htmlContent" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ── Payload Resend ───────────────────────────────────────────────────────
    const resendPayload: Record<string, unknown> = {
      from: "Restafy <noreply@restafy.shop>",
      to: [body.to],
      subject: body.subject,
      html: body.htmlContent,
    };

    if (body.textContent) {
      resendPayload.text = body.textContent;
    }

    if (body.attachment && body.attachment.length > 0) {
      resendPayload.attachments = body.attachment.map((a) => ({
        filename: a.name,
        content: a.content,
      }));
    }

    console.log("[send-email] Envoi à :", body.to, "| Sujet :", body.subject);

    // ── Appel API Resend (server-side, pas de CORS) ──────────────────────────
    const resendResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const responseText = await resendResponse.text();
    let resendData: Record<string, unknown> = {};
    try {
      resendData = responseText ? JSON.parse(responseText) : {};
    } catch (_) {
      console.error("[send-email] Réponse Resend non-JSON :", responseText);
    }

    if (!resendResponse.ok) {
      console.error("[send-email] Erreur Resend :", resendData);
      return new Response(
        JSON.stringify({
          error: "Échec de l'envoi",
          details: resendData,
          statusCode: resendResponse.status,
        }),
        { status: resendResponse.status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    console.log("[send-email] ✅ Email envoyé, ID :", resendData.id);

    return new Response(
      JSON.stringify({ success: true, messageId: resendData.id }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-email] Erreur interne :", error);
    return new Response(
      JSON.stringify({
        error: "Erreur interne du serveur",
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});