import { money, roundPercentOf } from '@oss-tips/domain';
import type { StripeClient } from './client/types.js';
import type {
  InvoiceApplicationFeeInput,
  InvoiceApplicationFeeResult,
  InvoiceFeeInput,
} from './types.js';
import {
  minorUnits,
  normalizeCurrency,
  deriveIdempotencyKey,
  validateIdempotencyKey,
  validateIdentifier,
} from './validation.js';

/**
 * Compute application_fee_amount for invoice.created (docs §7).
 * application_fee_amount = round(project_membership_amount × project_fee_rate)
 *                        + supporter_platform_tip
 */
export function computeInvoiceApplicationFeeAmount(input: InvoiceFeeInput): {
  applicationFeeMinor: bigint;
  applicationFee: { amount: string; currency: string };
} {
  if (!input || typeof input !== 'object') throw new Error('Invoice fee input is required');
  const membershipMinor = minorUnits(
    input.projectMembershipAmountMinor,
    'Project membership amount',
  );
  const tipMinor = minorUnits(input.supporterPlatformTipMinor, 'Platform tip');
  if (
    !Number.isInteger(input.projectFeeRateBps) ||
    input.projectFeeRateBps < 0 ||
    input.projectFeeRateBps > 10_000
  ) {
    throw new Error('Project fee rate must be an integer between 0 and 10000 basis points');
  }
  const currency = normalizeCurrency(input.currency);
  const projectFeeMinor = roundPercentOf(membershipMinor, input.projectFeeRateBps);
  const applicationFeeMinor = projectFeeMinor + tipMinor;
  const applicationFee = money(applicationFeeMinor, currency);
  return {
    applicationFeeMinor,
    applicationFee: {
      amount: applicationFee.amountMinor.toString(),
      currency: applicationFee.currency,
    },
  };
}

/** Set an exact invoice application fee before optionally finalising the invoice. */
export async function applyInvoiceApplicationFee(
  client: StripeClient,
  input: InvoiceApplicationFeeInput,
): Promise<InvoiceApplicationFeeResult> {
  if (!input || typeof input !== 'object') throw new Error('Invoice fee input is required');
  validateIdentifier(input.stripeAccountId, 'Stripe account id', 'acct_');
  validateIdentifier(input.invoiceId, 'Invoice id', 'in_');
  const currency = normalizeCurrency(input.currency);
  const fee = computeInvoiceApplicationFeeAmount({ ...input, currency });
  if (fee.applicationFeeMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Invoice application fee exceeds supported minor-unit range');
  }
  if (input.invoiceTotalMinor !== undefined) {
    const invoiceTotal = minorUnits(input.invoiceTotalMinor, 'Invoice total');
    if (fee.applicationFeeMinor > invoiceTotal) {
      throw new Error('Invoice application fee exceeds invoice total');
    }
  }

  if (!client || typeof client.updateInvoiceApplicationFee !== 'function') {
    throw new Error('Stripe client does not support invoice application fees');
  }

  const baseKey =
    input.idempotencyKey ??
    `invoice-fee:${input.stripeAccountId}:${input.invoiceId}:${fee.applicationFeeMinor.toString()}`;
  if (input.idempotencyKey) validateIdempotencyKey(input.idempotencyKey);
  await client.updateInvoiceApplicationFee({
    stripeAccountId: input.stripeAccountId,
    invoiceId: input.invoiceId,
    applicationFeeMinor: Number(fee.applicationFeeMinor),
    idempotencyKey: deriveIdempotencyKey(baseKey, 'update'),
  });

  let finalized = false;
  if (input.finalize === true) {
    if (!client.finalizeInvoice)
      throw new Error('Stripe client does not support invoice finalisation');
    await client.finalizeInvoice({
      stripeAccountId: input.stripeAccountId,
      invoiceId: input.invoiceId,
      idempotencyKey: deriveIdempotencyKey(baseKey, 'finalize'),
    });
    finalized = true;
  }

  return {
    invoiceId: input.invoiceId,
    applicationFeeMinor: fee.applicationFeeMinor.toString(),
    currency,
    finalized,
  };
}
