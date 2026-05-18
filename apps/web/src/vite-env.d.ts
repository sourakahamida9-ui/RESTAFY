/// <reference types="vite/client" />

/**
 * Variables VITE_* utilisées par Restafy (complètent les types Vite par défaut).
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Alias souvent utilisé sur l’hébergeur (même valeur que VITE_*) */
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly VITE_LOG_EMAILS_TO_DB?: string;
  readonly VITE_APP_URL?: string;
}
