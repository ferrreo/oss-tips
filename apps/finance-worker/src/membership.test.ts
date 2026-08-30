import { describe, expect, it } from 'vitest';
import type {
  Entitlement,
  NewEntitlement,
  NewSubscription,
  Payment,
  StripeEvent,
  Subscription,
  SubscriptionPeriod,
} from '@oss-tips/db';
import { MockLedgerClient } from '@oss-tips/ledger';
import { MockStripeClient } from '@oss-tips/payments';
import {
  expireDueMemberships,
  membershipNotificationEvent,
  processMembershipEvent,
  processMembershipEventWithNotification,
  type MembershipTransactionDeps,
  type MembershipRuntimeDeps,
} from './membership.js';

const NOW = new Date('2026-08-29T12:00:00.000Z');
const PERIOD_START = Math.floor(NOW.getTime() / 1000);
const PERIOD_END = PERIOD_START + 30 * 24 * 60 * 60;

function metadata(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    project_id: 'project_1',
    tier_id: 'tier_1',
    user_id: 'user_1',
    subscription_id: 'sub_1',
    currency: 'gbp',
    feature_mode: 'standard',
    cadence: 'monthly',
    project_amount_minor: '1000',
    platform_tip_minor: '100',
    oss_project_fee_minor: '20',
    application_fee_minor: '120',
    customer_charge_minor: '1100',
    ...overrides,
  };
}

function event(
  type: StripeEvent['event_type'],
  id: string,
  created: number,
  object: Record<string, unknown>,
): StripeEvent {
  return {
    id: `row-${id}`,
    stripe_event_id: id,
    stripe_account_id: 'acct_1',
    event_type: type,
    api_version: null,
    payload: {
      id,
      type,
      created,
      account: 'acct_1',
      data: { object },
    },
    processed_at: null,
    process_error: null,
    processing_at: null,
    processing_by: null,
    processing_attempts: 0,
    received_at: NOW,
  } as StripeEvent;
}

function invoiceObject(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    object: 'invoice',
    id: 'in_1',
    subscription: 'sub_1',
    status: 'paid',
    currency: 'gbp',
    subtotal: 1100,
    amount_due: 1100,
    total: 1100,
    amount_paid: 1100,
    application_fee_amount: 120,
    period_start: PERIOD_START,
    period_end: PERIOD_END,
    payment_intent: 'pi_1',
    charge: 'ch_1',
    metadata: metadata(),
    ...overrides,
  };
}

function subscriptionObject(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    object: 'subscription',
    id: 'sub_1',
    status: 'active',
    current_period_end: PERIOD_END,
    cancel_at_period_end: false,
    metadata: metadata(),
    ...overrides,
  };
}

