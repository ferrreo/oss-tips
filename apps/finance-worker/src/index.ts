import {
  createDb,
  createPaymentsRepository,
  createStripeEventsRepository,
  destroyDb,
  type StripeEvent,
} from '@oss-tips/db';
import { createLedgerClient } from '@oss-tips/ledger';
import { createLogger } from '@oss-tips/observability';
import { isAllowedStripeWebhookEvent } from '@oss-tips/payments';
import {
  extractSettlementMetadata,
  settleOneOffPayment,
  shouldSettleOneOff,
} from './settle-one-off.js';

const log = createLogger('@oss-tips/finance-worker');
const POLL_MS = Number(process.env.FINANCE_WORKER_POLL_MS ?? 1_000);
const BATCH_SIZE = Number(process.env.FINANCE_WORKER_BATCH_SIZE ?? 10);

async function processStripeEvent(
  event: StripeEvent,
  deps: {
    ledger: ReturnType<typeof createLedgerClient>;
    payments: ReturnType<typeof createPaymentsRepository>;
  },
): Promise<void> {
  const payload = event.payload as Record<string, unknown>;
  const type = event.event_type || (typeof payload.type === 'string' ? payload.type : 'unknown');

  if (!isAllowedStripeWebhookEvent(type)) {
    throw new Error(`Unsupported stripe event type: ${type}`);
  }

  if (!shouldSettleOneOff(type)) {
    log.info('acknowledged non-settlement event', {
      id: event.id,
      stripeEventId: event.stripe_event_id,
      type,
    });
    return;
  }

  const extracted = extractSettlementMetadata(payload, event.stripe_account_id);
  if ('error' in extracted) {
    throw new Error(extracted.error);
  }

  const settlement = await settleOneOffPayment({
    ledger: deps.ledger,
    stripeEventId: event.stripe_event_id,
    metadata: extracted,
  });

  if (!settlement.ok) {
    if (settlement.skipped) {
      log.info('skipped settlement', {
        id: event.id,
        reason: settlement.error,
      });
      return;
    }
    throw new Error(settlement.error);
  }

  const existing = await deps.payments.findById(extracted.paymentId);
  if (existing) {
    await deps.payments.markSettled(existing.id);
  } else {
    await deps.payments.create({
      id: extracted.paymentId,
      project_id: extracted.projectId,
      user_id: null,
      stripe_account_id: extracted.stripeAccountId,
      stripe_payment_intent_id: extracted.stripePaymentIntentId,
      stripe_charge_id: null,
      currency: extracted.currency,
      exponent: 2,
      customer_charge_minor: extracted.customerChargeMinor,
      project_amount_minor: extracted.projectAmountMinor,
      platform_tip_minor: extracted.platformTipMinor,
      oss_project_fee_minor: extracted.ossProjectFeeMinor,
      stripe_application_fee_minor: extracted.applicationFeeMinor,
      status: 'succeeded',
      cadence: extracted.cadence,
      feature_mode: extracted.featureMode,
      settled_at: new Date(),
    });
  }

  log.info('settled one-off payment', {
    id: event.id,
    stripeEventId: event.stripe_event_id,
    paymentId: settlement.paymentId,
    transitBalance: settlement.transitBalance.toString(),
    semanticKey: settlement.semanticKey,
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
  const payments = createPaymentsRepository(db);
  const ledger = createLedgerClient(process.env);

  log.info('ready', {
    ledger: process.env.TIGERBEETLE_ADDRESSES ? 'tigerbeetle' : 'mock',
  });

  const loop = async () => {
    try {
      const batch = await stripeEvents.claimUnprocessed(BATCH_SIZE);

      for (const event of batch) {
        try {
          await processStripeEvent(event, { ledger, payments });
          await stripeEvents.markProcessed(event.id);
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
