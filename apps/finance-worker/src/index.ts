import {
  createDb,
  createStripeEventsRepository,
  destroyDb,
  type StripeEvent,
} from '@oss-tips/db';
import { createLedgerClient } from '@oss-tips/ledger';
import { createLogger } from '@oss-tips/observability';
import { isAllowedStripeWebhookEvent } from '@oss-tips/payments';

const log = createLogger('@oss-tips/finance-worker');
const POLL_MS = Number(process.env.FINANCE_WORKER_POLL_MS ?? 1_000);
const BATCH_SIZE = Number(process.env.FINANCE_WORKER_BATCH_SIZE ?? 10);

async function processStripeEvent(event: StripeEvent): Promise<void> {
  const payload = event.payload as { type?: string };
  const type = payload.type ?? 'unknown';

  if (!isAllowedStripeWebhookEvent(type)) {
    throw new Error(`Unsupported stripe event type: ${type}`);
  }

  // Ledger posting and payment read-model updates land here in Slice B.
  log.info('processing stripe event', {
    id: event.id,
    stripeEventId: event.stripe_event_id,
    type,
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    log.warn('DATABASE_URL not set; finance worker idle in stub mode');
    log.info('ready', { ledger: 'stub' });
    return;
  }

  const db = createDb(databaseUrl);
  const stripeEvents = createStripeEventsRepository(db);
  const ledger = createLedgerClient(process.env);

  log.info('ready', {
    ledger: process.env.TIGERBEETLE_ADDRESSES ? 'tigerbeetle' : 'mock',
  });

  const loop = async () => {
    try {
      const batch = await stripeEvents.claimUnprocessed(BATCH_SIZE);

      for (const event of batch) {
        try {
          await processStripeEvent(event);
          await stripeEvents.markProcessed(event.id);
          void ledger;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await stripeEvents.markFailed(event.id, message);
          log.error('stripe event failed', {
            id: event.id,
            stripeEventId: event.stripe_event_id,
            error: message,
          });
        }
      }
    } catch (err) {
      log.error('finance worker loop error', { error: String(err) });
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
