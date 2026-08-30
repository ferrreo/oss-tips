import { describe, expect, it } from 'vitest';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import type { Db } from '../client.js';
import type { Database } from '../types.js';
import { countCurrentEntitlementSupporters, listCurrentForProject } from './entitlements.js';

function recordingDb(): { db: Db; query: () => string } {
  let lastQuery = '';
  const connection = {
    async executeQuery(input: { sql: string }) {
      lastQuery = input.sql;
      return { rows: [] };
    },
    async *streamQuery() {
      yield { rows: [] };
    },
  };
  const driver = {
    async init() {},
    async acquireConnection() {
      return connection;
    },
    async beginTransaction() {},
    async commitTransaction() {},
    async rollbackTransaction() {},
    async releaseConnection() {},
    async destroy() {},
  };
  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver as never,
      createIntrospector: (database) => new PostgresIntrospector(database),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  }) as unknown as Db;
  return { db, query: () => lastQuery };
}

describe('current project entitlements', () => {
  it('queries current one-offs and active or grace memberships without payment rows', async () => {
    const { db, query } = recordingDb();

    await expect(
      listCurrentForProject(db, 'project-1', new Date('2026-08-30T00:00:00.000Z')),
    ).resolves.toEqual([]);

    expect(query()).toContain('left join "subscription"');
    expect(query()).toContain('"entitlement"."kind" = $');
    expect(query()).toContain('"subscription"."status" in');
    expect(query()).not.toContain('payment');
    await db.destroy();
  });

  it('deduplicates membership entitlements while keeping anonymous one-offs distinct', () => {
    expect(
      countCurrentEntitlementSupporters([
        { id: 'membership-a', user_id: 'user-1' },
        { id: 'membership-b', user_id: 'user-1' },
        { id: 'one-off-a', user_id: 'user-2' },
        { id: 'one-off-guest-a', user_id: null },
        { id: 'one-off-guest-b', user_id: null },
      ]),
    ).toBe(4);
  });
});
