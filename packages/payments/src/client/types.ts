export type StripeCheckoutMode = 'payment' | 'subscription';

export type CreateCheckoutSessionParams = {
  stripeAccountId: string;
  mode: StripeCheckoutMode;
  currency: string;
  amountMinor: number;
  applicationFeeMinor: number;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | undefined;
  stripePriceId?: string | undefined;
  metadata: Record<string, string>;
  enableCrypto: boolean;
  cadence?: 'one_off' | 'monthly' | 'annual' | undefined;
  recurringTipMinor?: number | undefined;
  recurringTipPriceId?: string | undefined;
  adaptivePricing?: boolean | undefined;
  idempotencyKey?: string | undefined;
  uiMode?: 'hosted' | 'embedded' | undefined;
  returnUrl?: string | undefined;
};

export type CheckoutSession = {
  id: string;
  clientSecret: string | null;
  url: string | null;
};

export type CreateRefundParams = {
  stripeAccountId: string;
  chargeId: string;
  amountMinor: number;
  refundApplicationFeeMinor: number;
  reason: string;
  refundApplicationFee?: boolean | undefined;
  idempotencyKey?: string | undefined;
  providerReason?: 'duplicate' | 'fraudulent' | 'requested_by_customer' | undefined;
};

export type StripeRefund = {
  id: string;
  status: 'pending' | 'succeeded' | 'failed';
  amountMinor: number;
};

export type ListBalanceTransactionsParams = {
  stripeAccountId: string;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
};

export type ListPlatformBalanceTransactionsParams = {
  currency: string;
  periodStart: Date;
  periodEnd: Date;
};

/** Raw Stripe event returned by the official Events API for recovery. */
export type StripeProviderEvent = {
  id: string;
  stripeAccountId: string | null;
  type: string;
  apiVersion: string | null;
  createdAt: Date;
  objectId: string | null;
  payload: Record<string, unknown>;
};

export type ListStripeEventsParams = {
  /** null lists events in platform context; acct_... lists a connected account. */
  stripeAccountId: string | null;
  periodStart: Date;
  periodEnd: Date;
};

/** Normalised Stripe balance transaction used by daily reconciliation. */
export type StripeBalanceTransaction = {
  id: string;
  stripeAccountId: string;
  currency: string;
  amountMinor: number;
  feeMinor: number;
  netMinor: number;
  type: string;
  sourceId: string | null;
  createdAt: Date;
  availableOn: Date | null;
};

export type UpdateInvoiceApplicationFeeParams = {
  stripeAccountId: string;
  invoiceId: string;
  applicationFeeMinor: number;
  idempotencyKey?: string | undefined;
};

export type StripeInvoice = {
  id: string;
  applicationFeeMinor: number | null;
  status: string | null;
};

export type FinalizeInvoiceParams = {
  stripeAccountId: string;
  invoiceId: string;
  idempotencyKey?: string | undefined;
};

export type CreateApplicationFeeRefundParams = {
  applicationFeeId: string;
  amountMinor: number;
  idempotencyKey?: string | undefined;
  metadata?: Record<string, string> | undefined;
};

export type StripeApplicationFeeRefund = {
  id: string;
  amountMinor: number;
};

export type CreateConnectedAccountParams = {
  displayName: string;
  contactEmail?: string | undefined;
  country?: string | undefined;
  defaultCurrency?: string | undefined;
  idempotencyKey?: string | undefined;
  metadata?: Record<string, string> | undefined;
};

export type ConnectedAccount = {
  stripeAccountId: string;
};

export type CreateConnectedAccountLinkParams = {
  stripeAccountId: string;
  refreshUrl: string;
  returnUrl?: string | undefined;
  idempotencyKey?: string | undefined;
};

export type ConnectedAccountLink = {
  stripeAccountId: string;
  url: string;
  expiresAt: string;
};

export type CreateConnectedAccountSessionParams = {
  stripeAccountId: string;
  idempotencyKey?: string | undefined;
};

export type ConnectedAccountSession = {
  stripeAccountId: string;
  clientSecret: string;
  expiresAt: number;
};

export type CreateCustomerPortalSessionParams = {
  stripeAccountId: string;
  customerId: string;
  returnUrl: string;
  idempotencyKey?: string | undefined;
};

export type CustomerPortalSession = {
  id: string;
  url: string;
};

export type UpdateSubscriptionTipParams = {
  stripeAccountId: string;
  subscriptionId: string;
  currentTipMinor: number | bigint;
  platformTipMinor: number | bigint;
  currency: string;
  cadence: 'monthly' | 'annual';
  idempotencyKey?: string | undefined;
};

export type StripeSubscriptionTipUpdate = {
  subscriptionId: string;
  platformTipMinor: number;
};

export interface StripeClient {
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession>;
  createRefund(params: CreateRefundParams): Promise<StripeRefund>;
  /** Optional for compatibility with non-Stripe test doubles. Production Stripe clients implement it. */
  listBalanceTransactions?(
    params: ListBalanceTransactionsParams,
  ): Promise<StripeBalanceTransaction[]>;
  listPlatformBalanceTransactions?(
    params: ListPlatformBalanceTransactionsParams,
  ): Promise<StripeBalanceTransaction[]>;
  listEvents?(params: ListStripeEventsParams): Promise<StripeProviderEvent[]>;
  updateInvoiceApplicationFee?(params: UpdateInvoiceApplicationFeeParams): Promise<StripeInvoice>;
  finalizeInvoice?(params: FinalizeInvoiceParams): Promise<StripeInvoice>;
  createApplicationFeeRefund?(
    params: CreateApplicationFeeRefundParams,
  ): Promise<StripeApplicationFeeRefund>;
  createConnectedAccount?(params: CreateConnectedAccountParams): Promise<ConnectedAccount>;
  createConnectedAccountLink?(
    params: CreateConnectedAccountLinkParams,
  ): Promise<ConnectedAccountLink>;
  createConnectedAccountSession?(
    params: CreateConnectedAccountSessionParams,
  ): Promise<ConnectedAccountSession>;
  createCustomerPortalSession?(
    params: CreateCustomerPortalSessionParams,
  ): Promise<CustomerPortalSession>;
  updateSubscriptionTip?(params: UpdateSubscriptionTipParams): Promise<StripeSubscriptionTipUpdate>;
}
