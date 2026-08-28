import type { Cadence, FeatureMode } from '@oss-tips/domain';

/** Public checkout preferences shown on supporter pages. */
export type PublicSupportOptions = {
  showName: boolean;
  showAmount: boolean;
  showMessage: boolean;
};

/** Server input for one-off or subscription checkout (docs §6). */
export type CheckoutIntentInput = {
  project: string;
  tierId?: string | undefined;
  projectAmountMinor: number;
  projectCurrency: string;
  platformTipMinor: number;
  cadence: Cadence;
  publicOptions: PublicSupportOptions;
};

export type StripeCapabilities = {
  cardPayments: boolean;
  cryptoPayments: boolean;
};

export type CheckoutIntentContext = {
  projectId: string;
  stripeAccountId: string;
  featureMode: FeatureMode;
  capabilities: StripeCapabilities;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | undefined;
  stripePriceId?: string | undefined;
  membershipPlatformTipMinor?: number | undefined;
};

export type CheckoutIntentResult = {
  intentId: string;
  clientSecret: string | null;
  checkoutUrl: string | null;
  expiresAt: string;
  applicationFeeMinor: string;
  customerChargeMinor: string;
  currency: string;
  mode: 'payment' | 'subscription';
};

export type RefundInput = {
  stripeAccountId: string;
  chargeId: string;
  refundAmountMinor: number;
  currency: string;
  originalCustomerChargeMinor: number;
  originalApplicationFeeMinor: number;
  reason: string;
};

export type RefundResult = {
  refundId: string;
  status: 'pending' | 'succeeded' | 'failed';
  amountMinor: string;
  applicationFeeRefundMinor: string;
};

export type InvoiceFeeInput = {
  projectMembershipAmountMinor: number;
  projectFeeRateBps: number;
  supporterPlatformTipMinor: number;
  currency: string;
};
