import { describe, expect, it } from 'vitest';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { down, up } from './migrations/017_email_delivery_lifecycle.js';

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

describe('email delivery lifecycle migration', () => {
  it('adds freshness, provider-event dedupe and suppression storage', async () => {
    const { db, queries } = recordingDb();
    await up(db);

    const sql = queries.join('\n');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS updated_at timestamptz');
    expect(sql).toContain('SET updated_at = created_at');
    expect(sql).toContain('ALTER COLUMN updated_at SET NOT NULL');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS email_delivery_event');
    expect(sql).toContain('provider_event_id text NOT NULL UNIQUE');
    expect(sql).toContain('status text NOT NULL');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS email_suppression');
    expect(sql).toContain('email_address text PRIMARY KEY');
    expect(sql).not.toContain('payload jsonb');
    await db.destroy();
  });

  it('drops only lifecycle objects on rollback', async () => {
    const { db, queries } = recordingDb();
    await down(db);

    const sql = queries.join('\n');
    expect(sql).toContain('DROP TABLE IF EXISTS email_suppression');
    expect(sql).toContain('DROP TABLE IF EXISTS email_delivery_event');
    expect(sql).toContain('DROP COLUMN IF EXISTS updated_at');
    await db.destroy();
  });
});
