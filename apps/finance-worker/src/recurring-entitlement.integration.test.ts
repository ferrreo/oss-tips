import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDb, destroyDb } from '@oss-tips/db';
import { reconcileRecurringEntitlement } from './index.js';

const integration =
  process.env.RUN_DB_INTEGRATION === '1' && process.env.DATABASE_URL ? describe : describe.skip;

integration('recurring entitlement reconciliation', () => {
  it('shortens partial reversals, restores won disputes, and keeps inactive access revoked', async () => {
    const db = createDb(process.env.DATABASE_URL!);
    const ids = {
      organisationId: randomUUID(),
      projectId: randomUUID(),
      tierId: randomUUID(),
      subscriptionId: randomUUID(),
      paymentId: randomUUID(),
      periodId: randomUUID(),
      entitlementId: randomUUID(),
      refundId: randomUUID(),
      disputeId: randomUUID(),
    };
    const now = new Date('2026-08-15T12:00:00.000Z');
    const periodStart = new Date('2026-08-01T12:00:00.000Z');
    const periodEnd = new Date('2026-09-01T12:00:00.000Z');

    try {
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('organisation')
          .values({
            id: ids.organisationId,
            name: 'Recurring entitlement integration',
            slug: `recurring-entitlement-${ids.projectId}`,
          })
          .execute();
        await trx
          .insertInto('project')
          .values({
            id: ids.projectId,
            organisation_id: ids.organisationId,
            name: 'Recurring entitlement integration',
            slug: `recurring-entitlement-${ids.projectId}`,
            status: 'published',
            description: null,
            default_currency: 'gbp',
          })
          .execute();
        await trx
          .insertInto('tier')
          .values({
            id: ids.tierId,
            project_id: ids.projectId,
            name: 'Member',
            slug: 'member',
            description: null,
            rank: 1,
            is_active: true,
            one_off_duration: null,
          })
          .execute();
        await trx
          .insertInto('subscription')
          .values({
            id: ids.subscriptionId,
            project_id: ids.projectId,
            user_id: null,
            tier_id: ids.tierId,
            stripe_subscription_id: `sub_recurring_entitlement_${ids.projectId}`,
            stripe_account_id: `acct_recurring_entitlement_${ids.projectId}`,
            status: 'active',
            current_period_end: periodEnd,
            grace_ends_at: null,
            cancel_at_period_end: false,
            project_amount_minor: 1000,
            platform_tip_minor: 100,
            currency: 'gbp',
            feature_mode: 'standard',
            cadence: 'monthly',
          })
          .execute();
        await trx
          .insertInto('payment')
          .values({
            id: ids.paymentId,
            project_id: ids.projectId,
            user_id: null,
            stripe_account_id: `acct_recurring_entitlement_${ids.projectId}`,
            stripe_payment_intent_id: `pi_recurring_entitlement_${ids.projectId}`,
            stripe_charge_id: `ch_recurring_entitlement_${ids.projectId}`,
            stripe_application_fee_id: null,
            currency: 'gbp',
            exponent: 2,
            customer_charge_minor: 1100,
            project_amount_minor: 1000,
            platform_tip_minor: 100,
            oss_project_fee_minor: 20,
            stripe_application_fee_minor: 120,
            status: 'succeeded',
            cadence: 'monthly',
            feature_mode: 'standard',
            settled_at: periodStart,
          })
          .execute();
        await trx
          .insertInto('subscription_period')
          .values({
            id: ids.periodId,
            subscription_id: ids.subscriptionId,
            stripe_invoice_id: `in_recurring_entitlement_${ids.projectId}`,
            period_start: periodStart,
            period_end: periodEnd,
            payment_id: ids.paymentId,
          })
          .execute();
        await trx
          .insertInto('entitlement')
          .values({
            id: ids.entitlementId,
            project_id: ids.projectId,
            user_id: null,
            tier_id: ids.tierId,
            payment_id: ids.paymentId,
            subscription_id: ids.subscriptionId,
            kind: 'membership',
            tier_rank: 1,
            starts_at: periodStart,
            ends_at: periodEnd,
            revoked_at: null,
            transition_key: `membership:recurring-entitlement:${ids.paymentId}`,
          })
          .execute();
      });

      await db
        .insertInto('refund')
        .values({
          id: ids.refundId,
          payment_id: ids.paymentId,
          stripe_refund_id: `re_recurring_entitlement_${ids.projectId}`,
          idempotency_key: `re_recurring_entitlement_${ids.projectId}`,
          amount_minor: 550,
          application_fee_refund_minor: 60,
          stripe_application_fee_refund_id: null,
          currency: 'gbp',
          status: 'succeeded',
          reason: null,
        })
        .execute();
      await reconcileRecurringEntitlement(db, ids.paymentId, now);
      await expect(
        db
          .selectFrom('entitlement')
          .select(['ends_at', 'revoked_at'])
          .where('id', '=', ids.entitlementId)
          .executeTakeFirstOrThrow(),
      ).resolves.toEqual({
        ends_at: new Date('2026-08-17T00:00:00.000Z'),
        revoked_at: null,
      });

      await db
        .insertInto('payment_dispute')
        .values({
          id: ids.disputeId,
          payment_id: ids.paymentId,
          stripe_dispute_id: `dp_recurring_entitlement_${ids.projectId}`,
          status: 'under_review',
          amount_minor: 550,
          currency: 'gbp',
          last_event_created: '1',
          last_event_id: `evt_recurring_entitlement_${ids.projectId}`,
        })
        .execute();
      await reconcileRecurringEntitlement(db, ids.paymentId, now);
      await expect(
        db
          .selectFrom('entitlement')
          .select(['ends_at', 'revoked_at'])
          .where('id', '=', ids.entitlementId)
          .executeTakeFirstOrThrow(),
      ).resolves.toEqual({ ends_at: periodStart, revoked_at: now });

      await db
        .updateTable('payment_dispute')
        .set({ status: 'won' })
        .where('id', '=', ids.disputeId)
        .execute();
      await reconcileRecurringEntitlement(db, ids.paymentId, now);
      await expect(
        db
          .selectFrom('entitlement')
          .select(['ends_at', 'revoked_at'])
          .where('id', '=', ids.entitlementId)
          .executeTakeFirstOrThrow(),
      ).resolves.toEqual({
        ends_at: new Date('2026-08-17T00:00:00.000Z'),
        revoked_at: null,
      });

      await db
        .updateTable('payment_dispute')
        .set({ status: 'lost', amount_minor: 1100 })
        .where('id', '=', ids.disputeId)
        .execute();
      await reconcileRecurringEntitlement(db, ids.paymentId, now);
      await expect(
        db
          .selectFrom('entitlement')
          .select(['ends_at', 'revoked_at'])
          .where('id', '=', ids.entitlementId)
          .executeTakeFirstOrThrow(),
      ).resolves.toEqual({ ends_at: periodStart, revoked_at: now });

      await db
        .updateTable('payment_dispute')
        .set({ status: 'won', amount_minor: 550 })
        .where('id', '=', ids.disputeId)
        .execute();
      await db
        .updateTable('subscription')
        .set({ status: 'expired' })
        .where('id', '=', ids.subscriptionId)
        .execute();
      await reconcileRecurringEntitlement(db, ids.paymentId, now);
      await expect(
        db
          .selectFrom('entitlement')
          .select(['ends_at', 'revoked_at'])
          .where('id', '=', ids.entitlementId)
          .executeTakeFirstOrThrow(),
      ).resolves.toEqual({ ends_at: periodStart, revoked_at: now });
    } finally {
      await db.deleteFrom('project').where('id', '=', ids.projectId).execute();
      await db.deleteFrom('organisation').where('id', '=', ids.organisationId).execute();
      await destroyDb(db);
    }
  });
});
