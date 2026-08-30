import Stripe from 'stripe';

const MAX_BODY_BYTES = 256 * 1024;
export const STRIPE_WEBHOOK_MAX_BODY_BYTES = MAX_BODY_BYTES;

export type VerifiedStripeEvent = {
  id: string;
  type: string;
  apiVersion: string | null;
  account: string | null;
  payload: Record<string, unknown>;
  createdAt?: number | undefined;
  objectId?: string | undefined;
  requestId?: string | null | undefined;
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
  if (
    !(typeof args.rawBody === 'string' || Buffer.isBuffer(args.rawBody)) ||
    args.rawBody.length === 0
  ) {
    throw new Error('Webhook payload is required');
  }
  const bodyBytes = Buffer.isBuffer(args.rawBody)
    ? args.rawBody.byteLength
    : Buffer.byteLength(args.rawBody);
  if (bodyBytes > MAX_BODY_BYTES) throw new Error('Webhook body is too large');
  if (typeof args.signatureHeader !== 'string' || args.signatureHeader.length === 0) {
    throw new Error('Stripe signature header is required');
  }
  if (typeof args.webhookSecret !== 'string' || args.webhookSecret.length === 0) {
    throw new Error('Stripe webhook secret is required');
  }

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
    ...(Number.isSafeInteger(event.created) ? { createdAt: event.created } : {}),
    ...(typeof event.data.object === 'object' &&
    event.data.object !== null &&
    'id' in event.data.object &&
    typeof event.data.object.id === 'string'
      ? { objectId: event.data.object.id }
      : {}),
    ...(event.request?.id ? { requestId: event.request.id } : {}),
  };
}

/** Build a Stripe-compatible test signature header for local fixtures. */
export function signStripeWebhookPayload(args: {
  rawBody: string;
  webhookSecret: string;
  timestamp?: number;
}): string {
  if (typeof args.rawBody !== 'string' || args.rawBody.length === 0) {
    throw new Error('Webhook payload is required');
  }
  if (typeof args.webhookSecret !== 'string' || args.webhookSecret.length === 0) {
    throw new Error('Stripe webhook secret is required');
  }
  if (args.timestamp !== undefined) {
    if (!Number.isSafeInteger(args.timestamp) || args.timestamp <= 0) {
      throw new Error('Webhook timestamp is invalid');
    }
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
