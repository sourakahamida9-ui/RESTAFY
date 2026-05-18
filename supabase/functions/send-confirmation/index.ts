import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface ConfirmationEmailRequest {
  email: string;
  confirmationLink: string;
  userName: string;
}

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body: ConfirmationEmailRequest = await req.json();

    if (!body.email || !body.confirmationLink) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, confirmationLink" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!BREVO_API_KEY) {
      console.error("[send-confirmation] BREVO_API_KEY not set");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmer votre email - Restafy</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa;">
        <div style="max-width: 600px; margin: 30px auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
          <div style="background: linear-gradient(135deg, #F27D26 0%, #EF4444 100%); color: white; padding: 40px 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 15px;">🎉</div>
            <h1 style="font-size: 32px; margin: 0 0 10px 0; font-weight: 900;">Bienvenue sur Restafy!</h1>
            <p style="font-size: 16px; opacity: 0.9; margin: 0;">Confirmez votre email pour commencer</p>
          </div>

          <div style="padding: 40px 30px;">
            <p style="color: #333; font-size: 16px; margin-bottom: 20px;">
              Bonjour ${body.userName || 'ami'},
            </p>

            <p style="color: #666; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
              Merci de vous être inscrit sur <strong>Restafy</strong>! Pour terminer votre inscription et accéder à votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.
            </p>

            <div style="text-align: center; margin: 40px 0;">
              <a href="${body.confirmationLink}" style="display: inline-block; background: linear-gradient(135deg, #F27D26 0%, #EF4444 100%); color: white; text-decoration: none; font-weight: 700; font-size: 16px; padding: 16px 40px; border-radius: 50px; box-shadow: 0 8px 20px rgba(242,125,38,0.3);">
                ✓ Confirmer mon email
              </a>
            </div>

            <p style="color: #999; font-size: 13px; text-align: center; margin-top: 30px;">
              Ou copiez ce lien dans votre navigateur:<br>
              <span style="word-break: break-all; color: #666;">${body.confirmationLink}</span>
            </p>

            <div style="background: #FFF8F0; border-left: 4px solid #F27D26; padding: 20px; border-radius: 12px; margin: 30px 0;">
              <p style="color: #666; font-size: 14px; margin: 0;">
                <strong>💡 Astuce:</strong> Ce lien expire dans 24 heures. Si vous ne confirmez pas votre email, vous devrez recommencer l'inscription.
              </p>
            </div>
          </div>

          <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} Restafy · Cotonou, Bénin<br>
              <a href="https://restafy.com" style="color: #F27D26; text-decoration: none;">restafy.com</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const brevoPayload = {
      sender: {
        email: "noreply@restafy.shop",
        name: "Restafy",
      },
      to: [{ email: body.email }],
      subject: "✉️ Confirmez votre email - Restafy",
      htmlContent,
      replyTo: { email: "support@restafy.shop" },
    };

    const brevoResponse = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(brevoPayload),
    });

    const brevoData = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error("[send-confirmation] Brevo error:", brevoData);
      return new Response(
        JSON.stringify({
          error: "Failed to send confirmation email",
          details: brevoData,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: brevoData.messageId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[send-confirmation] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
