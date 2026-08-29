export type ProjectStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'restricted'
  | 'suspended'
  | 'archived';

export type PaymentReadiness = {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requiredCapabilitiesActive: boolean;
  cryptoPaymentsActive: boolean;
};

export function paymentsEnabled(readiness: PaymentReadiness): boolean {
  return (
    readiness.chargesEnabled &&
    readiness.payoutsEnabled &&
    readiness.requiredCapabilitiesActive
  );
}

export function showCrypto(readiness: PaymentReadiness): boolean {
  return paymentsEnabled(readiness) && readiness.cryptoPaymentsActive;
}

export type SlugValidation =
  | { ok: true; slug: string }
  | { ok: false; reason: string };

const RESERVED_SLUGS = new Set([
  'api',
  'admin',
  'dashboard',
  'explore',
  'about',
  'pricing',
  'docs',
  'security',
  'transparency',
  'terms',
  'login',
  'signin',
  'sign-in',
  'me',
  'account',
  'settings',
  'static',
  'assets',
  'health',
  'status',
  'webhooks',
  'support',
]);

export function validateProjectSlug(raw: string): SlugValidation {
  const slug = raw.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(slug)) {
    return { ok: false, reason: 'invalid_format' };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, reason: 'reserved' };
  }
  return { ok: true, slug };
}

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
};

export function problem(
  status: number,
  title: string,
  detail?: string,
  extra?: Partial<ProblemDetails>,
): ProblemDetails {
  return {
    type: `https://oss.tips/problems/${status}`,
    title,
    status,
    ...(detail !== undefined ? { detail } : {}),
    ...extra,
  };
}
