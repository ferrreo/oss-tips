import { money, roundPercentOf } from '@oss-tips/domain';

/**
 * Compute application_fee_amount for invoice.created (docs §7).
 * application_fee_amount = round(project_membership_amount × project_fee_rate)
 *                        + supporter_platform_tip
 */
export function computeInvoiceApplicationFeeAmount(input: {
  projectMembershipAmountMinor: number | bigint;
  projectFeeRateBps: number;
  supporterPlatformTipMinor: number | bigint;
  currency: string;
}): { applicationFeeMinor: bigint; applicationFee: { amount: string; currency: string } } {
  const membershipMinor = BigInt(input.projectMembershipAmountMinor);
  const tipMinor = BigInt(input.supporterPlatformTipMinor);
  const projectFeeMinor = roundPercentOf(membershipMinor, input.projectFeeRateBps);
  const applicationFeeMinor = projectFeeMinor + tipMinor;
  const applicationFee = money(applicationFeeMinor, input.currency);
  return {
    applicationFeeMinor,
    applicationFee: { amount: applicationFee.amountMinor.toString(), currency: applicationFee.currency },
  };
}
