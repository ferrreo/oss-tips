import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createDb,
  createEntitlementsRepository,
  emailNotificationJob,
  createPaymentsRepository,
  createSubscriptionsRepository,
  destroyDb,
  type Db,
  type StripeEvent,
} from '@oss-tips/db';
import { MockLedgerClient } from '@oss-tips/ledger';
import { MockStripeClient } from '@oss-tips/payments';
import {
  processMembershipEventWithNotification,
  type MembershipLedgerPostingInput,
  type MembershipRuntimeDeps,
  type MembershipTransactionDeps,
} from './membership.js';
import { persistLedgerPosting } from './index.js';

const integration =
  process.env.RUN_DB_INTEGRATION === '1' && process.env.DATABASE_URL ? describe : describe.skip;

class FlakyLedgerClient extends MockLedgerClient {
  failReplay = true;

  override async createTransfers(transfers: Parameters<MockLedgerClient['createTransfers']>[0]) {
    if (this.failReplay) return { ok: false as const, error: 'ledger unavailable' };
    return super.createTransfers(transfers);
  }
}

class BarrierLedgerClient extends MockLedgerClient {
  private replayCount = 0;
  private release!: () => void;
  private readonly bothReplays: Promise<void>;

  constructor() {
    super();
    this.bothReplays = new Promise((resolve) => {
      this.release = resolve;
    });
  }

  override async createTransfers(transfers: Parameters<MockLedgerClient['createTransfers']>[0]) {
    this.replayCount += 1;
    if (this.replayCount === 1) await this.bothReplays;
    if (this.replayCount === 2) this.release();
    return super.createTransfers(transfers);
  }
}

function membershipStore(db: Db) {
  return {
    ...createSubscriptionsRepository(db),
    entitlements: createEntitlementsRepository(db),
    payments: createPaymentsRepository(db),
  };
}

function runtime(db: Db, ledger: MockLedgerClient, failNotification: () => boolean) {
  const transaction: MembershipRuntimeDeps['transaction'] = async <T>(
    operation: (deps: MembershipTransactionDeps) => Promise<T>,
  ): Promise<T> => {
    const deferred: Array<
      (deps: {
        store: ReturnType<typeof membershipStore>;
        ledger: MockLedgerClient;
        persistLedgerPosting: (input: MembershipLedgerPostingInput) => Promise<void>;
        transaction: MembershipRuntimeDeps['transaction'];
      }) => Promise<void>
    > = [];
    const result = await db.transaction().execute(async (trx) =>
      operation({
        store: membershipStore(trx),
        persistLedgerPosting: (input) => persistLedgerPosting(trx, input),
        deferAfterCommit: (callback) => deferred.push(callback),
        enqueueEmailNotification: async (payload) => {
          if (failNotification()) throw new Error('notification unavailable');
          await trx.insertInto('job').values(emailNotificationJob(payload)).execute();
        },
        notifyGraceEnding: async () => undefined,
      }),
    );
    const postCommitDeps = {
      store: membershipStore(db),
      ledger,
      persistLedgerPosting: (input: MembershipLedgerPostingInput) =>
        persistLedgerPosting(db, input),
      transaction,
    };
    for (const callback of deferred) await callback(postCommitDeps);
    return result;
  };

  return {
    store: membershipStore(db),
    stripe: new MockStripeClient(),
    ledger,
    persistLedgerPosting: (input: MembershipLedgerPostingInput) => persistLedgerPosting(db, input),
    transaction,
  } satisfies MembershipRuntimeDeps;
}

function paidEvent(input: {
  eventId: string;
  accountId: string;
  projectId: string;
  tierId: string;
  userId: string;
  subscriptionId: string;
  invoiceId: string;
  paymentIntentId: string;
  chargeId: string;
  periodStart: Date;
  periodEnd: Date;
}): StripeEvent {
  const metadata = {
    project_id: input.projectId,
    tier_id: input.tierId,
    user_id: input.userId,
    subscription_id: input.subscriptionId,
    currency: 'gbp',
    feature_mode: 'standard',
    cadence: 'monthly',
    project_amount_minor: '1000',
    platform_tip_minor: '100',
    oss_project_fee_minor: '20',
    application_fee_minor: '120',
    customer_charge_minor: '1100',
  };
  return {
    id: randomUUID(),
    stripe_event_id: input.eventId,
    stripe_account_id: input.accountId,
    event_type: 'invoice.paid',
    api_version: null,
    payload: {
      id: input.eventId,
      type: 'invoice.paid',
      created: Math.floor(input.periodStart.getTime() / 1000),
      account: input.accountId,
      data: {
        object: {
          object: 'invoice',
          id: input.invoiceId,
          subscription: input.subscriptionId,
          status: 'paid',
          currency: 'gbp',
          subtotal: 1100,
          amount_due: 1100,
          total: 1100,
          amount_paid: 1100,
          application_fee_amount: 120,
          period_start: Math.floor(input.periodStart.getTime() / 1000),
          period_end: Math.floor(input.periodEnd.getTime() / 1000),
          payment_intent: input.paymentIntentId,
          charge: input.chargeId,
          metadata,
        },
      },
    },
    processed_at: null,
    process_error: null,
    processing_at: null,
    processing_by: null,
    processing_attempts: 0,
    received_at: input.periodStart,
  };
}

