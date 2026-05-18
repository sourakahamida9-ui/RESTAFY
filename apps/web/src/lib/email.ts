// ✅ Migré de Brevo → Resend
// ✅ FIX Networking Error : les appels fetch() vers api.resend.com sont bloqués par CORS depuis le navigateur.
//    On passe désormais par la Vercel Serverless Function '/api/send-email' (proxy server-side).
// Variables d'environnement requises :
//   RESEND_API_KEY — clé Resend à configurer dans Vercel Environment Variables

import { logEmailAttempt } from './emailLog';
import { safeParseResponse } from '@/lib/http/safeParseResponse';
import { authedSendEmailFetch } from '@/lib/sendEmailClient';

export { authedSendEmailFetch };

const APP_URL = import.meta.env.VITE_APP_URL || 'https://restafy.shop';

export interface EmailParams {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  attachment?: Array<{
    content: string;
    name: string;
  }>;
}

// ══════════════════════════════════════════════════════════════════════════════
//  DESIGN SYSTEM — Restafy Signature
//  Règles : typographie forte · couleurs franches · zéro emoji · inline CSS
//  (le CSS inline est obligatoire pour la compatibilité email)
// ══════════════════════════════════════════════════════════════════════════════

// Palette
const C = {
  orange: '#F27D26',
  red: '#D94F2B',
  dark: '#1A1A1A',
  mid: '#5A5A5A',
  muted: '#888888',
  light: '#F5F0EB',
  border: '#E8E3DC',
  white: '#FFFFFF',
  bg: '#F0EBE5',
  green: '#2E7D32',
  greenBg: '#E8F5E9',
  greenBorder: '#A5D6A7',
  red2: '#B71C1C',
  redBg: '#FFEBEE',
  redBorder: '#FFCDD2',
  amber: '#92400E',
  amberBg: '#FFFBEB',
  amberBorder: '#FCD34D',
};

// Styles communs inline (compatibilité email universelle)
const S = {
  hdrDark: `background:#1A1A1A;padding:32px 36px;`,
  hdrWarm: `background:linear-gradient(150deg,#F27D26 0%,#D94F2B 100%);padding:32px 36px;`,
  wm: `font-family:Georgia,'Times New Roman',serif;font-size:13px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,0.6);display:block;margin-bottom:20px;`,
  tag: `display:inline-block;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:5px 11px;border-radius:2px;margin-bottom:14px;`,
  hl: `font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#FFFFFF;line-height:1.25;margin:0;letter-spacing:-0.3px;`,
  sub: `font-size:13px;color:rgba(255,255,255,0.55);margin-top:7px;`,
  body: `padding:36px 36px 28px;`,
  greet: `font-size:15px;color:#5A5A5A;margin:0 0 18px;`,
  txt: `font-size:14px;color:#5A5A5A;line-height:1.7;margin:0 0 24px;`,
  card: `border:1px solid #E8E3DC;border-radius:4px;padding:22px;margin:0 0 20px;`,
  cardTtl: `font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F27D26;margin:0 0 16px;`,
  notice: `background:#F5F0EB;border-left:3px solid #F27D26;padding:14px 18px;border-radius:0 3px 3px 0;font-size:13px;color:#5A5A5A;margin:20px 0;`,
  btn: `display:inline-block;background:#F27D26;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.5px;padding:14px 30px;border-radius:3px;`,
  btnDark: `display:inline-block;background:#1A1A1A;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.5px;padding:14px 30px;border-radius:3px;`,
};

// ── Footer signature ─────────────────────────────────────────────────────────
function footer(): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:40px;border-top:1px solid #E8E3DC;">
  <tr><td style="padding-top:28px;text-align:center;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#1A1A1A;margin-bottom:3px;">RESTAFY</div>
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#888888;margin-bottom:22px;">Cotonou · Bénin</div>
    <table width="auto" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 auto 20px;">
      <tr>
        <td style="padding:0 14px;"><a href="https://restafy.shop/app" style="font-size:12px;color:#5A5A5A;text-decoration:none;">Application</a></td>
        <td style="padding:0 14px;border-left:1px solid #E8E3DC;"><a href="mailto:support@restafy.shop" style="font-size:12px;color:#5A5A5A;text-decoration:none;">Support</a></td>
        <td style="padding:0 14px;border-left:1px solid #E8E3DC;"><a href="https://restafy.shop/faq" style="font-size:12px;color:#5A5A5A;text-decoration:none;">FAQ</a></td>
      </tr>
    </table>
    <p style="font-size:11px;color:#BBBBBB;margin:0 0 5px;">© ${new Date().getFullYear()} Restafy Technologies. Tous droits réservés.</p>
    <p style="margin:0;"><a href="https://restafy.shop/terms" style="font-size:11px;color:#BBBBBB;text-decoration:none;">Conditions</a><span style="color:#DDDDDD;margin:0 8px;">&middot;</span><a href="https://restafy.shop/privacy" style="font-size:11px;color:#BBBBBB;text-decoration:none;">Confidentialité</a></p>
  </td></tr>
