import { uuidv7 } from '@oss-tips/domain';
import { isAllowedStripeWebhookEvent } from './webhook-events.js';
import type { VerifiedStripeEvent } from './webhook-verify.js';

export type DurableInboxRow = {
  id: string;
  stripe_event_id: string;
  stripe_account_id: string | null;
  event_type: string;
  api_version: string | null;
  payload: Record<string, unknown>;
};

export type DurableInboxStore = {
  insertIfNew(row: DurableInboxRow): Promise<{ created: boolean; stripeEventId: string }>;
};

export type AcceptDurableInboxResult =
  | { kind: 'accepted'; stripeEventId: string; type: string; created: boolean }
  | { kind: 'rejected'; status: number; title: string; detail?: string };

const MAX_BODY_BYTES = 256 * 1024;

/**
 * Durable Stripe inbox: allowlist + size guard + unique insert.
 * No Stripe retrieval, ledger writes, or side effects.
 */
export async function acceptStripeEventIntoInbox(args: {
  event: VerifiedStripeEvent;
  store: DurableInboxStore;
  rawBodyByteLength: number;
  newId?: () => string;
}): Promise<AcceptDurableInboxResult> {
  if (args.rawBodyByteLength > MAX_BODY_BYTES) {
    return {
      kind: 'rejected',
      status: 413,
      title: 'Payload too large',
      detail: `Webhook body exceeds ${MAX_BODY_BYTES} bytes`,
    };
  }

  if (!isAllowedStripeWebhookEvent(args.event.type)) {
    return {
      kind: 'rejected',
      status: 400,
      title: 'Unsupported event type',
      detail: `Event type ${args.event.type} is not allowlisted`,
    };
  }

  if (!args.event.id) {
    return {
      kind: 'rejected',
      status: 400,
      title: 'Invalid webhook payload',
      detail: 'Expected Stripe event id',
    };
  }

  const row: DurableInboxRow = {
    id: (args.newId ?? uuidv7)(),
    stripe_event_id: args.event.id,
    stripe_account_id: args.event.account,
    event_type: args.event.type,
    api_version: args.event.apiVersion,
    payload: args.event.payload,
  };

  const inserted = await args.store.insertIfNew(row);

  return {
    kind: 'accepted',
    stripeEventId: inserted.stripeEventId,
    type: args.event.type,
    created: inserted.created,
  };
}

export const DURABLE_INBOX_MAX_BODY_BYTES = MAX_BODY_BYTES;
