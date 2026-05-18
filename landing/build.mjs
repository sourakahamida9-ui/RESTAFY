import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const ent of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, ent.name);
    const d = join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

const out = 'public';
mkdirSync(out, { recursive: true });

// ── Cache-busting ───────────────────────────────────────────────────────────
// Plus de cache stale côté navigateur : on inline le CSS dans chaque HTML
// (74 KB CSS → 25-30 KB une fois gzippé inline). Avantages :
//   1. Une seule requête HTTP pour rendre la page (vs HTML + CSS).
//   2. Si un visiteur est revenu avec un vieux HTML cached (cas du bug
//      "Ctrl+Shift+R obligatoire"), il a AUSSI le CSS d'époque, cohérent.
//   3. Si l'HTML est `no-store` (déjà le cas), le CSS suit automatiquement
//      la même politique sans devoir gérer un bundle séparé.
// On garde quand même un styles.css externe pour les outils tiers / SEO
// (Lighthouse fait du CSS inline une bonne pratique).
const cssSource = readFileSync('styles.css', 'utf8');

// Hash du build pour cache-buster les autres assets (images, fonts) — au cas
// où un user revienne avec du HTML d'il y a des semaines référençant des
// chemins assets qui ont changé. (Force redeploy 2026-05-06 — auteur souraka.)
const buildId = createHash('sha256')
  .update(cssSource)
  .update(readFileSync('index.html', 'utf8'))
  .update(String(Date.now()))
  .digest('hex')
  .slice(0, 8);

console.log(`[landing/build] buildId=${buildId}`);

// Pages HTML à traiter — on inline le CSS dans toutes.
const HTML_PAGES = [
  'index.html',
  'demo.html',
  'cookies.html',
  'confidentialite.html',
  'conditions-utilisation.html',
  'cgv.html',
  'mentions-legales.html',
  '404.html',
];

/** Remplace <link rel="stylesheet" href="...styles.css..."> par <style>...</style>. */
function inlineCss(html) {
  // Match: <link rel="stylesheet" href="<anything-styles.css>"[^>]*>
  // tolérant aux chemins relatifs (./styles.css, /styles.css, ../styles.css).
  const linkRe = /<link\s+[^>]*?href=(?:"|')[^"']*styles\.css[^"']*(?:"|')[^>]*>/gi;
  return html.replace(linkRe, () => `<style data-inlined="styles.css">${cssSource}</style>`);
}

/** Injecte le kill-switch service worker juste après le <head>. */
const SW_KILLSWITCH_SCRIPT = `
    <!-- SW kill-switch : si un service worker a été enregistré par erreur (ou
         par un ancien deploy de la landing), on le désinscrit silencieusement
         pour éviter qu'il intercepte les futures requêtes et serve du stale.
         La landing actuelle n'enregistre AUCUN SW — ce script est défensif. -->
    <script>
      (function () {
        try {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function (regs) {
              regs.forEach(function (reg) {
                try { reg.unregister(); } catch (_) { /* ignore */ }
              });
            }).catch(function () { /* ignore */ });
          }
        } catch (_) { /* ignore */ }
      })();
    </script>`;

function injectSwKillswitch(html) {
  // Insère juste après l'ouverture de <head> (avant tout autre contenu)
  return html.replace(/<head([^>]*)>/i, (_m, attrs) => `<head${attrs}>${SW_KILLSWITCH_SCRIPT}`);
}

/** Pipeline complet pour 1 page HTML. */
function processHtml(html) {
  let out = html;
  out = inlineCss(out);
  out = injectSwKillswitch(out);
  // Inject build id meta tag (debug + cache-bust marker visible)
  out = out.replace(
    /<head([^>]*)>/i,
    (_m, attrs) => `<head${attrs}>\n    <meta name="x-restafy-build" content="${buildId}" />`,
  );
  return out;
}

for (const f of HTML_PAGES) {
  const src = readFileSync(f, 'utf8');
  const transformed = processHtml(src);
  writeFileSync(join(out, f), transformed);
}

// On garde aussi styles.css en sortie pour les outils tiers (preview cards
// FB/Twitter, certains crawlers). C'est OK car les pages ne le référencent
// plus dans le HTML compilé.
copyFileSync('styles.css', join(out, 'styles.css'));

/* /demo et /demo/ : même contenu, chemins absolus dans demo.html vers /styles.css */
const demoDir = join(out, 'demo');
mkdirSync(demoDir, { recursive: true });
copyFileSync(join(out, 'demo.html'), join(demoDir, 'index.html'));

/* URLs propres pour les pages légales (chemins sans extension) */
const cleanPaths = {
  cookies: 'cookies.html',
  confidentialite: 'confidentialite.html',
  'conditions-utilisation': 'conditions-utilisation.html',
  cgu: 'conditions-utilisation.html', // alias historique utilisé dans le footer
  cgv: 'cgv.html',
  'mentions-legales': 'mentions-legales.html',
};
for (const [dir, src] of Object.entries(cleanPaths)) {
  const d = join(out, dir);
  mkdirSync(d, { recursive: true });
  // Source = la version DÉJÀ traitée dans public/, pour bénéficier de
  // l'inlining CSS + kill-switch SW.
  copyFileSync(join(out, src), join(d, 'index.html'));
}

for (const f of ['robots.txt', 'sitemap.xml']) {
  try {
    copyFileSync(f, join(out, f));
  } catch {
    /* optionnel */
  }
}

try {
  if (statSync('assets').isDirectory()) {
    copyDir('assets', join(out, 'assets'));
  }
} catch {
  /* pas de dossier assets */
}
