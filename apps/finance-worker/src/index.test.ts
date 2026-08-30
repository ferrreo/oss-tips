import { describe, expect, it } from 'vitest';
import type { StripeEvent } from '@oss-tips/db';
import { processStripeEvent, saveDisputeCursorAndNotify } from './index.js';

function accountEvent(
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
    received_at: new Date('2026-08-30T12:00:00.000Z'),
  } as StripeEvent;
}

function accountDb() {
  const account = {
    id: 'account_1',
    project_id: 'project_1',
    stripe_account_id: 'acct_1',
    charges_enabled: false,
    payouts_enabled: false,
    capabilities: {},
    last_event_created: '0',
    last_event_id: '',
  };
  const snapshots: Array<Record<string, unknown>> = [];
  const jobs: Array<Record<string, unknown>> = [];
  const db: any = {
    transaction: () => ({
      execute: async (operation: (trx: any) => Promise<unknown>) => operation(db),
    }),
    selectFrom: (table: string) => {
      if (table !== 'stripe_connected_account') throw new Error(`unexpected table: ${table}`);
      const query: any = {
        select: () => query,
        where: () => query,
        forUpdate: () => query,
        executeTakeFirst: async () => account,
      };
      return query;
    },
    updateTable: (table: string) => {
      if (table !== 'stripe_connected_account') throw new Error(`unexpected table: ${table}`);
      let patch: Record<string, unknown> = {};
      const query: any = {
        set: (input: Record<string, unknown>) => {
          patch = input;
          return query;
        },
        where: (column: string, operator: unknown, value?: unknown) => {
          if (typeof operator === 'string' && column === 'id' && operator === '=') {
            if (value !== account.id) throw new Error('unexpected account id');
          } else if (typeof operator === 'function') {
            const eb: any = (..._args: unknown[]) => true;
            eb.or = () => true;
            eb.and = () => true;
            operator(eb);
          }
          return query;
        },
        returningAll: () => query,
        executeTakeFirst: async () => {
          const incomingCreated = String(patch.last_event_created);
          const incomingId = String(patch.last_event_id);
          const currentIsOlder =
            Number(account.last_event_created) < Number(incomingCreated) ||
            (Number(account.last_event_created) === Number(incomingCreated) &&
              account.last_event_id < incomingId);
          if (!currentIsOlder) return undefined;
          Object.assign(account, patch);
          return account;
        },
      };
      return query;
    },
    insertInto: (table: string) => {
      const query: any = {
        values: (input: Record<string, unknown>) => {
          query.input = input;
          return query;
        },
        execute: async () => {
          if (table === 'stripe_capability_snapshot') snapshots.push(query.input);
          else if (table === 'job') jobs.push(query.input);
          else throw new Error(`unexpected table: ${table}`);
        },
      };
      return query;
    },
  };
  return { db, account, snapshots, jobs };
}

describe('Stripe connected-account event ordering', () => {
  it('keeps newer state for late and duplicate account events', async () => {
    const state = accountDb();
    const newer = accountEvent('account.updated', 'evt_new', 20, {
      id: 'acct_1',
      charges_enabled: true,
      payouts_enabled: true,
      capabilities: { card_payments: 'active' },
    });
    const older = accountEvent('account.updated', 'evt_old', 10, {
      id: 'acct_1',
      charges_enabled: false,
      payouts_enabled: false,
      capabilities: { card_payments: 'pending' },
    });

    const deps = { db: state.db, ledger: {}, membership: {} } as any;
    await processStripeEvent(newer, deps);
    await processStripeEvent(newer, deps);
    await processStripeEvent(older, deps);

    expect(state.account).toMatchObject({
      charges_enabled: true,
      payouts_enabled: true,
      capabilities: { card_payments: 'active' },
      last_event_created: '20',
      last_event_id: 'evt_new',
    });
    expect(state.snapshots).toHaveLength(1);
    expect(state.jobs).toHaveLength(0);
  });
});