</table>`;
}

// ── Wrapper HTML complet ─────────────────────────────────────────────────────
function wrap(title: string, header: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
</head>
<body style="margin:0;padding:24px 16px;background:#F0EBE5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;">
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<tr><td>
<div style="max-width:600px;margin:0 auto;background:#FFFFFF;border-radius:4px;overflow:hidden;">
${header}
<div style="${S.body}">
${bodyContent}
${footer()}
</div>
</div>
</td></tr>
</table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
//  sendEmail — Fonction de base
// ══════════════════════════════════════════════════════════════════════════════

export async function sendEmail(params: EmailParams) {
  try {
    const payload = {
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      htmlContent: params.htmlContent,
      textContent: params.textContent,
      attachment: params.attachment,
    };

    const response = await authedSendEmailFetch(payload);

    const parsed = await safeParseResponse(response).catch(() => ({ data: {}, raw: '' }));
    const data = parsed.data ?? {};

    if (!response.ok || !data?.success) {
      const errorMsg = (data?.error || data?.message || "Erreur lors de l'envoi") as string;
      throw new Error(errorMsg);
    }

    logEmailAttempt({
      recipient: params.to,
      subject: params.subject,
      type: 'general',
      success: true,
    }).catch(e => console.error('[Email] Erreur log:', e));

    console.log('[Email] Envoyé à', params.to, '— messageId:', data?.messageId);
    return { success: true, data };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Email] Erreur envoi:', errorMsg);

    logEmailAttempt({
      recipient: params.to,
      subject: params.subject,
      type: 'general',
      success: false,
      error: errorMsg,
    }).catch(e => console.error('[Email] Erreur log:', e));

    return { success: false, error };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  1. CONFIRMATION DE COMMANDE (avec points fidélité)
// ══════════════════════════════════════════════════════════════════════════════

export interface OrderCongratulationsParams {
  customerName: string;
  orderId: string;
  restaurantName: string;
  total: number;
  pointsEarned: number;
  orderSummary: Array<{
    itemName: string;
    quantity: number;
    price: number;
  }>;
  trackingUrl: string;
  customerEmail: string;
  estimatedDeliveryTime?: string;
}

export async function sendOrderCongratulations(params: OrderCongratulationsParams) {
  return sendEmail({
    to: params.customerEmail,
    subject: `Commande confirmée — ${params.restaurantName} · #${params.orderId}`,
    htmlContent: generateOrderCongratulationsHTML(params),
    textContent: `Bonjour ${params.customerName}, votre commande chez ${params.restaurantName} est confirmée. Total: ${params.total.toLocaleString('fr-FR')} FCFA. Vous avez gagné ${params.pointsEarned} points.`,
  });
}

function generateOrderCongratulationsHTML(params: OrderCongratulationsParams): string {
  const rows = params.orderSummary.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E8E3DC;font-size:14px;color:#1A1A1A;">
        <span style="font-weight:700;color:#888888;">${item.quantity}&times;</span>&ensp;${item.itemName}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #E8E3DC;font-size:14px;color:#5A5A5A;text-align:right;white-space:nowrap;">
        ${(item.price * item.quantity).toLocaleString('fr-FR')} FCFA
      </td>
    </tr>`).join('');

  const header = `
<div style="${S.hdrDark}">
  <span style="${S.wm}">Restafy</span>
  <div style="${S.tag}background:#E8F5E9;color:#2E7D32;">Commande confirmée</div>
  <h1 style="${S.hl}">Votre commande<br>est bien reçue.</h1>
  <p style="${S.sub}">${params.restaurantName}&ensp;&middot;&ensp;Réf.&ensp;#${params.orderId}</p>
</div>`;

  const body = `
<p style="${S.greet}">Bonjour <strong style="color:#1A1A1A;">${params.customerName}</strong>,</p>
<p style="${S.txt}">Votre commande est confirmée. Le restaurant prend en charge votre demande et vous tiendra informé de son avancement en temps réel.</p>

<div style="${S.card}">
  <div style="${S.cardTtl}">Détail de la commande</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${rows}
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14px;">
    <tr>
      <td style="background:#F5F0EB;padding:13px 16px;border-radius:3px;">
        <span style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5A5A5A;">Total</span>
      </td>
      <td style="background:#F5F0EB;padding:13px 16px;border-radius:3px;text-align:right;">
        <span style="font-size:20px;font-weight:800;color:#1A1A1A;letter-spacing:-0.5px;">${params.total.toLocaleString('fr-FR')} FCFA</span>
      </td>
    </tr>
  </table>
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">
  <tr>
    <td style="background:#1A1A1A;border-radius:3px;padding:18px 20px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F27D26;margin-bottom:4px;">Points fidélité gagnés</div>
      <div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">+${params.pointsEarned} pts</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:2px;">Continuez à commander pour débloquer des avantages exclusifs</div>
    </td>
  </tr>
</table>

${params.estimatedDeliveryTime ? `<div style="${S.notice}"><strong>Temps de livraison estimé</strong><br>${params.estimatedDeliveryTime}</div>` : ''}

<div style="text-align:center;padding-top:8px;">
  <a href="${params.trackingUrl}" style="${S.btn}">Suivre ma commande</a>
</div>`;

  return wrap('Commande confirmée — Restafy', header, body);
}

// ══════════════════════════════════════════════════════════════════════════════
//  2. BILLET ÉVÉNEMENT (avec QR code)
// ══════════════════════════════════════════════════════════════════════════════

export interface TicketConfirmationParams {
  customerEmail: string;
  customerName: string;
  ticketNumber: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketType: string;
  quantity: number;
  totalPrice: number;
  qrCodeData: string;
  restaurantName: string;
  eventImage?: string;
}

export async function sendTicketConfirmation(params: TicketConfirmationParams) {
  let qrPngDataUrl = '';
  try {
    // Génération QR côté client pour l’e-mail + pièce jointe (base64 PNG).
    const { default: QRCode } = await import('qrcode');
    qrPngDataUrl = await QRCode.toDataURL(params.qrCodeData, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 600,
      color: {
        dark: '#111111',
        light: '#FFFFFF',
      },
    });
  } catch {
    qrPngDataUrl = '';
  }

  return sendEmail({
    to: params.customerEmail,
    subject: `Billet confirmé — ${params.eventTitle} · #${params.ticketNumber}`,
    htmlContent: generateTicketConfirmationHTML(params, qrPngDataUrl),
    textContent: `Bonjour ${params.customerName}, votre billet #${params.ticketNumber} pour ${params.eventTitle} le ${params.eventDate} à ${params.eventLocation} est confirmé.`,
    attachment: qrPngDataUrl
      ? [
          {
            name: `qr-billet-${String(params.ticketNumber).replace(/[^a-zA-Z0-9_-]/g, '')}.png`,
            content: qrPngDataUrl.replace(/^data:image\/png;base64,/, ''),
          },
        ]
      : undefined,
  });
}

