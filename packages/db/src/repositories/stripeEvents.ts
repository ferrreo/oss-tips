import type { Db } from '../client.js';
import type { NewStripeEvent, StripeEvent } from '../types.js';
import { sql } from 'kysely';

export const STRIPE_EVENT_LEASE_TIMEOUT_MS = 5 * 60 * 1_000;

export function createStripeEventsRepository(db: Db) {
  return {
    async insertIfNew(
      event: NewStripeEvent,
    ): Promise<{ event: StripeEvent; created: boolean } | undefined> {
      try {
        const created = await db
          .insertInto('stripe_event')
          .values(event)
          .returningAll()
          .executeTakeFirst();
        if (!created) return undefined;
        return { event: created, created: true };
      } catch (err: unknown) {
        if (isUniqueViolation(err)) {
          const existing = await db
            .selectFrom('stripe_event')
            .selectAll()
            .where('stripe_event_id', '=', event.stripe_event_id)
            .executeTakeFirst();
          if (!existing) return undefined;
          return { event: existing, created: false };
        }
        throw err;
      }
    },

    async findByStripeEventId(stripeEventId: string): Promise<StripeEvent | undefined> {
      return db
        .selectFrom('stripe_event')
        .selectAll()
        .where('stripe_event_id', '=', stripeEventId)
        .executeTakeFirst();
    },

    async claimUnprocessed(
      limit = 10,
      workerId = 'stripe-event-worker',
      now = new Date(),
    ): Promise<StripeEvent[]> {
      const leaseCutoff = new Date(now.getTime() - STRIPE_EVENT_LEASE_TIMEOUT_MS);
      return db.transaction().execute(async (trx) => {
        const candidates = await trx
          .selectFrom('stripe_event')
          .select('id')
          .where('processed_at', 'is', null)
          .where((eb) =>
            eb.or([eb('processing_at', 'is', null), eb('processing_at', '<=', leaseCutoff)]),
          )
          .orderBy('received_at', 'asc')
          .limit(limit)
          .forUpdate()
          .skipLocked()
          .execute();
        if (candidates.length === 0) return [];
        return trx
          .updateTable('stripe_event')
          .set({
            processing_at: now,
            processing_by: workerId,
            processing_attempts: sql<number>`processing_attempts + 1`,
          })
          .where(
            'id',
            'in',
            candidates.map((candidate) => candidate.id),
          )
          .where('processed_at', 'is', null)
          .returningAll()
          .execute();
      });
    },

    async renewProcessingLease(
      id: string,
      workerId: string,
      now = new Date(),
    ): Promise<StripeEvent | undefined> {
      return db
        .updateTable('stripe_event')
        .set({ processing_at: now })
        .where('id', '=', id)
        .where('processing_by', '=', workerId)
        .where('processed_at', 'is', null)
        .returningAll()
        .executeTakeFirst();
    },

    async markProcessed(
      id: string,
      workerId = 'stripe-event-worker',
      now = new Date(),
    ): Promise<StripeEvent | undefined> {
      return db
        .updateTable('stripe_event')
        .set({
          processed_at: now,
          process_error: null,
          processing_at: null,
          processing_by: null,
        })
        .where('id', '=', id)
        .where('processing_by', '=', workerId)
        .where('processed_at', 'is', null)
        .returningAll()
        .executeTakeFirst();
    },

    async markFailed(
      id: string,
      error: string,
      workerId = 'stripe-event-worker',
    ): Promise<StripeEvent | undefined> {
      return db
        .updateTable('stripe_event')
        .set({ process_error: error, processing_at: null, processing_by: null })
        .where('id', '=', id)
        .where('processing_by', '=', workerId)
        .where('processed_at', 'is', null)
        .returningAll()
        .executeTakeFirst();
    },
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

export type StripeEventsRepository = ReturnType<typeof createStripeEventsRepository>;
