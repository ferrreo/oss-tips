import { createHash } from 'node:crypto';
import type { Db } from '../client.js';
import { uuidv7 } from '@oss-tips/domain';
import { sql } from 'kysely';
import type { Job, JsonValue, NewJob } from '../types.js';

/** A processing lease older than this is assumed abandoned and may be recovered. */
export const JOB_LEASE_TIMEOUT_MS = 5 * 60_000;

export const STORAGE_MAINTENANCE_JOB_KINDS = [
  'storage.inventory',
  'storage.cleanup_exports',
  'storage.purge_media',
] as const;
export type StorageMaintenanceJobKind = (typeof STORAGE_MAINTENANCE_JOB_KINDS)[number];

export const RETENTION_MAINTENANCE_JOB_KINDS = [
  'retention.verification',
  'retention.otp_limits',
  'retention.analytics',
  'retention.security_ip',
  'retention.api_rate_limits',
] as const;
export type RetentionMaintenanceJobKind = (typeof RETENTION_MAINTENANCE_JOB_KINDS)[number];

const STALE_LEASE_REQUEUED = 'Stale job lease recovered';
const STALE_LEASE_EXHAUSTED = 'Stale job lease exhausted';

/** Build a durable email notification job for use inside an existing transaction. */
export function emailNotificationJob(payload: JsonValue, runAt = new Date()): NewJob {
  return {
    id: uuidv7(),
    queue: 'default',
    kind: 'email.notification',
    payload,
    status: 'pending',
    attempt_count: 0,
    max_attempts: 5,
    run_at: runAt,
    locked_at: null,
    locked_by: null,
    last_error: null,
  };
}

function deterministicJobId(key: string): string {
  const nibbles = [...createHash('sha256').update(key).digest('hex')];
  nibbles[12] = '4';
  nibbles[16] = ((Number.parseInt(nibbles[16]!, 16) & 0x03) | 0x08).toString(16);
  return [
    nibbles.slice(0, 8),
    nibbles.slice(8, 12),
    nibbles.slice(12, 16),
    nibbles.slice(16, 20),
    nibbles.slice(20, 32),
  ]
    .map((part) => part.join(''))
    .join('-');
}

/** Build one stable maintenance job per kind and UTC day for restart-safe scheduling. */
export function storageMaintenanceJob(kind: StorageMaintenanceJobKind, runAt = new Date()): NewJob {
  const day = runAt.toISOString().slice(0, 10);
  return {
    id: deterministicJobId(`storage-maintenance:${kind}:${day}`),
    queue: 'default',
    kind,
    payload: { maintenance_day: day },
    status: 'pending',
    attempt_count: 0,
    max_attempts: 5,
    run_at: runAt,
    locked_at: null,
    locked_by: null,
    last_error: null,
  };
}

/** Build one stable retention job per kind and UTC day for restart-safe scheduling. */
export function retentionMaintenanceJob(
  kind: RetentionMaintenanceJobKind,
  runAt = new Date(),
): NewJob {
  const day = runAt.toISOString().slice(0, 10);
  return {
    id: deterministicJobId(`retention-maintenance:${kind}:${day}`),
    queue: 'default',
    kind,
    payload: { maintenance_day: day },
    status: 'pending',
    attempt_count: 0,
    max_attempts: 5,
    run_at: runAt,
    locked_at: null,
    locked_by: null,
    last_error: null,
  };
}

/** Build one stable reconciliation job per account scope/currency/day window. */
export function dailyReconciliationJob(
  input: {
    stripeAccountId: string;
    currency: string;
    periodStart: string;
    periodEnd: string;
    timingRetry?: boolean;
    eventRetry?: boolean;
  },
  runAt = new Date(),
): NewJob {
  const currency = input.currency.toLowerCase();
  const retryKind = input.eventRetry
    ? 'event-retry'
    : input.timingRetry
      ? 'timing-retry'
      : 'initial';
  return {
    id: deterministicJobId(
      `reconciliation:${input.stripeAccountId}:${currency}:${input.periodStart}:${input.periodEnd}:${retryKind}`,
    ),
    queue: 'finance',
    kind: 'reconciliation.daily',
    payload: {
      stripe_account_id: input.stripeAccountId,
      currency,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      ...(retryKind !== 'initial' ? { retry_kind: retryKind.replace('-retry', '') } : {}),
    },
    status: 'pending',
    attempt_count: 0,
    max_attempts: 5,
    run_at: runAt,
    locked_at: null,
    locked_by: null,
    last_error: null,
  };
}

