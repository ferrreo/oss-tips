export type ProjectStatus =
  'draft' | 'pending_review' | 'published' | 'restricted' | 'suspended' | 'archived';

export type PaymentReadiness = {
  connectedAccount: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requiredCapabilitiesActive: boolean;
  cryptoPaymentsActive: boolean;
};

export type StripeAccountReadinessInput = {
  connectedAccountId?: string | null;
  chargesEnabled?: boolean | null;
  payoutsEnabled?: boolean | null;
  capabilities?: unknown;
};

function capabilityIsActive(capabilities: unknown, capability: string): boolean {
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    return false;
  }
  return (capabilities as Record<string, unknown>)[capability] === 'active';
}

/** Build one fail-closed readiness decision from persisted Stripe account state. */
export function paymentReadiness(input: StripeAccountReadinessInput): PaymentReadiness {
  return {
    connectedAccount: Boolean(input.connectedAccountId),
    chargesEnabled: input.chargesEnabled === true,
    payoutsEnabled: input.payoutsEnabled === true,
    requiredCapabilitiesActive: capabilityIsActive(input.capabilities, 'card_payments'),
    cryptoPaymentsActive: capabilityIsActive(input.capabilities, 'crypto_payments'),
  };
}

export function paymentsEnabled(readiness: PaymentReadiness): boolean {
  return (
    readiness.connectedAccount &&
    readiness.chargesEnabled &&
    readiness.payoutsEnabled &&
    readiness.requiredCapabilitiesActive
  );
}

export function showCrypto(readiness: PaymentReadiness): boolean {
  return paymentsEnabled(readiness) && readiness.cryptoPaymentsActive;
}

export type SlugValidation = { ok: true; slug: string } | { ok: false; reason: string };

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
