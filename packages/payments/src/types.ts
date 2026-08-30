import type { Cadence, FeatureMode } from '@oss-tips/domain';

/** Public checkout preferences shown on supporter pages. */
export type PublicSupportOptions = {
  showName: boolean;
  showAmount: boolean;
  showMessage: boolean;
  displayName?: string | undefined;
  message?: string | undefined;
};

/** Server input for one-off or subscription checkout (docs §6). */
export type CheckoutIntentInput = {
  project: string;
  tierId?: string | undefined;
  projectAmountMinor: number | bigint;
  projectCurrency: string;
  platformTipMinor: number | bigint;
  cadence: Cadence;
  publicOptions: PublicSupportOptions;
};

export type StripeCapabilities = {
  cardPayments: boolean;
  cryptoPayments: boolean;
  chargesEnabled?: boolean | undefined;
  payoutsEnabled?: boolean | undefined;
};

export type CheckoutIntentContext = {
  projectId: string;
  stripeAccountId: string;
  featureMode: FeatureMode;
  capabilities: StripeCapabilities;
  successUrl: string;
  cancelUrl: string;
  /** Stable payment id written into Stripe metadata and our payment row. */
  paymentId?: string | undefined;
  /** Authenticated supporter identity for recurring checkout settlement. */
  userId?: string | undefined;
  customerEmail?: string | undefined;
  stripePriceId?: string | undefined;
  recurringTipPriceId?: string | undefined;
  membershipPlatformTipMinor?: number | bigint | undefined;
  /** Stable key supplied by the request boundary and reused on retries. */
  idempotencyKey?: string | undefined;
  /** Authoritative tier price snapshot, when this is a membership checkout. */
  authoritativePrice?:
    | {
        amountMinor: number | bigint;
        currency: string;
        cadence?: Exclude<Cadence, 'one_off'>;
      }
    | undefined;
  limits?:
    | {
        minimumProjectAmountMinor?: number | bigint;
        maximumProjectAmountMinor?: number | bigint;
      }
    | undefined;
  checkoutUiMode?: 'hosted' | 'embedded' | undefined;
  returnUrl?: string | undefined;
  adaptivePricing?: boolean | undefined;
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
  refundAmountMinor: number | bigint;
  currency: string;
  originalCustomerChargeMinor: number | bigint;
  originalApplicationFeeMinor: number | bigint;
  reason: string;
  providerReason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | undefined;
  idempotencyKey?: string | undefined;
  stripeApplicationFeeId?: string | undefined;
  previouslyRefundedCustomerChargeMinor?: number | bigint | undefined;
  previouslyRefundedApplicationFeeMinor?: number | bigint | undefined;
};

export type RefundResult = {
  refundId: string;
  status: 'pending' | 'succeeded' | 'failed';
  amountMinor: string;
  applicationFeeRefundMinor: string;
  applicationFeeRefundId?: string | undefined;
};

export type InvoiceFeeInput = {
  projectMembershipAmountMinor: number | bigint;
  projectFeeRateBps: number;
  supporterPlatformTipMinor: number | bigint;
  currency: string;
};

export type InvoiceApplicationFeeInput = InvoiceFeeInput & {
  stripeAccountId: string;
  invoiceId: string;
  invoiceTotalMinor?: number | bigint | undefined;
  idempotencyKey?: string | undefined;
  finalize?: boolean | undefined;
};

export type InvoiceApplicationFeeResult = {
  invoiceId: string;
  applicationFeeMinor: string;
  currency: string;
  finalized: boolean;
};
