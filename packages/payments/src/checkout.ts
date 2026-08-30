import { createHash } from 'node:crypto';
import { computeFeeAllocation, uuidv7 } from '@oss-tips/domain';
import type { StripeClient } from './client/types.js';
import type { CheckoutIntentContext, CheckoutIntentInput, CheckoutIntentResult } from './types.js';
import { validateCheckoutInput, validateIdempotencyKey } from './validation.js';

const INTENT_TTL_MS = 30 * 60 * 1000;

/**
 * Create a connected-account Checkout Session with server-computed fees.
 * Never accepts application-fee amount from the client.
 */
export async function createCheckoutIntent(
  client: StripeClient,
  input: CheckoutIntentInput,
  context: CheckoutIntentContext,
): Promise<CheckoutIntentResult> {
  const validated = validateCheckoutInput(input, context);
  const allocation = computeFeeAllocation({
    projectAmountMinor: validated.projectAmountMinor,
    platformTipMinor: validated.platformTipMinor,
    currency: validated.currency,
    featureMode: context.featureMode,
    cadence: input.cadence,
  });

  const mode = input.cadence === 'one_off' ? 'payment' : 'subscription';
  const enableCrypto = context.capabilities.cryptoPayments;

  const idempotencyKey = context.idempotencyKey;
  const paymentId =
    context.paymentId ?? (idempotencyKey ? deterministicPaymentId(idempotencyKey) : uuidv7());

  const metadata: Record<string, string> = {
    project_id: context.projectId,
    project_slug: input.project,
    payment_id: paymentId,
    ...(context.userId ? { user_id: context.userId } : {}),
    cadence: input.cadence,
    tier_id: input.tierId ?? '',
    feature_mode: context.featureMode,
    project_amount_minor: allocation.projectAmount.amountMinor.toString(),
    platform_tip_minor: allocation.platformTip.amountMinor.toString(),
    oss_project_fee_minor: allocation.ossProjectFee.amountMinor.toString(),
    application_fee_minor: allocation.stripeApplicationFee.amountMinor.toString(),
    customer_charge_minor: allocation.customerCharge.amountMinor.toString(),
    currency: validated.currency,
    show_name: String(input.publicOptions.showName),
    show_amount: String(input.publicOptions.showAmount),
    show_message: String(input.publicOptions.showMessage),
    display_name: input.publicOptions.displayName?.trim() ?? '',
    public_message: input.publicOptions.message?.trim() ?? '',
  };

  const session = await client.createCheckoutSession({
    stripeAccountId: context.stripeAccountId,
    mode,
    currency: validated.currency,
    amountMinor: Number(allocation.customerCharge.amountMinor),
    applicationFeeMinor: Number(allocation.stripeApplicationFee.amountMinor),
    successUrl: context.successUrl,
    cancelUrl: context.cancelUrl,
    customerEmail: context.customerEmail,
    stripePriceId: context.stripePriceId,
    metadata,
    enableCrypto,
    cadence: input.cadence,
    ...(input.cadence !== 'one_off'
      ? { recurringTipMinor: Number(validated.platformTipMinor) }
      : {}),
    ...(input.cadence !== 'one_off' && context.recurringTipPriceId
      ? { recurringTipPriceId: context.recurringTipPriceId }
      : {}),
    idempotencyKey: idempotencyKey ?? paymentId,
    uiMode: context.checkoutUiMode,
    returnUrl: context.returnUrl,
    adaptivePricing: context.adaptivePricing,
  });

  const expiresAt = new Date(Date.now() + INTENT_TTL_MS).toISOString();

  return {
    intentId: paymentId,
    clientSecret: session.clientSecret,
    checkoutUrl: session.url,
    expiresAt,
    applicationFeeMinor: allocation.stripeApplicationFee.amountMinor.toString(),
    customerChargeMinor: allocation.customerCharge.amountMinor.toString(),
    currency: validated.currency,
    mode,
  };
}

/** Whether crypto payment methods should be offered in Checkout UI. */
export function shouldOfferCryptoPayment(
  capabilities: CheckoutIntentContext['capabilities'],
): boolean {
  return capabilities.cryptoPayments;
}

function deterministicPaymentId(idempotencyKey: string): string {
  const hex = createHash('sha256')
    .update(`oss.tips/payment/${idempotencyKey}`)
    .digest('hex')
    .slice(0, 32);
  const variant = ((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20)}`;
}

/** Stable payment record ID for a checkout idempotency key. */
export function paymentIdForIdempotencyKey(idempotencyKey: string): string {
  return deterministicPaymentId(validateIdempotencyKey(idempotencyKey));
}
