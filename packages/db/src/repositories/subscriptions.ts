import type { Db } from '../client.js';
import type {
  NewSubscription,
  NewSubscriptionPeriod,
  Subscription,
  SubscriptionPeriod,
} from '../types.js';

export type SubscriptionEventCursor = {
  createdAt: number;
  id: string;
};

export type SubscriptionStatePatch = {
  status?: string;
  current_period_end?: Date | null;
  grace_ends_at?: Date | null;
  cancel_at_period_end?: boolean;
  project_amount_minor?: string | bigint | number | null;
  platform_tip_minor?: string | bigint | number | null;
  currency?: string | null;
  feature_mode?: string | null;
  cadence?: string | null;
};

export function createSubscriptionsRepository(db: Db) {
  return {
    async findById(id: string): Promise<Subscription | undefined> {
      return db.selectFrom('subscription').selectAll().where('id', '=', id).executeTakeFirst();
    },

    async findByStripeSubscriptionId(
      stripeSubscriptionId: string,
    ): Promise<Subscription | undefined> {
      return db
        .selectFrom('subscription')
        .selectAll()
        .where('stripe_subscription_id', '=', stripeSubscriptionId)
        .executeTakeFirst();
    },

    async findByIdForUpdate(id: string): Promise<Subscription | undefined> {
      return db
        .selectFrom('subscription')
        .selectAll()
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
    },

    async findTierRank(tierId: string): Promise<number | undefined> {
      const row = await db
        .selectFrom('tier')
        .select('rank')
        .where('id', '=', tierId)
        .executeTakeFirst();
      return row?.rank;
    },

    async create(subscription: NewSubscription): Promise<Subscription> {
      return db
        .insertInto('subscription')
        .values(subscription)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async createIfNew(
      subscription: NewSubscription,
    ): Promise<{ subscription: Subscription; created: boolean }> {
      const created = await db
        .insertInto('subscription')
        .values(subscription)
        .onConflict((oc) => oc.doNothing())
        .returningAll()
        .executeTakeFirst();
      if (created) return { subscription: created, created: true };
      const existing = await this.findByStripeSubscriptionId(subscription.stripe_subscription_id);
      if (!existing) throw new Error('Failed to create subscription');
      return { subscription: existing, created: false };
    },

    /** Apply provider state only when Stripe's event cursor is newer. */
    async updateIfNewer(
      id: string,
      cursor: SubscriptionEventCursor,
      patch: SubscriptionStatePatch,
    ): Promise<Subscription | undefined> {
      const created = String(cursor.createdAt);
      return db
        .updateTable('subscription')
        .set({
          ...patch,
          last_event_created: created,
          last_event_id: cursor.id,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .where((eb) =>
          eb.or([
            eb('last_event_created', '<', created),
            eb.and([eb('last_event_created', '=', created), eb('last_event_id', '<', cursor.id)]),
          ]),
        )
        .returningAll()
        .executeTakeFirst();
    },

    async listDueForExpiry(now = new Date()): Promise<Subscription[]> {
      return db
        .selectFrom('subscription')
        .selectAll()
        .where((eb) =>
          eb.or([
            eb.and([eb('status', '=', 'grace'), eb('grace_ends_at', '<=', now)]),
            eb.and([eb('status', '=', 'cancelled'), eb('current_period_end', '<=', now)]),
            eb.and([
              eb('status', '=', 'active'),
              eb('cancel_at_period_end', '=', true),
              eb('current_period_end', '<=', now),
            ]),
          ]),
        )
        .execute();
    },

    async markExpired(id: string, now = new Date()): Promise<Subscription | undefined> {
      return db
        .updateTable('subscription')
        .set({ status: 'expired', grace_ends_at: null, updated_at: now })
        .where('id', '=', id)
        .where((eb) =>
          eb.or([
            eb.and([eb('status', '=', 'grace'), eb('grace_ends_at', '<=', now)]),
            eb.and([eb('status', '=', 'cancelled'), eb('current_period_end', '<=', now)]),
            eb.and([
              eb('status', '=', 'active'),
              eb('cancel_at_period_end', '=', true),
              eb('current_period_end', '<=', now),
            ]),
          ]),
        )
        .returningAll()
        .executeTakeFirst();
    },

    async findPeriodByInvoiceId(stripeInvoiceId: string): Promise<SubscriptionPeriod | undefined> {
      return db
        .selectFrom('subscription_period')
        .selectAll()
        .where('stripe_invoice_id', '=', stripeInvoiceId)
        .executeTakeFirst();
    },

    async createPeriodIfNew(
      period: NewSubscriptionPeriod,
    ): Promise<{ period: SubscriptionPeriod; created: boolean }> {
      const created = await db
        .insertInto('subscription_period')
        .values(period)
        .onConflict((oc) => oc.doNothing())
        .returningAll()
        .executeTakeFirst();
      if (created) return { period: created, created: true };
      if (!period.stripe_invoice_id) {
        throw new Error('Failed to create subscription period');
      }
      const existing = await this.findPeriodByInvoiceId(period.stripe_invoice_id);
      if (!existing) throw new Error('Failed to create subscription period');
      return { period: existing, created: false };
    },

    async setPeriodPayment(id: string, paymentId: string): Promise<SubscriptionPeriod | undefined> {
      return db
        .updateTable('subscription_period')
        .set({ payment_id: paymentId })
        .where('id', '=', id)
        .where('payment_id', 'is', null)
        .returningAll()
        .executeTakeFirst();
    },

    async listPeriodsBySubscription(subscriptionId: string): Promise<SubscriptionPeriod[]> {
      return db
        .selectFrom('subscription_period')
        .selectAll()
        .where('subscription_id', '=', subscriptionId)
        .orderBy('period_end', 'desc')
        .execute();
    },
  };
}

export type SubscriptionsRepository = ReturnType<typeof createSubscriptionsRepository>;
