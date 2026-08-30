import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDb, destroyDb, type StripeEvent } from '@oss-tips/db';
import { MockLedgerClient } from '@oss-tips/ledger';
import { processStripeEvent, reconcileOneOffEntitlement } from './index.js';

const integration =
  process.env.RUN_DB_INTEGRATION === '1' && process.env.DATABASE_URL ? describe : describe.skip;

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

integration('one-off entitlement reconciliation concurrency', () => {
  it('waits for the payment lock and applies refund plus dispute together', async () => {
    const db = createDb(process.env.DATABASE_URL!);
    const ids = {
      organisationId: randomUUID(),
      projectId: randomUUID(),
      tierId: randomUUID(),
      paymentId: randomUUID(),
      refundId: randomUUID(),
      disputeId: randomUUID(),
      entitlementId: randomUUID(),
    };
    const now = new Date('2026-08-30T12:00:00.000Z');
    let releaseCorrection: (() => void) | undefined;
    let correctionReady!: () => void;
    const correctionInserted = new Promise<void>((resolve) => {
      correctionReady = resolve;
    });
    const correctionReleased = new Promise<void>((resolve) => {
      releaseCorrection = resolve;
    });
    let correctionTransaction: Promise<unknown> | undefined;

    try {
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('organisation')
          .values({
            id: ids.organisationId,
            name: 'Reconciliation concurrency',
            slug: ids.projectId,
          })
          .execute();
        await trx
          .insertInto('project')
          .values({
            id: ids.projectId,
            organisation_id: ids.organisationId,
            name: 'Reconciliation concurrency',
            slug: ids.projectId,
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
            name: 'Supporter',
            slug: 'supporter',
            description: null,
            rank: 1,
            is_active: true,
            one_off_duration: 'days_30',
          })
          .execute();
        await trx
          .insertInto('payment')
          .values({
            id: ids.paymentId,
            project_id: ids.projectId,
            user_id: null,
            stripe_account_id: 'acct_reconciliation_test',
            stripe_payment_intent_id: null,
            stripe_charge_id: null,
            stripe_application_fee_id: null,
            currency: 'gbp',
            exponent: 2,
            customer_charge_minor: 1000,
            project_amount_minor: 1000,
            platform_tip_minor: 0,
            oss_project_fee_minor: 0,
            stripe_application_fee_minor: 0,
            status: 'succeeded',
            cadence: 'one_off',
            feature_mode: 'standard',
            settled_at: new Date('2026-08-01T12:00:00.000Z'),
          })
          .execute();
        await trx
          .insertInto('checkout_intent')
          .values({
            id: ids.paymentId,
            project_id: ids.projectId,
            user_id: null,
            stripe_checkout_session_id: null,
            currency: 'gbp',
            project_amount_minor: 1000,
            platform_tip_minor: 0,
            tier_id: ids.tierId,
            cadence: 'one_off',
            expires_at: new Date('2026-09-30T12:00:00.000Z'),
          })
          .execute();
        await trx
          .insertInto('refund')
          .values({
            id: ids.refundId,
            payment_id: ids.paymentId,
            stripe_refund_id: `re_${ids.refundId.replaceAll('-', '')}`,
            idempotency_key: `re_${ids.refundId.replaceAll('-', '')}`,
            amount_minor: 600,
            application_fee_refund_minor: 0,
            stripe_application_fee_refund_id: null,
            currency: 'gbp',
            status: 'succeeded',
            reason: null,
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
            subscription_id: null,
            kind: 'one_off',
            tier_rank: 1,
            starts_at: new Date('2026-08-01T12:00:00.000Z'),
            ends_at: new Date('2026-08-31T12:00:00.000Z'),
            revoked_at: null,
            transition_key: `one_off:${ids.paymentId}:grant`,
          })
          .execute();
      });

      // Keep the correction uncommitted. Its payment foreign-key key-share lock
      // makes reconciliation's payment FOR UPDATE wait without blocking the
      // correction insert itself.
      correctionTransaction = db.transaction().execute(async (trx) => {
        await trx
          .insertInto('payment_dispute')
          .values({
            id: ids.disputeId,
            payment_id: ids.paymentId,
            stripe_dispute_id: `dp_${ids.disputeId.replaceAll('-', '')}`,
            status: 'lost',
            amount_minor: 500,
            currency: 'gbp',
            last_event_created: '1',
            last_event_id: `evt_${ids.disputeId.replaceAll('-', '')}`,
          })
          .execute();
        correctionReady();
        await correctionReleased;
      });
      await correctionInserted;
      const reconciliation = reconcileOneOffEntitlement(db, ids.paymentId, now);
      const blocked = await Promise.race([
        reconciliation.then(() => false),
        wait(30).then(() => true),
      ]);
      expect(blocked).toBe(true);

      releaseCorrection?.();
      await correctionTransaction;
      await reconciliation;

      const entitlement = await db
        .selectFrom('entitlement')
        .select(['revoked_at', 'ends_at'])
        .where('payment_id', '=', ids.paymentId)
        .executeTakeFirstOrThrow();
      expect(entitlement.revoked_at).toEqual(now);
      expect(entitlement.ends_at).toEqual(new Date('2026-08-01T12:00:00.000Z'));

      // A refund can be recorded before the settlement webhook is retried.
      // Settlement must fill missing ledger/payment details without reopening
      // the already terminal payment status.
      await db
        .updateTable('payment')
        .set({ status: 'refunded' })
        .where('id', '=', ids.paymentId)
        .execute();
      const settledBeforeReplay = (
        await db
          .selectFrom('payment')
          .select('settled_at')
          .where('id', '=', ids.paymentId)
          .executeTakeFirstOrThrow()
      ).settled_at;
      const settlementEvent: StripeEvent = {
        id: randomUUID(),
        stripe_event_id: `evt_settlement_${ids.paymentId.replaceAll('-', '')}`,
        stripe_account_id: 'acct_reconciliation_test',
        event_type: 'checkout.session.completed',
        api_version: null,
        payload: {
          id: `evt_settlement_${ids.paymentId.replaceAll('-', '')}`,
          type: 'checkout.session.completed',
          created: Math.floor(now.getTime() / 1000),
          account: 'acct_reconciliation_test',
          data: {
            object: {
              object: 'checkout.session',
              id: `cs_${ids.paymentId.replaceAll('-', '')}`,
              payment_intent: `pi_${ids.paymentId.replaceAll('-', '')}`,
              payment_status: 'paid',
              amount_total: 1000,
              currency: 'gbp',
              metadata: {
                payment_id: ids.paymentId,
                project_id: ids.projectId,
                currency: 'gbp',
                feature_mode: 'standard',
                cadence: 'one_off',
                project_amount_minor: '1000',
                platform_tip_minor: '0',
                oss_project_fee_minor: '0',
                application_fee_minor: '0',
                customer_charge_minor: '1000',
              },
            },
          },
        },
        received_at: now,
        processed_at: null,
        process_error: null,
        processing_at: null,
        processing_by: null,
        processing_attempts: 0,
      };
      await processStripeEvent(settlementEvent, {
        db,
        ledger: new MockLedgerClient(),
        membership: undefined as never,
      });
      const replayed = await db
        .selectFrom('payment')
        .select(['status', 'settled_at', 'stripe_payment_intent_id'])
        .where('id', '=', ids.paymentId)
        .executeTakeFirstOrThrow();
      expect(replayed.status).toBe('refunded');
      expect(replayed.settled_at).toEqual(settledBeforeReplay);
      expect(replayed.stripe_payment_intent_id).toBe(`pi_${ids.paymentId.replaceAll('-', '')}`);
    } finally {
      releaseCorrection?.();
      await correctionTransaction?.catch(() => undefined);
      await db
        .deleteFrom('ledger_posting_intent')
        .where('payment_id', '=', ids.paymentId)
        .execute();
      await db.deleteFrom('project').where('id', '=', ids.projectId).execute();
      await db.deleteFrom('organisation').where('id', '=', ids.organisationId).execute();
      await destroyDb(db);
    }
  });

  it('restores won disputes only while timed access is naturally active', async () => {
    const db = createDb(process.env.DATABASE_URL!);
    const organisationId = randomUUID();
    const projectId = randomUUID();
    const now = new Date('2026-08-10T12:00:00.000Z');
    const cases = [
      {
        name: 'timed-active',
        duration: 'days_30',
        startsAt: new Date('2026-08-01T12:00:00.000Z'),
        refundMinor: 0,
        disputeMinor: 1000,
        expectedEndsAt: new Date('2026-08-31T12:00:00.000Z'),
        expectedRevoked: false,
      },
      {
        name: 'timed-expired',
        duration: 'days_30',
        startsAt: new Date('2026-07-01T12:00:00.000Z'),
        refundMinor: 0,
        disputeMinor: 1000,
        expectedEndsAt: new Date('2026-07-31T12:00:00.000Z'),
        expectedRevoked: true,
      },
      {
        name: 'permanent',
        duration: 'permanent',
        startsAt: new Date('2026-01-01T12:00:00.000Z'),
        refundMinor: 0,
        disputeMinor: 1000,
        expectedEndsAt: null,
        expectedRevoked: false,
      },
      {
        name: 'remaining-refund',
        duration: 'days_30',
        startsAt: new Date('2026-08-01T12:00:00.000Z'),
        refundMinor: 400,
        disputeMinor: 600,
        expectedEndsAt: new Date('2026-08-19T12:00:00.000Z'),
        expectedRevoked: false,
      },
    ] as const;
    const ids = cases.map((scenario) => ({
      ...scenario,
      tierId: randomUUID(),
      paymentId: randomUUID(),
      refundId: randomUUID(),
      disputeId: randomUUID(),
      entitlementId: randomUUID(),
    }));

    try {
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('organisation')
          .values({
            id: organisationId,
            name: 'Won dispute restoration',
            slug: `won-dispute-${projectId}`,
          })
          .execute();
        await trx
          .insertInto('project')
          .values({
            id: projectId,
            organisation_id: organisationId,
            name: 'Won dispute restoration',
            slug: `won-dispute-${projectId}`,
            status: 'published',
            description: null,
            default_currency: 'gbp',
          })
          .execute();
        for (const scenario of ids) {
          await trx
            .insertInto('tier')
            .values({
              id: scenario.tierId,
              project_id: projectId,
              name: scenario.name,
              slug: scenario.name,
              description: null,
              rank: 1,
              is_active: true,
              one_off_duration: scenario.duration,
            })
            .execute();
          await trx
            .insertInto('payment')
            .values({
              id: scenario.paymentId,
              project_id: projectId,
              user_id: null,
              stripe_account_id: 'acct_won_dispute_test',
              stripe_payment_intent_id: null,
              stripe_charge_id: null,
              stripe_application_fee_id: null,
              currency: 'gbp',
              exponent: 2,
              customer_charge_minor: 1000,
              project_amount_minor: 1000,
              platform_tip_minor: 0,
              oss_project_fee_minor: 0,
              stripe_application_fee_minor: 0,
              status: 'succeeded',
              cadence: 'one_off',
              feature_mode: 'standard',
              settled_at: scenario.startsAt,
            })
            .execute();
          await trx
            .insertInto('checkout_intent')
            .values({
              id: scenario.paymentId,
              project_id: projectId,
              user_id: null,
              stripe_checkout_session_id: null,
              currency: 'gbp',
              project_amount_minor: 1000,
              platform_tip_minor: 0,
              tier_id: scenario.tierId,
              cadence: 'one_off',
              expires_at: new Date('2026-12-31T12:00:00.000Z'),
            })
            .execute();
          if (scenario.refundMinor > 0) {
            await trx
              .insertInto('refund')
              .values({
                id: scenario.refundId,
                payment_id: scenario.paymentId,
                stripe_refund_id: `re_${scenario.refundId.replaceAll('-', '')}`,
                idempotency_key: `re_${scenario.refundId.replaceAll('-', '')}`,
                amount_minor: scenario.refundMinor,
                application_fee_refund_minor: 0,
                stripe_application_fee_refund_id: null,
                currency: 'gbp',
                status: 'succeeded',
                reason: null,
              })
              .execute();
          }
          await trx
            .insertInto('payment_dispute')
            .values({
              id: scenario.disputeId,
              payment_id: scenario.paymentId,
              stripe_dispute_id: `dp_${scenario.disputeId.replaceAll('-', '')}`,
              status: 'lost',
              amount_minor: scenario.disputeMinor,
              currency: 'gbp',
              last_event_created: '1',
              last_event_id: `evt_${scenario.disputeId.replaceAll('-', '')}`,
            })
            .execute();
          await trx
            .insertInto('entitlement')
            .values({
              id: scenario.entitlementId,
              project_id: projectId,
              user_id: null,
              tier_id: scenario.tierId,
              payment_id: scenario.paymentId,
              subscription_id: null,
              kind: 'one_off',
              tier_rank: 1,
              starts_at: scenario.startsAt,
              ends_at: scenario.startsAt,
              revoked_at: null,
              transition_key: `one_off:${scenario.paymentId}:grant`,
            })
            .execute();
        }
      });

      for (const scenario of ids) {
        await reconcileOneOffEntitlement(db, scenario.paymentId, now);
      }
      await db
        .updateTable('payment_dispute')
        .set({ status: 'won' })
        .where(
          'payment_id',
          'in',
          ids.map((scenario) => scenario.paymentId),
        )
        .execute();
      for (const scenario of ids) {
        await reconcileOneOffEntitlement(db, scenario.paymentId, now);
      }

      for (const scenario of ids) {
        const entitlement = await db
          .selectFrom('entitlement')
          .select(['ends_at', 'revoked_at'])
          .where('id', '=', scenario.entitlementId)
          .executeTakeFirstOrThrow();
        expect(entitlement.ends_at).toEqual(scenario.expectedEndsAt);
        expect(entitlement.revoked_at === null).toBe(!scenario.expectedRevoked);
      }
    } finally {
      await db.deleteFrom('project').where('id', '=', projectId).execute();
      await db.deleteFrom('organisation').where('id', '=', organisationId).execute();
      await destroyDb(db);
    }
  });
});
