import type { Db } from '../client.js';
import type { NewStripeEvent, StripeEvent } from '../types.js';

export function createStripeEventsRepository(db: Db) {
  return {
    async insertIfNew(event: NewStripeEvent): Promise<StripeEvent | undefined> {
      try {
        return await db
          .insertInto('stripe_event')
          .values(event)
          .returningAll()
          .executeTakeFirst();
      } catch (err: unknown) {
        if (isUniqueViolation(err)) {
          return db
            .selectFrom('stripe_event')
            .selectAll()
            .where('stripe_event_id', '=', event.stripe_event_id)
            .executeTakeFirst();
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

    async claimUnprocessed(limit = 10): Promise<StripeEvent[]> {
      return db
        .selectFrom('stripe_event')
        .selectAll()
        .where('processed_at', 'is', null)
        .orderBy('received_at', 'asc')
        .limit(limit)
        .execute();
    },

    async markProcessed(id: string): Promise<StripeEvent | undefined> {
      return db
        .updateTable('stripe_event')
        .set({ processed_at: new Date(), process_error: null })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },

    async markFailed(id: string, error: string): Promise<StripeEvent | undefined> {
      return db
        .updateTable('stripe_event')
        .set({ process_error: error })
        .where('id', '=', id)
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
