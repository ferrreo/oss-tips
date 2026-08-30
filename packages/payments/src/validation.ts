import { createHash } from 'node:crypto';
import { currencyExponent, isSupportedCurrency } from '@oss-tips/domain';
import type { Cadence, FeatureMode } from '@oss-tips/domain';
import type {
  CheckoutIntentContext,
  CheckoutIntentInput,
  RefundInput,
  StripeCapabilities,
} from './types.js';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_:-]{0,254}$/;
const PROJECT_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const URL_PROTOCOLS = new Set(['http:', 'https:']);

export function minorUnits(value: unknown, name: string, allowZero = true): bigint {
  if (typeof value === 'bigint') {
    if (!allowZero && value <= 0n) throw new Error(`${name} must be positive`);
    if (allowZero && value < 0n) throw new Error(`${name} must be non-negative`);
    return value;
  }

  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a safe integer in minor units`);
  }
  if (!allowZero && value <= 0) throw new Error(`${name} must be positive`);
  if (allowZero && value < 0) throw new Error(`${name} must be non-negative`);
  return BigInt(value);
}

export function normalizeCurrency(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z]{3}$/i.test(value)) {
    throw new Error('Currency must be a three-letter ISO code');
  }
  const currency = value.toLowerCase();
  if (!isSupportedCurrency(currency)) throw new Error('Unsupported currency');
  return currency;
}

export function validateIdentifier(value: unknown, name: string, prefix?: string): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new Error(`${name} is invalid`);
  }
  if (prefix && !value.startsWith(prefix)) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

export function validateIdempotencyKey(value: unknown, name = 'Idempotency key'): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 255 ||
    /[\r\n]/.test(value)
  ) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

export function deriveIdempotencyKey(seed: string, operation: string): string {
  const key = `${seed}:${operation}`;
  if (key.length <= 255) return key;
  return `oss_${createHash('sha256').update(key).digest('hex')}_${operation}`;
}

export function validateStripeSecretKey(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+$/.test(value)) {
    throw new Error('Stripe secret key is invalid');
  }
  return value;
}

export function validateUrl(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length > 2048) throw new Error(`${name} is invalid`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is invalid`);
  }
  if (!URL_PROTOCOLS.has(url.protocol) || !url.host) throw new Error(`${name} is invalid`);
  if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error(`${name} must use HTTPS`);
  }
  return url.toString();
}

export function validateCapabilities(capabilities: StripeCapabilities): void {
  if (!capabilities || capabilities.cardPayments !== true) {
    throw new Error('Connected account is not ready for card payments');
  }
  if (capabilities.chargesEnabled === false || capabilities.payoutsEnabled === false) {
    throw new Error('Connected account is not ready for payments');
  }
  if (typeof capabilities.cryptoPayments !== 'boolean') {
    throw new Error('Connected account crypto capability is invalid');
  }
}

