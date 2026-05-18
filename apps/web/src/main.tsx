import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const isDevelopment = import.meta.env.DEV;

// Inject preconnect for the actual Supabase project URL ASAP, before React
// renders. Static <link> in index.html cannot include the project ref because
// it depends on a build-time env var that may not exist when the HTML is
// authored. Doing it here still hits before the first DB query.
(() => {
  const url = (
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  if (!url || !/^https:\/\//i.test(url)) return;
  try {
    const origin = new URL(url).origin;
    const head = document.head;
    if (!head) return;
    if (!head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = origin;
      preconnect.crossOrigin = 'anonymous';
      head.appendChild(preconnect);
    }
    if (!head.querySelector(`link[rel="dns-prefetch"][href="${origin}"]`)) {
      const dnsPrefetch = document.createElement('link');
      dnsPrefetch.rel = 'dns-prefetch';
      dnsPrefetch.href = origin;
      head.appendChild(dnsPrefetch);
    }
  } catch {
    // ignore: malformed URL, no-op
  }
})();

// Capturer les erreurs non-catchées (promesses non gérées, etc)
window.addEventListener('error', (event) => {
  if (isDevelopment) {
    console.error('[Global Error]', event.error);
  }
  // En production, on pourrait envoyer à un service d'analytics
});

window.addEventListener('unhandledrejection', (event) => {
  if (isDevelopment) {
    console.error('[Unhandled Promise Rejection]', event.reason);
  }
  // En production, on pourrait envoyer à un service d'analytics
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
