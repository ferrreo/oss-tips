import { ExportRequestSchema } from '@oss-tips/api-contracts';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.export_finance', 'analytics:read');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, ExportRequestSchema);
  if (body instanceof Response) return body;
  const now = new Date();
  const id = uuidv7();
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('job')
      .values({
        id,
        queue: 'exports',
        kind: 'project.export',
        payload: { project_id: access.projectId, kind: body.kind, format: body.format },
        status: 'pending',
        attempt_count: 0,
        max_attempts: 5,
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
            action: 'project.export_requested',
            resourceType: 'project',
            resourceId: access.projectId,
            projectId: access.projectId,
            metadata: { kind: body.kind, format: body.format, job_id: id },
          },
        ),
      )
      .execute();
  });
  return json({ id, status: 'queued' }, { status: 202, headers: { 'cache-control': 'no-store' } });
};
