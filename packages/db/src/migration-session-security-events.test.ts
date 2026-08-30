import { describe, expect, it } from 'vitest';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import { createDb, destroyDb } from './client.js';
import { down, up } from './migrations/020_session_security_events.js';

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

describe('session security event migration', () => {
  it('queues security event email from the session insert trigger', async () => {
    const { db, queries } = recordingDb();
    await up(db);

    const sql = queries.join('\n');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION enqueue_session_security_event()');
    expect(sql).toContain('AFTER INSERT ON session');
    expect(sql).toContain("'auth.sign_in'");
    expect(sql).toContain("'notification', 'security-event'");
    expect(sql).toContain("'event_id', event_id");
    expect(sql).toContain("'user_id', NEW.user_id");
    expect(sql).toContain("'event', 'sign-in'");
    expect(sql).not.toContain('NEW.token');
    await db.destroy();
  });

  it('removes trigger and function on rollback', async () => {
    const { db, queries } = recordingDb();
    await down(db);

    const sql = queries.join('\n');
    expect(sql).toContain('DROP TRIGGER IF EXISTS session_security_event_job');
    expect(sql).toContain('DROP FUNCTION IF EXISTS enqueue_session_security_event()');
    await db.destroy();
  });
});

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integration('session security event trigger integration', () => {
  it('rolls back together and emits one ID-only job on commit', async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
    const db = createDb(databaseUrl);
    const rollbackUserId = crypto.randomUUID();
    const rollbackSessionId = crypto.randomUUID();
    const successUserId = crypto.randomUUID();
    const successSessionId = crypto.randomUUID();
    let successEventId: string | undefined;

    try {
      await expect(
        db.transaction().execute(async (trx) => {
          await trx
            .insertInto('user')
            .values({
              id: rollbackUserId,
              name: 'Security rollback test',
              email: `${rollbackUserId}@example.test`,
              email_verified: true,
              image: null,
            })
            .execute();
          await trx
            .insertInto('session')
            .values({
              id: rollbackSessionId,
              user_id: rollbackUserId,
              token: `rollback-${rollbackSessionId}`,
              expires_at: new Date(Date.now() + 60 * 60 * 1_000),
              ip_address: '192.0.2.1',
              user_agent: 'security-test',
            })
            .execute();
          throw new Error('rollback sentinel');
        }),
      ).rejects.toThrow('rollback sentinel');

      expect(
        await db.selectFrom('session').select('id').where('id', '=', rollbackSessionId).execute(),
      ).toEqual([]);
      expect(
        await db
          .selectFrom('user_security_event')
          .select('id')
          .where('user_id', '=', rollbackUserId)
          .execute(),
      ).toEqual([]);

      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('user')
          .values({
            id: successUserId,
            name: 'Security commit test',
            email: `${successUserId}@example.test`,
            email_verified: true,
            image: null,
          })
          .execute();
        await trx
          .insertInto('session')
          .values({
            id: successSessionId,
            user_id: successUserId,
            token: `success-${successSessionId}`,
            expires_at: new Date(Date.now() + 60 * 60 * 1_000),
            ip_address: '192.0.2.2',
            user_agent: 'security-test',
          })
          .execute();
      });

      const events = await db
        .selectFrom('user_security_event')
        .selectAll()
        .where('user_id', '=', successUserId)
        .execute();
      expect(events).toHaveLength(1);
      successEventId = events[0]?.id;
      expect((events[0]?.metadata as Record<string, unknown>).session_id).toBe(successSessionId);

      const jobs = await db
        .selectFrom('job')
        .selectAll()
        .where('kind', '=', 'email.notification')
        .execute();
      const securityJobs = jobs.filter((job) => {
        const payload = job.payload as Record<string, unknown>;
        return payload.notification === 'security-event' && payload.event_id === events[0]?.id;
      });
      expect(securityJobs).toHaveLength(1);
      expect(securityJobs[0]?.payload).toEqual({
        notification: 'security-event',
        user_id: successUserId,
        event_id: events[0]?.id,
        event: 'sign-in',
      });
    } finally {
      const jobs = await db.selectFrom('job').select(['id', 'payload']).execute();
      const cleanupJobIds = jobs
        .filter((job) => {
          const payload = job.payload as Record<string, unknown>;
          return (
            payload.notification === 'security-event' &&
            payload.user_id === successUserId &&
            (!successEventId || payload.event_id === successEventId)
          );
        })
        .map((job) => job.id);
      if (cleanupJobIds.length > 0) {
        await db.deleteFrom('job').where('id', 'in', cleanupJobIds).execute();
      }
      await db
        .deleteFrom('user_security_event')
        .where('user_id', 'in', [rollbackUserId, successUserId])
        .execute();
      await db.deleteFrom('user').where('id', 'in', [rollbackUserId, successUserId]).execute();
      await destroyDb(db);
    }
  });
});
