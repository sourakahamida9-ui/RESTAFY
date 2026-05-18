import { describe, expect, it } from 'vitest';
import {
  normalizeBeninPhone,
  detectBeninOperator,
  formatBeninPhoneDisplay,
  BENIN_PREFIXES,
} from './phone';

describe('normalizeBeninPhone — format moderne 10 chiffres (avec préfixe 01)', () => {
  it('accepte +229 01 96 12 34 56 (espaces)', () => {
    expect(normalizeBeninPhone('+229 01 96 12 34 56')).toBe('+2290196123456');
  });

  it('accepte +2290196123456 (compact)', () => {
    expect(normalizeBeninPhone('+2290196123456')).toBe('+2290196123456');
  });

  it('accepte 22901961234556 sans + (13 chiffres)', () => {
    expect(normalizeBeninPhone('2290196123456')).toBe('+2290196123456');
  });

  it('accepte 0022901961234556 (préfixe international 00)', () => {
    expect(normalizeBeninPhone('002290196123456')).toBe('+2290196123456');
  });

  it('accepte 0196123456 (10 chiffres locaux)', () => {
    expect(normalizeBeninPhone('0196123456')).toBe('+2290196123456');
  });

  it('accepte 01 96 12 34 56 (10 chiffres avec espaces)', () => {
    expect(normalizeBeninPhone('01 96 12 34 56')).toBe('+2290196123456');
  });
});

describe('normalizeBeninPhone — backward compat 8 chiffres (pré-2021)', () => {
  it('accepte +22996123456 (12 chars legacy)', () => {
    expect(normalizeBeninPhone('+22996123456')).toBe('+22996123456');
  });

  it('accepte 96123456 (8 chiffres locaux legacy)', () => {
    expect(normalizeBeninPhone('96123456')).toBe('+22996123456');
  });
});

describe('normalizeBeninPhone — refus des formats invalides', () => {
  it('rejette une chaîne vide', () => {
    expect(normalizeBeninPhone('')).toBeNull();
  });

  it('rejette une longueur incorrecte (9 chiffres locaux)', () => {
    expect(normalizeBeninPhone('123456789')).toBeNull();
  });

  it('rejette un numéro 11 chiffres locaux', () => {
    expect(normalizeBeninPhone('01961234567')).toBeNull();
  });

  it('rejette du texte pur', () => {
    expect(normalizeBeninPhone('abcdefgh')).toBeNull();
  });

  it('rejette un numéro étranger (+33...)', () => {
    expect(normalizeBeninPhone('+33612345678')).toBeNull();
  });
});

describe('detectBeninOperator — préfixes ARCEP officiels', () => {
  it('identifie MTN sur 0196 (préfixe MTN)', () => {
    expect(detectBeninOperator('+2290196123456')).toBe('mtn');
  });

  it('identifie Moov sur 0194 (préfixe Moov)', () => {
    expect(detectBeninOperator('+2290194123456')).toBe('moov');
  });

  it('identifie Celtiis sur 0192 (préfixe Celtiis)', () => {
    expect(detectBeninOperator('+2290192123456')).toBe('celtiis');
  });

  it('identifie Celtiis sur 0120 (premier préfixe Celtiis)', () => {
    expect(detectBeninOperator('0120123456')).toBe('celtiis');
  });

  it('identifie MTN sur 0150 (bloc MTN)', () => {
    expect(detectBeninOperator('0150123456')).toBe('mtn');
  });

  it('identifie Moov sur 0163 (bloc Moov)', () => {
    expect(detectBeninOperator('0163123456')).toBe('moov');
  });

  it('retourne null pour un préfixe non attribué (0199 vs 0125)', () => {
    expect(detectBeninOperator('0125123456')).toBeNull();
  });

  it('retourne null pour un numéro étranger', () => {
    expect(detectBeninOperator('+33612345678')).toBeNull();
  });

  it('legacy : identifie MTN sur 96xxxxxx (ancien format MTN)', () => {
    expect(detectBeninOperator('96123456')).toBe('mtn');
  });

  it('legacy : identifie Moov sur 94xxxxxx (ancien format Moov)', () => {
    expect(detectBeninOperator('94123456')).toBe('moov');
  });
});

describe('formatBeninPhoneDisplay — affichage convivial', () => {
  it('formate un numéro 10 chiffres avec espaces réguliers', () => {
    expect(formatBeninPhoneDisplay('+2290196123456')).toBe('+229 01 96 12 34 56');
  });

  it('formate un numéro 8 chiffres legacy', () => {
    expect(formatBeninPhoneDisplay('+22996123456')).toBe('+229 96 12 34 56');
  });

  it('retourne l\'input tel quel si non reconnu', () => {
    expect(formatBeninPhoneDisplay('not a number')).toBe('not a number');
  });
});

describe('BENIN_PREFIXES — cohérence interne', () => {
  it('pas de doublon entre opérateurs (les préfixes ARCEP sont mutuellement exclusifs)', () => {
    const all: string[] = [
      ...BENIN_PREFIXES.mtn,
      ...BENIN_PREFIXES.moov,
      ...BENIN_PREFIXES.celtiis,
    ];
    const unique = new Set(all);
    expect(unique.size).toBe(all.length);
  });

  it('tous les préfixes sont au format 0XXX (4 chiffres)', () => {
    const all = [
      ...BENIN_PREFIXES.mtn,
      ...BENIN_PREFIXES.moov,
      ...BENIN_PREFIXES.celtiis,
    ];
    for (const p of all) {
      expect(p).toMatch(/^0\d{3}$/);
    }
  });

  it('MTN a 19 préfixes (publication ARCEP 2026)', () => {
    expect(BENIN_PREFIXES.mtn.length).toBe(19);
  });

  it('Moov a 12 préfixes', () => {
    expect(BENIN_PREFIXES.moov.length).toBe(12);
  });

  it('Celtiis a 16 préfixes', () => {
    expect(BENIN_PREFIXES.celtiis.length).toBe(16);
  });
});
