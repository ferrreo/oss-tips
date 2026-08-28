import { isAllowedStripeWebhookEvent } from '@oss-tips/payments';
import type { RequestHandler } from './$types';
import { json, problem } from '$lib/server/http';

/**
 * Durable inbox stub: accepts Stripe webhook payloads and acknowledges receipt.
 * Production path persists to stripe_event via @oss-tips/db.
 */
export const POST: RequestHandler = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return problem(400, 'Missing Stripe signature', 'stripe-signature header is required');
  }

  let payload: { id?: string; type?: string };
  try {
    payload = (await request.json()) as { id?: string; type?: string };
  } catch {
    return problem(400, 'Invalid JSON body');
  }

  if (!payload.id || !payload.type) {
    return problem(400, 'Invalid webhook payload', 'Expected Stripe event id and type');
  }

  if (!isAllowedStripeWebhookEvent(payload.type)) {
    return problem(400, 'Unsupported event type', `Event type ${payload.type} is not allowlisted`);
  }

  return json(
    {
      received: true,
      stripe_event_id: payload.id,
      type: payload.type,
      inbox: 'durable-stub',
    },
    { status: 202 },
  );
};
