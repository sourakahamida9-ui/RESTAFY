import { NextRequest, NextResponse } from 'next/server';

// Variable d'environnement server-side (sans VITE_)
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

// Signature Restafy
const RESTAFY_SIGNATURE = `
  <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #F27D26;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 20px 0; text-align: center; background: linear-gradient(135deg, #F27D26 0%, #EF4444 100%); border-radius: 12px;">
          <div style="font-size: 24px; font-weight: 900; color: white; letter-spacing: 1px;">RESTAFY</div>
          <div style="color: rgba(255,255,255,0.9); font-size: 12px; margin-top: 5px;">Commandez maintenant, savourez plus tard</div>
        </td>
      </tr>
      <tr>
        <td style="padding: 20px 0; text-align: center;">
          <a href="https://restafy.shop" style="color: #F27D26; text-decoration: none; font-size: 12px; font-weight: bold;">Visiter Restafy</a>
        </td>
      </tr>
      <tr>
        <td style="text-align: center; color: #999; font-size: 11px;">
          <p style="margin: 5px 0;">Restafy Technologies - Cotonou, Benin</p>
          <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} Restafy. Tous droits reserves.</p>
        </td>
      </tr>
    </table>
  </div>
`;

export async function POST(req: NextRequest) {
  try {
    // Verifier la cle API
    if (!RESEND_API_KEY) {
      console.error('[email/send] RESEND_API_KEY not configured');
      return NextResponse.json(
        { error: 'Email service not configured. Please add RESEND_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { to, subject, html, text, type } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, html' },
        { status: 400 }
      );
    }

    // Ajouter la signature si pas deja presente
    let finalHtml = html;
    if (!html.includes('RESTAFY') && !html.includes('restafy')) {
      finalHtml = html + RESTAFY_SIGNATURE;
    }

    // Wrapper HTML complet
    const wrappedHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
      background: #f8f9fa; 
      margin: 0;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .content {
      padding: 30px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      ${finalHtml}
    </div>
  </div>
</body>
</html>`;

    // Envoyer via Resend API
    console.log('[email/send] Sending to:', Array.isArray(to) ? to : [to]);
    
    const requestBody = {
      from: 'Restafy <noreply@restafy.shop>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html: wrappedHtml,
      text: text || undefined,
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Lire la reponse comme texte d'abord pour eviter les erreurs JSON
    const responseText = await response.text();
    console.log('[email/send] Response status:', response.status, 'Body:', responseText);

    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('[email/send] Failed to parse response:', responseText);
      return NextResponse.json(
        { error: 'Invalid response from email service', rawResponse: responseText },
        { status: 500 }
      );
    }

    if (!response.ok) {
      console.error('[email/send] Resend API error:', responseData);
      return NextResponse.json(
        { 
          error: responseData.message || 'Failed to send email', 
          details: responseData,
          statusCode: response.status 
        },
        { status: response.status }
      );
    }

    console.log('[email/send] Email sent successfully:', responseData.id);

    return NextResponse.json({
      success: true,
      messageId: responseData.id,
    });

  } catch (error) {
    console.error('[email/send] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Endpoint de test pour verifier la configuration
export async function GET() {
  const hasApiKey = !!RESEND_API_KEY;
  const maskedKey = RESEND_API_KEY 
    ? `${RESEND_API_KEY.slice(0, 8)}...${RESEND_API_KEY.slice(-4)}` 
    : 'NOT SET';

  return NextResponse.json({
    status: hasApiKey ? 'configured' : 'not_configured',
    apiKey: maskedKey,
    message: hasApiKey 
      ? 'Resend API is configured and ready to send emails'
      : 'RESEND_API_KEY environment variable is missing',
  });
}
