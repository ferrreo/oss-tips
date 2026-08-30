import {
  normalizeCurrency,
  validateIdempotencyKey,
  validateIdentifier,
  validateUrl,
} from './validation.js';

export type CreateConnectedAccountInput = {
  displayName: string;
  contactEmail?: string | undefined;
  country?: string | undefined;
  defaultCurrency?: string | undefined;
  idempotencyKey?: string | undefined;
  metadata?: Record<string, string> | undefined;
};

export type CreateConnectedAccountLinkInput = {
  stripeAccountId: string;
  refreshUrl: string;
  returnUrl?: string | undefined;
  idempotencyKey?: string | undefined;
};

export type ConnectedAccountResult = {
  stripeAccountId: string;
};

export type ConnectedAccountLinkResult = {
  stripeAccountId: string;
  url: string;
  expiresAt: string;
};

export function validateConnectedAccountInput(input: CreateConnectedAccountInput): void {
  if (
    !input ||
    typeof input.displayName !== 'string' ||
    input.displayName.trim().length === 0 ||
    input.displayName.length > 100 ||
    /[\r\n]/.test(input.displayName)
  ) {
    throw new Error('Connected account display name is invalid');
  }
  if (
    input.contactEmail !== undefined &&
    (typeof input.contactEmail !== 'string' ||
      input.contactEmail.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail))
  ) {
    throw new Error('Connected account email is invalid');
  }
  if (
    input.country !== undefined &&
    (typeof input.country !== 'string' || !/^[A-Za-z]{2}$/.test(input.country))
  ) {
    throw new Error('Connected account country is invalid');
  }
  if (input.defaultCurrency !== undefined) normalizeCurrency(input.defaultCurrency);
  if (input.idempotencyKey !== undefined) validateIdempotencyKey(input.idempotencyKey);
}

export function validateConnectedAccountLinkInput(input: CreateConnectedAccountLinkInput): void {
  if (!input || typeof input !== 'object')
    throw new Error('Connected account link input is required');
  validateIdentifier(input.stripeAccountId, 'Stripe account id', 'acct_');
  validateUrl(input.refreshUrl, 'Account-link refresh URL');
  if (input.returnUrl !== undefined) validateUrl(input.returnUrl, 'Account-link return URL');
  if (input.idempotencyKey !== undefined) validateIdempotencyKey(input.idempotencyKey);
}