export function createJobsRepository(db: Db) {
  return {
    async enqueue(job: NewJob): Promise<Job> {
      return db.insertInto('job').values(job).returningAll().executeTakeFirstOrThrow();
    },

    /** Insert stable recurring jobs without failing when another worker already scheduled them. */
    async enqueueIfAbsent(job: NewJob): Promise<Job | undefined> {
      return db
        .insertInto('job')
        .values(job)
        .onConflict((oc) => oc.column('id').doNothing())
        .returningAll()
        .executeTakeFirst();
    },

    async claimNext(queue: string, workerId: string): Promise<Job | undefined> {
      const now = new Date();
      return db.transaction().execute(async (trx) => {
        const job = await trx
          .selectFrom('job')
          .selectAll()
          .where('queue', '=', queue)
          .where('status', '=', 'pending')
          .where('run_at', '<=', now)
          .orderBy('run_at', 'asc')
          .limit(1)
          .forUpdate()
          .skipLocked()
          .executeTakeFirst();

        if (!job) return undefined;

        return trx
          .updateTable('job')
          .set({
            status: 'processing',
            locked_at: now,
            locked_by: workerId,
            updated_at: now,
          })
          .where('id', '=', job.id)
          .returningAll()
          .executeTakeFirstOrThrow();
      });
    },

    /** Recover abandoned leases in one guarded update; active leases remain untouched. */
    async recoverStaleLeases(input: { now?: Date; queue?: string } = {}): Promise<{
      requeued: number;
      failed: number;
    }> {
      const now = input.now ?? new Date();
      const cutoff = new Date(now.getTime() - JOB_LEASE_TIMEOUT_MS);
      const recovered = await db.transaction().execute(async (trx) => {
        let query = trx
          .updateTable('job')
          .set({
            status: sql<string>`CASE WHEN attempt_count + 1 >= max_attempts THEN 'failed' ELSE 'pending' END`,
            attempt_count: sql<number>`attempt_count + 1`,
            run_at: now,
            locked_at: null,
            locked_by: null,
            last_error: sql<string>`CASE WHEN attempt_count + 1 >= max_attempts THEN ${STALE_LEASE_EXHAUSTED} ELSE ${STALE_LEASE_REQUEUED} END`,
            updated_at: now,
          })
          .where('status', '=', 'processing')
          .where('locked_at', '<=', cutoff);
        if (input.queue !== undefined) query = query.where('queue', '=', input.queue);
        return query.returning('status').execute();
      });

      return recovered.reduce(
        (counts, job) => {
          if (job.status === 'failed') counts.failed += 1;
          else counts.requeued += 1;
          return counts;
        },
        { requeued: 0, failed: 0 },
      );
    },

    async renewLease(id: string, workerId: string, now = new Date()): Promise<Job | undefined> {
      return db
        .updateTable('job')
        .set({ locked_at: now, updated_at: now })
        .where('id', '=', id)
        .where('status', '=', 'processing')
        .where('locked_by', '=', workerId)
        .returningAll()
        .executeTakeFirst();
    },

    async complete(id: string, workerId: string): Promise<Job | undefined> {
      return db
        .updateTable('job')
        .set({
          status: 'completed',
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .where('status', '=', 'processing')
        .where('locked_by', '=', workerId)
        .returningAll()
        .executeTakeFirst();
    },

    async fail(
      id: string,
      error: string,
      nextRunAt: Date | undefined,
      workerId: string,
    ): Promise<Job | undefined> {
      return db
        .updateTable('job')
        .set({
          status: sql<string>`CASE WHEN attempt_count + 1 >= max_attempts THEN 'failed' ELSE 'pending' END`,
          attempt_count: sql<number>`attempt_count + 1`,
          last_error: error,
          ...(nextRunAt === undefined ? {} : { run_at: nextRunAt }),
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .where('status', '=', 'processing')
        .where('locked_by', '=', workerId)
        .returningAll()
        .executeTakeFirst();
    },
  };
}

export type JobsRepository = ReturnType<typeof createJobsRepository>;
