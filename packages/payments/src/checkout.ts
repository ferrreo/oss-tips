import { randomBytes } from 'node:crypto';
import { computeFeeAllocation } from '@oss-tips/domain';
import type { StripeClient } from './client/types.js';
import type { CheckoutIntentContext, CheckoutIntentInput, CheckoutIntentResult } from './types.js';

const INTENT_TTL_MS = 30 * 60 * 1000;

function intentId(): string {
  return `ci_${randomBytes(16).toString('hex')}`;
}

/**
 * Create a connected-account Checkout Session with server-computed fees.
 * Never accepts application-fee amount from the client.
 */
export async function createCheckoutIntent(
  client: StripeClient,
  input: CheckoutIntentInput,
  context: CheckoutIntentContext,
): Promise<CheckoutIntentResult> {
  const allocation = computeFeeAllocation({
    projectAmountMinor: input.projectAmountMinor,
    platformTipMinor: input.platformTipMinor,
    currency: input.projectCurrency,
    featureMode: context.featureMode,
    cadence: input.cadence,
  });

  const mode = input.cadence === 'one_off' ? 'payment' : 'subscription';
  const enableCrypto = context.capabilities.cryptoPayments;

  const paymentId = context.paymentId ?? intentId();

  const metadata: Record<string, string> = {
    project_id: context.projectId,
    project_slug: input.project,
    payment_id: paymentId,
    cadence: input.cadence,
    tier_id: input.tierId ?? '',
    feature_mode: context.featureMode,
    project_amount_minor: allocation.projectAmount.amountMinor.toString(),
    platform_tip_minor: allocation.platformTip.amountMinor.toString(),
    oss_project_fee_minor: allocation.ossProjectFee.amountMinor.toString(),
    application_fee_minor: allocation.stripeApplicationFee.amountMinor.toString(),
    customer_charge_minor: allocation.customerCharge.amountMinor.toString(),
    currency: input.projectCurrency.toLowerCase(),
    show_name: String(input.publicOptions.showName),
    show_amount: String(input.publicOptions.showAmount),
    show_message: String(input.publicOptions.showMessage),
  };

  const session = await client.createCheckoutSession({
    stripeAccountId: context.stripeAccountId,
    mode,
    currency: input.projectCurrency,
    amountMinor: Number(allocation.customerCharge.amountMinor),
    applicationFeeMinor: Number(allocation.stripeApplicationFee.amountMinor),
    successUrl: context.successUrl,
    cancelUrl: context.cancelUrl,
    customerEmail: context.customerEmail,
    stripePriceId: context.stripePriceId,
    metadata,
    enableCrypto,
  });

  const expiresAt = new Date(Date.now() + INTENT_TTL_MS).toISOString();

  return {
    intentId: paymentId,
    clientSecret: session.clientSecret,
    checkoutUrl: session.url,
    expiresAt,
    applicationFeeMinor: allocation.stripeApplicationFee.amountMinor.toString(),
    customerChargeMinor: allocation.customerCharge.amountMinor.toString(),
    currency: input.projectCurrency,
    mode,
  };
}

/** Whether crypto payment methods should be offered in Checkout UI. */
export function shouldOfferCryptoPayment(capabilities: CheckoutIntentContext['capabilities']): boolean {
  return capabilities.cryptoPayments;
}
