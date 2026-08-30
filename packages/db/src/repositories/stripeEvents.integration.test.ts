import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDb, destroyDb } from '../index.js';
import { createStripeEventsRepository } from './stripeEvents.js';

const integration =
  process.env.RUN_DB_INTEGRATION === '1' && process.env.DATABASE_URL ? describe : describe.skip;

integration('Stripe event processing leases', () => {
  it('allows only one of two workers to claim an inbox row', async () => {
    const db = createDb(process.env.DATABASE_URL!);
    const eventId = randomUUID();
    const stripeEventId = `evt_lease_${eventId.replaceAll('-', '')}`;
    const now = new Date('2026-08-30T12:00:00.000Z');
    try {
      await db
        .insertInto('stripe_event')
        .values({
          id: eventId,
          stripe_event_id: stripeEventId,
          stripe_account_id: 'acct_lease_test',
          event_type: 'charge.succeeded',
          api_version: null,
          payload: {},
          processed_at: null,
          process_error: null,
        })
        .execute();

      const workerA = createStripeEventsRepository(db);
      const workerB = createStripeEventsRepository(db);
      const [claimedA, claimedB] = await Promise.all([
        workerA.claimUnprocessed(1, 'finance-a', now),
        workerB.claimUnprocessed(1, 'finance-b', now),
      ]);
      const claimed = [...claimedA, ...claimedB];
      expect(claimed).toHaveLength(1);
      const winner = claimed[0];
      if (!winner) throw new Error('claim did not return a winner');
      const owner = winner.processing_by;
      if (!owner) throw new Error('claim did not record an owner');
      expect(['finance-a', 'finance-b']).toContain(owner);

      const loser = owner === 'finance-a' ? workerB : workerA;
      await expect(
        loser.markProcessed(eventId, owner === 'finance-a' ? 'finance-b' : 'finance-a'),
      ).resolves.toBeUndefined();
      await expect(
        (owner === 'finance-a' ? workerA : workerB).markProcessed(
          eventId,
          owner,
          new Date('2026-08-30T12:00:01.000Z'),
        ),
      ).resolves.toMatchObject({ processed_at: new Date('2026-08-30T12:00:01.000Z') });
    } finally {
      await db.deleteFrom('stripe_event').where('id', '=', eventId).execute();
      await destroyDb(db);
    }
  });
});
