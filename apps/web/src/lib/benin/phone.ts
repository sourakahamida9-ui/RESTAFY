/**
 * Utilitaires de normalisation et d'identification des numéros de téléphone béninois.
 *
 * Contexte : depuis le 30 octobre 2021, l'ARCEP Bénin a porté l'ensemble des
 * numéros nationaux à 10 chiffres en ajoutant le préfixe `01` devant les
 * anciens numéros mobiles à 8 chiffres.
 *
 * Format moderne attendu : `+229 01 XX XX XX XX`
 *
 * Préfixes officiels EZAB publiés par l'ARCEP (28 février 2026) :
 * https://leresonateur.com/benin-larcep-publie-la-liste-officielle-des-prefixes-telephoniques-attribues-aux-operateurs/
 */

export type BeninOperator = 'mtn' | 'moov' | 'celtiis';

/**
 * Préfixes EZAB (4 chiffres, incluant le `0` initial) attribués par l'ARCEP
 * à chaque opérateur béninois. Source : publication officielle ARCEP 2026.
 *
 * NB : la portabilité du numéro est autorisée depuis 2025. Un préfixe identifie
 * l'opérateur d'origine, pas nécessairement l'opérateur courant. Cette table
 * sert donc de **suggestion par défaut**, modifiable par l'utilisateur.
 */
export const BENIN_PREFIXES: Record<BeninOperator, readonly string[]> = {
  mtn: [
    '0142', '0146', '0150', '0151', '0152', '0153', '0154', '0156', '0157',
    '0159', '0161', '0162', '0166', '0167', '0169', '0190', '0191', '0196',
    '0197',
  ],
  moov: [
    '0145', '0155', '0158', '0160', '0163', '0164', '0165', '0168', '0194',
    '0195', '0198', '0199',
  ],
  celtiis: [
    '0120', '0121', '0122', '0123', '0124', '0128', '0129', '0140', '0141',
    '0143', '0144', '0147', '0148', '0149', '0192', '0193',
  ],
} as const;

/**
 * Normalise un numéro de téléphone béninois vers le format E.164 attendu par
 * Genius Pay (ex: `+2290196123456`).
 *
 * Accepte les formats suivants :
 * - `+229 01 96 12 34 56` (moderne, espaces ignorés)
 * - `+22901961234556` (compact moderne)
 * - `22901961234556` (sans `+`)
 * - `0022901961234556` (préfixe international ancien)
 * - `01 96 12 34 56` (10 chiffres locaux modernes)
 * - `0196123456` (10 chiffres locaux compact)
 * - Backward-compat : 8 chiffres locaux (numéros pré-2021 si encore actifs)
 *
 * Retourne `null` si le format n'est pas reconnu.
 */
export function normalizeBeninPhone(input: string): string | null {
  if (!input) return null;
  const cleaned = input.replace(/[^0-9+]/g, '');
  if (!cleaned) return null;

  // ---- Format moderne 10 chiffres locaux (`01XXXXXXXX`) ----
  // +22901XXXXXXXX (14 chars : '+' + 13 digits)
  if (cleaned.startsWith('+22901') && cleaned.length === 14) return cleaned;
  // 22901XXXXXXXX (13 chars)
  if (cleaned.startsWith('22901') && cleaned.length === 13) return `+${cleaned}`;
  // 0022901XXXXXXXX (15 chars : '00' + 13 digits)
  if (cleaned.startsWith('0022901') && cleaned.length === 15) return `+${cleaned.slice(2)}`;
  // 01XXXXXXXX (10 chars locaux)
  if (/^01\d{8}$/.test(cleaned)) return `+229${cleaned}`;

  // ---- Backward-compat : ancien format 8 chiffres ----
  // +229XXXXXXXX (12 chars : '+' + 11 digits)
  if (cleaned.startsWith('+229') && cleaned.length === 12) return cleaned;
  // 229XXXXXXXX (11 chars)
  if (cleaned.startsWith('229') && cleaned.length === 11) return `+${cleaned}`;
  // 00229XXXXXXXX (13 chars)
  if (cleaned.startsWith('00229') && cleaned.length === 13) return `+${cleaned.slice(2)}`;
  // XXXXXXXX (8 chars locaux pré-2021)
  if (/^\d{8}$/.test(cleaned)) return `+229${cleaned}`;

  return null;
}

/**
 * Tente d'identifier l'opérateur d'origine d'un numéro béninois à partir des
 * préfixes ARCEP. Retourne `null` si aucun préfixe ne matche (numéro étranger,
 * format non reconnu, ou nouveau bloc non documenté).
 *
 * ⚠️ La portabilité du numéro est possible : ce résultat n'est qu'une
 * suggestion à présenter à l'utilisateur, qui doit pouvoir corriger.
 */
export function detectBeninOperator(input: string): BeninOperator | null {
  const normalized = normalizeBeninPhone(input);
  if (!normalized) return null;

  // Format normalisé : +229XXXXXXXXXX
  // - Si format moderne, les positions 4..7 ('+229' = 4 chars puis '01XX')
  //   donnent le préfixe à 4 chiffres.
  // - Si format legacy 8 chiffres, on extrapole un préfixe 4 chiffres en
  //   préfixant par '0' pour matcher la table EZAB (ex: '96123456' → '096' ;
  //   on regarde alors '0961' qui appartient à 0190-0196 etc. — mais ces
  //   anciens numéros n'apparaissent plus dans la table 2026, donc retour null).
  const local = normalized.slice(4); // tout après '+229'
  let prefix: string;
  if (local.startsWith('01') && local.length === 10) {
    prefix = local.slice(0, 4); // '01XX'
  } else if (local.length === 8) {
    // Ancien format : on essaie de mapper sur les anciens préfixes connus
    // (96/97/61/66/67/69 = MTN ; 94/95/98/99 = Moov ; pas Celtiis avant 2021)
    const old2 = local.slice(0, 2);
    if (['96', '97', '90', '91', '61', '62', '66', '67', '69'].includes(old2)) return 'mtn';
    if (['94', '95', '98', '99'].includes(old2)) return 'moov';
    return null;
  } else {
    return null;
  }

  for (const op of Object.keys(BENIN_PREFIXES) as BeninOperator[]) {
    if (BENIN_PREFIXES[op].includes(prefix)) return op;
  }
  return null;
}

/**
 * Format d'affichage convivial : `+229 01 96 12 34 56`.
 * Retourne l'input tel quel si non reconnu.
 */
export function formatBeninPhoneDisplay(input: string): string {
  const normalized = normalizeBeninPhone(input);
  if (!normalized) return input;
  // +229 + 10 ou 8 chiffres locaux
  const local = normalized.slice(4);
  if (local.length === 10) {
    // 01 96 12 34 56
    return `+229 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)} ${local.slice(8, 10)}`;
  }
  if (local.length === 8) {
    return `+229 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)}`;
  }
  return normalized;
}
