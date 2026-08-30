import { ProjectGoalPublishSchema, ProjectGoalSchema } from '@oss-tips/api-contracts';
import {
  ActivePublishedGoalLimitError,
  lockAndAssertPublishedGoalCapacity,
  type ProjectGoal,
} from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { toGoal } from '../../../../../public-api';

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_goals', 'goals:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, ProjectGoalPublishSchema);
  if (body instanceof Response) return body;
  const current = await db
    .selectFrom('project_goal')
    .selectAll()
    .where('id', '=', event.params.id)
    .where('project_id', '=', access.projectId)
    .executeTakeFirst();
  if (!current || current.status === 'archived') return problem(404, 'Goal not found');
  if (current.target_minor === null && current.target_count === null)
    return problem(400, 'Goal target is required');
  let row: ProjectGoal;
  try {
    row = await db.transaction().execute(async (trx) => {
      const alreadyPublished = await lockAndAssertPublishedGoalCapacity(
        trx,
        access.projectId,
        current.id,
      );
      const goal = await trx
        .updateTable('project_goal')
        .set({ status: 'published', is_active: true, updated_at: new Date() })
        .where('id', '=', current.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      if (alreadyPublished) return goal;
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'goal.published',
              resourceType: 'project_goal',
              resourceId: current.id,
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
          aggregate_type: 'project_goal',
          aggregate_id: access.projectId,
          event_type: 'goal.updated',
          payload: { project_id: access.projectId, goal_id: current.id, change: 'published' },
          published_at: null,
        })
        .execute();
      return goal;
    });
  } catch (error) {
    if (error instanceof ActivePublishedGoalLimitError)
      return problem(
        409,
        'Active goal limit reached',
        'Archive an active goal before publishing another',
      );
    throw error;
  }
  return json(ProjectGoalSchema.parse(toGoal(row)), {
    headers: { 'cache-control': 'private, no-store' },
  });
};
