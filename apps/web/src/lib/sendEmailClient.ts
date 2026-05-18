// Low-level HTTP client for /api/send-email. Separated from lib/email.ts so it
// can be imported by lib/emailLog.ts (and anywhere else) without creating a
// circular dependency.
//
// The serverless function rejects unauthenticated calls with HTTP 401
// ("Authentification requise"). This helper fetches the current Supabase
// session and attaches its access token as a Bearer header.

import { supabase } from '@/lib/supabase';

export async function authedSendEmailFetch(payload: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return fetch('/api/send-email', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}
