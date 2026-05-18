import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Centralized CORS configuration for all Vercel API routes.
 * Single source of truth for allowed origins.
 */
const ALLOWED_ORIGINS = [
  'https://app.restafy.shop',
  'https://scan.restafy.shop',
  'https://restafy.shop',
  'https://www.restafy.shop',
];

export function isOriginAllowed(origin: string): boolean {
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

export function applyCors(res: VercelResponse, req: VercelRequest): void {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const allowedOrigin = isOriginAllowed(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}