export function validateCheckoutInput(
  input: CheckoutIntentInput,
  context: CheckoutIntentContext,
): { currency: string; projectAmountMinor: bigint; platformTipMinor: bigint } {
  if (!input || typeof input !== 'object') throw new Error('Checkout input is required');
  if (!context || typeof context !== 'object') throw new Error('Checkout context is required');
  if (typeof input.project !== 'string' || !PROJECT_PATTERN.test(input.project)) {
    throw new Error('Project slug is invalid');
  }
  if (
    !input.publicOptions ||
    typeof input.publicOptions.showName !== 'boolean' ||
    typeof input.publicOptions.showAmount !== 'boolean' ||
    typeof input.publicOptions.showMessage !== 'boolean'
  ) {
    throw new Error('Public support options are invalid');
  }
  if (input.publicOptions.displayName !== undefined) {
    if (
      typeof input.publicOptions.displayName !== 'string' ||
      input.publicOptions.displayName.trim().length === 0 ||
      input.publicOptions.displayName.trim().length > 120
    ) {
      throw new Error('Public display name is invalid');
    }
    if (!input.publicOptions.showName) throw new Error('Public display name requires show name');
  }
  if (input.publicOptions.message !== undefined) {
    if (
      typeof input.publicOptions.message !== 'string' ||
      input.publicOptions.message.trim().length > 2000 ||
      /(?:https?|ftp|javascript|data):|www\./i.test(input.publicOptions.message)
    ) {
      throw new Error('Public message is invalid');
    }
    if (!input.publicOptions.showMessage) throw new Error('Public message requires show message');
  }

  const cadence = input.cadence as Cadence;
  if (!['one_off', 'monthly', 'annual'].includes(cadence)) {
    throw new Error('Cadence is invalid');
  }
  if (!['standard', 'contributes_5_percent'].includes(context.featureMode as FeatureMode)) {
    throw new Error('Feature mode is invalid');
  }

  const currency = normalizeCurrency(input.projectCurrency);
  const projectAmountMinor = minorUnits(input.projectAmountMinor, 'Project amount', false);
  const platformTipMinor = minorUnits(input.platformTipMinor, 'Platform tip');
  validateCapabilities(context.capabilities);

  validateIdentifier(context.projectId, 'Project id');
  validateIdentifier(context.stripeAccountId, 'Stripe account id', 'acct_');
  validateUrl(context.successUrl, 'Success URL');
  validateUrl(context.cancelUrl, 'Cancel URL');
  if (context.checkoutUiMode === 'embedded') {
    validateUrl(context.returnUrl, 'Return URL');
  }
  if (context.customerEmail !== undefined) {
    if (
      typeof context.customerEmail !== 'string' ||
      context.customerEmail.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(context.customerEmail)
    ) {
      throw new Error('Customer email is invalid');
    }
  }
  if (context.paymentId !== undefined) validateIdentifier(context.paymentId, 'Payment id');
  if (context.idempotencyKey !== undefined) validateIdempotencyKey(context.idempotencyKey);
  if (
    context.checkoutUiMode !== undefined &&
    !['hosted', 'embedded'].includes(context.checkoutUiMode)
  ) {
    throw new Error('Checkout UI mode is invalid');
  }
  if (context.adaptivePricing !== undefined && typeof context.adaptivePricing !== 'boolean') {
    throw new Error('Adaptive pricing option is invalid');
  }
  if (context.membershipPlatformTipMinor !== undefined) {
    const expectedTip = minorUnits(context.membershipPlatformTipMinor, 'Membership platform tip');
    if (cadence !== 'one_off' && expectedTip !== platformTipMinor) {
      throw new Error('Membership platform tip does not match selected tip');
    }
  }

  if (input.tierId !== undefined) validateIdentifier(input.tierId, 'Tier id');
  if (cadence !== 'one_off') {
    if (!input.tierId) throw new Error('Tier id is required for memberships');
    validateIdentifier(context.stripePriceId, 'Stripe price id', 'price_');
    if (context.recurringTipPriceId !== undefined) {
      validateIdentifier(context.recurringTipPriceId, 'Recurring tip price id', 'price_');
    }
    if (context.authoritativePrice !== undefined) {
      const priceCurrency = normalizeCurrency(context.authoritativePrice.currency);
      const priceAmount = minorUnits(
        context.authoritativePrice.amountMinor,
        'Authoritative membership amount',
        false,
      );
      if (priceCurrency !== currency || priceAmount !== projectAmountMinor) {
        throw new Error('Membership price does not match selected amount or currency');
      }
      if (
        context.authoritativePrice.cadence !== undefined &&
        context.authoritativePrice.cadence !== cadence
      ) {
        throw new Error('Membership price cadence does not match selection');
      }
    }
  }

  const limits = context.limits;
  const minimum =
    limits?.minimumProjectAmountMinor !== undefined
      ? minorUnits(limits.minimumProjectAmountMinor, 'Minimum project amount')
      : currency === 'gbp' && cadence === 'one_off'
        ? 200n
        : 0n;
  const maximum =
    limits?.maximumProjectAmountMinor !== undefined
      ? minorUnits(limits.maximumProjectAmountMinor, 'Maximum project amount', false)
      : currency === 'gbp'
        ? 500_000n
        : null;
  if (maximum !== null && maximum < minimum) throw new Error('Checkout amount limits are invalid');
  if (projectAmountMinor < minimum) throw new Error('Project amount is below the minimum');
  if (maximum !== null && projectAmountMinor > maximum) {
    throw new Error('Project amount exceeds the maximum');
  }

  const customerChargeMinor = projectAmountMinor + platformTipMinor;
  if (customerChargeMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Customer charge exceeds supported minor-unit range');
  }
  if (currencyExponent(currency) < 0) throw new Error('Currency exponent is invalid');
  return { currency, projectAmountMinor, platformTipMinor };
}

