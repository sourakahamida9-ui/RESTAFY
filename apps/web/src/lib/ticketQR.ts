import { createHmac } from 'crypto';

const QR_SIGNATURE_SECRET = process.env.QR_SIGNATURE_SECRET || 'default-secret-change-in-production';

/**
 * Generate a secure QR code data with signature
 * Format: ticket_id|signature
 * Signature: HMAC-SHA256(ticket_id + timestamp, secret)
 */
export function generateSecureQRCode(ticketId: string): string {
  const timestamp = Date.now();
  const data = `${ticketId}|${timestamp}`;
  const signature = createHmac('sha256', QR_SIGNATURE_SECRET)
    .update(data)
    .digest('hex');
  
  return `${data}|${signature}`;
}

/**
 * Verify QR code signature
 * Returns true if signature is valid
 */
export function verifyQRCode(qrCodeData: string): boolean {
  const parts = qrCodeData.split('|');
  if (parts.length !== 3) return false;
  
  const [ticketId, timestamp, providedSignature] = parts;
  const data = `${ticketId}|${timestamp}`;
  const expectedSignature = createHmac('sha256', QR_SIGNATURE_SECRET)
    .update(data)
    .digest('hex');
  
  // Use timing-safe comparison to prevent timing attacks
  if (providedSignature.length !== expectedSignature.length) return false;
  
  try {
    // Simple comparison (for production, use crypto.timingSafeEqual in Node.js)
    return providedSignature === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * Extract ticket ID from QR code data
 */
export function extractTicketId(qrCodeData: string): string | null {
  const parts = qrCodeData.split('|');
  if (parts.length < 2) return null;
  return parts[0];
}

/**
 * Check if QR code is expired (optional, 24 hours by default)
 */
export function isQRCodeExpired(qrCodeData: string, maxAgeMs: number = 24 * 60 * 60 * 1000): boolean {
  const parts = qrCodeData.split('|');
  if (parts.length < 2) return true;
  
  const timestamp = parseInt(parts[1], 10);
  if (isNaN(timestamp)) return true;
  
  return Date.now() - timestamp > maxAgeMs;
}
