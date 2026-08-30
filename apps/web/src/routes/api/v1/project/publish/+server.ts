import { ProjectPublishSchema } from '@oss-tips/api-contracts';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import {
  projectSettings,
  publishEligibility,
  readProjectManagement,
  validatePublishEligibility,
} from '../project-management';

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.publish_project', 'project:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, ProjectPublishSchema);
  if (body instanceof Response) return body;

  const result = await db.transaction().execute(async (trx) => {
    const lockedProject = await trx
      .selectFrom('project')
      .select('id')
      .where('id', '=', access.projectId)
      .forUpdate()
      .executeTakeFirst();
    if (!lockedProject) return { kind: 'not_found' as const };

    const current = await readProjectManagement(trx, access.projectId);
    if (!current.project) return { kind: 'not_found' as const };
    const eligibility = validatePublishEligibility(
      publishEligibility(current.project, current.repository, current.claim),
    );
    if (!eligibility.eligible) return { kind: 'ineligible' as const, missing: eligibility.missing };

    const project = current.project;
    if (project.status === 'published') return { kind: 'published' as const };

    await trx
      .updateTable('project')
      .set({ status: 'published', updated_at: new Date() })
      .where('id', '=', access.projectId)
      .execute();
    await trx
      .insertInto('project_status_history')
      .values({
        id: uuidv7(),
        project_id: access.projectId,
        from_status: project.status,
        to_status: 'published',
        reason: 'owner_publish',
        changed_by: access.userId,
      })
      .execute();
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'project.published',
            resourceType: 'project',
            resourceId: access.projectId,
            projectId: access.projectId,
            metadata: { confirmed: body.confirm },
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
        payload: { project_id: access.projectId, change: 'published' },
        published_at: null,
      })
      .execute();
    return { kind: 'published' as const };
  });

  if (result.kind === 'not_found') return problem(404, 'Project not found');
  if (result.kind === 'ineligible') {
    return problem(409, 'Project is not ready to publish', `Missing: ${result.missing.join(', ')}`);
  }

  const settings = await projectSettings(db, access.projectId);
  if (!settings) return problem(404, 'Project not found');
  return json(settings, { headers: { 'cache-control': 'private, no-store' } });
};