export function validateRefundInput(input: RefundInput): {
  currency: string;
  originalCharge: bigint;
  refundAmount: bigint;
  originalFee: bigint;
  previouslyRefundedCharge: bigint;
  previouslyRefundedFee: bigint;
} {
  if (!input || typeof input !== 'object') throw new Error('Refund input is required');
  if (
    (input.previouslyRefundedCustomerChargeMinor === undefined) !==
    (input.previouslyRefundedApplicationFeeMinor === undefined)
  ) {
    throw new Error('Previously refunded charge and fee must be provided together');
  }
  validateIdentifier(input.stripeAccountId, 'Stripe account id', 'acct_');
  validateIdentifier(input.chargeId, 'Charge id', 'ch_');
  const currency = normalizeCurrency(input.currency);
  const originalCharge = minorUnits(input.originalCustomerChargeMinor, 'Original charge', false);
  const refundAmount = minorUnits(input.refundAmountMinor, 'Refund amount', false);
  const originalFee = minorUnits(input.originalApplicationFeeMinor, 'Original application fee');
  const previouslyRefundedCharge = minorUnits(
    input.previouslyRefundedCustomerChargeMinor ?? 0,
    'Previously refunded charge',
  );
  const previouslyRefundedFee = minorUnits(
    input.previouslyRefundedApplicationFeeMinor ?? 0,
    'Previously refunded application fee',
  );
  if (originalFee > originalCharge) throw new Error('Application fee exceeds original charge');
  if (
    originalCharge > BigInt(Number.MAX_SAFE_INTEGER) ||
    originalFee > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error('Refund amount exceeds supported minor-unit range');
  }
  if (previouslyRefundedCharge > originalCharge) {
    throw new Error('Previously refunded charge exceeds original charge');
  }
  if (previouslyRefundedFee > originalFee) {
    throw new Error('Previously refunded application fee exceeds original fee');
  }
  if (refundAmount > originalCharge - previouslyRefundedCharge) {
    throw new Error('Refund amount exceeds remaining charge');
  }
  if (
    typeof input.reason !== 'string' ||
    input.reason.trim().length === 0 ||
    input.reason.length > 500 ||
    /[\r\n]/.test(input.reason)
  ) {
    throw new Error('Refund reason is invalid');
  }
  if (
    input.providerReason !== undefined &&
    !['duplicate', 'fraudulent', 'requested_by_customer'].includes(input.providerReason)
  ) {
    throw new Error('Provider refund reason is invalid');
  }
  if (input.idempotencyKey !== undefined) validateIdempotencyKey(input.idempotencyKey);
  if (input.stripeApplicationFeeId !== undefined) {
    validateIdentifier(input.stripeApplicationFeeId, 'Application fee id', 'fee_');
  }
  return {
    currency,
    originalCharge,
    refundAmount,
    originalFee,
    previouslyRefundedCharge,
    previouslyRefundedFee,
  };
}