function makeStore() {
  const subscriptions: Subscription[] = [];
  const periods: SubscriptionPeriod[] = [];
  const paymentRows: Payment[] = [];
  const entitlementRows: Entitlement[] = [];
  const store = {
    subscriptions,
    periods,
    paymentRows,
    entitlementRows,
    async findByStripeSubscriptionId(id: string) {
      return subscriptions.find((row) => row.stripe_subscription_id === id);
    },
    async findByIdForUpdate(id: string) {
      return subscriptions.find((row) => row.id === id);
    },
    async findTierRank(id: string) {
      return id === 'tier_1' ? 2 : undefined;
    },
    async createIfNew(input: NewSubscription) {
      const existing = subscriptions.find(
        (row) => row.stripe_subscription_id === input.stripe_subscription_id,
      );
      if (existing) return { subscription: existing, created: false };
      const row = input as Subscription;
      subscriptions.push(row);
      return { subscription: row, created: true };
    },
    async updateIfNewer(
      id: string,
      cursor: { createdAt: number; id: string },
      patch: Record<string, unknown>,
    ) {
      const row = subscriptions.find((item) => item.id === id);
      if (!row) return undefined;
      const previousCreated = Number(row.last_event_created);
      if (
        cursor.createdAt < previousCreated ||
        (cursor.createdAt === previousCreated && cursor.id <= row.last_event_id)
      ) {
        return undefined;
      }
      Object.assign(row, patch, {
        last_event_created: String(cursor.createdAt),
        last_event_id: cursor.id,
      });
      return row;
    },
    async listDueForExpiry(now: Date) {
      return subscriptions.filter(
        (row) =>
          (row.status === 'grace' && row.grace_ends_at !== null && row.grace_ends_at <= now) ||
          (row.status === 'cancelled' &&
            row.current_period_end !== null &&
            row.current_period_end <= now) ||
          (row.status === 'active' &&
            row.cancel_at_period_end &&
            row.current_period_end !== null &&
            row.current_period_end <= now),
      );
    },
    async markExpired(id: string, now: Date) {
      const row = subscriptions.find((item) => item.id === id);
      if (!row) return undefined;
      const due =
        (row.status === 'grace' && row.grace_ends_at !== null && row.grace_ends_at <= now) ||
        (row.status === 'cancelled' &&
          row.current_period_end !== null &&
          row.current_period_end <= now) ||
        (row.status === 'active' &&
          row.cancel_at_period_end &&
          row.current_period_end !== null &&
          row.current_period_end <= now);
      if (!due) return undefined;
      row.status = 'expired';
      row.grace_ends_at = null;
      return row;
    },
    async createPeriodIfNew(input: Record<string, unknown>) {
      const existing = periods.find((row) => row.stripe_invoice_id === input.stripe_invoice_id);
      if (existing) return { period: existing, created: false };
      const row = input as SubscriptionPeriod;
      periods.push(row);
      return { period: row, created: true };
    },
    async setPeriodPayment(id: string, paymentId: string) {
      const row = periods.find((item) => item.id === id);
      if (!row) return undefined;
      if (row.payment_id === null) row.payment_id = paymentId;
      return row;
    },
    async listPeriodsBySubscription(subscriptionId: string) {
      return periods.filter((row) => row.subscription_id === subscriptionId);
    },
    entitlements: {
      async findByTransitionKey(key: string) {
        return entitlementRows.find((row) => row.transition_key === key);
      },
      async createIfNew(input: NewEntitlement) {
        const existing = entitlementRows.find((row) => row.transition_key === input.transition_key);
        if (existing) return { entitlement: existing, created: false };
        const row = input as Entitlement;
        entitlementRows.push(row);
        return { entitlement: row, created: true };
      },
      async setEndsAtForSubscription(subscriptionId: string, endsAt: Date) {
        return entitlementRows.filter((row) => {
          if (row.subscription_id !== subscriptionId || row.revoked_at !== null) return false;
          if (row.ends_at !== null && row.ends_at <= endsAt) return false;
          row.ends_at = endsAt;
          return true;
        });
      },
      async revokeForSubscription(subscriptionId: string, revokedAt: Date) {
        return entitlementRows.filter((row) => {
          if (row.subscription_id !== subscriptionId || row.revoked_at !== null) return false;
          row.revoked_at = revokedAt;
          return true;
        });
      },
    },
    payments: {
      async findById(id: string) {
        return paymentRows.find((row) => row.id === id);
      },
      async create(input: any) {
        const row = input as Payment;
        paymentRows.push(row);
        return row;
      },
      async updateProviderDetails(
        id: string,
        details: { stripe_payment_intent_id?: string | null; stripe_charge_id?: string | null },
      ) {
        const row = paymentRows.find((item) => item.id === id);
        if (!row) return undefined;
        if (details.stripe_payment_intent_id !== undefined)
          row.stripe_payment_intent_id = details.stripe_payment_intent_id;
        if (details.stripe_charge_id !== undefined) row.stripe_charge_id = details.stripe_charge_id;
        return row;
      },
      async markSettled(id: string, settledAt = NOW) {
        const row = paymentRows.find((item) => item.id === id);
        if (!row) return undefined;
        if (row.status !== 'refunded' && row.status !== 'disputed') row.status = 'succeeded';
        if (!row.settled_at) row.settled_at = settledAt;
        return row;
      },
    },
  };
  return store;
}