describe('dispute notification transaction', () => {
  it('rolls back the cursor when notification enqueue fails, then retries', async () => {
    const disputes: Array<Record<string, unknown>> = [];
    const jobs: Array<Record<string, unknown>> = [];
    let failEnqueue = true;

    const fakeDb = {} as any;
    fakeDb.transaction = () => ({
      execute: async (operation: (trx: any) => Promise<unknown>) => {
        const previousDisputes = disputes.slice();
        const previousJobs = jobs.slice();
        try {
          return await operation(fakeDb);
        } catch (error) {
          disputes.splice(0, disputes.length, ...previousDisputes);
          jobs.splice(0, jobs.length, ...previousJobs);
          throw error;
        }
      },
    });
    fakeDb.selectFrom = () => {
      let disputeId: unknown;
      const query: any = {
        selectAll: () => query,
        where: (_column: string, _operator: string, value: unknown) => {
          disputeId = value;
          return query;
        },
        executeTakeFirst: async () => disputes.find((row) => row.stripe_dispute_id === disputeId),
      };
      return query;
    };
    fakeDb.insertInto = (table: string) => {
      let values: Record<string, unknown> | undefined;
      const query: any = {
        values: (input: Record<string, unknown>) => {
          values = input;
          return query;
        },
        onConflict: (callback: (target: any) => unknown) => {
          const target = { column: () => ({ doNothing: () => target }) };
          callback(target);
          return query;
        },
        returningAll: () => query,
        executeTakeFirst: async () => {
          if (table !== 'payment_dispute') throw new Error(`unexpected table: ${table}`);
          const existing = disputes.find(
            (row) => row.stripe_dispute_id === values?.stripe_dispute_id,
          );
          if (existing) return undefined;
          const row = { ...values };
          disputes.push(row);
          return row;
        },
        execute: async () => {
          if (table !== 'job') throw new Error(`unexpected table: ${table}`);
          if (failEnqueue) throw new Error('notification unavailable');
          jobs.push(values ?? {});
        },
      };
      return query;
    };

    const event = {
      stripe_event_id: 'evt_dispute_retryable',
      payload: { created: 602 },
    } as unknown as StripeEvent;
    const payment = { id: 'payment_1' };
    const metadata = {
      stripeDisputeId: 'dp_1',
      disputeAmountMinor: 1000n,
      currency: 'gbp',
    };

    await expect(
      saveDisputeCursorAndNotify(fakeDb, payment, metadata, 'open', event),
    ).rejects.toThrow('notification unavailable');
    expect(disputes).toHaveLength(0);
    expect(jobs).toHaveLength(0);

    failEnqueue = false;
    const saved = await saveDisputeCursorAndNotify(fakeDb, payment, metadata, 'open', event);
    expect(saved?.stripe_dispute_id).toBe('dp_1');
    expect(disputes).toHaveLength(1);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.payload).toMatchObject({
      notification: 'dispute',
      dispute_id: saved?.id,
      event_id: 'evt_dispute_retryable',
    });
  });
});

function paymentIntentEvent(
  type: 'payment_intent.processing' | 'payment_intent.payment_failed',
  id: string,
): StripeEvent {
  return {
    id: `row-${id}`,
    stripe_event_id: `evt-${id}`,
    stripe_account_id: 'acct_1',
    event_type: type,
    api_version: null,
    payload: {
      id: `evt-${id}`,
      type,
      account: 'acct_1',
      data: { object: { id, object: 'payment_intent' } },
    },
    processed_at: null,
    process_error: null,
    processing_at: null,
    processing_by: null,
    processing_attempts: 0,
    received_at: new Date('2026-08-30T12:00:00.000Z'),
  } as StripeEvent;
}

function paymentDb(payment?: Record<string, unknown>) {
  const db: any = {
    selectFrom: (table: string) => {
      if (table !== 'payment') throw new Error(`unexpected table: ${table}`);
      let paymentIntentId: unknown;
      let accountId: unknown;
      const query: any = {
        selectAll: () => query,
        where: (column: string, _operator: string, value: unknown) => {
          if (column === 'stripe_payment_intent_id') paymentIntentId = value;
          if (column === 'stripe_account_id') accountId = value;
          return query;
        },
        executeTakeFirst: async () =>
          payment &&
          payment.stripe_payment_intent_id === paymentIntentId &&
          payment.stripe_account_id === accountId
            ? payment
            : undefined,
      };
      return query;
    },
    updateTable: (table: string) => {
      if (table !== 'payment') throw new Error(`unexpected table: ${table}`);
      let id: unknown;
      let patch: Record<string, unknown> = {};
      const query: any = {
        set: (input: Record<string, unknown>) => {
          patch = input;
          return query;
        },
        where: (column: string, _operator: string, value: unknown) => {
          if (column === 'id') id = value;
          return query;
        },
        execute: async () => {
          if (payment && payment.id === id) Object.assign(payment, patch);
        },
      };
      return query;
    },
  };
  return db;
}

describe('payment intent status events', () => {
  it('keeps missing-payment events retryable and updates visible payments', async () => {
    const missing = paymentIntentEvent('payment_intent.processing', 'pi_missing');
    await expect(
      processStripeEvent(missing, { db: paymentDb(), ledger: {}, membership: {} } as any),
    ).rejects.toThrow('Payment is not available yet');

    const processingPayment = {
      id: 'payment_processing',
      stripe_account_id: 'acct_1',
      stripe_payment_intent_id: 'pi_processing',
      status: 'pending',
    };
    await processStripeEvent(paymentIntentEvent('payment_intent.processing', 'pi_processing'), {
      db: paymentDb(processingPayment),
      ledger: {},
      membership: {},
    } as any);
    expect(processingPayment.status).toBe('processing');

    const failedPayment = {
      id: 'payment_failed',
      stripe_account_id: 'acct_1',
      stripe_payment_intent_id: 'pi_failed',
      status: 'processing',
    };
    await processStripeEvent(paymentIntentEvent('payment_intent.payment_failed', 'pi_failed'), {
      db: paymentDb(failedPayment),
      ledger: {},
      membership: {},
    } as any);
    expect(failedPayment.status).toBe('failed');
  });
});
