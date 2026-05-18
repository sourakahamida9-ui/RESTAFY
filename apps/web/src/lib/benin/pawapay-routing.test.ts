/**
 * Tests du routing paiement — vérifie que le backend route correctement
 * les paiements Mobile Money vers les bons providers GeniusPay.
 *
 * Bénin (BJ) : GeniusPay liste MTN_MOMO_BEN et MOOV_BEN dans ses
 * providers PawaPay. On route via payment_method='pawapay' + mmo_provider.
 *
 * Cas de test basé sur le numéro réel : +2290155530826 (Moov Bénin)
 */
import { describe, expect, it } from 'vitest';
import { normalizeBeninPhone, detectBeninOperator, BENIN_PREFIXES } from './phone';

// ── Reproduction de la logique du backend (api/payments/initiate.ts) ──
// On la duplique ici pour tester sans dépendance à Vercel/Node APIs.

// Countries routed through PawaPay (GeniusPay's PawaPay provider list)
const PAWAPAY_COUNTRIES: Record<string, Record<string, string>> = {
  BJ: {
    mtn_money: 'MTN_MOMO_BEN',
    moov_money: 'MOOV_BEN',
  },
  CM: {
    mtn_money: 'MTN_MOMO_CMR',
    orange_money: 'ORANGE_CMR',
  },
  SN: {
    orange_money: 'ORANGE_SEN',
    free_money: 'FREE_SEN',
  },
  CI: {
    mtn_money: 'MTN_MOMO_CIV',
    orange_money: 'ORANGE_CIV',
  },
  CD: {
    mtn_money: 'MTN_MOMO_COD',
    orange_money: 'ORANGE_COD',
    airtel_money: 'AIRTEL_COD',
  },
  CG: {
    mtn_money: 'MTN_MOMO_COG',
    airtel_money: 'AIRTEL_COG',
  },
  UG: {
    mtn_money: 'MTN_MOMO_UGA',
    airtel_money: 'AIRTEL_UGA',
  },
  RW: {
    mtn_money: 'MTN_MOMO_RWA',
    airtel_money: 'AIRTEL_RWA',
  },
  KE: {
    mpesa: 'MPESA_KEN',
  },
};

function detectCountryFromPhone(phone: string): string | undefined {
  const cleaned = phone.replace(/\s+/g, '');
  if (cleaned.startsWith('+229') || cleaned.startsWith('229')) return 'BJ';
  if (cleaned.startsWith('+225') || cleaned.startsWith('225')) return 'CI';
  if (cleaned.startsWith('+221') || cleaned.startsWith('221')) return 'SN';
  if (cleaned.startsWith('+237') || cleaned.startsWith('237')) return 'CM';
  return undefined;
}

function resolvePayment(
  paymentMethod: string,
  country: string,
  existingMmoProvider?: string,
): { paymentMethod: string; mmoProvider?: string; gateway?: string } {
  if (existingMmoProvider) {
    return { paymentMethod, mmoProvider: existingMmoProvider };
  }

  // PawaPay routing
  const countryMap = PAWAPAY_COUNTRIES[country];
  if (countryMap) {
    const providerCode = countryMap[paymentMethod];
    if (providerCode) {
      return { paymentMethod: 'pawapay', mmoProvider: providerCode };
    }
  }

  return { paymentMethod };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Payment Routing — numéro réel Moov +2290155530826', () => {
  const MOOV_NUMBER = '+2290155530826';

  it('normalise correctement le numéro', () => {
    expect(normalizeBeninPhone(MOOV_NUMBER)).toBe('+2290155530826');
  });

  it('détecte Moov comme opérateur (préfixe 0155)', () => {
    expect(detectBeninOperator(MOOV_NUMBER)).toBe('moov');
  });

  it('détecte le pays BJ depuis le préfixe +229', () => {
    expect(detectCountryFromPhone(MOOV_NUMBER)).toBe('BJ');
  });

  it('route moov_money en BJ via PawaPay + MOOV_BEN', () => {
    const result = resolvePayment('moov_money', 'BJ');
    expect(result.paymentMethod).toBe('pawapay');
    expect(result.mmoProvider).toBe('MOOV_BEN');
    expect(result.gateway).toBeUndefined();
  });

  it('chaîne complète : +2290155530826 + moov_money → pawapay + MOOV_BEN', () => {
    const normalized = normalizeBeninPhone(MOOV_NUMBER);
    expect(normalized).not.toBeNull();

    const operator = detectBeninOperator(MOOV_NUMBER);
    expect(operator).toBe('moov');

    const country = detectCountryFromPhone(normalized!);
    expect(country).toBe('BJ');

    const result = resolvePayment('moov_money', country!);
    expect(result.paymentMethod).toBe('pawapay');
    expect(result.mmoProvider).toBe('MOOV_BEN');
    expect(result.gateway).toBeUndefined();
  });
});

