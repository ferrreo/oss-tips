import { describe, expect, it } from 'vitest';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { down, up } from './migrations/026_project_lifecycle.js';

function recordingDb(): { db: Kysely<unknown>; queries: string[] } {
  const queries: string[] = [];
  const connection = {
    async executeQuery(query: { sql: string }) {
      queries.push(query.sql);
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
  const db = new Kysely<unknown>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver as never,
      createIntrospector: (database) => new PostgresIntrospector(database),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  return { db, queries };
}

describe('project lifecycle migration', () => {
  it('adds and removes the nullable closure timestamp', async () => {
    const applied = recordingDb();
    await up(applied.db);
    expect(applied.queries.join('\n')).toContain('ADD COLUMN IF NOT EXISTS closed_at timestamptz');
    await applied.db.destroy();

    const rolledBack = recordingDb();
    await down(rolledBack.db);
    expect(rolledBack.queries.join('\n')).toContain('DROP COLUMN IF EXISTS closed_at');
    await rolledBack.db.destroy();
  });
});
