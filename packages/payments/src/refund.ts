import { proportionalPlatformRefund } from '@oss-tips/domain';
import type { StripeClient } from './client/types.js';
import type { RefundInput, RefundResult } from './types.js';
import { deriveIdempotencyKey, validateRefundInput } from './validation.js';

/**
 * Issue a refund on the connected account with proportional application fee refund.
 */
export async function orchestrateRefund(
  client: StripeClient,
  input: RefundInput,
): Promise<RefundResult> {
  const {
    originalCharge,
    refundAmount,
    originalFee,
    previouslyRefundedCharge,
    previouslyRefundedFee,
  } = validateRefundInput(input);
  const expectedPreviousFee = proportionalPlatformRefund({
    originalCustomerChargeMinor: originalCharge,
    refundCustomerChargeMinor: previouslyRefundedCharge,
    originalApplicationFeeMinor: originalFee,
  });
  if (previouslyRefundedFee !== expectedPreviousFee) {
    throw new Error('Previously refunded application fee is inconsistent with charge refunds');
  }
  const totalRefundedCharge = previouslyRefundedCharge + refundAmount;
  const targetRefundedFee = proportionalPlatformRefund({
    originalCustomerChargeMinor: originalCharge,
    refundCustomerChargeMinor: totalRefundedCharge,
    originalApplicationFeeMinor: originalFee,
  });
  const feeRefundMinor = targetRefundedFee - previouslyRefundedFee;
  if (feeRefundMinor < 0n) {
    throw new Error('Previously refunded application fee is inconsistent with charge refunds');
  }

  const key =
    input.idempotencyKey ??
    `refund:${input.stripeAccountId}:${input.chargeId}:${refundAmount.toString()}:${input.reason}`;
  const exactApplicationFee = input.stripeApplicationFeeId !== undefined;
  const applicationFeeId = input.stripeApplicationFeeId;

  const refund = await client.createRefund({
    stripeAccountId: input.stripeAccountId,
    chargeId: input.chargeId,
    amountMinor: Number(refundAmount),
    refundApplicationFeeMinor: Number(feeRefundMinor),
    reason: input.reason,
    refundApplicationFee: !exactApplicationFee && feeRefundMinor > 0n,
    idempotencyKey: deriveIdempotencyKey(key, exactApplicationFee ? 'charge' : 'refund'),
    providerReason: input.providerReason,
  });

  let applicationFeeRefundId: string | undefined;
  if (applicationFeeId !== undefined && refund.status !== 'failed' && feeRefundMinor > 0n) {
    if (!client.createApplicationFeeRefund) {
      throw new Error('Stripe client does not support application-fee refunds');
    }
    const feeRefund = await client.createApplicationFeeRefund({
      applicationFeeId,
      amountMinor: Number(feeRefundMinor),
      idempotencyKey: deriveIdempotencyKey(key, 'application-fee'),
      metadata: { reason: input.reason },
    });
    applicationFeeRefundId = feeRefund.id;
  }

  return {
    refundId: refund.id,
    status: refund.status,
    amountMinor: refund.amountMinor.toString(),
    applicationFeeRefundMinor: feeRefundMinor.toString(),
    ...(applicationFeeRefundId ? { applicationFeeRefundId } : {}),
  };
}
