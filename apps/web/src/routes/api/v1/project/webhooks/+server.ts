import {
  OutgoingEventTypeSchema,
  WebhookEndpointCreateSchema,
  WebhookEndpointCreatedSchema,
  WebhookEndpointSchema,
} from '@oss-tips/api-contracts';
import { createWebhookSecret } from '@oss-tips/api-contracts/security';
import { WEBHOOK_API_VERSION, uuidv7 } from '@oss-tips/domain';
import { emailNotificationJob } from '@oss-tips/db';
import type { RequestHandler } from './$types';
import {
  authorizeProject,
  auditRecord,
  encryptWebhookSecretForStorage,
  readJson,
  validateWebhookUrl,
} from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json, problem } from '$lib/server/http';

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

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_webhooks', 'webhooks:manage');
  if (access instanceof Response) return access;
  const rows = await db
    .selectFrom('webhook_endpoint')
    .select(['id', 'url', 'events', 'is_active', 'created_at'])
    .where('project_id', '=', access.projectId)
    .orderBy('created_at', 'desc')
    .execute();
  return json(rows.map(endpointPayload));
};

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_webhooks', 'webhooks:manage');
  if (access instanceof Response) return access;
  const parsed = await readJson(event.request, WebhookEndpointCreateSchema);
  if (parsed instanceof Response) return parsed;
  if (parsed.api_version !== WEBHOOK_API_VERSION) {
    return problem(
      400,
      'Unsupported webhook API version',
      `Use ${WEBHOOK_API_VERSION} for new endpoints`,
    );
  }
  const destination = await validateWebhookUrl(parsed.url);
  if ('error' in destination) return destination.error;

  const secret = createWebhookSecret();
  const encryptedSecret = encryptWebhookSecretForStorage(secret);
  if (encryptedSecret instanceof Response) return encryptedSecret;
  const row = await db.transaction().execute(async (trx) => {
    const created = await trx
      .insertInto('webhook_endpoint')
      .values({
        id: uuidv7(),
        project_id: access.projectId,
        url: destination.url.toString(),
        secret_hash: encryptedSecret,
        events: parsed.events,
        is_active: true,
      })
      .returning(['id', 'url', 'events', 'is_active', 'created_at'])
      .executeTakeFirstOrThrow();
    const audit = auditRecord(
      event,
      access.source === 'session' ? { type: 'user', userId: access.userId } : { type: 'api_key' },
      {
        action: 'webhook.created',
        resourceType: 'webhook_endpoint',
        resourceId: created.id,
        projectId: access.projectId,
        metadata: { url: created.url, events: created.events },
      },
    );
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
          webhook_endpoint_id: created.id,
          change: 'created',
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
          webhook_endpoint_id: created.id,
          action: 'created',
          event_id: audit.id,
        }),
      )
      .execute();
    return created;
  });

  const response = WebhookEndpointCreatedSchema.parse({ ...endpointPayload(row), secret });
  return json(response, { status: 201, headers: { 'cache-control': 'no-store' } });
};
