import { describe, expect, it } from 'vitest';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { down, up } from './migrations/018_auth_otp_jobs.js';

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

describe('auth OTP job migration', () => {
  it('queues only attempt-zero sign-in OTP rows with an ID-only payload', async () => {
    const { db, queries } = recordingDb();
    await up(db);

    const sql = queries.join('\n');
    expect(sql).toContain("NEW.identifier LIKE 'sign-in-otp-%'");
    expect(sql).toContain("NEW.value ~ '^otp:v1:[0-9a-f]{64}:0$'");
    expect(sql).toContain("'otp'");
    expect(sql).toContain("'email.notification'");
    expect(sql).toContain("'notification', 'auth-otp'");
    expect(sql).toContain("'verification_id', NEW.id");
    expect(sql).not.toContain("'otp', NEW.value");
    await db.destroy();
  });

  it('removes trigger and function on rollback', async () => {
    const { db, queries } = recordingDb();
    await down(db);

    const sql = queries.join('\n');
    expect(sql).toContain('DROP TRIGGER IF EXISTS verification_sign_in_otp_job');
    expect(sql).toContain('DROP FUNCTION IF EXISTS enqueue_sign_in_otp_job()');
    await db.destroy();
  });
});
