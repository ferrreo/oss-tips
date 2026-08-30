import { describe, expect, it } from 'vitest';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { down, up } from './migrations/027_stripe_event_leases.js';

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

describe('Stripe event lease migration', () => {
  it('adds the processing lease fields and claim index', async () => {
    const applied = recordingDb();
    await up(applied.db);
    const upSql = applied.queries.join('\n');
    expect(upSql).toContain('ADD COLUMN IF NOT EXISTS processing_at timestamptz');
    expect(upSql).toContain('ADD COLUMN IF NOT EXISTS processing_by text');
    expect(upSql).toContain(
      'ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0',
    );
    expect(upSql).toContain('CREATE INDEX IF NOT EXISTS stripe_event_unprocessed_claim_idx');
    await applied.db.destroy();

    const rolledBack = recordingDb();
    await down(rolledBack.db);
    const downSql = rolledBack.queries.join('\n');
    expect(downSql).toContain('DROP INDEX IF EXISTS stripe_event_unprocessed_claim_idx');
    expect(downSql).toContain('DROP COLUMN IF EXISTS processing_attempts');
    expect(downSql).toContain('DROP COLUMN IF EXISTS processing_by');
    expect(downSql).toContain('DROP COLUMN IF EXISTS processing_at');
    await rolledBack.db.destroy();
  });
});