async function eventNotificationJobs(db: Db, eventId: string): Promise<string[]> {
  const jobs = await db
    .selectFrom('job')
    .select(['id', 'payload'])
    .where('kind', '=', 'email.notification')
    .execute();
  return jobs
    .filter(
      (job) =>
        typeof job.payload === 'object' &&
        job.payload !== null &&
        !Array.isArray(job.payload) &&
        (job.payload as Record<string, unknown>).event_id === eventId,
    )
    .map((job) => job.id);
}

async function membershipNotificationEvents(db: Db, eventIds: string[]): Promise<string[]> {
  const jobs = await db
    .selectFrom('job')
    .select('payload')
    .where('kind', '=', 'email.notification')
    .execute();
  return jobs.flatMap((job) => {
    if (typeof job.payload !== 'object' || job.payload === null || Array.isArray(job.payload)) {
      return [];
    }
    const payload = job.payload as Record<string, unknown>;
    return typeof payload.event_id === 'string' &&
      eventIds.includes(payload.event_id) &&
      typeof payload.event === 'string'
      ? [payload.event]
      : [];
  });
}

integration('membership settlement transaction boundary', () => {
  it('keeps access and email pending after replay failure, then grants exactly once on retry', async () => {
    const db = createDb(process.env.DATABASE_URL!);
    const suffix = randomUUID().replaceAll('-', '');
    const ids = {
      organisationId: randomUUID(),
      projectId: randomUUID(),
      tierId: randomUUID(),
      userId: randomUUID(),
      accountId: `acct_membership_${suffix}`,
      eventId: `evt_membership_${suffix}`,
      subscriptionId: `sub_membership_${suffix}`,
      invoiceId: `in_membership_${suffix}`,
      paymentIntentId: `pi_membership_${suffix}`,
      chargeId: `ch_membership_${suffix}`,
    };
    const periodStart = new Date('2026-08-29T12:00:00.000Z');
    const periodEnd = new Date('2026-09-28T12:00:00.000Z');
    const event = paidEvent({ ...ids, periodStart, periodEnd });
    const ledger = new FlakyLedgerClient();
    let failNotification = false;
    const deps = runtime(db, ledger, () => failNotification);
    const semanticKey = `${ids.accountId}:${ids.invoiceId}:membership_settlement:1`;

    try {
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('user')
          .values({
            id: ids.userId,
            name: 'Membership integration test',
            email: `${ids.userId}@example.test`,
            email_verified: true,
            image: null,
          })
          .execute();
        await trx
          .insertInto('organisation')
          .values({
            id: ids.organisationId,
            name: 'Membership integration',
            slug: `membership-${suffix}`,
          })
          .execute();
        await trx
          .insertInto('project')
          .values({
            id: ids.projectId,
            organisation_id: ids.organisationId,
            name: 'Membership integration',
            slug: `membership-${suffix}`,
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
      });

      await expect(
        processMembershipEventWithNotification(event, deps, periodStart),
      ).rejects.toThrow('ledger unavailable');
      expect(ledger.listTransfers()).toHaveLength(0);
      await expect(
        db
          .selectFrom('payment')
          .select(['id', 'status'])
          .where('project_id', '=', ids.projectId)
          .execute(),
      ).resolves.toMatchObject([{ status: 'pending' }]);
      await expect(
        db.selectFrom('entitlement').select('id').where('project_id', '=', ids.projectId).execute(),
      ).resolves.toEqual([]);
      await expect(
        db
          .selectFrom('ledger_posting_intent')
          .select(['id', 'status'])
          .where('semantic_key', '=', semanticKey)
          .execute(),
      ).resolves.toMatchObject([{ status: 'pending' }]);
      await expect(eventNotificationJobs(db, ids.eventId)).resolves.toEqual([]);

      ledger.failReplay = false;
      await processMembershipEventWithNotification(event, deps, periodStart);

      const payment = await db
        .selectFrom('payment')
        .select(['id', 'status'])
        .where('project_id', '=', ids.projectId)
        .executeTakeFirstOrThrow();
      expect(payment.status).toBe('succeeded');
      const intent = await db
        .selectFrom('ledger_posting_intent')
        .select(['id', 'payment_id', 'status'])
        .where('semantic_key', '=', semanticKey)
        .executeTakeFirstOrThrow();
      expect(intent).toMatchObject({ payment_id: payment.id, status: 'posted' });
      const result = await db
        .selectFrom('ledger_posting_result')
        .select(['status', 'tigerbeetle_transfer_ids'])
        .where('intent_id', '=', intent.id)
        .executeTakeFirstOrThrow();
      expect(result.status).toBe('posted');
      expect(result.tigerbeetle_transfer_ids).toHaveLength(4);
      await expect(
        db.selectFrom('entitlement').select('id').where('project_id', '=', ids.projectId).execute(),
      ).resolves.toHaveLength(1);
      expect(await eventNotificationJobs(db, ids.eventId)).toHaveLength(1);

      const originalSettledAt = (
        await db
          .selectFrom('payment')
          .select('settled_at')
          .where('id', '=', payment.id)
          .executeTakeFirstOrThrow()
      ).settled_at;
      await db
        .updateTable('payment')
        .set({ status: 'refunded' })
        .where('id', '=', payment.id)
        .execute();
      await processMembershipEventWithNotification(event, deps, periodStart);
      const replayedPayment = await db
        .selectFrom('payment')
        .select(['status', 'settled_at'])
        .where('id', '=', payment.id)
        .executeTakeFirstOrThrow();
      expect(replayedPayment.status).toBe('refunded');
      expect(replayedPayment.settled_at).toEqual(originalSettledAt);
    } finally {
      await db
        .deleteFrom('ledger_posting_intent')
        .where('semantic_key', '=', semanticKey)
        .execute();
      for (const jobId of await eventNotificationJobs(db, ids.eventId)) {
        await db.deleteFrom('job').where('id', '=', jobId).execute();
      }
      await db.deleteFrom('project').where('id', '=', ids.projectId).execute();
      await db.deleteFrom('organisation').where('id', '=', ids.organisationId).execute();
      await db.deleteFrom('user').where('id', '=', ids.userId).execute();
      await destroyDb(db);
    }
  });

  it('serializes concurrent first settlements into one started and one renewed event', async () => {
    const db = createDb(process.env.DATABASE_URL!);
    const suffix = randomUUID().replaceAll('-', '');
    const ids = {
      organisationId: randomUUID(),
      projectId: randomUUID(),
      tierId: randomUUID(),
      userId: randomUUID(),
      accountId: `acct_membership_race_${suffix}`,
      subscriptionId: `sub_membership_race_${suffix}`,
    };
    const invoiceIds = {
      first: `in_membership_race_a_${suffix}`,
      second: `in_membership_race_b_${suffix}`,
    };
    const periodStart = new Date('2026-08-29T12:00:00.000Z');
    const periodEnd = new Date('2026-09-28T12:00:00.000Z');
    const first = paidEvent({
      ...ids,
      eventId: `evt_membership_race_a_${suffix}`,
      invoiceId: invoiceIds.first,
      paymentIntentId: `pi_membership_race_a_${suffix}`,
      chargeId: `ch_membership_race_a_${suffix}`,
      periodStart,
      periodEnd,
    });
    const second = paidEvent({
      ...ids,
      eventId: `evt_membership_race_b_${suffix}`,
      invoiceId: invoiceIds.second,
      paymentIntentId: `pi_membership_race_b_${suffix}`,
      chargeId: `ch_membership_race_b_${suffix}`,
      periodStart: periodEnd,
      periodEnd: new Date('2026-10-28T12:00:00.000Z'),
    });
    const ledger = new BarrierLedgerClient();
    const deps = runtime(db, ledger, () => false);

    try {
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('user')
          .values({
            id: ids.userId,
            name: 'Membership race integration test',
            email: `${ids.userId}@example.test`,
            email_verified: true,
            image: null,
          })
          .execute();
        await trx
          .insertInto('organisation')
          .values({
            id: ids.organisationId,
            name: 'Membership race integration',
            slug: `membership-race-${suffix}`,
          })
          .execute();
        await trx
          .insertInto('project')
          .values({
            id: ids.projectId,
            organisation_id: ids.organisationId,
            name: 'Membership race integration',
            slug: `membership-race-${suffix}`,
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
      });

      const results = await Promise.all([
        processMembershipEventWithNotification(first, deps, periodStart),
        processMembershipEventWithNotification(second, deps, periodStart),
      ]);
      expect(results.filter((result) => result.firstSettlement)).toHaveLength(1);
      expect(results.filter((result) => !result.firstSettlement)).toHaveLength(1);

      await expect(
        db
          .selectFrom('subscription_period')
          .select('subscription_period.id')
          .innerJoin('subscription', 'subscription.id', 'subscription_period.subscription_id')
          .where('subscription.stripe_subscription_id', '=', ids.subscriptionId)
          .execute(),
      ).resolves.toHaveLength(2);
      await expect(
        db.selectFrom('entitlement').select('id').where('project_id', '=', ids.projectId).execute(),
      ).resolves.toHaveLength(2);
      const events = await membershipNotificationEvents(db, [
        first.stripe_event_id,
        second.stripe_event_id,
      ]);
      expect(events.sort()).toEqual(['renewed', 'started']);
    } finally {
      for (const eventId of [first.stripe_event_id, second.stripe_event_id]) {
        for (const jobId of await eventNotificationJobs(db, eventId)) {
          await db.deleteFrom('job').where('id', '=', jobId).execute();
        }
      }
      await db
        .deleteFrom('ledger_posting_intent')
        .where('stripe_event_id', 'in', [invoiceIds.first, invoiceIds.second])
        .execute();
      await db.deleteFrom('project').where('id', '=', ids.projectId).execute();
      await db.deleteFrom('organisation').where('id', '=', ids.organisationId).execute();
      await db.deleteFrom('user').where('id', '=', ids.userId).execute();
      await destroyDb(db);
    }
  });
});
