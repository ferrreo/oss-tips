import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { describe, expect, it } from 'vitest';
import type { Db } from '../client.js';
import type { Database } from '../types.js';
import { createPaymentsRepository } from './payments.js';

function recordingDb(): {
  db: Db;
  queries: Array<{ sql: string; parameters: readonly unknown[] }>;
} {
  const queries: Array<{ sql: string; parameters: readonly unknown[] }> = [];
  const connection = {
    async executeQuery(query: { sql: string; parameters: readonly unknown[] }) {
      queries.push(query);
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
  return { db, queries };
}

describe('payment settlement', () => {
  it('preserves terminal refund and dispute status while filling settlement time', async () => {
    const { db, queries } = recordingDb();

    await createPaymentsRepository(db).markSettled(
      'payment-1',
      new Date('2026-08-30T12:00:00.000Z'),
    );

    const query = queries[0];
    expect(query).toBeDefined();
    expect(query?.sql).toContain("CASE WHEN status IN ('refunded', 'disputed')");
    expect(query?.sql).toContain('COALESCE(settled_at');
    await db.destroy();
  });
});