function generateTicketConfirmationHTML(params: TicketConfirmationParams, qrPngDataUrl: string): string {
  const eventDate = (() => {
    try {
      return new Date(params.eventDate).toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long',
        day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return params.eventDate; }
  })();

  const header = `
<div style="${S.hdrWarm}">
  <span style="${S.wm}">Restafy</span>
  <div style="${S.tag}background:rgba(255,255,255,0.18);color:#FFFFFF;">Billet confirmé</div>
  <h1 style="${S.hl}">${params.eventTitle}</h1>
  <p style="${S.sub}">${params.restaurantName}&ensp;&middot;&ensp;${params.eventLocation}</p>
</div>`;

  const body = `
<p style="${S.greet}">Bonjour <strong style="color:#1A1A1A;">${params.customerName}</strong>,</p>
<p style="${S.txt}">Votre réservation est enregistrée. Présentez le code ci-dessous à l'entrée de l'événement.</p>

<div style="${S.card}">
  <div style="${S.cardTtl}">Informations billet</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E8E3DC;font-size:13px;color:#5A5A5A;width:45%;">Référence</td>
      <td style="padding:10px 0;border-bottom:1px solid #E8E3DC;font-size:14px;color:#1A1A1A;font-weight:700;text-align:right;">#${params.ticketNumber}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E8E3DC;font-size:13px;color:#5A5A5A;">Date</td>
      <td style="padding:10px 0;border-bottom:1px solid #E8E3DC;font-size:14px;color:#1A1A1A;font-weight:700;text-align:right;">${eventDate}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E8E3DC;font-size:13px;color:#5A5A5A;">Lieu</td>
      <td style="padding:10px 0;border-bottom:1px solid #E8E3DC;font-size:14px;color:#1A1A1A;font-weight:700;text-align:right;">${params.eventLocation}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E8E3DC;font-size:13px;color:#5A5A5A;">Type</td>
      <td style="padding:10px 0;border-bottom:1px solid #E8E3DC;font-size:14px;color:#1A1A1A;font-weight:700;text-align:right;">${params.ticketType}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E8E3DC;font-size:13px;color:#5A5A5A;">Titulaire</td>
      <td style="padding:10px 0;border-bottom:1px solid #E8E3DC;font-size:14px;color:#1A1A1A;font-weight:700;text-align:right;">${params.customerName}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;font-size:13px;color:#5A5A5A;">Total</td>
      <td style="padding:10px 0;font-size:14px;color:#1A1A1A;font-weight:700;text-align:right;">${params.totalPrice.toLocaleString('fr-FR')} FCFA &nbsp;&middot;&nbsp; ${params.quantity} billet${params.quantity > 1 ? 's' : ''}</td>
    </tr>
  </table>
</div>

<div style="${S.card}text-align:center;">
  <div style="${S.cardTtl}text-align:center;">Code d'entrée</div>
  ${
    qrPngDataUrl
      ? `<div style="background:#FFFFFF;border:1px solid #E8E3DC;border-radius:4px;padding:14px;display:inline-block;">
           <img src="${qrPngDataUrl}" width="220" height="220" alt="QR code billet" style="display:block;border-radius:3px;" />
         </div>
         <p style="font-size:12px;color:#888888;margin:12px 0 0;">QR code en pièce jointe (PNG) si vous préférez l'imprimer.</p>`
      : ''
  }
  <div style="margin-top:14px;background:#F5F0EB;border-radius:3px;padding:18px 16px;font-family:'Courier New',Courier,monospace;font-size:12px;color:#5A5A5A;word-break:break-all;letter-spacing:1px;line-height:1.8;">${params.qrCodeData}</div>
  <p style="font-size:12px;color:#888888;margin:12px 0 0;">Présentez ce code à l'entrée — valable une seule fois</p>
  <p style="font-size:11px;color:#BBBBBB;margin:10px 0 0;letter-spacing:0.6px;">Powered by Restafy</p>
</div>

<div style="${S.notice}"><strong>Rappel automatique</strong> — Vous recevrez un rappel 24 h avant le début de l'événement.</div>`;

  return wrap(`Billet — ${params.eventTitle}`, header, body);
}

// ══════════════════════════════════════════════════════════════════════════════
//  3. RESTAURANT APPROUVÉ
// ══════════════════════════════════════════════════════════════════════════════

export interface RestaurantApprovalParams {
  ownerName: string;
  ownerEmail: string;
  restaurantName: string;
  dashboardUrl: string;
  setupGuideUrl?: string;
}

export async function sendRestaurantApprovalEmail(params: RestaurantApprovalParams) {
  return sendEmail({
    to: params.ownerEmail,
    subject: `${params.restaurantName} est maintenant actif sur Restafy`,
    htmlContent: generateRestaurantApprovalHTML(params),
    textContent: `Félicitations ${params.ownerName}. Votre restaurant ${params.restaurantName} est approuvé et actif sur Restafy.`,
  });
}