function deps() {
  const store = makeStore();
  const notifications: Array<Record<string, string>> = [];
  const transaction = async <T>(
    operation: (deps: MembershipTransactionDeps) => Promise<T>,
  ): Promise<T> =>
    operation({
      store: store as unknown as MembershipRuntimeDeps['store'],
      notifyGraceEnding: async () => undefined,
      enqueueEmailNotification: async (payload) => {
        notifications.push(payload);
      },
    });
  const runtime: MembershipRuntimeDeps = {
    store: store as unknown as MembershipRuntimeDeps['store'],
    stripe: new MockStripeClient(),
    ledger: new MockLedgerClient(),
    transaction,
  };
  return { store, runtime, notifications };
}

class FlakyLedgerClient extends MockLedgerClient {
  failReplay = true;

  override async createTransfers(transfers: Parameters<MockLedgerClient['createTransfers']>[0]) {
    if (this.failReplay) return { ok: false as const, error: 'ledger unavailable' };
    return super.createTransfers(transfers);
  }
}

function deferredDeps() {
  const store = makeStore();
  const ledger = new FlakyLedgerClient();
  const notifications: Array<Record<string, string>> = [];
  const paymentThreads: string[] = [];
  const conversions: Array<{ projectId: string; paymentId: string }> = [];
  const discordSyncs: Array<{ projectId: string; userId: string }> = [];
  type DeferredOperation = Parameters<
    NonNullable<MembershipTransactionDeps['deferAfterCommit']>
  >[0];
  const transaction: MembershipRuntimeDeps['transaction'] = async <T>(
    operation: (deps: MembershipTransactionDeps) => Promise<T>,
  ): Promise<T> => {
    const deferred: DeferredOperation[] = [];
    const result = await operation({
      store: store as unknown as MembershipRuntimeDeps['store'],
      persistLedgerPosting: async () => undefined,
      deferAfterCommit: (callback) => deferred.push(callback),
      notifyGraceEnding: async () => undefined,
      enqueueEmailNotification: async (payload) => {
        notifications.push(payload);
      },
    });
    for (const callback of deferred) {
      await callback({
        store: store as unknown as MembershipRuntimeDeps['store'],
        ledger,
        persistLedgerPosting: async () => undefined,
        transaction,
      });
    }
    return result;
  };
  const runtime: MembershipRuntimeDeps = {
    store: store as unknown as MembershipRuntimeDeps['store'],
    stripe: new MockStripeClient(),
    ledger,
    ensurePaymentThread: async (paymentId) => {
      paymentThreads.push(paymentId);
    },
    recordConfirmedConversion: async (input) => {
      conversions.push(input);
    },
    enqueueDiscordRoleSync: async (input) => {
      discordSyncs.push(input);
    },
    transaction,
  };
  return { store, runtime, ledger, notifications, paymentThreads, conversions, discordSyncs };
}

