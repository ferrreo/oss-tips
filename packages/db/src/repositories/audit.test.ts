import { describe, expect, it } from 'vitest';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import type { Db } from '../client.js';
import type { Database } from '../types.js';
import { createAuditRepository } from './audit.js';

function recordingDb(rows: unknown[] = []): { db: Db; queries: string[] } {
  const queries: string[] = [];
  const connection = {
    async executeQuery(query: { sql: string }) {
      queries.push(query.sql);
      return { rows };
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

describe('audit repository', () => {
  it('writes the canonical redacted append-only columns', async () => {
    const row = {
      id: '0198d6e8-0000-7000-8000-000000000001',
      actor_id: null,
      actor_type: 'system',
      session_id: null,
      action: 'post.published',
      resource_type: 'post',
      resource_id: '0198d6e8-0000-7000-8000-000000000002',
      project_id: '0198d6e8-0000-7000-8000-000000000003',
      reason: null,
      ip_hash: null,
      before_hash: null,
      after_hash: null,
      correlation_id: '0198d6e8-0000-7000-8000-000000000004',
      metadata_redacted: { scheduled: true },
      occurred_at: new Date('2026-08-30T12:00:00.000Z'),
    };
    const { db, queries } = recordingDb([row]);

    await expect(
      createAuditRepository(db).record({
        ...row,
        occurred_at: undefined,
      }),
    ).resolves.toEqual(row);

    expect(queries[0]).toContain('"metadata_redacted"');
    expect(queries[0]).toContain('"correlation_id"');
    expect(queries[0]).not.toContain('"ip_address"');
    await db.destroy();
  });
});
