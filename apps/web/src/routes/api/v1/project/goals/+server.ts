import { ProjectGoalCreateSchema, ProjectGoalSchema } from '@oss-tips/api-contracts';
import {
  ActivePublishedGoalLimitError,
  lockAndAssertPublishedGoalCapacity,
  type ProjectGoal,
} from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { toGoal } from '../../../public-api';

const COUNT_GOALS = new Set(['supporter_count', 'active_supporter_count']);

function basisFor(goalType: string): string {
  if (goalType === 'calendar_month_money') return 'calendar_month';
  if (goalType === 'mrr' || goalType === 'recurring_money') return 'mrr';
  if (COUNT_GOALS.has(goalType)) return 'active_supporters';
  return 'settled_project_support';
}

export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const access = await authorizeProject(event, getDb(), 'project.manage_goals', 'goals:read');
  if (access instanceof Response) return access;
  const rows = await getDb()
    .selectFrom('project_goal')
    .selectAll()
    .where('project_id', '=', access.projectId)
    .orderBy('created_at', 'asc')
    .execute();
  return json(
    rows.map((row) => ProjectGoalSchema.parse(toGoal(row))),
    {
      headers: { 'cache-control': 'private, no-store' },
    },
  );
};

export const POST: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_goals', 'goals:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, ProjectGoalCreateSchema);
  if (body instanceof Response) return body;
  const project = await db
    .selectFrom('project')
    .select(['default_currency'])
    .where('id', '=', access.projectId)
    .executeTakeFirst();
  if (!project) return problem(404, 'Project not found');
  const isCount = COUNT_GOALS.has(body.goal_type);
  const currency = body.currency?.toLowerCase() ?? project.default_currency.toLowerCase();
  if (!isCount && body.currency && currency !== project.default_currency.toLowerCase()) {
    return problem(
      400,
      'Invalid goal currency',
      `Use ${project.default_currency.toLowerCase()} for this project`,
    );
  }
  const status = body.status;
  let row: ProjectGoal;
  try {
    row = await db.transaction().execute(async (trx) => {
      if (status === 'published') await lockAndAssertPublishedGoalCapacity(trx, access.projectId);
      const goal = await trx
        .insertInto('project_goal')
        .values({
          id: uuidv7(),
          project_id: access.projectId,
          goal_type: body.goal_type,
          target_minor: isCount ? null : (body.target_minor ?? null),
          target_count: isCount ? (body.target_count ?? null) : null,
          currency: isCount ? null : currency,
          title: body.title,
          is_active: status === 'published',
          status,
          deadline: body.deadline ? new Date(body.deadline) : null,
          basis: body.basis ?? basisFor(body.goal_type),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'goal.created',
              resourceType: 'project_goal',
              resourceId: goal.id,
              projectId: access.projectId,
              metadata: { goal_type: goal.goal_type, status: goal.status },
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
          payload: { project_id: access.projectId, goal_id: goal.id, change: 'created' },
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
    status: 201,
    headers: { 'cache-control': 'private, no-store' },
  });
};
