import { money, roundPercentOf, type Money } from '../money/index.js';

export type FeatureMode = 'standard' | 'contributes_5_percent';
export type Cadence = 'one_off' | 'monthly' | 'annual';

export type FeeAllocation = {
  readonly projectAmount: Money;
  readonly platformTip: Money;
  readonly customerCharge: Money;
  readonly projectFeeRateBps: number;
  readonly ossProjectFee: Money;
  readonly stripeApplicationFee: Money;
  readonly projectBeforeStripe: Money;
  readonly featureMode: FeatureMode;
  readonly cadence: Cadence;
};

const ONE_OFF_STANDARD_BPS = 0;
const RECURRING_STANDARD_BPS = 200;
const CONTRIBUTES_BPS = 500;

export function feeRateBps(mode: FeatureMode, cadence: Cadence): number {
  if (mode === 'contributes_5_percent') return CONTRIBUTES_BPS;
  if (cadence === 'one_off') return ONE_OFF_STANDARD_BPS;
  return RECURRING_STANDARD_BPS;
}

export type ComputeFeeInput = {
  projectAmountMinor: bigint | number;
  platformTipMinor: bigint | number;
  currency: string;
  featureMode: FeatureMode;
  cadence: Cadence;
};

/**
 * Compute immutable fee allocation for a charge.
 * Never accept application-fee amount from the client.
 */
export function computeFeeAllocation(input: ComputeFeeInput): FeeAllocation {
  const currency = input.currency;
  const projectAmount = money(input.projectAmountMinor, currency);
  const platformTip = money(input.platformTipMinor, currency);

  if (projectAmount.amountMinor < 0n || platformTip.amountMinor < 0n) {
    throw new Error('Amounts must be non-negative');
  }

  const rateBps = feeRateBps(input.featureMode, input.cadence);
  const ossFeeMinor = roundPercentOf(projectAmount.amountMinor, rateBps);
  const ossProjectFee = money(ossFeeMinor, currency);
  const stripeApplicationFee = money(ossFeeMinor + platformTip.amountMinor, currency);
  const customerCharge = money(projectAmount.amountMinor + platformTip.amountMinor, currency);
  const projectBeforeStripe = money(projectAmount.amountMinor - ossFeeMinor, currency);

  return {
    projectAmount,
    platformTip,
    customerCharge,
    projectFeeRateBps: rateBps,
    ossProjectFee,
    stripeApplicationFee,
    projectBeforeStripe,
    featureMode: input.featureMode,
    cadence: input.cadence,
  };
}

/** Proportional refund of platform fee + tip for a partial/full refund of customer charge. */
export function proportionalPlatformRefund(args: {
  originalCustomerChargeMinor: bigint;
  refundCustomerChargeMinor: bigint;
  originalApplicationFeeMinor: bigint;
}): bigint {
  if (args.originalCustomerChargeMinor <= 0n) return 0n;
  if (args.refundCustomerChargeMinor >= args.originalCustomerChargeMinor) {
    return args.originalApplicationFeeMinor;
  }
  return (
    (args.originalApplicationFeeMinor * args.refundCustomerChargeMinor +
      args.originalCustomerChargeMinor / 2n) /
    args.originalCustomerChargeMinor
  );
}

export const MIN_ONE_OFF_GBP_MINOR = 200n; // £2
export const MAX_ORDINARY_GBP_MINOR = 500_000n; // £5,000
