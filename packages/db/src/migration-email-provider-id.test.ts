import { describe, expect, it } from 'vitest';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { down, up } from './migrations/019_email_delivery_provider_identity.js';

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

describe('email delivery provider identity migration', () => {
  it('uniquely indexes non-null provider IDs and rolls back cleanly', async () => {
    const applied = recordingDb();
    await up(applied.db);
    const upSql = applied.queries.join('\n');
    expect(upSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS email_delivery_provider_id_unique');
    expect(upSql).toContain('ON email_delivery (provider_id)');
    expect(upSql).toContain('WHERE provider_id IS NOT NULL');
    await applied.db.destroy();

    const rolledBack = recordingDb();
    await down(rolledBack.db);
    expect(rolledBack.queries.join('\n')).toContain(
      'DROP INDEX IF EXISTS email_delivery_provider_id_unique',
    );
    await rolledBack.db.destroy();
  });
});
