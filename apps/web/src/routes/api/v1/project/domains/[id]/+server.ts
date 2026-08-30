import type { RequestHandler } from './$types';
import { uuidv7 } from '@oss-tips/domain';
import { auditRecord, authorizeProject, problem } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import {
  domainResponse,
  getCloudflareClient,
  providerFailure,
  providerFields,
} from '$lib/server/domain-runtime';
import { json } from '$lib/server/http';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function domainFor(db: ReturnType<typeof getDb>, projectId: string, id: string) {
  return db
    .selectFrom('custom_domain')
    .selectAll()
    .where('id', '=', id)
    .where('project_id', '=', projectId)
    .executeTakeFirst();
}

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!UUID.test(event.params.id)) return problem(404, 'Custom domain not found');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_domain', 'project:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const row = await domainFor(db, access.projectId, event.params.id);
  if (!row || row.status === 'removed') return problem(404, 'Custom domain not found');
  if (!row.provider_id) return problem(409, 'Custom domain has not been provisioned');

  let remote;
  try {
    remote = await getCloudflareClient().get(row.provider_id);
  } catch (error) {
    const failure = providerFailure(error);
    const updated = await db.transaction().execute(async (trx) => {
      const next = await trx
        .updateTable('custom_domain')
        .set({
          ...(failure.status === 'removed' ? { provider_id: null } : {}),
          status: failure.status,
          canonical_enabled: false,
          last_error: failure.message,
          retry_at: failure.status === 'failed' ? new Date(Date.now() + 5 * 60_000) : null,
          updated_at: new Date(),
        })
        .where('id', '=', row.id)
        .where('project_id', '=', access.projectId)
        .where('provider_id', '=', row.provider_id)
        .where('status', '<>', 'removed')
        .returningAll()
        .executeTakeFirst();
      if (!next) return null;
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'domain.status_updated',
              resourceType: 'custom_domain',
              resourceId: row.id,
              projectId: access.projectId,
              metadata: { status: next.status, error: next.last_error },
            },
          ),
        )
        .execute();
      await trx
        .insertInto('outbox_event')
        .values({
          id: uuidv7(),
          aggregate_type: 'project',
          aggregate_id: access.projectId,
          event_type: 'project.updated',
          payload: { project_id: access.projectId, domain_id: row.id, change: 'status_updated' },
          published_at: null,
        })
        .execute();
      return next;
    });
    if (!updated) return problem(404, 'Custom domain not found');
    return json(domainResponse(updated), { status: failure.status === 'removed' ? 200 : 503 });
  }

  const updated = await db.transaction().execute(async (trx) => {
    const next = await trx
      .updateTable('custom_domain')
      .set({ ...providerFields(remote), grace_until: null })
      .where('id', '=', row.id)
      .where('project_id', '=', access.projectId)
      .where('provider_id', '=', row.provider_id)
      .where('status', '<>', 'removed')
      .returningAll()
      .executeTakeFirst();
    if (!next) return null;
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'domain.status_updated',
            resourceType: 'custom_domain',
            resourceId: row.id,
            projectId: access.projectId,
            metadata: { status: next.status },
          },
        ),
      )
      .execute();
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'project',
        aggregate_id: access.projectId,
        event_type: 'project.updated',
        payload: { project_id: access.projectId, domain_id: row.id, change: 'status_updated' },
        published_at: null,
      })
      .execute();
    return next;
  });
  if (!updated) return problem(404, 'Custom domain not found');
  return json(domainResponse(updated), { headers: { 'cache-control': 'no-store' } });
};

export const DELETE: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!UUID.test(event.params.id)) return problem(404, 'Custom domain not found');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_domain', 'project:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const row = await domainFor(db, access.projectId, event.params.id);
  if (!row) return problem(404, 'Custom domain not found');
  if (row.status === 'removed') return new Response(null, { status: 204 });
  const now = new Date();
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('custom_domain')
      .set({
        status: 'removed',
        canonical_enabled: false,
        retry_at: now,
        last_error: null,
        updated_at: now,
      })
      .where('id', '=', row.id)
      .execute();
    await trx
      .insertInto('job')
      .values({
        id: uuidv7(),
        queue: 'domains',
        kind: 'domain.delete',
        payload: {
          project_id: access.projectId,
          domain_id: row.id,
          ...(row.provider_id ? { provider_id: row.provider_id } : {}),
        },
        status: 'pending',
        attempt_count: 0,
        max_attempts: 10,
        run_at: now,
        locked_at: null,
        locked_by: null,
        last_error: null,
      })
      .execute();
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'domain.removed',
            resourceType: 'custom_domain',
            resourceId: row.id,
            projectId: access.projectId,
          },
        ),
      )
      .execute();
    await trx
      .insertInto('outbox_event')
      .values({
        id: uuidv7(),
        aggregate_type: 'project',
        aggregate_id: access.projectId,
        event_type: 'project.updated',
        payload: { project_id: access.projectId, domain_id: row.id, change: 'removed' },
        published_at: null,
      })
      .execute();
  });
  return new Response(null, { status: 204 });
};