describe('membership runtime', () => {
  it('rolls back membership state when notification enqueue fails, then retries as started', async () => {
    const { runtime, store } = deps();
    const notifications: Array<Record<string, string>> = [];
    let failNotification = true;
    runtime.transaction = async <T>(operation: (deps: MembershipTransactionDeps) => Promise<T>) => {
      const subscriptions = store.subscriptions.slice();
      const periods = store.periods.slice();
      const payments = store.paymentRows.slice();
      const entitlements = store.entitlementRows.slice();
      try {
        return await operation({
          store: runtime.store,
          notifyGraceEnding: async () => undefined,
          enqueueEmailNotification: async (payload) => {
            notifications.push(payload);
            if (failNotification) throw new Error('notification unavailable');
          },
        });
      } catch (error) {
        store.subscriptions.splice(0, store.subscriptions.length, ...subscriptions);
        store.periods.splice(0, store.periods.length, ...periods);
        store.paymentRows.splice(0, store.paymentRows.length, ...payments);
        store.entitlementRows.splice(0, store.entitlementRows.length, ...entitlements);
        throw error;
      }
    };

    const paidEvent = event('invoice.paid', 'evt_invoice_paid_retryable', 602, invoiceObject());
    await expect(processMembershipEventWithNotification(paidEvent, runtime, NOW)).rejects.toThrow(
      'notification unavailable',
    );
    expect(store.subscriptions).toHaveLength(0);
    expect(store.periods).toHaveLength(0);
    expect(store.paymentRows).toHaveLength(0);
    expect(store.entitlementRows).toHaveLength(0);

    failNotification = false;
    const result = await processMembershipEventWithNotification(paidEvent, runtime, NOW);
    expect(result.subscriptionCreated).toBe(true);
    expect(result.firstSettlement).toBe(true);
    expect(store.subscriptions).toHaveLength(1);
    expect(notifications).toHaveLength(2);
  });

  it('does not duplicate started notification when subscription creation arrives after invoice', async () => {
    const { runtime, notifications } = deps();
    const paid = await processMembershipEventWithNotification(
      event('invoice.paid', 'evt_invoice_paid_reordered', 600, invoiceObject()),
      runtime,
      NOW,
    );
    const created = await processMembershipEventWithNotification(
      event(
        'customer.subscription.created',
        'evt_subscription_created_late',
        601,
        subscriptionObject(),
      ),
      runtime,
      NOW,
    );

    expect(membershipNotificationEvent('invoice.paid', paid)).toBe('started');
    expect(membershipNotificationEvent('customer.subscription.created', created)).toBeUndefined();
    expect(notifications.map((item) => item.event)).toEqual(['started']);
  });

  it('persists membership intent in the transaction and replays ledger only after commit', async () => {
    const { runtime } = deps();
    const statuses: string[] = [];
    let committed = false;
    runtime.transaction = async <T>(operation: (deps: MembershipTransactionDeps) => Promise<T>) => {
      const deferred: Array<
        (postCommit: {
          store: MembershipRuntimeDeps['store'];
          ledger: MembershipRuntimeDeps['ledger'];
          persistLedgerPosting: NonNullable<MembershipRuntimeDeps['persistLedgerPosting']>;
          transaction: MembershipRuntimeDeps['transaction'];
        }) => Promise<void>
      > = [];
      const result = await operation({
        store: runtime.store,
        persistLedgerPosting: async (input) => {
          expect(committed).toBe(false);
          statuses.push(input.status ?? 'posted');
        },
        deferAfterCommit: (callback) => deferred.push(callback),
        notifyGraceEnding: async () => undefined,
        enqueueEmailNotification: async () => {
          expect(runtime.ledger.listTransfers()).toHaveLength(0);
        },
      });
      committed = true;
      for (const callback of deferred) {
        await callback({
          store: runtime.store,
          ledger: runtime.ledger,
          persistLedgerPosting: async (input) => {
            expect(committed).toBe(true);
            statuses.push(input.status ?? 'posted');
          },
          transaction: async (finalize) =>
            finalize({
              store: runtime.store,
              persistLedgerPosting: async (input) => {
                expect(committed).toBe(true);
                statuses.push(input.status ?? 'posted');
              },
              notifyGraceEnding: async () => undefined,
              enqueueEmailNotification: async () => undefined,
            }),
        });
      }
      return result;
    };

    await processMembershipEventWithNotification(
      event('invoice.paid', 'evt_invoice_paid_after_commit', 603, invoiceObject()),
      runtime,
      NOW,
    );

    expect(statuses).toEqual(['pending', 'posted']);
    expect(runtime.ledger.listTransfers()).toHaveLength(4);
  });

  it('does not grant access when post-commit ledger replay fails', async () => {
    const { runtime, store, ledger, notifications, paymentThreads, conversions, discordSyncs } =
      deferredDeps();
    const paid = event('invoice.paid', 'evt_invoice_paid_replay_failure', 604, invoiceObject());

    await expect(processMembershipEventWithNotification(paid, runtime, NOW)).rejects.toThrow(
      'ledger unavailable',
    );
    expect(store.paymentRows[0]?.status).toBe('pending');
    expect(store.entitlementRows).toHaveLength(0);
    expect(notifications).toHaveLength(0);
    expect(ledger.listTransfers()).toHaveLength(0);
    expect(paymentThreads).toHaveLength(0);
    expect(conversions).toHaveLength(0);
    expect(discordSyncs).toHaveLength(0);

    ledger.failReplay = false;
    await processMembershipEventWithNotification(paid, runtime, NOW);
    expect(store.paymentRows[0]?.status).toBe('succeeded');
    expect(store.entitlementRows).toHaveLength(1);
    expect(notifications).toHaveLength(1);
    expect(ledger.listTransfers()).toHaveLength(4);
    expect(paymentThreads).toHaveLength(1);
    expect(conversions).toHaveLength(1);
    expect(discordSyncs).toHaveLength(1);
  });

  it('waits for first settlement before starting, then renews later invoices', async () => {
    const { runtime, notifications } = deps();
    await processMembershipEventWithNotification(
      event(
        'customer.subscription.created',
        'evt_subscription_created_first',
        10,
        subscriptionObject(),
      ),
      runtime,
      NOW,
    );
    expect(notifications).toHaveLength(0);

    const first = await processMembershipEventWithNotification(
      event('invoice.paid', 'evt_invoice_paid_first', 20, invoiceObject()),
      runtime,
      NOW,
    );
    const second = await processMembershipEventWithNotification(
      event(
        'invoice.paid',
        'evt_invoice_paid_second',
        30,
        invoiceObject({
          id: 'in_2',
          period_start: PERIOD_END,
          period_end: PERIOD_END + 30 * 24 * 60 * 60,
          payment_intent: 'pi_2',
          charge: 'ch_2',
        }),
      ),
      runtime,
      NOW,
    );

    expect(first.firstSettlement).toBe(true);
    expect(second.firstSettlement).toBe(false);
    expect(notifications.map((item) => item.event)).toEqual(['started', 'renewed']);
  });

  it('applies exact invoice fee and finalises a draft invoice once', async () => {
    const { runtime } = deps();
    const stripe = runtime.stripe as MockStripeClient;
    const result = await processMembershipEvent(
      event(
        'invoice.created',
        'evt_invoice_created',
        10,
        invoiceObject({ status: 'draft', application_fee_amount: null, auto_advance: true }),
      ),
      runtime,
      NOW,
    );
    await processMembershipEvent(
      event(
        'invoice.created',
        'evt_invoice_created_retry',
        11,
        invoiceObject({ status: 'draft', application_fee_amount: null, auto_advance: true }),
      ),
      runtime,
      NOW,
    );
    expect(result).toMatchObject({ kind: 'invoice_fee_applied', applicationFeeMinor: '120' });
    expect(stripe.invoiceUpdates).toHaveLength(1);
    expect(stripe.finalizedInvoices).toHaveLength(1);
  });

  it('settles a paid invoice, grants one entitlement, and tolerates duplicate delivery', async () => {
    const { runtime, store } = deps();
    const paid = event('invoice.paid', 'evt_invoice_paid', 20, invoiceObject());
    await processMembershipEvent(paid, runtime, NOW);
    await processMembershipEvent(paid, runtime, NOW);
    expect(store.subscriptions).toHaveLength(1);
    expect(store.periods).toHaveLength(1);
    expect(store.paymentRows).toHaveLength(1);
    expect(store.paymentRows[0]?.status).toBe('succeeded');
    expect(store.entitlementRows).toHaveLength(1);
    expect(runtime.ledger.listTransfers()).toHaveLength(4);
  });

  it.each(['refunded', 'disputed'] as const)(
    'preserves a %s payment when its invoice is replayed',
    async (terminalStatus) => {
      const { runtime, store } = deps();
      const paid = event('invoice.paid', `evt_invoice_paid_${terminalStatus}`, 20, invoiceObject());
      await processMembershipEvent(paid, runtime, NOW);
      const payment = store.paymentRows[0]!;
      const settledAt = payment.settled_at;
      payment.status = terminalStatus;

      await processMembershipEvent(paid, runtime, NOW);

      expect(payment.status).toBe(terminalStatus);
      expect(payment.settled_at).toEqual(settledAt);
      expect(store.entitlementRows).toHaveLength(1);
    },
  );

  it.each(['monthly', 'annual'] as const)(
    'reuses the %s checkout payment for first invoice settlement',
    async (cadence) => {
      const { runtime, store } = deps();
      const checkoutPaymentId = '11111111-1111-5111-8111-111111111111';
      store.paymentRows.push({
        id: checkoutPaymentId,
        project_id: 'project_1',
        user_id: 'user_1',
        stripe_account_id: 'acct_1',
        stripe_payment_intent_id: null,
        stripe_charge_id: null,
        stripe_application_fee_id: null,
        currency: 'gbp',
        exponent: 2,
        customer_charge_minor: '1100',
        project_amount_minor: '1000',
        platform_tip_minor: '100',
        oss_project_fee_minor: '20',
        stripe_application_fee_minor: '120',
        status: 'pending',
        cadence,
        feature_mode: 'standard',
        receipt_email: null,
        public_show_name: false,
        public_show_amount: false,
        public_show_message: false,
        public_display_name: null,
        public_message: null,
        settled_at: null,
        created_at: NOW,
        updated_at: NOW,
      });

      await processMembershipEvent(
        event(
          'invoice.paid',
          `evt_invoice_paid_checkout_${cadence}`,
          24,
          invoiceObject({ metadata: metadata({ cadence, payment_id: checkoutPaymentId }) }),
        ),
        runtime,
        NOW,
      );

      expect(store.paymentRows).toHaveLength(1);
      expect(store.paymentRows[0]).toMatchObject({
        id: checkoutPaymentId,
        status: 'succeeded',
        stripe_payment_intent_id: 'pi_1',
        stripe_charge_id: 'ch_1',
      });
      expect(store.periods[0]?.payment_id).toBe(checkoutPaymentId);
      expect(store.entitlementRows[0]?.payment_id).toBe(checkoutPaymentId);
    },
  );

  it('rejects a checkout payment owned by another supporter', async () => {
    const { runtime, store } = deps();
    const checkoutPaymentId = '22222222-2222-5222-8222-222222222222';
    store.paymentRows.push({
      id: checkoutPaymentId,
      project_id: 'project_1',
      user_id: 'another_user',
      stripe_account_id: 'acct_1',
      currency: 'gbp',
      customer_charge_minor: '1100',
      project_amount_minor: '1000',
      platform_tip_minor: '100',
      oss_project_fee_minor: '20',
      stripe_application_fee_minor: '120',
      status: 'pending',
      cadence: 'monthly',
      feature_mode: 'standard',
    } as Payment);

    await expect(
      processMembershipEvent(
        event(
          'invoice.paid',
          'evt_invoice_paid_checkout_owner_mismatch',
          25,
          invoiceObject({ metadata: metadata({ payment_id: checkoutPaymentId }) }),
        ),
        runtime,
        NOW,
      ),
    ).rejects.toThrow('Recurring payment does not match invoice allocation');
    expect(store.paymentRows[0]?.status).toBe('pending');
    expect(store.entitlementRows).toHaveLength(0);
  });

  it('stores recurring JPY payments with zero currency exponent', async () => {
    const { runtime, store } = deps();
    await processMembershipEvent(
      event(
        'invoice.paid',
        'evt_invoice_paid_jpy',
        23,
        invoiceObject({
          currency: 'jpy',
          metadata: metadata({ currency: 'jpy' }),
        }),
      ),
      runtime,
      NOW,
    );

    expect(store.paymentRows[0]?.currency).toBe('jpy');
    expect(store.paymentRows[0]?.exponent).toBe(0);
  });

  it('persists recurring supporter recognition choices from invoice metadata', async () => {
    const { runtime, store } = deps();
    await processMembershipEvent(
      event(
        'invoice.paid',
        'evt_invoice_paid_recognition',
        22,
        invoiceObject({
          customer_email: 'Ada@Example.com',
          metadata: metadata({
            show_name: 'true',
            show_amount: 'false',
            show_message: 'true',
            display_name: ' Ada Lovelace ',
            public_message: 'Thank you for building this.',
          }),
        }),
      ),
      runtime,
      NOW,
    );

    expect(store.paymentRows[0]).toMatchObject({
      receipt_email: 'ada@example.com',
      public_show_name: true,
      public_show_amount: false,
      public_show_message: true,
      public_display_name: 'Ada Lovelace',
      public_message: 'Thank you for building this.',
    });
  });

  it('notifies analytics only after durable invoice settlement', async () => {
    const { runtime, store } = deps();
    const conversions: Array<{ projectId: string; paymentId: string }> = [];
    runtime.recordConfirmedConversion = async (input) => {
      conversions.push(input);
    };

    await processMembershipEvent(
      event('invoice.paid', 'evt_invoice_paid_analytics', 21, invoiceObject()),
      runtime,
      NOW,
    );

    expect(store.paymentRows[0]?.status).toBe('succeeded');
    expect(conversions).toEqual([{ projectId: 'project_1', paymentId: store.paymentRows[0]?.id }]);
  });

  it('ignores stale subscription state while preserving a newer paid period', async () => {
    const { runtime, store } = deps();
    await processMembershipEvent(
      event('invoice.paid', 'evt_invoice_paid_new', 200, invoiceObject()),
      runtime,
      NOW,
    );
    await processMembershipEvent(
      event(
        'customer.subscription.updated',
        'evt_subscription_old',
        100,
        subscriptionObject({ current_period_end: PERIOD_START + 10 }),
      ),
      runtime,
      NOW,
    );
    expect(store.subscriptions[0]?.status).toBe('active');
    expect(store.subscriptions[0]?.current_period_end).toEqual(new Date(PERIOD_END * 1000));
    expect(store.entitlementRows).toHaveLength(1);
  });

  it('keeps access during seven-day grace, then revokes on expiry', async () => {
    const { runtime, store } = deps();
    await processMembershipEvent(
      event('invoice.paid', 'evt_invoice_paid_grace', 300, invoiceObject()),
      runtime,
      NOW,
    );
    const failedAt = new Date('2026-09-01T12:00:00.000Z');
    await processMembershipEvent(
      event(
        'invoice.payment_failed',
        'evt_invoice_failed',
        301,
        invoiceObject({ status: 'open', application_fee_amount: null }),
      ),
      runtime,
      failedAt,
    );
    expect(store.subscriptions[0]?.status).toBe('grace');
    expect(store.entitlementRows[0]?.ends_at).toEqual(
      new Date(failedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
    );
    const expiredAt = new Date(failedAt.getTime() + 7 * 24 * 60 * 60 * 1000 + 1);
    expect(await expireDueMemberships(runtime, expiredAt)).toBe(1);
    expect(store.subscriptions[0]?.status).toBe('expired');
    expect(store.entitlementRows[0]?.revoked_at).toEqual(expiredAt);
  });

  it('queues Discord sync after grant, grace transition, and expiry', async () => {
    const { runtime } = deps();
    const syncs: Array<{ projectId: string; userId: string }> = [];
    runtime.enqueueDiscordRoleSync = async (input) => {
      syncs.push(input);
    };

    await processMembershipEventWithNotification(
      event('invoice.paid', 'evt_invoice_paid_discord', 305, invoiceObject()),
      runtime,
      NOW,
    );
    expect(syncs).toEqual([{ projectId: 'project_1', userId: 'user_1' }]);

    const failedAt = new Date('2026-09-01T12:00:00.000Z');
    await processMembershipEventWithNotification(
      event(
        'invoice.payment_failed',
        'evt_invoice_failed_discord',
        306,
        invoiceObject({ status: 'open', application_fee_amount: null }),
      ),
      runtime,
      failedAt,
    );
    expect(syncs).toHaveLength(2);

    const expiredAt = new Date(failedAt.getTime() + 7 * 24 * 60 * 60 * 1_000 + 1);
    await expect(expireDueMemberships(runtime, expiredAt)).resolves.toBe(1);
    expect(syncs).toHaveLength(3);
    expect(
      syncs.every((input) => input.projectId === 'project_1' && input.userId === 'user_1'),
    ).toBe(true);
  });

  it('keeps grace expiry retryable when notification transaction rolls back', async () => {
    const { runtime, store } = deps();
    await processMembershipEvent(
      event('invoice.paid', 'evt_invoice_paid_retryable_grace', 302, invoiceObject()),
      runtime,
      NOW,
    );
    const failedAt = new Date('2026-09-01T12:00:00.000Z');
    await processMembershipEvent(
      event(
        'invoice.payment_failed',
        'evt_invoice_failed_retryable_grace',
        303,
        invoiceObject({ status: 'open', application_fee_amount: null }),
      ),
      runtime,
      failedAt,
    );

    const subscription = store.subscriptions[0]!;
    const entitlement = store.entitlementRows[0]!;
    const graceEndsAt = subscription.grace_ends_at;
    let failNotification = true;
    let notifications = 0;
    runtime.transaction = async <T>(operation: (deps: MembershipTransactionDeps) => Promise<T>) => {
      try {
        return await operation({
          store: runtime.store,
          notifyGraceEnding: async () => {
            notifications += 1;
            if (failNotification) throw new Error('notification unavailable');
          },
          enqueueEmailNotification: async () => undefined,
        });
      } catch (error) {
        subscription.status = 'grace';
        subscription.grace_ends_at = graceEndsAt;
        entitlement.revoked_at = null;
        throw error;
      }
    };

    const expiredAt = new Date(failedAt.getTime() + 7 * 24 * 60 * 60 * 1000 + 1);
    await expect(expireDueMemberships(runtime, expiredAt)).rejects.toThrow(
      'notification unavailable',
    );
    expect(subscription.status).toBe('grace');
    expect(entitlement.revoked_at).toBeNull();
    expect(notifications).toBe(1);

    failNotification = false;
    expect(await expireDueMemberships(runtime, expiredAt)).toBe(1);
    expect(subscription.status).toBe('expired');
    expect(entitlement.revoked_at).toEqual(expiredAt);
    expect(notifications).toBe(2);
  });

  it('ends access at paid period end after cancellation', async () => {
    const { runtime, store } = deps();
    await processMembershipEvent(
      event('invoice.paid', 'evt_invoice_paid_cancel', 500, invoiceObject()),
      runtime,
      NOW,
    );
    await processMembershipEvent(
      event(
        'customer.subscription.deleted',
        'evt_subscription_deleted',
        501,
        subscriptionObject({ status: 'canceled', current_period_end: PERIOD_END }),
      ),
      runtime,
      NOW,
    );
    expect(store.subscriptions[0]?.status).toBe('cancelled');
    expect(store.entitlementRows[0]?.ends_at).toEqual(new Date(PERIOD_END * 1000));
  });

  it('rejects invoice amounts that disagree with signed checkout metadata', async () => {
    const { runtime } = deps();
    await expect(
      processMembershipEvent(
        event('invoice.created', 'evt_invoice_tampered', 400, invoiceObject({ total: 1101 })),
        runtime,
        NOW,
      ),
    ).rejects.toThrow('Invoice total does not match membership amount');
  });

  it('rejects a finalised invoice whose provider fee is wrong', async () => {
    const { runtime } = deps();
    await expect(
      processMembershipEvent(
        event(
          'invoice.finalized',
          'evt_invoice_fee_tampered',
          401,
          invoiceObject({ status: 'open', application_fee_amount: 119 }),
        ),
        runtime,
        NOW,
      ),
    ).rejects.toThrow('Invoice application fee does not match server allocation');
  });
});
