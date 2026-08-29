import Stripe from 'stripe';
import type {
  CheckoutSession,
  CreateCheckoutSessionParams,
  CreateRefundParams,
  StripeClient,
  StripeRefund,
} from './types.js';

export class RealStripeClient implements StripeClient {
  private readonly stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, { apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion });
  }

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = ['card'];
    if (params.enableCrypto) {
      paymentMethodTypes.push('crypto' as Stripe.Checkout.SessionCreateParams.PaymentMethodType);
    }

    const base: Stripe.Checkout.SessionCreateParams = {
      mode: params.mode,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      payment_method_types: paymentMethodTypes,
      metadata: params.metadata,
    };

    if (params.mode === 'payment') {
      base.payment_intent_data = {
        application_fee_amount: params.applicationFeeMinor,
      };
    } else {
      base.subscription_data = {
        metadata: params.metadata,
      };
    }

    if (params.customerEmail) {
      base.customer_email = params.customerEmail;
    }

    if (params.mode === 'payment') {
      base.line_items = [
        {
          price_data: {
            currency: params.currency,
            unit_amount: params.amountMinor,
            product_data: { name: 'Support' },
          },
          quantity: 1,
        },
      ];
    } else if (params.stripePriceId) {
      base.line_items = [{ price: params.stripePriceId, quantity: 1 }];
    } else {
      throw new Error('stripePriceId required for subscription checkout');
    }

    const session = await this.stripe.checkout.sessions.create(base, {
      stripeAccount: params.stripeAccountId,
    });

    return {
      id: session.id,
      clientSecret: session.client_secret ?? null,
      url: session.url ?? null,
    };
  }

  async createRefund(params: CreateRefundParams): Promise<StripeRefund> {
    const refund = await this.stripe.refunds.create(
      {
        charge: params.chargeId,
        amount: params.amountMinor,
        refund_application_fee: params.refundApplicationFeeMinor > 0,
        metadata: { reason: params.reason },
      },
      { stripeAccount: params.stripeAccountId },
    );

    const status =
      refund.status === 'succeeded' || refund.status === 'pending' || refund.status === 'failed'
        ? refund.status
        : 'pending';

    return {
      id: refund.id,
      status,
      amountMinor: refund.amount ?? params.amountMinor,
    };
  }
}
