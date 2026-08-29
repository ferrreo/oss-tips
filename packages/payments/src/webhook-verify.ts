import Stripe from 'stripe';

export type VerifiedStripeEvent = {
  id: string;
  type: string;
  apiVersion: string | null;
  account: string | null;
  payload: Record<string, unknown>;
};

/**
 * Verify a Stripe webhook signature and return a normalised event.
 * Call only at the HTTP boundary with the raw request body.
 */
export function verifyStripeWebhook(args: {
  rawBody: string | Buffer;
  signatureHeader: string;
  webhookSecret: string;
}): VerifiedStripeEvent {
  const event = Stripe.webhooks.constructEvent(
    args.rawBody,
    args.signatureHeader,
    args.webhookSecret,
  );

  return {
    id: event.id,
    type: event.type,
    apiVersion: event.api_version ?? null,
    account: typeof event.account === 'string' ? event.account : null,
    payload: event as unknown as Record<string, unknown>,
  };
}

/** Build a Stripe-compatible test signature header for local fixtures. */
export function signStripeWebhookPayload(args: {
  rawBody: string;
  webhookSecret: string;
  timestamp?: number;
}): string {
  if (args.timestamp !== undefined) {
    return Stripe.webhooks.generateTestHeaderString({
      payload: args.rawBody,
      secret: args.webhookSecret,
      timestamp: args.timestamp,
    });
  }
  return Stripe.webhooks.generateTestHeaderString({
    payload: args.rawBody,
    secret: args.webhookSecret,
  });
}
