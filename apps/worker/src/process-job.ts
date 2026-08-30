import type { Job } from '@oss-tips/db';
import { createJobsRepository, JOB_LEASE_TIMEOUT_MS } from '@oss-tips/db';
import { createLogger } from '@oss-tips/observability';
import { JobRetryError } from './job-handlers.js';

const log = createLogger('@oss-tips/worker');

export type JobHandler = (job: Job) => Promise<void>;

/** A job is acknowledged only after its handler has completed its side effect. */
export async function processJob(
  jobs: ReturnType<typeof createJobsRepository>,
  job: Job,
  handlers: Record<string, JobHandler>,
  workerId: string,
): Promise<void> {
  const handler = handlers[job.kind];
  if (!handler) {
    const failure = await jobs.fail(
      job.id,
      `Unsupported job kind: ${job.kind}`,
      undefined,
      workerId,
    );
    log.warn('unsupported job failed', {
      jobId: job.id,
      kind: job.kind,
      status: failure?.status ?? 'unknown',
    });
    return;
  }
  let leaseLost = false;
  const heartbeat = setInterval(
    () => {
      void jobs
        .renewLease(job.id, workerId)
        .then((renewed) => {
          if (renewed) return;
          leaseLost = true;
          clearInterval(heartbeat);
          log.warn('job lease lost during handling', { jobId: job.id, kind: job.kind });
        })
        .catch((error: unknown) => {
          log.warn('job lease heartbeat failed', {
            jobId: job.id,
            kind: job.kind,
            error: String(error),
          });
        });
    },
    Math.max(1_000, Math.floor(JOB_LEASE_TIMEOUT_MS / 2)),
  );
  try {
    await handler(job);
    if (leaseLost) return;
    const completed = await jobs.complete(job.id, workerId);
    if (!completed) {
      log.warn('job completion rejected after lease changed', { jobId: job.id, kind: job.kind });
    }
  } catch (error) {
    const failure = await jobs.fail(
      job.id,
      error instanceof Error ? error.message : 'Job handler failed',
      error instanceof JobRetryError ? error.runAt : undefined,
      workerId,
    );
    log.warn('job handler failed', {
      jobId: job.id,
      kind: job.kind,
      status: failure?.status ?? 'unknown',
      error: error instanceof Error ? error.message : 'Job handler failed',
    });
  } finally {
    clearInterval(heartbeat);
  }
}
