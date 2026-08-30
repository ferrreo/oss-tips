import { ProjectGoalPatchSchema, ProjectGoalSchema } from '@oss-tips/api-contracts';
import {
  ActivePublishedGoalLimitError,
  lockAndAssertPublishedGoalCapacity,
  type ProjectGoal,
} from '@oss-tips/db';
import { uuidv7 } from '@oss-tips/domain';
import type { RequestHandler } from './$types';
import { auditRecord, authorizeProject, problem, readJson } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { json } from '$lib/server/http';
import { toGoal } from '../../../../public-api';

const COUNT_GOALS = new Set(['supporter_count', 'active_supporter_count']);

function basisFor(goalType: string): string {
  if (goalType === 'calendar_month_money') return 'calendar_month';
  if (goalType === 'mrr' || goalType === 'recurring_money') return 'mrr';
  if (COUNT_GOALS.has(goalType)) return 'active_supporters';
  return 'settled_project_support';
}

export const PATCH: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_goals', 'goals:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const body = await readJson(event.request, ProjectGoalPatchSchema);
  if (body instanceof Response) return body;
  if (Object.keys(body).length === 0) return problem(400, 'Empty goal update');
  const current = await db
    .selectFrom('project_goal')
    .innerJoin('project', 'project.id', 'project_goal.project_id')
    .selectAll('project_goal')
    .select('project.default_currency')
    .where('project_goal.id', '=', event.params.id)
    .where('project_goal.project_id', '=', access.projectId)
    .executeTakeFirst();
  if (!current || current.status === 'archived') return problem(404, 'Goal not found');

  const goalType = body.goal_type ?? current.goal_type;
  const isCount = COUNT_GOALS.has(goalType);
  const targetMinor = body.target_minor === undefined ? current.target_minor : body.target_minor;
  const targetCount = body.target_count === undefined ? current.target_count : body.target_count;
  if (isCount && (!targetCount || targetCount < 1)) return problem(400, 'Target count is required');
  if (!isCount && (!targetMinor || Number(targetMinor) < 1))
    return problem(400, 'Target amount is required');
  const currency = (body.currency ?? current.currency ?? current.default_currency).toLowerCase();
  if (!isCount && currency !== current.default_currency.toLowerCase()) {
    return problem(
      400,
      'Invalid goal currency',
      `Use ${current.default_currency.toLowerCase()} for this project`,
    );
  }
  const status = body.status ?? current.status;
  const changesTarget =
    body.goal_type !== undefined ||
    body.target_minor !== undefined ||
    body.target_count !== undefined ||
    body.currency !== undefined;

  let row: ProjectGoal;
  try {
    row = await db.transaction().execute(async (trx) => {
      if (status === 'published')
        await lockAndAssertPublishedGoalCapacity(trx, access.projectId, current.id);
      const goal = await trx
        .updateTable('project_goal')
        .set({
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(changesTarget
            ? {
                goal_type: goalType,
                target_minor: isCount ? null : targetMinor,
                target_count: isCount ? targetCount : null,
                currency: isCount ? null : currency,
                basis: body.basis ?? current.basis ?? basisFor(goalType),
              }
            : {}),
          ...(body.deadline !== undefined
            ? { deadline: body.deadline ? new Date(body.deadline) : null }
            : {}),
          ...(body.basis !== undefined ? { basis: body.basis } : {}),
          ...(body.status !== undefined ? { status, is_active: status === 'published' } : {}),
          updated_at: new Date(),
        })
        .where('id', '=', current.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('audit_event')
        .values(
          auditRecord(
            event,
            { type: 'user', userId: access.userId },
            {
              action: 'goal.updated',
              resourceType: 'project_goal',
              resourceId: current.id,
              projectId: access.projectId,
              metadata: { fields: Object.keys(body) },
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
          payload: { project_id: access.projectId, goal_id: current.id, change: 'updated' },
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

export const DELETE: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const db = getDb();
  const access = await authorizeProject(event, db, 'project.manage_goals', 'goals:write');
  if (access instanceof Response) return access;
  if (access.source !== 'session') return problem(403, 'Session required');
  const current = await db
    .selectFrom('project_goal')
    .select(['id', 'status'])
    .where('id', '=', event.params.id)
    .where('project_id', '=', access.projectId)
    .executeTakeFirst();
  if (!current || current.status === 'archived') return problem(404, 'Goal not found');
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('project_goal')
      .set({ status: 'archived', is_active: false, updated_at: new Date() })
      .where('id', '=', current.id)
      .execute();
    await trx
      .insertInto('audit_event')
      .values(
        auditRecord(
          event,
          { type: 'user', userId: access.userId },
          {
            action: 'goal.archived',
            resourceType: 'project_goal',
            resourceId: current.id,
            projectId: access.projectId,
          },
        ),
      )
      .execute();
  });
  return new Response(null, { status: 204 });
};
