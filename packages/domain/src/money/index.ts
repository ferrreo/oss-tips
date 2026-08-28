/** Integer minor-unit money. Never float. */

export type CurrencyCode = string & { readonly __brand: 'CurrencyCode' };

export type Money = {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
  readonly exponent: number;
};

const EXPONENTS: Record<string, number> = {
  gbp: 2,
  usd: 2,
  eur: 2,
  jpy: 0,
  cad: 2,
  aud: 2,
  chf: 2,
  sek: 2,
  nok: 2,
  dkk: 2,
  brl: 2,
  mxn: 2,
  pln: 2,
  czk: 2,
  inr: 2,
};

export function currencyCode(code: string): CurrencyCode {
  return code.toLowerCase() as CurrencyCode;
}

export function currencyExponent(currency: string): number {
  return EXPONENTS[currency.toLowerCase()] ?? 2;
}

export function money(amountMinor: bigint | number | string, currency: string): Money {
  return {
    amountMinor: BigInt(amountMinor),
    currency: currencyCode(currency),
    exponent: currencyExponent(currency),
  };
}

export function moneyToString(m: Money): { amount: string; currency: string } {
  return { amount: m.amountMinor.toString(), currency: m.currency };
}

export function formatMoney(m: Money, locale = 'en-GB'): string {
  const value = Number(m.amountMinor) / 10 ** m.exponent;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: m.currency.toUpperCase(),
  }).format(value);
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function roundPercentOf(amountMinor: bigint, rateBps: number): bigint {
  // rateBps: 200 = 2%, 500 = 5%
  return (amountMinor * BigInt(rateBps) + 5000n) / 10000n;
}