describe('Payment Routing — tous les opérateurs Bénin (BJ) via PawaPay', () => {
  it('MTN money → pawapay + MTN_MOMO_BEN', () => {
    const result = resolvePayment('mtn_money', 'BJ');
    expect(result).toEqual({ paymentMethod: 'pawapay', mmoProvider: 'MTN_MOMO_BEN' });
  });

  it('Moov money → pawapay + MOOV_BEN', () => {
    const result = resolvePayment('moov_money', 'BJ');
    expect(result).toEqual({ paymentMethod: 'pawapay', mmoProvider: 'MOOV_BEN' });
  });

  it('celtiis_cash ne route PAS (pas dans la map BJ)', () => {
    const result = resolvePayment('celtiis_cash', 'BJ');
    expect(result.paymentMethod).toBe('celtiis_cash');
    expect(result.gateway).toBeUndefined();
    expect(result.mmoProvider).toBeUndefined();
  });

  it('wave ne route PAS via PawaPay (pas dans la map BJ)', () => {
    const result = resolvePayment('wave', 'BJ');
    expect(result.paymentMethod).toBe('wave');
    expect(result.mmoProvider).toBeUndefined();
  });
});

describe('Payment Routing — BJ utilise PawaPay (MTN_MOMO_BEN, MOOV_BEN)', () => {
  it('BJ est dans PAWAPAY_COUNTRIES', () => {
    expect(PAWAPAY_COUNTRIES['BJ']).toBeDefined();
  });

  it('BJ a MTN_MOMO_BEN et MOOV_BEN comme providers', () => {
    expect(PAWAPAY_COUNTRIES['BJ']['mtn_money']).toBe('MTN_MOMO_BEN');
    expect(PAWAPAY_COUNTRIES['BJ']['moov_money']).toBe('MOOV_BEN');
  });

  it('moov_money en BJ produit un mmoProvider MOOV_BEN', () => {
    const result = resolvePayment('moov_money', 'BJ');
    expect(result.mmoProvider).toBe('MOOV_BEN');
  });

  it('mtn_money en BJ produit un mmoProvider MTN_MOMO_BEN', () => {
    const result = resolvePayment('mtn_money', 'BJ');
    expect(result.mmoProvider).toBe('MTN_MOMO_BEN');
  });
});

describe('Payment Routing — détection pays depuis téléphone', () => {
  it('+229... → BJ (Bénin)', () => {
    expect(detectCountryFromPhone('+2290155530826')).toBe('BJ');
  });

  it('229... sans + → BJ', () => {
    expect(detectCountryFromPhone('2290155530826')).toBe('BJ');
  });

  it('+225... → CI (Côte d\'Ivoire)', () => {
    expect(detectCountryFromPhone('+22507123456')).toBe('CI');
  });

  it('+221... → SN (Sénégal)', () => {
    expect(detectCountryFromPhone('+221771234567')).toBe('SN');
  });

  it('+237... → CM (Cameroun)', () => {
    expect(detectCountryFromPhone('+237612345678')).toBe('CM');
  });

  it('+33... → undefined (pas dans la map)', () => {
    expect(detectCountryFromPhone('+33612345678')).toBeUndefined();
  });
});

