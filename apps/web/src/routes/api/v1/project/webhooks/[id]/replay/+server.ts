import {
  WebhookEnvelopeSchema,
  WebhookReplayRequestSchema,
  WebhookReplayResponseSchema,
} from '@oss-tips/api-contracts';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_webhooks', 'webhooks:manage');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, WebhookReplayRequestSchema);
  if (body instanceof Response) return body;

  const endpoint = await db
    .selectFrom('webhook_endpoint')
    .select(['id', 'is_active'])
    .where('id', '=', event.params.id)
    .where('project_id', '=', access.projectId)
    .executeTakeFirst();
  if (!endpoint) return problem(404, 'Webhook endpoint not found');
  if (!endpoint.is_active) return problem(409, 'Webhook endpoint is disabled');

  const original = await db
    .selectFrom('webhook_delivery')
    .select(['id', 'event_id', 'event_type', 'payload'])
    .where('id', '=', body.delivery_id)
    .where('webhook_endpoint_id', '=', endpoint.id)
    .executeTakeFirst();
  if (!original) return problem(404, 'Webhook delivery not found');
  const envelope = WebhookEnvelopeSchema.safeParse(original.payload);
  if (!envelope.success) {
    return problem(409, 'Webhook delivery cannot be replayed', 'Stored payload is invalid');
  }

  const deliveryId = uuidv7();
  const replayEventId = `${original.event_id}:replay:${deliveryId}`;
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('webhook_delivery')
      .values({
        id: deliveryId,
        webhook_endpoint_id: endpoint.id,
        event_id: replayEventId,
        event_type: original.event_type,
        payload: original.payload,
        status: 'pending',
        attempt_count: 0,
        next_attempt_at: new Date(),
        last_response_status: null,
      })
      .execute();
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'webhook.replay_requested',
            resourceType: 'webhook_delivery',
            resourceId: deliveryId,
            projectId: access.projectId,
            metadata: { endpoint_id: endpoint.id, original_delivery_id: original.id },
          },
        ),
      )
      .execute();
  });

  return json(
    WebhookReplayResponseSchema.parse({
      id: deliveryId,
      status: 'queued',
      event_id: envelope.data.id,
    }),
    { status: 202, headers: { 'cache-control': 'no-store' } },
  );
};
