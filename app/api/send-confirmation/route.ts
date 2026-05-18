import { NextRequest, NextResponse } from 'next/server';
import { safeParseResponse } from '@/lib/http/safeParseResponse';

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, confirmationLink, userName } = body;

    if (!email || !confirmationLink) {
      return NextResponse.json(
        { error: 'Missing required fields: email, confirmationLink' },
        { status: 400 }
      );
    }

    if (!RESEND_API_KEY) {
      console.error('[send-confirmation] RESEND_API_KEY not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const name = userName || 'ami';

    // Template HTML pour email de confirmation
    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmez votre compte Restafy</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #F27D26 0%, #EF4444 100%); color: white; padding: 40px 30px; text-align: center;">
      <div style="font-size: 32px; font-weight: 900; letter-spacing: 2px; margin-bottom: 10px;">RESTAFY</div>
      <div style="font-size: 14px; opacity: 0.9;">Confirmez votre compte</div>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 20px 0;">Bienvenue ${name} !</h1>
      
      <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
        Merci de vous etre inscrit sur Restafy. Pour activer votre compte et commencer a commander vos plats preferes, cliquez sur le bouton ci-dessous.
      </p>
      
      <div style="text-align: center; margin: 40px 0;">
        <a href="${confirmationLink}" style="display: inline-block; background: linear-gradient(135deg, #F27D26 0%, #EF4444 100%); color: white; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(242, 125, 38, 0.4);">
          Confirmer mon compte
        </a>
      </div>
      
      <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
        Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
        <a href="${confirmationLink}" style="color: #F27D26; word-break: break-all;">${confirmationLink}</a>
      </p>
      
      <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px; margin: 0;">
          Ce lien expire dans 24 heures. Si vous n'avez pas cree de compte sur Restafy, ignorez cet email.
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #fafafa; padding: 30px; text-align: center; border-top: 1px solid #eee;">
      <div style="color: #F27D26; font-weight: 900; font-size: 18px; margin-bottom: 10px;">RESTAFY</div>
      <p style="color: #999; font-size: 12px; margin: 0;">
        Commandez maintenant, savourez plus tard<br>
        Cotonou, Benin - &copy; ${new Date().getFullYear()} Restafy
      </p>
    </div>
  </div>
</body>
</html>`;

    // Envoyer via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Restafy <noreply@restafy.shop>',
        to: [email],
        subject: 'Confirmez votre compte Restafy',
        html: htmlContent,
      }),
    });

    const { ok, status, data: responseData, raw, message } = await safeParseResponse(response);

    if (!response.ok) {
      console.error('[send-confirmation] Resend error:', responseData);
      return NextResponse.json(
        { error: 'Failed to send confirmation email', details: responseData },
        { status: response.status }
      );
    }

    console.log('[send-confirmation] Email sent:', responseData.id);

    return NextResponse.json({
      success: true,
      messageId: responseData.id,
    });

  } catch (error) {
    console.error('[send-confirmation] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
