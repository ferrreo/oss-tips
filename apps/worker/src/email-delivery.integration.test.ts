import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createDb, destroyDb, lockEmailSuppressionForTransaction, type Db } from '@oss-tips/db';
import { deliverEmail } from './email-delivery.js';

const integration =
  process.env.RUN_DB_INTEGRATION === '1' && process.env.DATABASE_URL ? describe : describe.skip;

integration('email suppression locking', () => {
  it('serializes suppression and delivery across separate PgBouncer transactions', async () => {
    const db = createDb(process.env.DATABASE_URL!);
    const suffix = randomUUID();
    const email = `suppression-race-${suffix}@example.test`;
    const providerEventId = `evt-${suffix}`;
    const dedupeKey = `email:suppression-race:${suffix}`;
    let releaseWebhook!: () => void;
    const webhookRelease = new Promise<void>((resolve) => {
      releaseWebhook = resolve;
    });
    let webhookReady!: () => void;
    const webhookStarted = new Promise<void>((resolve) => {
      webhookReady = resolve;
    });
    let delivery: Promise<void> | undefined;

    const webhook = db.transaction().execute(async (trx) => {
      await lockEmailSuppressionForTransaction(trx, email);
      webhookReady();
      await webhookRelease;
      await trx
        .insertInto('email_suppression')
        .values({
          email_address: email,
          reason: 'bounce',
          provider_event_id: providerEventId,
        })
        .execute();
    });

    let deliverySettled = false;
    const sender = { send: vi.fn(async () => ({ id: 'provider-race' })) };

    try {
      await webhookStarted;
      delivery = deliverEmail(
        { db, email: sender },
        {
          recipient: { email },
          dedupeKey,
          template: 'suppression-race',
          metadata: {},
          render: () => ({ subject: 'Race', text: 'Race', html: '<p>Race</p>' }),
        },
      ).finally(() => {
        deliverySettled = true;
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(deliverySettled).toBe(false);
      expect(sender.send).not.toHaveBeenCalled();
      releaseWebhook();
      await Promise.all([webhook, delivery]);
      const row = await db
        .selectFrom('email_delivery')
        .select(['status'])
        .where('dedupe_key', '=', dedupeKey)
        .executeTakeFirstOrThrow();
      expect(row.status).toBe('suppressed');
      expect(sender.send).not.toHaveBeenCalled();
    } finally {
      releaseWebhook();
      await Promise.allSettled([webhook, ...(delivery ? [delivery] : [])]);
      await cleanup(db, email, dedupeKey);
      await destroyDb(db);
    }
  });
});

async function cleanup(db: Db, email: string, dedupeKey: string): Promise<void> {
  await db.deleteFrom('email_delivery').where('dedupe_key', '=', dedupeKey).execute();
  await db.deleteFrom('email_suppression').where('email_address', '=', email).execute();
}
