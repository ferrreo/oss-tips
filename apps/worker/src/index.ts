import './instrumentation.js';
import { randomUUID } from 'node:crypto';
import { createDb, createJobsRepository, destroyDb, JOB_LEASE_TIMEOUT_MS } from '@oss-tips/db';
import { createStorageClient } from '@oss-tips/storage';
import { createEmailSender } from '@oss-tips/email';
import { createLogger, shutdownTelemetry } from '@oss-tips/observability';
import { createJobHandlers } from './job-handlers.js';
import { processJob } from './process-job.js';
import { deliverNextWebhook, enqueueOutgoingDeliveries } from './outgoing-webhooks.js';
import { validateWorkerProductionConfig } from './runtime-config.js';
import {
  enqueueMaintenanceJobs,
  STORAGE_MAINTENANCE_INTERVAL_MS,
  workerQueuePlan,
} from './worker-runtime.js';

const log = createLogger('@oss-tips/worker');
const WORKER_ID = `worker-${process.pid}-${randomUUID()}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 2_000);

async function recoverStaleLeases(
  jobs: ReturnType<typeof createJobsRepository>,
  queues: readonly string[],
): Promise<{ requeued: number; failed: number }> {
  const recovered = { requeued: 0, failed: 0 };
  for (const queue of queues) {
    const result = await jobs.recoverStaleLeases({ queue });
    recovered.requeued += result.requeued;
    recovered.failed += result.failed;
  }
  return recovered;
}

async function main() {
  const queuePlan = workerQueuePlan(process.env.WORKER_QUEUE);
  const queues = queuePlan.queues;
  validateWorkerProductionConfig(process.env, { otpOnly: queuePlan.otpOnly });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is required; worker refuses to start without a database');
    }
    log.warn('DATABASE_URL not set; running in stub mode without job claims');
    log.info('ready', { workerId: WORKER_ID, queues });
    return;
  }

  const db = createDb(databaseUrl);
  const jobs = createJobsRepository(db);
  const recovered = await recoverStaleLeases(jobs, queues);
  if (recovered.requeued || recovered.failed) {
    log.info('stale jobs recovered', recovered);
  }
  let nextLeaseRecoveryAt = Date.now() + JOB_LEASE_TIMEOUT_MS;
  let nextStorageMaintenanceAt = 0;
  const storage = queuePlan.otpOnly
    ? undefined
    : createStorageClient({
        s3Endpoint: process.env.S3_ENDPOINT,
        s3Region: process.env.S3_REGION,
        s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
        s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        localRoot: process.env.STORAGE_ROOT,
        nodeEnv: process.env.NODE_ENV,
      });
  const handlers = createJobHandlers({
    db,
    ...(storage ? { storage } : {}),
    ...(process.env.BETTER_AUTH_SECRET
      ? { authSecret: process.env.BETTER_AUTH_SECRET }
      : process.env.NODE_ENV === 'production'
        ? {}
        : { authSecret: 'dev-only-change-me-min-32-chars!!' }),
    ...(process.env.PUBLIC_APP_URL ? { publicAppUrl: process.env.PUBLIC_APP_URL } : {}),
    ...(process.env.RESEND_API_KEY
      ? {
          email: createEmailSender({
            apiKey: process.env.RESEND_API_KEY,
            ...(process.env.EMAIL_FROM ? { from: process.env.EMAIL_FROM } : {}),
          }),
        }
      : {}),
  });

  log.info('ready', { workerId: WORKER_ID, queues });

  const loop = async () => {
    try {
      if (Date.now() >= nextLeaseRecoveryAt) {
        nextLeaseRecoveryAt = Date.now() + JOB_LEASE_TIMEOUT_MS;
        const recovered = await recoverStaleLeases(jobs, queues);
        if (recovered.requeued || recovered.failed) {
          log.info('stale jobs recovered', recovered);
        }
      }
      if (queuePlan.runDispatchPrework) {
        if (Date.now() >= nextStorageMaintenanceAt) {
          await enqueueMaintenanceJobs(jobs);
          nextStorageMaintenanceAt = Date.now() + STORAGE_MAINTENANCE_INTERVAL_MS;
        }
        await enqueueOutgoingDeliveries(db);
        if (process.env.WEBHOOK_ENCRYPTION_KEY) {
          await deliverNextWebhook(db, { encryptionKey: process.env.WEBHOOK_ENCRYPTION_KEY });
        }
      }
      for (const queue of queues) {
        const job = await jobs.claimNext(queue, WORKER_ID);
        if (!job) continue;
        log.info('job claimed', { jobId: job.id, kind: job.kind, queue });
        await processJob(jobs, job, handlers, WORKER_ID);
        break;
      }
    } catch (err) {
      log.error('worker loop error', { error: String(err) });
    } finally {
      setTimeout(loop, POLL_MS);
    }
  };

  void loop();

  const shutdown = async () => {
    log.info('shutting down');
    await destroyDb(db);
    await shutdownTelemetry();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  log.error('fatal', { error: String(err) });
  process.exit(1);
});
