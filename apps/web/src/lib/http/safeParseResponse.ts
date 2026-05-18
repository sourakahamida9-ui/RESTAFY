export async function safeParseResponse(response: Response) {
  const raw = await response.text().catch(() => '');
  let data: any = null;
  let parseError: string | null = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'JSON parse error';
    console.error('[safeParseResponse] JSON parse failed:', parseError);
    console.error('[safeParseResponse] Raw response (first 200 chars):', raw.substring(0, 200));
    console.error('[safeParseResponse] Content-Type:', response.headers.get('content-type'));
    console.error('[safeParseResponse] Status:', response.status);

    // If parsing failed, check if it's HTML or other non-JSON content
    const isHtml = raw.includes('<html') || raw.includes('<!DOCTYPE') || raw.includes('<body');
    const isServerError = raw.includes('server error') || raw.includes('Server Error') || raw.includes('A server');
    data = isHtml || isServerError ? null : raw; // Set to null for HTML/server errors, keep as string for other text
  }

  const message = (() => {
    if (data && typeof data === 'object') return (data?.message || data?.error || data?.details) ?? null;
    if (typeof data === 'string') {
      return data.slice(0, 160);
    }
    // If data is null (HTML response or parse error), provide a generic message
    if (data === null) {
      if (parseError) {
        // JSON parse failed - likely HTML or malformed response
        return 'Service de paiement temporairement indisponible. Veuillez réessayer plus tard.';
      }
      const isHtml = raw.includes('<html') || raw.includes('<!DOCTYPE') || raw.includes('<body');
      const isServerError = raw.includes('server error') || raw.includes('Server Error') || raw.includes('A server');
      return isHtml || isServerError ? 'Service de paiement temporairement indisponible. Veuillez réessayer plus tard.' : raw.slice(0, 160);
    }
    return null;
  })();

  return {
    ok: response.ok,
    status: response.status,
    data,
    raw,
    message,
    parseError, // Add this for debugging
  };
}
