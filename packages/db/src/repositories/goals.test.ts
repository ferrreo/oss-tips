import { describe, expect, it } from 'vitest';
import type { Db } from '../client.js';
import {
  ActivePublishedGoalLimitError,
  lockAndAssertPublishedGoalCapacity,
  MAX_ACTIVE_PUBLISHED_GOALS,
} from './goals.js';

type FakeGoal = { id: string; project_id: string; status: string; is_active: boolean };

class FakeGoalDb {
  private tail = Promise.resolve();

  constructor(
    private readonly projectId: string,
    readonly goals: FakeGoal[],
  ) {}

  transaction() {
    return {
      execute: async <T>(callback: (trx: Db) => Promise<T>): Promise<T> => {
        const previous = this.tail;
        let release!: () => void;
        this.tail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await callback(this as unknown as Db);
        } finally {
          release();
        }
      },
    };
  }

  selectFrom(table: string): any {
    const filters: Array<[string, string, unknown]> = [];
    const query: any = {
      select: () => query,
      where: (column: string, operator: string, value: unknown) => {
        filters.push([column, operator, value]);
        return query;
      },
      forUpdate: () => query,
      executeTakeFirstOrThrow: async () => {
        if (table === 'project') return { id: this.projectId };
        const row = this.filtered(filters).at(0);
        if (!row) throw new Error('missing row');
        return row;
      },
      executeTakeFirst: async () => this.filtered(filters).at(0),
      execute: async () => this.filtered(filters),
    };
    return query;
  }

  private filtered(filters: Array<[string, string, unknown]>): FakeGoal[] {
    return this.goals.filter((goal) =>
      filters.every(([column, operator, value]) => {
        if (column === 'project_id') return value === this.projectId;
        const actual = goal[column as keyof FakeGoal];
        if (operator === '=') return actual === value;
        if (operator === '!=') return actual !== value;
        return true;
      }),
    );
  }
}

describe('published goal capacity', () => {
  it('serializes concurrent publishes so only one fills final slot', async () => {
    const db = new FakeGoalDb('project-1', [
      { id: 'published-1', project_id: 'project-1', status: 'published', is_active: true },
      { id: 'published-2', project_id: 'project-1', status: 'published', is_active: true },
      { id: 'draft-1', project_id: 'project-1', status: 'draft', is_active: false },
      { id: 'draft-2', project_id: 'project-1', status: 'draft', is_active: false },
    ]);

    const publish = (id: string) =>
      db.transaction().execute(async (trx) => {
        await lockAndAssertPublishedGoalCapacity(trx, 'project-1', id);
        const goal = db.goals.find((item) => item.id === id);
        if (!goal) throw new Error('goal missing');
        goal.status = 'published';
        goal.is_active = true;
      });

    const results = await Promise.allSettled([publish('draft-1'), publish('draft-2')]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(db.goals.filter((goal) => goal.status === 'published' && goal.is_active)).toHaveLength(
      MAX_ACTIVE_PUBLISHED_GOALS,
    );
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: expect.any(ActivePublishedGoalLimitError),
    });
  });

  it('allows retrying an already active goal at the cap', async () => {
    const db = new FakeGoalDb('project-1', [
      { id: 'published-1', project_id: 'project-1', status: 'published', is_active: true },
      { id: 'published-2', project_id: 'project-1', status: 'published', is_active: true },
      { id: 'published-3', project_id: 'project-1', status: 'published', is_active: true },
    ]);

    await expect(
      db
        .transaction()
        .execute((trx) => lockAndAssertPublishedGoalCapacity(trx, 'project-1', 'published-1')),
    ).resolves.toBe(true);
  });
});
