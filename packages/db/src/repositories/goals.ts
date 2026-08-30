import type { Db } from '../client.js';
import type { NewProjectGoal, ProjectGoal } from '../types.js';

export const MAX_ACTIVE_PUBLISHED_GOALS = 3;

export class ActivePublishedGoalLimitError extends Error {
  constructor() {
    super(`A project can have at most ${MAX_ACTIVE_PUBLISHED_GOALS} active published goals`);
    this.name = 'ActivePublishedGoalLimitError';
  }
}

/**
 * Serialize published-goal transitions for one project and enforce its cap.
 * Passing a goal id makes publishing an already-active goal idempotent.
 */
export async function lockAndAssertPublishedGoalCapacity(
  db: Db,
  projectId: string,
  goalId?: string,
): Promise<boolean> {
  await db
    .selectFrom('project')
    .select('id')
    .where('id', '=', projectId)
    .forUpdate()
    .executeTakeFirstOrThrow();

  if (goalId) {
    const current = await db
      .selectFrom('project_goal')
      .select(['status', 'is_active'])
      .where('id', '=', goalId)
      .where('project_id', '=', projectId)
      .executeTakeFirst();
    if (current?.status === 'published' && current.is_active) return true;
  }

  const active = await db
    .selectFrom('project_goal')
    .select('id')
    .where('project_id', '=', projectId)
    .where('status', '=', 'published')
    .where('is_active', '=', true)
    .execute();
  if (active.length >= MAX_ACTIVE_PUBLISHED_GOALS) {
    throw new ActivePublishedGoalLimitError();
  }
  return false;
}

export function createGoalsRepository(db: Db) {
  return {
    async findById(id: string): Promise<ProjectGoal | undefined> {
      return db.selectFrom('project_goal').selectAll().where('id', '=', id).executeTakeFirst();
    },

    async listActiveByProject(projectId: string): Promise<ProjectGoal[]> {
      return db
        .selectFrom('project_goal')
        .selectAll()
        .where('project_id', '=', projectId)
        .where('is_active', '=', true)
        .orderBy('created_at', 'asc')
        .execute();
    },

    async create(goal: NewProjectGoal): Promise<ProjectGoal> {
      return db.transaction().execute(async (trx) => {
        // Generated status defaults to published, so treat an omitted status as published.
        if ((goal.status ?? 'published') === 'published' && goal.is_active) {
          await lockAndAssertPublishedGoalCapacity(trx, goal.project_id);
        }
        return trx.insertInto('project_goal').values(goal).returningAll().executeTakeFirstOrThrow();
      });
    },

    async deactivate(id: string): Promise<ProjectGoal | undefined> {
      return db
        .updateTable('project_goal')
        .set({ is_active: false, updated_at: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },
  };
}

export type GoalsRepository = ReturnType<typeof createGoalsRepository>;
