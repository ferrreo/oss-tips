import type { Db } from '../client.js';
import type { Job, NewJob } from '../types.js';

export function createJobsRepository(db: Db) {
  return {
    async enqueue(job: NewJob): Promise<Job> {
      return db
        .insertInto('job')
        .values(job)
        .returningAll()
        .executeTakeFirstOrThrow();
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

    async complete(id: string): Promise<Job | undefined> {
      return db
        .updateTable('job')
        .set({
          status: 'completed',
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },

    async fail(id: string, error: string): Promise<Job | undefined> {
      const job = await db
        .selectFrom('job')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      const attemptCount = job.attempt_count + 1;
      const exhausted = attemptCount >= job.max_attempts;

      return db
        .updateTable('job')
        .set({
          status: exhausted ? 'failed' : 'pending',
          attempt_count: attemptCount,
          last_error: error,
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },
  };
}

export type JobsRepository = ReturnType<typeof createJobsRepository>;
