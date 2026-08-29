import { createDb, createJobsRepository, destroyDb } from '@oss-tips/db';
import { createLogger } from '@oss-tips/observability';

const log = createLogger('@oss-tips/worker');
const WORKER_ID = `worker-${process.pid}`;
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 2_000);
const QUEUE = process.env.WORKER_QUEUE ?? 'default';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log.warn('DATABASE_URL not set; running in stub mode without job claims');
    log.info('ready', { workerId: WORKER_ID, queue: QUEUE });
    return;
  }

  const db = createDb(databaseUrl);
  const jobs = createJobsRepository(db);

  log.info('ready', { workerId: WORKER_ID, queue: QUEUE });

  const loop = async () => {
    try {
      const job = await jobs.claimNext(QUEUE, WORKER_ID);
      if (job) {
        log.info('job claimed', { jobId: job.id, kind: job.kind });
        await jobs.complete(job.id);
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
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err) => {
  log.error('fatal', { error: String(err) });
  process.exit(1);
});
