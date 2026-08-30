import { uuidv7 } from '@oss-tips/domain';
import { sql } from 'kysely';
import type { Db } from '../client.js';
import type { NewPayment, Payment } from '../types.js';

export function createPaymentsRepository(db: Db) {
  return {
    async findById(id: string): Promise<Payment | undefined> {
      return db.selectFrom('payment').selectAll().where('id', '=', id).executeTakeFirst();
    },

    async findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<Payment | undefined> {
      return db
        .selectFrom('payment')
        .selectAll()
        .where('stripe_payment_intent_id', '=', stripePaymentIntentId)
        .executeTakeFirst();
    },

    async listByProject(projectId: string, limit = 50): Promise<Payment[]> {
      return db
        .selectFrom('payment')
        .selectAll()
        .where('project_id', '=', projectId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .execute();
    },

    async create(payment: NewPayment): Promise<Payment> {
      return db.insertInto('payment').values(payment).returningAll().executeTakeFirstOrThrow();
    },

    async updateProviderDetails(
      id: string,
      details: {
        stripe_payment_intent_id?: string | null | undefined;
        stripe_charge_id?: string | null | undefined;
      },
    ): Promise<Payment | undefined> {
      const patch = {
        ...(details.stripe_payment_intent_id !== undefined
          ? { stripe_payment_intent_id: details.stripe_payment_intent_id }
          : {}),
        ...(details.stripe_charge_id !== undefined
          ? { stripe_charge_id: details.stripe_charge_id }
          : {}),
      };
      if (Object.keys(patch).length === 0) return this.findById(id);
      return db
        .updateTable('payment')
        .set({ ...patch, updated_at: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },

    async markSettled(id: string, settledAt = new Date()): Promise<Payment | undefined> {
      return db
        .updateTable('payment')
        .set({
          status: sql<string>`CASE WHEN status IN ('refunded', 'disputed') THEN status ELSE 'succeeded' END`,
          settled_at: sql<Date>`COALESCE(settled_at, ${settledAt})`,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
    },

    async createAllocations(
      paymentId: string,
      allocations: Array<{ kind: string; amount_minor: string | bigint; currency: string }>,
    ): Promise<void> {
      if (allocations.length === 0) return;
      await db
        .insertInto('payment_allocation')
        .values(
          allocations.map((a) => ({
            id: uuidv7(),
            payment_id: paymentId,
            kind: a.kind,
            amount_minor: a.amount_minor,
            currency: a.currency,
          })),
        )
        .execute();
    },
  };
}

export type PaymentsRepository = ReturnType<typeof createPaymentsRepository>;