function generateRestaurantApprovalHTML(params: RestaurantApprovalParams): string {
  const steps = [
    { n: 1, t: 'Complétez votre menu', d: 'Ajoutez vos catégories, plats, prix et photos.' },
    { n: 2, t: 'Configurez vos horaires', d: 'Définissez vos jours et créneaux de service.' },
    { n: 3, t: 'Activez les paiements', d: 'Mobile Money, carte bancaire ou espèces.' },
    { n: 4, t: 'Mettez-vous en ligne', d: 'Activez votre restaurant pour recevoir des commandes.' },
  ];

  const stepsHTML = steps.map((s, i) => `
    <tr>
      <td style="padding:14px 0;border-bottom:${i < steps.length - 1 ? '1px solid #E8E3DC' : 'none'};vertical-align:top;width:36px;">
        <div style="width:26px;height:26px;border-radius:50%;background:#1A1A1A;color:#FFFFFF;font-size:11px;font-weight:700;text-align:center;line-height:26px;">${s.n}</div>
      </td>
      <td style="padding:14px 0 14px 14px;border-bottom:${i < steps.length - 1 ? '1px solid #E8E3DC' : 'none'};">
        <div style="font-weight:700;font-size:14px;color:#1A1A1A;margin-bottom:2px;">${s.t}</div>
        <div style="font-size:13px;color:#5A5A5A;">${s.d}</div>
      </td>
    </tr>`).join('');

  const header = `
<div style="${S.hdrDark}">
  <span style="${S.wm}">Restafy</span>
  <div style="${S.tag}background:#E8F5E9;color:#2E7D32;">Restaurant activé</div>
  <h1 style="${S.hl}">Bienvenue dans<br>le réseau Restafy.</h1>
  <p style="${S.sub}">${params.restaurantName} est maintenant en ligne.</p>
</div>`;

  const body = `
<p style="${S.greet}">Bonjour <strong style="color:#1A1A1A;">${params.ownerName}</strong>,</p>
<p style="${S.txt}">Votre restaurant a été validé par notre équipe. Vous pouvez dès à présent configurer votre espace et commencer à recevoir des commandes.</p>

<div style="${S.card}">
  <div style="${S.cardTtl}">Pour commencer</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${stepsHTML}
  </table>
</div>

<div style="text-align:center;padding:4px 0 8px;">
  <a href="${params.dashboardUrl}" style="${S.btn}">Accéder à mon dashboard</a>
</div>

${params.setupGuideUrl ? `<p style="text-align:center;margin-top:16px;"><a href="${params.setupGuideUrl}" style="font-size:13px;color:#F27D26;text-decoration:none;">Consulter le guide de configuration &rarr;</a></p>` : ''}

<div style="${S.notice}margin-top:24px;"><strong>Une question ?</strong> Notre équipe partenaires répond sous 24 h — <a href="mailto:partenaires@restafy.shop" style="color:#F27D26;text-decoration:none;">partenaires@restafy.shop</a></div>`;

  return wrap(`${params.restaurantName} approuvé — Restafy`, header, body);
}

// ══════════════════════════════════════════════════════════════════════════════
//  4. BIENVENUE NOUVEL UTILISATEUR
// ══════════════════════════════════════════════════════════════════════════════

export interface WelcomeEmailParams {
  userName: string;
  userEmail: string;
  verificationLink?: string;
}

