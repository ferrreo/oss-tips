/** Stripe Connect webhook event allowlist (docs §8). Versioned in code. */
export const STRIPE_WEBHOOK_EVENT_TYPES = [
  'account.updated',
  'account.application.deauthorized',
  'checkout.session.completed',
  'payment_intent.processing',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.succeeded',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.created',
  'invoice.finalized',
  'invoice.finalization_failed',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'payout.failed',
] as const;

export type StripeWebhookEventType = (typeof STRIPE_WEBHOOK_EVENT_TYPES)[number];

export type StripeWebhookEventKind =
  'account' | 'checkout' | 'payment' | 'refund' | 'dispute' | 'subscription' | 'invoice' | 'payout';

export type StripeWebhookClassification = {
  accepted: boolean;
  kind: StripeWebhookEventKind | 'unsupported';
  type: string;
  objectId?: string | undefined;
};

const EVENT_KIND_BY_TYPE: Record<StripeWebhookEventType, StripeWebhookEventKind> = {
  'account.updated': 'account',
  'account.application.deauthorized': 'account',
  'checkout.session.completed': 'checkout',
  'payment_intent.processing': 'payment',
  'payment_intent.succeeded': 'payment',
  'payment_intent.payment_failed': 'payment',
  'charge.succeeded': 'payment',
  'charge.refunded': 'refund',
  'charge.dispute.created': 'dispute',
  'charge.dispute.updated': 'dispute',
  'charge.dispute.closed': 'dispute',
  'customer.subscription.created': 'subscription',
  'customer.subscription.updated': 'subscription',
  'customer.subscription.deleted': 'subscription',
  'invoice.created': 'invoice',
  'invoice.finalized': 'invoice',
  'invoice.finalization_failed': 'invoice',
  'invoice.paid': 'invoice',
  'invoice.payment_failed': 'invoice',
  'invoice.payment_action_required': 'invoice',
  'payout.failed': 'payout',
};

export function isAllowedStripeWebhookEvent(type: string): type is StripeWebhookEventType {
  return (STRIPE_WEBHOOK_EVENT_TYPES as readonly string[]).includes(type);
}

export function classifyStripeWebhookEvent(input: {
  type: string;
  objectId?: string | undefined;
}): StripeWebhookClassification {
  if (!isAllowedStripeWebhookEvent(input.type)) {
    return { accepted: false, kind: 'unsupported', type: input.type };
  }
  return {
    accepted: true,
    kind: EVENT_KIND_BY_TYPE[input.type],
    type: input.type,
    ...(input.objectId ? { objectId: input.objectId } : {}),
  };
}

export type StripeEventOrder = {
  id: string;
  createdAt?: number | undefined;
};

/** Deterministic event ordering for workers that receive Stripe events out of order. */
export function compareStripeEventOrder(a: StripeEventOrder, b: StripeEventOrder): -1 | 0 | 1 {
  const createdA = a.createdAt ?? 0;
  const createdB = b.createdAt ?? 0;
  if (createdA !== createdB) return createdA < createdB ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export function isStripeEventNewer(
  incoming: StripeEventOrder,
  current?: StripeEventOrder,
): boolean {
  return current === undefined || compareStripeEventOrder(incoming, current) > 0;
}
