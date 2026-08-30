import {
  createEmailDeliveriesRepository,
  type EmailDeliveryStatus,
  type EmailSuppressionReason,
} from '@oss-tips/db';
import { verifyResendWebhook } from '@oss-tips/email';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json, problem } from '$lib/server/http';
import {
  parseUploadContentLength,
  readBoundedUploadBody,
  UploadBodyLengthMismatchError,
  UploadBodyTooLargeError,
} from '$lib/server/storage';
import { RESEND_WEBHOOK_MAX_BODY_BYTES } from './resend-webhook';

const STATUS_BY_EVENT: Record<string, EmailDeliveryStatus | undefined> = {
  'email.scheduled': 'pending',
  'email.sent': 'sent',
  'email.delivery_delayed': 'delayed',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'suppressed',
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedAddresses(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function suppressionForEvent(
  eventType: string,
  data: RecordValue,
): { reason: EmailSuppressionReason; emailAddresses: string[] } | undefined {
  if (eventType === 'email.suppressed') {
    return { reason: 'provider', emailAddresses: normalizedAddresses(data.to) };
  }
  if (eventType === 'email.complained') {
    return { reason: 'complaint', emailAddresses: normalizedAddresses(data.to) };
  }
  if (eventType !== 'email.bounced' || !isRecord(data.bounce)) return undefined;
  return typeof data.bounce.type === 'string' && data.bounce.type.toLowerCase() === 'permanent'
    ? { reason: 'bounce', emailAddresses: normalizedAddresses(data.to) }
    : undefined;
}

/** Durable Resend webhook: verify raw body, then reconcile lifecycle asynchronously-safe. */
export const POST: RequestHandler = async ({ request }) => {
  if (!hasDatabaseUrl()) {
    return problem(503, 'Database unavailable', 'DATABASE_URL is required for webhook durability');
  }

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return problem(503, 'Webhook secret unset', 'RESEND_WEBHOOK_SECRET is required');
  }

  const signatureHeaders = {
    id: request.headers.get('svix-id') ?? '',
    timestamp: request.headers.get('svix-timestamp') ?? '',
    signature: request.headers.get('svix-signature') ?? '',
  };
  if (!signatureHeaders.id || !signatureHeaders.timestamp || !signatureHeaders.signature) {
    return problem(
      400,
      'Missing Resend signature',
      'Resend webhook signature headers are required',
    );
  }

  let contentLength: number | undefined;
  try {
    contentLength = parseUploadContentLength(request.headers.get('content-length'));
  } catch (err) {
    return problem(400, 'Invalid Content-Length', err instanceof Error ? err.message : undefined);
  }
  if (contentLength !== undefined && contentLength > RESEND_WEBHOOK_MAX_BODY_BYTES) {
    return problem(413, 'Payload too large');
  }

  let rawBody: Buffer;
  try {
    rawBody = Buffer.from(
      await readBoundedUploadBody(request, RESEND_WEBHOOK_MAX_BODY_BYTES, contentLength),
    );
  } catch (err) {
    if (err instanceof UploadBodyTooLargeError) return problem(413, 'Payload too large');
    if (err instanceof UploadBodyLengthMismatchError) {
      return problem(400, 'Payload length mismatch');
    }
    return problem(400, 'Invalid request body');
  }

  let event: unknown;
  try {
    event = verifyResendWebhook({
      payload: rawBody,
      headers: signatureHeaders,
      webhookSecret,
    });
  } catch {
    return problem(400, 'Invalid Resend signature');
  }

  if (!isRecord(event) || typeof event.type !== 'string') {
    return problem(400, 'Invalid Resend webhook');
  }

  const status = STATUS_BY_EVENT[event.type];
  if (!status) return json({ received: true, processed: false }, { status: 202 });
  if (!isRecord(event.data) || typeof event.data.email_id !== 'string') {
    return problem(400, 'Invalid Resend email event');
  }
  const occurredAt = new Date(
    typeof event.created_at === 'string' ? event.created_at : String(event.created_at ?? ''),
  );
  if (Number.isNaN(occurredAt.getTime())) {
    return problem(400, 'Invalid Resend event timestamp');
  }

  const suppression = suppressionForEvent(event.type, event.data);
  const result = await createEmailDeliveriesRepository(getDb()).recordProviderEvent({
    providerEventId: signatureHeaders.id,
    providerEmailId: event.data.email_id,
    eventType: event.type,
    status,
    occurredAt,
    ...(suppression ? { suppression } : {}),
  });

  return json(
    {
      received: true,
      processed: true,
      duplicate: !result.created,
      matched: Boolean(result.deliveryId),
    },
    { status: 202 },
  );
};