describe('Payment Routing — PawaPay pour autres pays', () => {
  it('CM: mtn_money → pawapay + MTN_MOMO_CMR', () => {
    expect(resolvePayment('mtn_money', 'CM')).toEqual({ paymentMethod: 'pawapay', mmoProvider: 'MTN_MOMO_CMR' });
  });

  it('CM: orange_money → pawapay + ORANGE_CMR', () => {
    expect(resolvePayment('orange_money', 'CM')).toEqual({ paymentMethod: 'pawapay', mmoProvider: 'ORANGE_CMR' });
  });

  it('SN: orange_money → pawapay + ORANGE_SEN', () => {
    expect(resolvePayment('orange_money', 'SN')).toEqual({ paymentMethod: 'pawapay', mmoProvider: 'ORANGE_SEN' });
  });

  it('SN: free_money → pawapay + FREE_SEN', () => {
    expect(resolvePayment('free_money', 'SN')).toEqual({ paymentMethod: 'pawapay', mmoProvider: 'FREE_SEN' });
  });

  it('CI: mtn_money → pawapay + MTN_MOMO_CIV', () => {
    expect(resolvePayment('mtn_money', 'CI')).toEqual({ paymentMethod: 'pawapay', mmoProvider: 'MTN_MOMO_CIV' });
  });

  it('KE: mpesa → pawapay + MPESA_KEN', () => {
    expect(resolvePayment('mpesa', 'KE')).toEqual({ paymentMethod: 'pawapay', mmoProvider: 'MPESA_KEN' });
  });

  it('FR: pas de routing (pays non supporté)', () => {
    expect(resolvePayment('mtn_money', 'FR')).toEqual({ paymentMethod: 'mtn_money' });
  });
});

describe('Payment Routing — mmo_provider déjà fourni (skip routing)', () => {
  it('ne remplace pas un mmo_provider existant', () => {
    const result = resolvePayment('mtn_money', 'BJ', 'CUSTOM_PROVIDER');
    expect(result.paymentMethod).toBe('mtn_money');
    expect(result.mmoProvider).toBe('CUSTOM_PROVIDER');
  });
});

describe('Détection opérateur — préfixes Moov Bénin spécifiques', () => {
  const moovPrefixes = BENIN_PREFIXES.moov;

  it('le préfixe 0155 est bien dans la liste Moov', () => {
    expect(moovPrefixes).toContain('0155');
  });

  it.each([
    ['0145', 'moov'],
    ['0155', 'moov'],
    ['0158', 'moov'],
    ['0160', 'moov'],
    ['0163', 'moov'],
    ['0164', 'moov'],
    ['0165', 'moov'],
    ['0168', 'moov'],
    ['0194', 'moov'],
    ['0195', 'moov'],
    ['0198', 'moov'],
    ['0199', 'moov'],
  ] as const)('préfixe %s → opérateur %s', (prefix, expected) => {
    const phone = `+229${prefix}123456`;
    expect(detectBeninOperator(phone)).toBe(expected);
  });
});

describe('Intégration frontend ↔ backend — cohérence payment_method', () => {
  it('mtn_money et moov_money du frontend ont un mapping PawaPay BJ', () => {
    const bjMap = PAWAPAY_COUNTRIES['BJ'];
    expect(bjMap['mtn_money']).toBe('MTN_MOMO_BEN');
    expect(bjMap['moov_money']).toBe('MOOV_BEN');
  });

  it('celtiis_cash du frontend n\'a PAS de mapping PawaPay (pas encore intégré)', () => {
    expect(PAWAPAY_COUNTRIES['BJ']['celtiis_cash']).toBeUndefined();
  });

  it('wave du frontend n\'a PAS de mapping PawaPay (gateway séparée)', () => {
    expect(PAWAPAY_COUNTRIES['BJ']['wave']).toBeUndefined();
  });
});
