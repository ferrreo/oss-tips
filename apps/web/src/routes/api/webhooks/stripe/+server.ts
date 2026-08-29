import {
  acceptStripeEventIntoInbox,
  DURABLE_INBOX_MAX_BODY_BYTES,
  verifyStripeWebhook,
} from '@oss-tips/payments';
import { createStripeEventsRepository, type JsonValue } from '@oss-tips/db';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json, problem } from '$lib/server/http';

function asJsonValue(value: Record<string, unknown>): JsonValue {
  return value as JsonValue;
}

/**
 * Durable Stripe inbox: verify signature, size-limit, insert unique event, return 2xx.
 * Finance work happens asynchronously in the finance-worker.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!hasDatabaseUrl()) {
    return problem(503, 'Database unavailable', 'DATABASE_URL is required for webhook durability');
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return problem(400, 'Missing Stripe signature', 'stripe-signature header is required');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return problem(503, 'Webhook secret unset', 'STRIPE_WEBHOOK_SECRET is required');
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  if (rawBody.byteLength > DURABLE_INBOX_MAX_BODY_BYTES) {
    return problem(413, 'Payload too large');
  }

  let event;
  try {
    event = verifyStripeWebhook({
      rawBody,
      signatureHeader: signature,
      webhookSecret,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Signature verification failed';
    return problem(400, 'Invalid Stripe signature', detail);
  }

  const db = getDb();
  const repo = createStripeEventsRepository(db);

  const result = await acceptStripeEventIntoInbox({
    event,
    rawBodyByteLength: rawBody.byteLength,
    store: {
      async insertIfNew(row) {
        const inserted = await repo.insertIfNew({
          id: row.id,
          stripe_event_id: row.stripe_event_id,
          stripe_account_id: row.stripe_account_id,
          event_type: row.event_type,
          api_version: row.api_version,
          payload: asJsonValue(row.payload),
          processed_at: null,
          process_error: null,
        });
        if (!inserted) {
          throw new Error('Failed to persist stripe_event');
        }
        return {
          created: inserted.created,
          stripeEventId: inserted.event.stripe_event_id,
        };
      },
    },
  });

  if (result.kind === 'rejected') {
    return problem(result.status, result.title, result.detail);
  }

  return json(
    {
      received: true,
      stripe_event_id: result.stripeEventId,
      type: result.type,
      created: result.created,
      inbox: 'durable',
    },
    { status: 202 },
  );
};
