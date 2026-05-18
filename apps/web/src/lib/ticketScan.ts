/**
 * Normalise le texte lu depuis un QR / un scan / un copier-coller pour matcher la base (qr_code_data, ticket_number).
 */
export function normalizeTicketScanPayload(raw: string): string {
  if (!raw) return '';
  let s = raw.replace(/\u200b|\u200c|\u200d|\ufeff/g, '').trim();
  s = s.replace(/^["'«»]+|["'«»]+$/g, '').trim();

  const lines = s
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  s = lines[0] ?? s;

  try {
    if (/^https?:\/\//i.test(s)) {
      const url = new URL(s.split(/\s+/)[0]);
      const fromQuery =
        url.searchParams.get('q') ||
        url.searchParams.get('code') ||
        url.searchParams.get('ticket') ||
        url.searchParams.get('t');
      if (fromQuery) return normalizeTicketScanPayload(fromQuery);
      const seg = url.pathname.split('/').filter(Boolean).pop();
      if (seg && (/^RESTAFY-/i.test(seg) || /^TKT-/i.test(seg))) {
        return normalizeTicketScanPayload(seg);
      }
    }
  } catch {
    /* pas une URL valide */
  }

  if (/^RESTAFY-/i.test(s)) {
    return s.replace(/\s+/g, '').toUpperCase();
  }
  if (/^TKT-/i.test(s)) {
    return s.replace(/\s+/g, '').toUpperCase();
  }
  return s.trim();
}
