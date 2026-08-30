import { DomainCreateSchema } from '@oss-tips/api-contracts';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import {
  domainResponse,
  getCloudflareClient,
  markModeGrace,
  providerFailure,
  providerFields,
} from '$lib/server/domain-runtime';
import { isFivePercentMode, normalizeCustomHostname } from '$lib/server/custom-domains';
import { json } from '$lib/server/http';

async function syncGrace(db: ReturnType<typeof getDb>, projectId: string, mode: string | null) {
  const rows = await db
    .selectFrom('custom_domain')
    .selectAll()
    .where('project_id', '=', projectId)
    .where('status', '<>', 'removed')
    .execute();
  if (isFivePercentMode(mode)) return rows;
  const updated = [];
  for (const row of rows) {
    const next = await markModeGrace(db, row, mode);
    updated.push(next ?? row);
  }
  return updated;
}

async function currentMode(db: ReturnType<typeof getDb>, projectId: string) {
  return (
    (
      await db
        .selectFrom('project_feature_mode')
        .select('mode')
        .where('project_id', '=', projectId)
        .executeTakeFirst()
    )?.mode ?? null
  );
}

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_domain', 'project:read');
  if (access instanceof Response) return access;
  const mode = await currentMode(db, access.projectId);
  const rows = await syncGrace(db, access.projectId, mode);
  return json(rows.map(domainResponse), { headers: { 'cache-control': 'private, no-store' } });
};

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_domain', 'project:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  if (!isFivePercentMode(await currentMode(db, access.projectId))) {
    return problem(403, 'Custom domains require 5% contribution mode');
  }
  const body = await readJson(event.request, DomainCreateSchema);
  if (body instanceof Response) return body;
  const hostname = normalizeCustomHostname(body.hostname);
  if (!hostname.ok) return problem(400, 'Invalid custom domain', hostname.reason);

  const pendingRemoval = await db
    .selectFrom('custom_domain')
    .select(['provider_id', 'retry_at'])
    .where('hostname', '=', hostname.hostname)
    .where('status', '=', 'removed')
    .executeTakeFirst();
  if (pendingRemoval?.provider_id || pendingRemoval?.retry_at) {
    return problem(409, 'Custom domain removal is still pending');
  }

  const existing = await db
    .selectFrom('custom_domain')
    .selectAll()
    .where('project_id', '=', access.projectId)
    .where('status', '<>', 'removed')
    .executeTakeFirst();
  if (existing) {
    if (existing.hostname === hostname.hostname) {
      if (existing.provider_id) {
        try {
          const remote = await getCloudflareClient().get(existing.provider_id);
          const updated = await db.transaction().execute(async (trx) => {
            const refreshed = await trx
              .updateTable('custom_domain')
              .set({ ...providerFields(remote), grace_until: null })
              .where('id', '=', existing.id)
              .where('project_id', '=', access.projectId)
              .where('provider_id', '=', existing.provider_id)
              .where('status', '<>', 'removed')
              .returningAll()
              .executeTakeFirst();
            if (!refreshed) return null;
            await trx
              .insertInto('audit_event')
              .values(
                auditRecord(
                  event,
                  { type: 'user', userId: access.userId },
                  {
                    action: 'domain.refreshed',
                    resourceType: 'custom_domain',
                    resourceId: refreshed.id,
                    projectId: access.projectId,
                    metadata: { hostname: refreshed.hostname },
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
                payload: {
                  project_id: access.projectId,
                  domain_id: refreshed.id,
                  change: 'refreshed',
                },
                published_at: null,
              })
              .execute();
            return refreshed;
          });
          if (!updated) return problem(404, 'Custom domain not found');
          return json(domainResponse(updated), { headers: { 'cache-control': 'no-store' } });
        } catch (error) {
          const failure = providerFailure(error);
          const updated = await db.transaction().execute(async (trx) => {
            const refreshed = await trx
              .updateTable('custom_domain')
              .set({
                ...(failure.status === 'removed' ? { provider_id: null } : {}),
                status: failure.status,
                canonical_enabled: false,
                last_error: failure.message,
                retry_at: failure.status === 'failed' ? new Date(Date.now() + 5 * 60_000) : null,
                updated_at: new Date(),
              })
              .where('id', '=', existing.id)
              .where('project_id', '=', access.projectId)
              .where('provider_id', '=', existing.provider_id)
              .where('status', '<>', 'removed')
              .returningAll()
              .executeTakeFirst();
            if (!refreshed) return null;
            await trx
              .insertInto('audit_event')
              .values(
                auditRecord(
                  event,
                  { type: 'user', userId: access.userId },
                  {
                    action: 'domain.refresh_failed',
                    resourceType: 'custom_domain',
                    resourceId: refreshed.id,
                    projectId: access.projectId,
                    metadata: { hostname: refreshed.hostname, status: refreshed.status },
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
                payload: {
                  project_id: access.projectId,
                  domain_id: refreshed.id,
                  change: 'refresh_failed',
                },
                published_at: null,
              })
              .execute();
            return refreshed;
          });
          if (!updated) return problem(404, 'Custom domain not found');
          return json(domainResponse(updated), {
            status: failure.status === 'failed' ? 503 : 200,
            headers: { 'cache-control': 'no-store' },
          });
        }
      }
      return json(domainResponse(existing), { headers: { 'cache-control': 'no-store' } });
    }
    return problem(409, 'Project already has a custom domain');
  }

  const now = new Date();
  let row;
  try {
    row = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('custom_domain')
        .values({
          id: uuidv7(),
          project_id: access.projectId,
          hostname: hostname.hostname,
          status: 'requested',
          ssl_status: null,
          provider_id: null,
          validation_method: 'txt',
          validation_name: null,
          validation_value: null,
          cname_target: null,
          grace_until: null,
          last_error: null,
          retry_at: null,
          canonical_enabled: false,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('job')
        .values({
          id: uuidv7(),
          queue: 'domains',
          kind: 'domain.provision',
          payload: { project_id: access.projectId, domain_id: created.id },
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
              action: 'domain.requested',
              resourceType: 'custom_domain',
              resourceId: created.id,
              projectId: access.projectId,
              metadata: { hostname: created.hostname },
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
          payload: { project_id: access.projectId, domain_id: created.id, change: 'requested' },
          published_at: null,
        })
        .execute();
      return created;
    });
  } catch {
    return problem(409, 'Project already has a custom domain');
  }

  return json(domainResponse(row), { status: 202, headers: { 'cache-control': 'no-store' } });
};
