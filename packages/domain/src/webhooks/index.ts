import { createHmac, timingSafeEqual } from 'node:crypto';

export const WEBHOOK_API_VERSION = '2026-08-01';

export type OutgoingEventType =
  | 'project.updated'
  | 'project.payment_status_changed'
  | 'support.processing'
  | 'support.succeeded'
  | 'support.refunded'
  | 'support.disputed'
  | 'membership.started'
  | 'membership.renewed'
  | 'membership.payment_failed'
  | 'membership.grace_started'
  | 'membership.cancelled'
  | 'membership.expired'
  | 'entitlement.granted'
  | 'entitlement.revoked'
  | 'post.published'
  | 'goal.updated'
  | 'supporter.message_received'
  | 'discord.assignment_failed';

export type OutgoingEventEnvelope = {
  id: string;
  type: OutgoingEventType;
  api_version: typeof WEBHOOK_API_VERSION;
  created_at: string;
  project_id: string;
  data: { object: Record<string, unknown> };
};

export function signWebhookPayload(args: {
  secret: string;
  timestamp: number;
  rawBody: string;
}): string {
  const signed = `${args.timestamp}.${args.rawBody}`;
  const hex = createHmac('sha256', args.secret).update(signed).digest('hex');
  return `v1=${hex}`;
}

export function verifyWebhookSignature(args: {
  secret: string;
  timestampHeader: string;
  signatureHeader: string;
  rawBody: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): boolean {
  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = args.toleranceSeconds ?? 300;
  const ts = Number(args.timestampHeader);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > tolerance) return false;

  const expected = signWebhookPayload({
    secret: args.secret,
    timestamp: ts,
    rawBody: args.rawBody,
  });

  const a = Buffer.from(expected);
  const b = Buffer.from(args.signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const WEBHOOK_RETRY_SCHEDULE_SECONDS = [
  0, 30, 120, 600, 1800, 7200, 21600, 43200, 43200, 43200, 43200, 43200,
] as const;