export async function sendWelcomeEmail(params: WelcomeEmailParams) {
  const cols = [
    { lbl: 'Restaurants', val: 'Des centaines<br>de choix' },
    { lbl: 'Livraison', val: 'Rapide et suivie<br>en temps réel' },
    { lbl: 'Fidélité', val: 'Points et<br>avantages exclusifs' },
  ];

  const colsHTML = cols.map(c => `
    <td style="padding:18px 10px;text-align:center;border:1px solid #E8E3DC;border-radius:3px;width:33%;">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F27D26;margin-bottom:6px;">${c.lbl}</div>
      <div style="font-size:13px;color:#5A5A5A;line-height:1.5;">${c.val}</div>
    </td>`).join('<td width="8"></td>');

  const header = `
<div style="${S.hdrWarm}">
  <span style="${S.wm}">Restafy</span>
  <h1 style="${S.hl}">Bonjour,<br>${params.userName}.</h1>
  <p style="${S.sub}">Votre compte est prêt.</p>
</div>`;

  const body = `
<p style="${S.txt}">Vous avez rejoint Restafy — la référence de la commande de repas au Bénin. Découvrez les meilleurs restaurants de votre ville et commandez en quelques secondes.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 28px;">
  <tr>${colsHTML}</tr>
</table>

${params.verificationLink
      ? `<div style="text-align:center;"><a href="${params.verificationLink}" style="${S.btn}">Vérifier mon adresse email</a></div>
     <p style="text-align:center;font-size:12px;color:#888888;margin-top:14px;">Ce lien expire dans 24 heures.</p>`
      : `<div style="text-align:center;"><a href="${APP_URL}" style="${S.btn}">Commencer à commander</a></div>`
    }`;

  const htmlContent = wrap('Bienvenue sur Restafy', header, body);

  return sendEmail({
    to: params.userEmail,
    subject: `Bienvenue sur Restafy, ${params.userName}`,
    htmlContent,
    textContent: `Bonjour ${params.userName}, bienvenue sur Restafy !`,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  5. STATUT RESTAURANT (activé / désactivé)
// ══════════════════════════════════════════════════════════════════════════════

export interface RestaurantStatusEmailParams {
  ownerName: string;
  ownerEmail: string;
  restaurantName: string;
  isActive: boolean;
  reason?: string;
}

export async function sendRestaurantStatusEmail(params: RestaurantStatusEmailParams) {
  const { ownerName, ownerEmail, restaurantName, isActive, reason } = params;
  const label = isActive ? 'réactivé' : 'désactivé';
  const tagBg = isActive ? '#E8F5E9' : '#FFEBEE';
  const tagColor = isActive ? '#2E7D32' : '#B71C1C';
  const blockBg = isActive ? '#E8F5E9' : '#FFEBEE';
  const blockBorder = isActive ? '#A5D6A7' : '#FFCDD2';
  const blockColor = isActive ? '#2E7D32' : '#B71C1C';
  const actionText = isActive
    ? `${restaurantName} est de nouveau visible par les clients et peut recevoir des commandes.`
    : `${restaurantName} n'est plus visible par les clients. Aucune commande ne peut être passée pendant cette période.`;

  const header = `
<div style="${S.hdrDark}">
  <span style="${S.wm}">Restafy</span>
  <div style="${S.tag}background:${tagBg};color:${tagColor};">Restaurant ${label}</div>
  <h1 style="${S.hl}">${restaurantName}</h1>
  <p style="${S.sub}">Notification de statut · Restafy Partenaires</p>
</div>`;

  const body = `
<p style="${S.greet}">Bonjour <strong style="color:#1A1A1A;">${ownerName}</strong>,</p>

<div style="background:${blockBg};border:1px solid ${blockBorder};border-radius:3px;padding:22px;margin:0 0 20px;">
  <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${blockColor};margin-bottom:8px;">${label.toUpperCase()}</div>
  <p style="font-size:15px;color:#1A1A1A;margin:0;">${actionText}</p>
</div>

${reason ? `<div style="${S.notice}"><strong>Motif communiqué par Restafy</strong><br>${reason}</div>` : ''}

${isActive
      ? `<div style="text-align:center;padding-top:8px;"><a href="${APP_URL}/restaurant/dashboard" style="${S.btn}">Accéder au dashboard</a></div>`
      : `<p style="${S.txt}">Pour toute question ou pour régulariser votre situation, contactez directement notre équipe partenaires.</p>
     <div style="text-align:center;padding-top:4px;"><a href="mailto:partenaires@restafy.shop" style="${S.btnDark}">Contacter l'équipe partenaires</a></div>`
    }`;

  const htmlContent = wrap(`Restaurant ${label} — Restafy`, header, body);

  return sendEmail({
    to: ownerEmail,
    subject: `${restaurantName} — Compte ${label} sur Restafy`,
    htmlContent,
    textContent: `Bonjour ${ownerName}, votre restaurant "${restaurantName}" a été ${label} sur Restafy.${reason ? ` Motif : ${reason}` : ''} Contactez partenaires@restafy.shop pour plus d'informations.`,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  6. STATUT CLIENT (suspendu / réactivé)
// ══════════════════════════════════════════════════════════════════════════════

export interface UserStatusEmailParams {
  userName: string;
  userEmail: string;
  isBanned: boolean;
  reason?: string;
}

export async function sendUserStatusEmail(params: UserStatusEmailParams) {
  const { userName, userEmail, isBanned, reason } = params;
  const label = isBanned ? 'suspendu' : 'réactivé';
  const tagBg = isBanned ? '#FFEBEE' : '#E8F5E9';
  const tagColor = isBanned ? '#B71C1C' : '#2E7D32';
  const blockBg = isBanned ? '#FFEBEE' : '#E8F5E9';
  const blockBorder = isBanned ? '#FFCDD2' : '#A5D6A7';
  const blockColor = isBanned ? '#B71C1C' : '#2E7D32';
  const actionText = isBanned
    ? "Votre accès à Restafy a été temporairement suspendu. Vous ne pouvez plus passer de commandes pendant cette période."
    : "Votre compte est de nouveau actif. Vous pouvez commander comme d'habitude.";

  const header = `
<div style="${S.hdrDark}">
  <span style="${S.wm}">Restafy</span>
  <div style="${S.tag}background:${tagBg};color:${tagColor};">Compte ${label}</div>
  <h1 style="${S.hl}">Information<br>importante.</h1>
  <p style="${S.sub}">Concernant votre compte Restafy</p>
</div>`;

  const body = `
<p style="${S.greet}">Bonjour <strong style="color:#1A1A1A;">${userName}</strong>,</p>

<div style="background:${blockBg};border:1px solid ${blockBorder};border-radius:3px;padding:22px;margin:0 0 20px;">
  <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${blockColor};margin-bottom:8px;">COMPTE ${label.toUpperCase()}</div>
  <p style="font-size:15px;color:#1A1A1A;margin:0;">${actionText}</p>
</div>

${reason ? `<div style="${S.notice}"><strong>Motif</strong><br>${reason}</div>` : ''}

${isBanned
      ? `<p style="${S.txt}">Si vous pensez que cette décision est une erreur, contactez notre service client.</p>
     <div style="text-align:center;padding-top:4px;"><a href="mailto:support@restafy.shop" style="${S.btnDark}">Contacter le support</a></div>`
      : `<div style="text-align:center;padding-top:4px;"><a href="${APP_URL}" style="${S.btn}">Commander maintenant</a></div>`
    }`;

  const htmlContent = wrap(`Compte ${label} — Restafy`, header, body);

  return sendEmail({
    to: userEmail,
    subject: `Votre compte Restafy a été ${label}`,
    htmlContent,
    textContent: `Bonjour ${userName}, votre compte Restafy a été ${label}.${reason ? ` Motif : ${reason}` : ''} Contactez support@restafy.shop pour plus d'informations.`,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  7. COMMANDE ACCEPTÉE PAR LE RESTAURANT
// ══════════════════════════════════════════════════════════════════════════════

export interface OrderAcceptedParams {
  customerName: string;
  customerEmail: string;
  orderId: string;
  restaurantName: string;
  estimatedTime?: string;
  trackingUrl: string;
}

export async function sendOrderAccepted(params: OrderAcceptedParams) {
  const header = `
<div style="${S.hdrDark}">
  <span style="${S.wm}">Restafy</span>
  <div style="${S.tag}background:#E8F5E9;color:#2E7D32;">En préparation</div>
  <h1 style="${S.hl}">Le restaurant<br>prépare votre commande.</h1>
  <p style="${S.sub}">${params.restaurantName}&ensp;&middot;&ensp;#${params.orderId}</p>
</div>`;

  const body = `
<p style="${S.greet}">Bonjour <strong style="color:#1A1A1A;">${params.customerName}</strong>,</p>
<p style="${S.txt}">Bonne nouvelle — ${params.restaurantName} a accepté votre commande et la prépare actuellement.</p>

${params.estimatedTime ? `<div style="${S.notice}"><strong>Temps de préparation estimé</strong><br>${params.estimatedTime}</div>` : ''}

<div style="text-align:center;padding-top:4px;"><a href="${params.trackingUrl}" style="${S.btn}">Suivre ma commande</a></div>`;

  const htmlContent = wrap('Commande acceptée — Restafy', header, body);

  return sendEmail({
    to: params.customerEmail,
    subject: `Votre commande est en préparation — ${params.restaurantName}`,
    htmlContent,
    textContent: `Bonjour ${params.customerName}, votre commande #${params.orderId} chez ${params.restaurantName} est en cours de préparation.`,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  8. COMMANDE ANNULÉE
// ══════════════════════════════════════════════════════════════════════════════

export interface OrderCancelledParams {
  customerName: string;
  customerEmail: string;
  orderId: string;
  restaurantName: string;
  reason?: string;
  refundAmount?: number;
}

export async function sendOrderCancelled(params: OrderCancelledParams) {
  const header = `
<div style="${S.hdrDark}">
  <span style="${S.wm}">Restafy</span>
  <div style="${S.tag}background:#FFEBEE;color:#B71C1C;">Commande annulée</div>
  <h1 style="${S.hl}">Votre commande<br>a été annulée.</h1>
  <p style="${S.sub}">${params.restaurantName}&ensp;&middot;&ensp;#${params.orderId}</p>
</div>`;

  const body = `
<p style="${S.greet}">Bonjour <strong style="color:#1A1A1A;">${params.customerName}</strong>,</p>
<p style="${S.txt}">Nous vous informons que votre commande #${params.orderId} passée chez ${params.restaurantName} a malheureusement été annulée.</p>

${params.reason ? `<div style="${S.notice}"><strong>Raison de l'annulation</strong><br>${params.reason}</div>` : ''}

${params.refundAmount ? `
<div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:3px;padding:20px;margin:0 0 20px;">
  <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400E;margin-bottom:6px;">Remboursement</div>
  <p style="font-size:15px;color:#1A1A1A;margin:0;">Un remboursement de <strong>${params.refundAmount.toLocaleString('fr-FR')} FCFA</strong> a été initié. Il apparaîtra sur votre compte sous 2 à 5 jours ouvrés.</p>
</div>` : ''}

<div style="text-align:center;padding-top:4px;"><a href="${APP_URL}" style="${S.btn}">Commander à nouveau</a></div>`;

  const htmlContent = wrap('Commande annulée — Restafy', header, body);

  return sendEmail({
    to: params.customerEmail,
    subject: `Commande annulée — #${params.orderId}`,
    htmlContent,
    textContent: `Bonjour ${params.customerName}, votre commande #${params.orderId} a été annulée.${params.reason ? ` Raison : ${params.reason}` : ''}${params.refundAmount ? ` Remboursement de ${params.refundAmount} FCFA initié.` : ''}`,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  9. COMMANDE PRÊTE / EN LIVRAISON
// ══════════════════════════════════════════════════════════════════════════════

export interface OrderReadyParams {
  customerName: string;
  customerEmail: string;
  orderId: string;
  restaurantName: string;
  isDelivery: boolean;
  trackingUrl: string;
  restaurantAddress?: string;
}

export async function sendOrderReady(params: OrderReadyParams) {
  const headline = params.isDelivery
    ? 'Votre commande\nest en route.'
    : 'Votre commande\nest prête.';
  const subLabel = params.isDelivery ? 'En livraison' : 'Prête pour retrait';
  const hdrStyle = params.isDelivery ? S.hdrWarm : S.hdrDark;
  const tagStyle = params.isDelivery
    ? 'background:rgba(255,255,255,0.18);color:#FFFFFF;'
    : 'background:#E8F5E9;color:#2E7D32;';

  const header = `
<div style="${hdrStyle}">
  <span style="${S.wm}">Restafy</span>
  <div style="${S.tag}${tagStyle}">${subLabel}</div>
  <h1 style="${S.hl}">${headline}</h1>
  <p style="${S.sub}">${params.restaurantName}&ensp;&middot;&ensp;#${params.orderId}</p>
</div>`;

  const body = `
<p style="${S.greet}">Bonjour <strong style="color:#1A1A1A;">${params.customerName}</strong>,</p>
${params.isDelivery
      ? `<p style="${S.txt}">Votre commande est en route. Notre livreur se dirige vers vous — suivez la livraison en temps réel.</p>`
      : `<p style="${S.txt}">Votre commande est prête et vous attend au restaurant. Merci de vous présenter dès que possible.</p>
     ${params.restaurantAddress ? `<div style="${S.notice}"><strong>Adresse de retrait</strong><br>${params.restaurantAddress}</div>` : ''}`
    }
<div style="text-align:center;padding-top:4px;"><a href="${params.trackingUrl}" style="${S.btn}">Suivre en temps réel</a></div>`;

  const htmlContent = wrap(
    `Commande ${params.isDelivery ? 'en livraison' : 'prête'} — Restafy`,
    header, body
  );

  return sendEmail({
    to: params.customerEmail,
    subject: params.isDelivery
      ? `Votre commande est en route — ${params.restaurantName}`
      : `Votre commande est prête — ${params.restaurantName}`,
    htmlContent,
    textContent: `Bonjour ${params.customerName}, votre commande #${params.orderId} ${params.isDelivery ? 'est en cours de livraison' : 'est prête pour le retrait'}.`,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  10. COMMANDE LIVRÉE
// ══════════════════════════════════════════════════════════════════════════════

export interface OrderDeliveredParams {
  customerName: string;
  customerEmail: string;
  orderId: string;
  restaurantName: string;
  total: number;
  pointsTotal: number;
  reviewUrl?: string;
}

export async function sendOrderDelivered(params: OrderDeliveredParams) {
  const header = `
<div style="${S.hdrWarm}">
  <span style="${S.wm}">Restafy</span>
  <div style="${S.tag}background:rgba(255,255,255,0.18);color:#FFFFFF;">Livrée</div>
  <h1 style="${S.hl}">Bon appétit,<br>${params.customerName}.</h1>
  <p style="${S.sub}">${params.restaurantName}&ensp;&middot;&ensp;#${params.orderId}</p>
</div>`;

  const body = `
<p style="${S.greet}">Bonjour <strong style="color:#1A1A1A;">${params.customerName}</strong>,</p>
<p style="${S.txt}">Votre commande a été livrée. Nous espérons que vous apprécierez votre repas.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">
  <tr>
    <td style="border:1px solid #E8E3DC;border-radius:3px;padding:18px;width:50%;vertical-align:top;">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F27D26;margin-bottom:4px;">Total payé</div>
      <div style="font-size:20px;font-weight:800;color:#1A1A1A;letter-spacing:-0.5px;">${params.total.toLocaleString('fr-FR')} FCFA</div>
    </td>
    <td width="8"></td>
    <td style="background:#1A1A1A;border-radius:3px;padding:18px;width:50%;vertical-align:top;">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F27D26;margin-bottom:4px;">Points fidélité</div>
      <div style="font-size:20px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">${params.pointsTotal.toLocaleString('fr-FR')} pts</div>
    </td>
  </tr>
</table>

${params.reviewUrl ? `
<div style="${S.notice}">
  <strong>Votre avis compte</strong><br>Prenez 30 secondes pour noter votre expérience et aider la communauté Restafy.
</div>
<div style="text-align:center;padding-top:4px;"><a href="${params.reviewUrl}" style="${S.btnDark}">Laisser un avis</a></div>` : ''}`;

  const htmlContent = wrap('Commande livrée — Restafy', header, body);

  return sendEmail({
    to: params.customerEmail,
    subject: `Commande livrée — Bon appétit !`,
    htmlContent,
    textContent: `Bonjour ${params.customerName}, votre commande #${params.orderId} a été livrée. Merci d'avoir choisi Restafy.`,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  11. RÉCOMPENSE FIDÉLITÉ DÉBLOQUÉE
// ══════════════════════════════════════════════════════════════════════════════

export interface LoyaltyRewardParams {
  customerName: string;
  customerEmail: string;
  rewardName: string;
  rewardValue: string;
  promoCode?: string;
  expiryDate?: string;
  redeemUrl: string;
}

export async function sendLoyaltyReward(params: LoyaltyRewardParams) {
  const header = `
<div style="${S.hdrDark}">
  <span style="${S.wm}">Restafy</span>
  <div style="${S.tag}background:#FFFBEB;color:#92400E;">Récompense débloquée</div>
  <h1 style="${S.hl}">${params.rewardName}</h1>
  <p style="${S.sub}">Programme de fidélité Restafy</p>
</div>`;

  const body = `
<p style="${S.greet}">Bonjour <strong style="color:#1A1A1A;">${params.customerName}</strong>,</p>
<p style="${S.txt}">Félicitations — vous avez débloqué une nouvelle récompense grâce à votre fidélité.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">
  <tr>
    <td style="background:#1A1A1A;border-radius:3px;padding:26px;text-align:center;">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F27D26;margin-bottom:6px;">${params.rewardName}</div>
      <div style="font-size:28px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px;">${params.rewardValue}</div>
      ${params.promoCode ? `
      <div style="margin-top:16px;">
        <div style="font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Code promo</div>
        <div style="display:inline-block;background:#F27D26;color:#FFFFFF;font-family:'Courier New',Courier,monospace;font-size:16px;font-weight:700;letter-spacing:3px;padding:10px 22px;border-radius:3px;">${params.promoCode}</div>
      </div>` : ''}
    </td>
  </tr>
</table>

${params.expiryDate ? `<div style="${S.notice}"><strong>Valable jusqu'au</strong> ${params.expiryDate}</div>` : ''}

<div style="text-align:center;padding-top:4px;"><a href="${params.redeemUrl}" style="${S.btn}">Utiliser ma récompense</a></div>`;

  const htmlContent = wrap('Récompense fidélité — Restafy', header, body);

  return sendEmail({
    to: params.customerEmail,
    subject: `Récompense débloquée — ${params.rewardName}`,
    htmlContent,
    textContent: `Bonjour ${params.customerName}, vous avez débloqué "${params.rewardName}" (${params.rewardValue}).${params.promoCode ? ` Code promo : ${params.promoCode}.` : ''}`,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  12. RAPPEL ÉVÉNEMENT (24 h avant)
// ══════════════════════════════════════════════════════════════════════════════

export interface EventReminderParams {
  customerName: string;
  customerEmail: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketNumber: string;
  qrCodeData: string;
}

export async function sendEventReminder(params: EventReminderParams) {
  const eventDate = (() => {
    try {
      return new Date(params.eventDate).toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long',
        day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return params.eventDate; }
  })();

  const header = `
<div style="${S.hdrWarm}">
  <span style="${S.wm}">Restafy</span>
  <div style="${S.tag}background:rgba(255,255,255,0.18);color:#FFFFFF;">Rappel · Dans 24 heures</div>
  <h1 style="${S.hl}">${params.eventTitle}</h1>
  <p style="${S.sub}">${params.eventLocation}&ensp;&middot;&ensp;${eventDate}</p>
</div>`;

  const body = `
<p style="${S.greet}">Bonjour <strong style="color:#1A1A1A;">${params.customerName}</strong>,</p>
<p style="${S.txt}">Votre événement commence demain. N'oubliez pas de présenter votre code d'entrée à l'accueil.</p>

<div style="${S.card}text-align:center;">
  <div style="${S.cardTtl}text-align:center;">Code d'entrée · #${params.ticketNumber}</div>
  <div style="background:#F5F0EB;border-radius:3px;padding:22px 18px;font-family:'Courier New',Courier,monospace;font-size:12px;color:#5A5A5A;word-break:break-all;letter-spacing:1px;line-height:1.8;">${params.qrCodeData}</div>
  <p style="font-size:12px;color:#888888;margin:12px 0 0;">Valable une seule fois</p>
</div>

<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">
  <tr>
    <td style="border:1px solid #E8E3DC;border-radius:3px;padding:14px;vertical-align:top;width:50%;">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F27D26;margin-bottom:3px;">Date</div>
      <div style="font-size:13px;color:#1A1A1A;font-weight:700;">${eventDate}</div>
    </td>
    <td width="8"></td>
    <td style="border:1px solid #E8E3DC;border-radius:3px;padding:14px;vertical-align:top;width:50%;">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F27D26;margin-bottom:3px;">Lieu</div>
      <div style="font-size:13px;color:#1A1A1A;font-weight:700;">${params.eventLocation}</div>
    </td>
  </tr>
</table>`;

  const htmlContent = wrap(`Rappel — ${params.eventTitle}`, header, body);

  return sendEmail({
    to: params.customerEmail,
    subject: `Rappel — ${params.eventTitle} démarre demain`,
    htmlContent,
    textContent: `Bonjour ${params.customerName}, rappel : ${params.eventTitle} a lieu le ${eventDate} à ${params.eventLocation}. Billet : #${params.ticketNumber}.`,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  13. CAMPAGNE PROMO / MARKETING
// ══════════════════════════════════════════════════════════════════════════════

export interface PromoEmailParams {
  recipientName: string;
  recipientEmail: string;
  promoTitle: string;
  promoDescription: string;
  promoCode?: string;
  discountValue: string;
  expiryDate?: string;
  ctaLabel?: string;
  ctaUrl: string;
}

export async function sendPromoEmail(params: PromoEmailParams) {
  const header = `
<div style="${S.hdrWarm}">
  <span style="${S.wm}">Restafy</span>
  <h1 style="${S.hl}">${params.promoTitle}</h1>
  <p style="${S.sub}">${params.discountValue}&ensp;&middot;&ensp;Offre exclusive Restafy</p>
</div>`;

  const body = `
<p style="${S.greet}">Bonjour <strong style="color:#1A1A1A;">${params.recipientName}</strong>,</p>
<p style="${S.txt}">${params.promoDescription}</p>

${params.promoCode ? `
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">
  <tr>
    <td style="background:#1A1A1A;border-radius:3px;padding:24px;text-align:center;">
      <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F27D26;margin-bottom:8px;">Votre code promo</div>
      <div style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:4px;background:rgba(255,255,255,0.07);display:inline-block;padding:10px 22px;border-radius:3px;">${params.promoCode}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:10px;">Appliquez ce code lors de votre prochaine commande</div>
    </td>
  </tr>
</table>` : ''}

${params.expiryDate ? `<div style="${S.notice}"><strong>Offre valable jusqu'au</strong> ${params.expiryDate} — Ne la manquez pas.</div>` : ''}

<div style="text-align:center;padding-top:4px;"><a href="${params.ctaUrl}" style="${S.btn}">${params.ctaLabel || 'Commander maintenant'}</a></div>`;

  const htmlContent = wrap(`${params.promoTitle} — Restafy`, header, body);

  return sendEmail({
    to: params.recipientEmail,
    subject: params.promoTitle,
    htmlContent,
    textContent: `${params.promoTitle} — ${params.promoDescription}${params.promoCode ? ` Code : ${params.promoCode}.` : ''} Valable sur ${params.ctaUrl}.`,
  });
}