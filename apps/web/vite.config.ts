import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import type { PluginOption, UserConfig } from 'vite';

/**
 * SPA Vite (équivalent des optimisations Next.js : découpage, minification, analyse bundle).
 * Analyse : `npm run build:analyze` → ouvrir `public/stats.html`
 */
export default defineConfig(async ({ mode }): Promise<UserConfig> => {
  const isAnalyze = mode === 'analyze';

  // Import dynamique pour éviter l'erreur ESM avec rollup-plugin-visualizer
  let visualizerPlugin: PluginOption = null;
  if (isAnalyze) {
    const { visualizer } = await import('rollup-plugin-visualizer');
    visualizerPlugin = visualizer({
      filename: 'public/stats.html',
      gzipSize: true,
      brotliSize: true,
      open: false,
      template: 'treemap',
    });
  }

  return {
    /** Fichiers statiques sources (robots.txt, sw.js, etc.) — le build sort dans `public/` pour Vercel. */
    publicDir: 'static',
    plugins: [
      react(),
      tailwindcss(),
      visualizerPlugin,
    ].filter(Boolean),

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@restafy/shared': path.resolve(__dirname, '../../packages/shared/src'),
      },
    },

    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    build: {
      /** Aligné sur le répertoire de sortie attendu par Vercel (souvent « public » dans le dashboard). */
      outDir: 'public',
      target: 'es2020',
      sourcemap: false,
      /** Désactive le calcul gzip sur chaque fichier en fin de build (plus rapide en CI / local). */
      reportCompressedSize: false,
      chunkSizeWarningLimit: 900,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          /** Grosses libs seules — React reste dans le chunk principal pour éviter les cycles vendor ↔ react.
           *  Stratégie: 1 lib lourde = 1 chunk pour maximiser le cache hit ratio
           *  (changer une lib n'invalide pas les autres). */
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('recharts')) return 'recharts';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('framer-motion')) return 'framer';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('@tanstack')) return 'tanstack';
            if (id.includes('react-router')) return 'router';
            if (id.includes('react-hook-form') || id.includes('@hookform')) return 'forms';
            if (id.includes('zod')) return 'zod';
            if (id.includes('sonner')) return 'sonner';
            if (id.includes('date-fns')) return 'date-fns';
            // ⚠️ N'attraper QUE le `qrcode` lourd, PAS `qrcode.react` (lib séparée,
            // statiquement importée par EventPoster/POS/MyTickets/QRCodeGenerator,
            // donc la fusionner dans `qrcode` la chargerait eagerly et casserait
            // tout le bénéfice du lazy-import dans RestaurantSettings/email.ts).
            if (id.includes('node_modules/qrcode/') && !id.includes('qrcode.react') && !id.includes('html5-qrcode')) return 'qrcode';
            // qrcode.react v4 = QR encoder embarqué + composant React (~340KB).
            // Son propre chunk pour qu'il soit téléchargé une seule fois et
            // cacheable séparément des routes qui le consomment.
            if (id.includes('node_modules/qrcode.react/')) return 'qrcode-react';
          },
        },
      },
    },

    esbuild: {
      drop: mode === 'production' ? (['console', 'debugger'] as const) : [],
      ...(mode === 'production' ? { legalComments: 'none' as const } : {}),
    },
  };
});
