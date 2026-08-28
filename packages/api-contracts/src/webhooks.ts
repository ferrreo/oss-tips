import { z } from 'zod';
import { WEBHOOK_API_VERSION, type OutgoingEventType } from '@oss-tips/domain';
import { IdSchema, TimestampSchema } from './money.js';

const outgoingEventTypes = [
  'project.updated',
  'project.payment_status_changed',
  'support.processing',
  'support.succeeded',
  'support.refunded',
  'support.disputed',
  'membership.started',
  'membership.renewed',
  'membership.payment_failed',
  'membership.grace_started',
  'membership.cancelled',
  'membership.expired',
  'entitlement.granted',
  'entitlement.revoked',
  'post.published',
  'goal.updated',
  'supporter.message_received',
  'discord.assignment_failed',
] as const satisfies readonly OutgoingEventType[];

export const OutgoingEventTypeSchema = z.enum(outgoingEventTypes);

export const WebhookEnvelopeSchema = z.object({
  id: IdSchema,
  type: OutgoingEventTypeSchema,
  api_version: z.literal(WEBHOOK_API_VERSION),
  created_at: TimestampSchema,
  project_id: IdSchema,
  data: z.object({
    object: z.record(z.unknown()),
  }),
});

export type WebhookEnvelope = z.infer<typeof WebhookEnvelopeSchema>;

export const WebhookSignatureHeadersSchema = z.object({
  'oss-tips-event-id': z.string(),
  'oss-tips-timestamp': z.string(),
  'oss-tips-signature': z.string().regex(/^v1=[a-f0-9]+$/),
});
