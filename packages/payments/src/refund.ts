import { proportionalPlatformRefund } from '@oss-tips/domain';
import type { StripeClient } from './client/types.js';
import type { RefundInput, RefundResult } from './types.js';

/**
 * Issue a refund on the connected account with proportional application fee refund.
 */
export async function orchestrateRefund(
  client: StripeClient,
  input: RefundInput,
): Promise<RefundResult> {
  const originalCharge = BigInt(input.originalCustomerChargeMinor);
  const refundAmount = BigInt(input.refundAmountMinor);
  const originalFee = BigInt(input.originalApplicationFeeMinor);

  if (refundAmount <= 0n) {
    throw new Error('Refund amount must be positive');
  }
  if (refundAmount > originalCharge) {
    throw new Error('Refund amount exceeds original charge');
  }

  const feeRefundMinor = proportionalPlatformRefund({
    originalCustomerChargeMinor: originalCharge,
    refundCustomerChargeMinor: refundAmount,
    originalApplicationFeeMinor: originalFee,
  });

  const refund = await client.createRefund({
    stripeAccountId: input.stripeAccountId,
    chargeId: input.chargeId,
    amountMinor: Number(refundAmount),
    refundApplicationFeeMinor: Number(feeRefundMinor),
    reason: input.reason,
  });

  return {
    refundId: refund.id,
    status: refund.status,
    amountMinor: refund.amountMinor.toString(),
    applicationFeeRefundMinor: feeRefundMinor.toString(),
  };
}
