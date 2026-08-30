import { describe, expect, it } from 'vitest';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { down, up } from './migrations/015_audit_event_hardening.js';

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

describe('audit event hardening migration', () => {
  it('drops raw IP and unrestricted metadata while restoring immutability', async () => {
    const { db, queries } = recordingDb();
    await up(db);

    const sql = queries.join('\n');
    expect(sql).toContain('RENAME COLUMN actor_user_id TO actor_id');
    expect(sql).toContain('RENAME COLUMN created_at TO occurred_at');
    expect(sql).toContain('ADD COLUMN metadata_redacted jsonb');
    expect(sql).toContain('DROP COLUMN metadata');
    expect(sql).toContain('DROP COLUMN ip_address');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS audit_event_actor_user_id_fkey');
    expect(sql).toContain('CREATE TRIGGER audit_event_immutable');
    await db.destroy();
  });

  it('keeps migration rollback executable without restoring raw values', async () => {
    const { db, queries } = recordingDb();
    await down(db);

    const sql = queries.join('\n');
    expect(sql).toContain('RENAME COLUMN metadata_redacted TO metadata');
    expect(sql).toContain('ADD COLUMN ip_address text');
    await db.destroy();
  });
});
