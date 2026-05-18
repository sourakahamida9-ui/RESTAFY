import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Whitelist des origines autorisees
const ALLOWED_ORIGINS = [
  'https://app.restafy.shop',
  'https://restafy.shop',
  'https://www.restafy.shop',
];

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'restafy.shop' || hostname.endsWith('.restafy.shop')) return true;
    if (hostname.endsWith('.vercel.app')) return true;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    return false;
  } catch {
    return false;
  }
}

function applyCors(res: VercelResponse, req: VercelRequest): void {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const allowedOrigin = isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✅ AUTH JWT - Vérifier le token Supabase
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  const token = authHeader.slice(7);

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await (supabaseClient.auth as any).getUser();
  if (authError || !user) {
    console.error('[send-email] Auth error:', authError);
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }

  // ✅ Vérifier le rôle autorisé
  const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: 'Profil non trouvé' });
  }

  const allowedRoles = ['restaurant_owner', 'admin', 'manager', 'super_admin', 'support', 'client'];
  if (!allowedRoles.includes(profile.role)) {
    console.warn('[send-email] Unauthorized role:', profile.role, 'user:', user.id);
    return res.status(403).json({ error: 'Envoi email non autorisé pour ce rôle' });
  }

  if (!RESEND_API_KEY) {
    console.error('[send-email] RESEND_API_KEY not configured');
    return res.status(500).json({ 
      success: false, 
      error: 'Email service not configured. Please add RESEND_API_KEY to Vercel environment variables.' 
    });
  }

  try {
    const { to, subject, htmlContent, textContent, attachment } = req.body;

    if (!to || !subject || !htmlContent) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: to, subject, htmlContent' 
      });
    }

    console.log('[send-email] Sending to:', to, 'Subject:', subject);

    // Build Resend payload
    const payload: any = {
      from: process.env.RESEND_FROM_EMAIL || 'Restafy <noreply@app.restafy.shop>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html: htmlContent,
    };

    if (textContent) {
      payload.text = textContent;
    }

    if (attachment && Array.isArray(attachment) && attachment.length > 0) {
      payload.attachments = attachment.map((att: any) => ({
        filename: att.name,
        content: att.content,
      }));
    }

    // Call Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[send-email] Resend response:', response.status, responseText);

    let data;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('[send-email] Failed to parse Resend response:', responseText);
      return res.status(500).json({ 
        success: false, 
        error: 'Invalid response from Resend API',
        rawResponse: responseText.substring(0, 200)
      });
    }

    if (!response.ok) {
      console.error('[send-email] Resend API error:', data);
      return res.status(response.status).json({ 
        success: false, 
        error: data.message || 'Failed to send email',
        details: data
      });
    }

    console.log('[send-email] Email sent successfully:', data.id);

    return res.status(200).json({ 
      success: true, 
      messageId: data.id 
    });

  } catch (error) {
    console.error('[send-email] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
