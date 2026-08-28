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
};

export type StripeRefund = {
  id: string;
  status: 'pending' | 'succeeded' | 'failed';
  amountMinor: number;
};

export interface StripeClient {
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession>;
  createRefund(params: CreateRefundParams): Promise<StripeRefund>;
}
