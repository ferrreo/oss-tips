import {
  OutgoingEventTypeSchema,
  WebhookEndpointPatchSchema,
  WebhookEndpointSchema,
} from '@oss-tips/api-contracts';
import { uuidv7, WEBHOOK_API_VERSION } from '@oss-tips/domain';
import { emailNotificationJob } from '@oss-tips/db';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

function endpointPayload(row: {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: Date;
}) {
  return WebhookEndpointSchema.parse({
    id: row.id,
    url: row.url,
    api_version: WEBHOOK_API_VERSION,
    events: row.events.filter((event) => OutgoingEventTypeSchema.safeParse(event).success),
    enabled: row.is_active,
    created_at: row.created_at.toISOString(),
  });
}

function auditActor(access: { source: 'api_key' | 'session'; userId?: string }) {
  return access.source === 'session'
    ? { type: 'user' as const, userId: access.userId }
    : { type: 'api_key' as const };
}

export const PATCH: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_webhooks', 'webhooks:manage');
  if (access instanceof Response) return access;
  const body = await readJson(event.request, WebhookEndpointPatchSchema);
  if (body instanceof Response) return body;
  const row = await db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('webhook_endpoint')
      .set({ is_active: body.enabled, updated_at: new Date() })
      .where('id', '=', event.params.id)
      .where('project_id', '=', access.projectId)
      .returning(['id', 'url', 'events', 'is_active', 'created_at'])
      .executeTakeFirst();
    if (!updated) return undefined;
    const audit = auditRecord(event, auditActor(access), {
      action: body.enabled ? 'webhook.enabled' : 'webhook.disabled',
      resourceType: 'webhook_endpoint',
      resourceId: updated.id,
      projectId: access.projectId,
      metadata: { enabled: body.enabled },
    });
    await trx.insertInto('audit_event').values(audit).execute();
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'project',
        aggregate_id: access.projectId,
        event_type: 'project.updated',
        payload: {
          project_id: access.projectId,
          webhook_endpoint_id: updated.id,
          change: 'status_updated',
        },
        published_at: null,
      })
      .execute();
    await trx
      .insertInto('job')
      .values(
        emailNotificationJob({
          notification: 'webhook-change',
          project_id: access.projectId,
          webhook_endpoint_id: updated.id,
          action: body.enabled ? 'enabled' : 'disabled',
          event_id: audit.id,
        }),
      )
      .execute();
    return updated;
  });
  if (!row) return problem(404, 'Webhook endpoint not found');
  return json(endpointPayload(row), { headers: { 'cache-control': 'private, no-store' } });
};

export const DELETE: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_webhooks', 'webhooks:manage');
  if (access instanceof Response) return access;
  const changed = await db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('webhook_endpoint')
      .set({ is_active: false, updated_at: new Date() })
      .where('id', '=', event.params.id)
      .where('project_id', '=', access.projectId)
      .where('is_active', '=', true)
      .returning('id')
      .executeTakeFirst();
    if (!updated) return false;
    const audit = auditRecord(event, auditActor(access), {
      action: 'webhook.disabled',
      resourceType: 'webhook_endpoint',
      resourceId: updated.id,
      projectId: access.projectId,
    });
    await trx.insertInto('audit_event').values(audit).execute();
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'project',
        aggregate_id: access.projectId,
        event_type: 'project.updated',
        payload: {
          project_id: access.projectId,
          webhook_endpoint_id: updated.id,
          change: 'disabled',
        },
        published_at: null,
      })
      .execute();
    await trx
      .insertInto('job')
      .values(
        emailNotificationJob({
          notification: 'webhook-change',
          project_id: access.projectId,
          webhook_endpoint_id: updated.id,
          action: 'disabled',
          event_id: audit.id,
        }),
      )
      .execute();
    return true;
  });
  if (!changed) return problem(404, 'Webhook endpoint not found');
  return new Response(null, { status: 204 });
};
