/**
 * Modèles visuels pour les QR (cadre + couleurs). Les modèles « scanOptimized » évitent le logo au centre pour une lecture caméra plus fiable.
 */
export type QrTemplateId =
  | 'minimal'
  | 'restafy'
  | 'scan_me'
  | 'party'
  | 'elegant'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'midnight'
  | 'mail'
  | 'hearts'
  | 'mono';

export type QrTemplateDef = {
  id: QrTemplateId;
  name: string;
  /** Sous-titre court pour la grille de choix */
  hint: string;
  scanOptimized: boolean;
  /** Classes Tailwind du cadre extérieur (décor) */
  frameClass: string;
  /** Bandeau au-dessus du QR (optionnel) */
  topBarClass?: string;
  topBarText?: string;
  fgColor: string;
  bgColor: string;
  /** Logo Restafy au centre du QR (réduit la lisibilité si true) */
  showCenterLogo: boolean;
  /** Accent pour le header de carte (bordure gauche) */
  accentColor: string;
};

export const QR_TEMPLATES: QrTemplateDef[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    hint: 'Lecture max',
    scanOptimized: true,
    frameClass: 'bg-white ring-1 ring-zinc-200/80 shadow-sm',
    fgColor: '#18181b',
    bgColor: '#ffffff',
    showCenterLogo: false,
    accentColor: '#71717a',
  },
  {
    id: 'restafy',
    name: 'Restafy',
    hint: 'Marque orange',
    scanOptimized: false,
    frameClass: 'bg-gradient-to-br from-orange-50 to-amber-50 ring-2 ring-orange-200/60 shadow-md',
    fgColor: '#9a3412',
    bgColor: '#fffbeb',
    showCenterLogo: true,
    accentColor: '#f97316',
  },
  {
    id: 'scan_me',
    name: 'Scan me',
    hint: 'Affiche & vitrine',
    scanOptimized: true,
    frameClass: 'bg-zinc-900 p-1 shadow-xl',
    topBarClass: 'bg-black text-white text-center py-2 text-[10px] font-black tracking-[0.35em] uppercase',
    topBarText: 'SCAN ME',
    fgColor: '#ffffff',
    bgColor: '#000000',
    showCenterLogo: false,
    accentColor: '#18181b',
  },
  {
    id: 'party',
    name: 'Fête',
    hint: 'Rose & violet',
    scanOptimized: true,
    frameClass: 'bg-gradient-to-br from-fuchsia-100 via-pink-50 to-violet-100 ring-2 ring-fuchsia-200/50 shadow-lg',
    fgColor: '#86198f',
    bgColor: '#fdf4ff',
    showCenterLogo: false,
    accentColor: '#d946ef',
  },
  {
    id: 'elegant',
    name: 'Élégant',
    hint: 'Mariage / gala',
    scanOptimized: true,
    frameClass: 'bg-gradient-to-b from-slate-50 to-sky-50 ring-2 ring-sky-200/40 shadow-md',
    fgColor: '#0f172a',
    bgColor: '#f8fafc',
    showCenterLogo: false,
    accentColor: '#0ea5e9',
  },
  {
    id: 'ocean',
    name: 'Océan',
    hint: 'Bleu cyan',
    scanOptimized: true,
    frameClass: 'bg-gradient-to-br from-cyan-50 to-blue-100 ring-2 ring-cyan-300/40',
    fgColor: '#155e75',
    bgColor: '#ecfeff',
    showCenterLogo: false,
    accentColor: '#06b6d4',
  },
  {
    id: 'forest',
    name: 'Nature',
    hint: 'Vert frais',
    scanOptimized: true,
    frameClass: 'bg-gradient-to-br from-emerald-50 to-green-100 ring-2 ring-emerald-200/50',
    fgColor: '#14532d',
    bgColor: '#f0fdf4',
    showCenterLogo: false,
    accentColor: '#22c55e',
  },
  {
    id: 'sunset',
    name: 'Coucher',
    hint: 'Orange & corail',
    scanOptimized: true,
    frameClass: 'bg-gradient-to-br from-orange-100 to-rose-100 ring-2 ring-orange-200/60',
    fgColor: '#9f1239',
    bgColor: '#fff7ed',
    showCenterLogo: false,
    accentColor: '#f97316',
  },
  {
    id: 'midnight',
    name: 'Nuit',
    hint: 'Sombre néon',
    scanOptimized: true,
    frameClass: 'bg-gradient-to-br from-zinc-900 to-slate-900 ring-2 ring-emerald-500/30 shadow-lg',
    fgColor: '#a7f3d0',
    bgColor: '#0f172a',
    showCenterLogo: false,
    accentColor: '#10b981',
  },
  {
    id: 'mail',
    name: 'Courrier',
    hint: 'Bleu postal',
    scanOptimized: true,
    frameClass: 'bg-gradient-to-br from-blue-50 to-indigo-100 ring-2 ring-blue-200/50',
    fgColor: '#1e3a8a',
    bgColor: '#eff6ff',
    showCenterLogo: false,
    accentColor: '#3b82f6',
  },
  {
    id: 'hearts',
    name: 'Cœurs',
    hint: 'Romantique',
    scanOptimized: true,
    frameClass: 'bg-gradient-to-br from-rose-50 to-pink-100 ring-2 ring-rose-200/60',
    fgColor: '#9f1239',
    bgColor: '#fff1f2',
    showCenterLogo: false,
    accentColor: '#f43f5e',
  },
  {
    id: 'mono',
    name: 'Classique',
    hint: 'Noir & blanc',
    scanOptimized: true,
    frameClass: 'bg-white ring-2 ring-zinc-800 shadow-md',
    fgColor: '#000000',
    bgColor: '#ffffff',
    showCenterLogo: false,
    accentColor: '#18181b',
  },
];

export function getQrTemplate(id: QrTemplateId): QrTemplateDef {
  return QR_TEMPLATES.find((t) => t.id === id) ?? QR_TEMPLATES[0];
}
