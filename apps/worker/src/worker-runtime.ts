import {
  createJobsRepository,
  RETENTION_MAINTENANCE_JOB_KINDS,
  STORAGE_MAINTENANCE_JOB_KINDS,
  retentionMaintenanceJob,
  storageMaintenanceJob,
} from '@oss-tips/db';

export const OTP_QUEUE = 'otp';
export const DEFAULT_WORKER_QUEUES = ['default', 'exports', 'domains'] as const;
export const STORAGE_MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1_000;

export type WorkerQueuePlan = {
  queues: string[];
  otpOnly: boolean;
  runDispatchPrework: boolean;
};

/** Keep OTP isolated from general workers while preserving comma-separated queue configuration. */
export function workerQueuePlan(raw: string | undefined): WorkerQueuePlan {
  const requested = (raw ?? '')
    .split(',')
    .map((queue) => queue.trim())
    .filter(Boolean);
  const queues = requested.length > 0 ? requested : [...DEFAULT_WORKER_QUEUES];
  const otpOnly = queues.length === 1 && queues[0] === OTP_QUEUE;
  const generalQueues = otpOnly ? queues : queues.filter((queue) => queue !== OTP_QUEUE);

  return {
    queues: generalQueues.length > 0 ? generalQueues : [...DEFAULT_WORKER_QUEUES],
    otpOnly,
    runDispatchPrework: !otpOnly,
  };
}

export async function enqueueStorageMaintenanceJobs(
  jobs: ReturnType<typeof createJobsRepository>,
  now = new Date(),
): Promise<void> {
  for (const kind of STORAGE_MAINTENANCE_JOB_KINDS) {
    await jobs.enqueueIfAbsent(storageMaintenanceJob(kind, now));
  }
}

export async function enqueueRetentionMaintenanceJobs(
  jobs: ReturnType<typeof createJobsRepository>,
  now = new Date(),
): Promise<void> {
  for (const kind of RETENTION_MAINTENANCE_JOB_KINDS) {
    await jobs.enqueueIfAbsent(retentionMaintenanceJob(kind, now));
  }
}

export async function enqueueMaintenanceJobs(
  jobs: ReturnType<typeof createJobsRepository>,
  now = new Date(),
): Promise<void> {
  await enqueueStorageMaintenanceJobs(jobs, now);
  await enqueueRetentionMaintenanceJobs(jobs, now);
}
