import type { RequestHandler } from './$types';
import { emailNotificationJob } from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import { auditRecord, authorizeProject, problem } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';

export const DELETE: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_api_keys', 'webhooks:manage');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const revoked = await db.transaction().execute(async (trx) => {
    const row = await trx
      .updateTable('api_key')
      .set({ revoked_at: new Date() })
      .where('id', '=', event.params.id)
      .where('project_id', '=', access.projectId)
      .where('revoked_at', 'is', null)
      .returning('id')
      .executeTakeFirst();
    if (!row) return false;
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'api_key.revoked',
            resourceType: 'api_key',
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
        payload: { project_id: access.projectId, api_key_id: row.id, change: 'revoked' },
        published_at: null,
      })
      .execute();
    await trx
      .insertInto('job')
      .values(
        emailNotificationJob({
          notification: 'api-key-change',
          project_id: access.projectId,
          api_key_id: row.id,
          action: 'revoked',
        }),
      )
      .execute();
    return true;
  });
  if (!revoked) return problem(404, 'API key not found');
  return new Response(null, { status: 204 });
};
