import type { Db } from '../client.js';
import type { NewProjectGoal, ProjectGoal } from '../types.js';

export function createGoalsRepository(db: Db) {
  return {
    async findById(id: string): Promise<ProjectGoal | undefined> {
      return db
        .selectFrom('project_goal')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst();
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
      return db
        .insertInto('project_goal')
        .values(goal)
        .returningAll()
        .executeTakeFirstOrThrow();
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
