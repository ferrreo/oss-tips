import { randomBytes } from 'node:crypto';
import type {
  CheckoutSession,
  CreateCheckoutSessionParams,
  CreateRefundParams,
  StripeClient,
  StripeRefund,
} from './types.js';

function fakeId(prefix: string): string {
  return `${prefix}_mock_${randomBytes(12).toString('hex')}`;
}

/** Local/dev Stripe client when STRIPE_SECRET_KEY is unset. Sessions always succeed. */
export class MockStripeClient implements StripeClient {
  readonly sessions: CreateCheckoutSessionParams[] = [];
  readonly refunds: CreateRefundParams[] = [];

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
    this.sessions.push(params);
    const id = fakeId('cs');
    return {
      id,
      clientSecret: `${id}_secret_mock`,
      url: `https://checkout.stripe.mock/session/${id}`,
    };
  }

  async createRefund(params: CreateRefundParams): Promise<StripeRefund> {
    this.refunds.push(params);
    return {
      id: fakeId('re'),
      status: 'succeeded',
      amountMinor: params.amountMinor,
    };
  }
}
