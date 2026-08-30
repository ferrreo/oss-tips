import { describe, expect, it } from 'vitest';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import type { Db } from '../client.js';
import {
  JOB_LEASE_TIMEOUT_MS,
  createJobsRepository,
  dailyReconciliationJob,
  retentionMaintenanceJob,
  storageMaintenanceJob,
} from './jobs.js';

function recordingDb(rows: Array<{ status: string }>): {
  db: Db;
  queries: Array<{ sql: string; parameters: readonly unknown[] }>;
} {
  const queries: Array<{ sql: string; parameters: readonly unknown[] }> = [];
  const connection = {
    async executeQuery(query: { sql: string; parameters: readonly unknown[] }) {
      queries.push(query);
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
  const db = new Kysely<unknown>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver as never,
      createIntrospector: (database) => new PostgresIntrospector(database),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  return { db: db as unknown as Db, queries };
}

function mutableLeaseDb(row: {
  id: string;
  status: string;
  locked_by: string | null;
  locked_at: Date | null;
  updated_at: Date;
  attempt_count: number;
}) {
  const db = {
    updateTable: () => {
      const filters: Array<[string, unknown]> = [];
      let values: Record<string, unknown> = {};
      const builder = {
        set: (next: Record<string, unknown>) => {
          values = next;
          return builder;
        },
        where: (column: string, _operator: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        returningAll: () => builder,
        executeTakeFirst: async () => {
          if (!filters.every(([column, value]) => row[column as keyof typeof row] === value)) {
            return undefined;
          }
          Object.assign(row, values);
          return row;
        },
      };
      return builder;
    },
  };
  return db as unknown as Db;
}

describe('job lease recovery', () => {
  it('updates only expired processing leases in one transaction and counts outcomes', async () => {
    const { db, queries } = recordingDb([{ status: 'pending' }, { status: 'failed' }]);
    const now = new Date('2026-08-30T12:00:00.000Z');
    const result = await createJobsRepository(db).recoverStaleLeases({
      now,
      queue: 'default',
    });

    expect(result).toEqual({ requeued: 1, failed: 1 });
    expect(queries).toHaveLength(1);
    const query = queries[0];
    if (!query) throw new Error('recovery query missing');
    expect(query.sql).toContain('update "job"');
    expect(query.sql).toContain('"status" = $');
    expect(query.sql).toContain('"locked_at" <= $');
    expect(query.sql).toContain('"status" = $');
    expect(
      query.parameters.some(
        (parameter) =>
          parameter instanceof Date && parameter.getTime() === now.getTime() - JOB_LEASE_TIMEOUT_MS,
      ),
    ).toBe(true);
    expect(query.parameters).toContain('default');
    expect(query.sql).toContain('attempt_count + 1');
    expect(query.sql).toContain('max_attempts');
  });

  it('rejects completion/failure from another worker and renews the current owner', async () => {
    const row = {
      id: 'job-1',
      status: 'processing',
      locked_by: 'worker-a',
      locked_at: new Date('2026-08-30T11:50:00.000Z'),
      updated_at: new Date('2026-08-30T11:50:00.000Z'),
      attempt_count: 0,
    };
    const db = mutableLeaseDb(row);
    const jobs = createJobsRepository(db);

    await expect(jobs.complete('job-1', 'worker-b')).resolves.toBeUndefined();
    await expect(
      jobs.fail('job-1', 'stale worker', undefined, 'worker-b'),
    ).resolves.toBeUndefined();
    expect(row.status).toBe('processing');
    expect(row.attempt_count).toBe(0);

    const renewedAt = new Date('2026-08-30T12:00:00.000Z');
    await expect(jobs.renewLease('job-1', 'worker-a', renewedAt)).resolves.toMatchObject({
      locked_at: renewedAt,
      updated_at: renewedAt,
    });
  });

  it('schedules retry in the same owner-guarded failure update', async () => {
    const { db, queries } = recordingDb([{ status: 'pending' }]);
    const nextRunAt = new Date('2026-08-30T12:01:00.000Z');

    await createJobsRepository(db).fail('job-1', 'temporary failure', nextRunAt, 'worker-a');

    expect(queries).toHaveLength(1);
    const query = queries[0];
    if (!query) throw new Error('failure query missing');
    expect(query.sql).toContain('"run_at" = $');
    expect(query.sql).toContain('"status" = $');
    expect(query.sql).toContain('"locked_by" = $');
    expect(query.parameters).toContain(nextRunAt);
    expect(query.parameters).toContain('worker-a');
  });
});

describe('maintenance jobs', () => {
  it('uses one stable job id per maintenance kind and UTC day', () => {
    const morning = new Date('2026-08-30T01:00:00.000Z');
    const evening = new Date('2026-08-30T23:00:00.000Z');
    const nextDay = new Date('2026-08-31T00:00:00.000Z');

    expect(storageMaintenanceJob('storage.inventory', morning)).toMatchObject({
      id: storageMaintenanceJob('storage.inventory', evening).id,
      queue: 'default',
      kind: 'storage.inventory',
      payload: { maintenance_day: '2026-08-30' },
    });
    expect(storageMaintenanceJob('storage.inventory', morning).id).not.toBe(
      storageMaintenanceJob('storage.inventory', nextDay).id,
    );
    expect(storageMaintenanceJob('storage.inventory', morning).id).not.toBe(
      storageMaintenanceJob('storage.cleanup_exports', morning).id,
    );
  });

  it('uses one stable job id per retention kind and UTC day', () => {
    const morning = new Date('2026-08-30T01:00:00.000Z');
    const evening = new Date('2026-08-30T23:00:00.000Z');
    const nextDay = new Date('2026-08-31T00:00:00.000Z');

    expect(retentionMaintenanceJob('retention.analytics', morning)).toMatchObject({
      id: retentionMaintenanceJob('retention.analytics', evening).id,
      queue: 'default',
      kind: 'retention.analytics',
      payload: { maintenance_day: '2026-08-30' },
    });
    expect(retentionMaintenanceJob('retention.analytics', morning).id).not.toBe(
      retentionMaintenanceJob('retention.analytics', nextDay).id,
    );
    expect(retentionMaintenanceJob('retention.analytics', morning).id).not.toBe(
      retentionMaintenanceJob('retention.security_ip', morning).id,
    );
  });

  it('inserts duplicate maintenance jobs without failing', async () => {
    const { db, queries } = recordingDb([{ status: 'pending' }]);
    await createJobsRepository(db).enqueueIfAbsent(
      storageMaintenanceJob('storage.inventory', new Date('2026-08-30T00:00:00.000Z')),
    );

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toContain('on conflict ("id") do nothing');
  });
});

describe('reconciliation jobs', () => {
  it('uses one stable job id per account/currency/day window', () => {
    const morning = new Date('2026-08-30T01:00:00.000Z');
    const evening = new Date('2026-08-30T23:00:00.000Z');
    const input = {
      stripeAccountId: 'acct_1',
      currency: 'GBP',
      periodStart: '2026-08-29',
      periodEnd: '2026-08-30',
    };

    expect(dailyReconciliationJob(input, morning)).toMatchObject({
      id: dailyReconciliationJob(input, evening).id,
      queue: 'finance',
      kind: 'reconciliation.daily',
      payload: {
        stripe_account_id: 'acct_1',
        currency: 'gbp',
        period_start: '2026-08-29',
        period_end: '2026-08-30',
      },
    });
    expect(dailyReconciliationJob(input, morning).id).not.toBe(
      dailyReconciliationJob({ ...input, periodStart: '2026-08-28' }, morning).id,
    );
    expect(dailyReconciliationJob({ ...input, timingRetry: true }, morning).id).not.toBe(
      dailyReconciliationJob(input, morning).id,
    );
    expect(dailyReconciliationJob({ ...input, eventRetry: true }, morning)).toMatchObject({
      id: dailyReconciliationJob({ ...input, eventRetry: true }, evening).id,
      payload: { retry_kind: 'event' },
    });
    expect(dailyReconciliationJob({ ...input, eventRetry: true }, morning).id).not.toBe(
      dailyReconciliationJob({ ...input, timingRetry: true }, morning).id,
    );
  });
});
