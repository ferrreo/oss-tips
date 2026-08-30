import { describe, expect, it } from 'vitest';
import { AccountCode, accountId, TransferCode } from '@oss-tips/ledger';
import {
  MockStripeClient,
  type DurableInboxRow,
  type StripeBalanceTransaction,
} from '@oss-tips/payments';
import {
  comparePlatformReconciliation,
  compareReconciliation,
  lookupLedgerTransfers,
  recoverMissingStripeEvents,
  type PaymentInput,
} from './reconciliation.js';

const periodStart = new Date('2026-08-29T00:00:00.000Z');
const periodEnd = new Date('2026-08-30T00:00:00.000Z');

const payment: PaymentInput = {
  id: 'payment-1',
  project_id: 'project-1',
  stripe_account_id: 'acct_1',
  stripe_payment_intent_id: 'pi_1',
  stripe_charge_id: 'ch_1',
  stripe_application_fee_id: 'fee_1',
  stripe_application_fee_minor: '100',
  currency: 'gbp',
  customer_charge_minor: '1100',
  project_amount_minor: '1000',
  oss_project_fee_minor: '0',
  status: 'succeeded',
  settled_at: new Date('2026-08-29T12:00:00.000Z'),
  created_at: new Date('2026-08-29T12:00:00.000Z'),
};

function transaction(overrides: Partial<StripeBalanceTransaction> = {}): StripeBalanceTransaction {
  return {
    id: 'txn_1',
    stripeAccountId: 'acct_1',
    currency: 'gbp',
    amountMinor: 1100,
    feeMinor: 100,
    netMinor: 1000,
    type: 'charge',
    sourceId: 'ch_1',
    createdAt: new Date('2026-08-29T12:00:00.000Z'),
    availableOn: null,
    ...overrides,
  };
}

const postedLedger = [
  {
    payment_id: 'payment-1',
    posting_kind: 'one_off_settlement',
    intent_status: 'posted',
    result_status: 'posted',
    result_error: null,
  },
] as const;

describe('daily reconciliation comparison', () => {
  it('matches provider charge and posted ledger state', () => {
    const result = compareReconciliation({
      providerTransactions: [
        transaction(),
        transaction({
          id: 'txn_fee_1',
          type: 'application_fee',
          feeMinor: 0,
          amountMinor: 100,
          netMinor: 100,
          sourceId: 'fee_1',
        }),
      ],
      payments: [payment],
      refunds: [],
      disputes: [],
      ledgerPostings: postedLedger,
      periodStart,
      periodEnd,
    });

    expect(result.differences).toEqual([]);
    expect(result.providerNetMinor).toBe(1000n);
    expect(result.ledgerNetMinor).toBe(1000n);
  });

  it('matches a fee-mode payment and its application fee movement', () => {
    const feeModePayment = {
      ...payment,
      project_amount_minor: '1000',
      oss_project_fee_minor: '50',
      stripe_application_fee_minor: '150',
      customer_charge_minor: '1100',
    };
    const result = compareReconciliation({
      providerTransactions: [
        transaction({ feeMinor: 210, netMinor: 890 }),
        transaction({
          id: 'txn_fee_5_percent',
          type: 'application_fee',
          feeMinor: 0,
          amountMinor: 150,
          netMinor: 150,
          sourceId: 'fee_1',
        }),
      ],
      payments: [feeModePayment],
      refunds: [],
      disputes: [],
      ledgerPostings: postedLedger,
      periodStart,
      periodEnd,
    });

    expect(result.differences).toEqual([]);
    expect(result.providerNetMinor).toBe(950n);
    expect(result.ledgerNetMinor).toBe(950n);
  });

  it('classifies a provider amount mismatch', () => {
    const result = compareReconciliation({
      providerTransactions: [transaction({ amountMinor: 1000, netMinor: 1000 })],
      payments: [payment],
      refunds: [],
      disputes: [],
      ledgerPostings: postedLedger,
      periodStart,
      periodEnd,
    });

    expect(result.differences).toEqual([
      expect.objectContaining({
        classification: 'wrong_amount',
        providerObjectId: 'ch_1',
        expectedMinor: 1100n,
        actualMinor: 1000n,
      }),
    ]);
  });

  it('keeps recent missing events in timing and escalates stale ones', () => {
    const recent = compareReconciliation({
      providerTransactions: [],
      payments: [payment],
      refunds: [],
      disputes: [],
      ledgerPostings: postedLedger,
      periodStart,
      periodEnd,
      now: new Date('2026-08-30T12:00:00.000Z'),
    });
    expect(recent.differences).toEqual([
      expect.objectContaining({ classification: 'timing', providerObjectId: 'ch_1' }),
    ]);

    const stale = compareReconciliation({
      providerTransactions: [],
      payments: [{ ...payment, settled_at: new Date('2026-08-27T12:00:00.000Z') }],
      refunds: [],
      disputes: [],
      ledgerPostings: postedLedger,
      periodStart: new Date('2026-08-27T00:00:00.000Z'),
      periodEnd: new Date('2026-08-28T00:00:00.000Z'),
      now: new Date('2026-08-30T12:00:00.000Z'),
    });
    expect(stale.differences).toEqual([
      expect.objectContaining({
        classification: 'missing_event',
        providerObjectId: 'ch_1',
        details: {
          payment_id: 'payment-1',
          ledger_net_minor: '1000',
          recovery_object_id: 'ch_1',
          recovery_locator: 'data.object.id',
        },
      }),
    ]);
  });

  it('classifies an aggregate provider/ledger mismatch', () => {
    const result = compareReconciliation({
      providerTransactions: [transaction({ netMinor: 1100 })],
      payments: [payment],
      refunds: [],
      disputes: [],
      ledgerPostings: postedLedger,
      periodStart,
      periodEnd,
    });

    expect(result.differences).toEqual([
      expect.objectContaining({
        classification: 'wrong_amount',
        providerObjectId: null,
        expectedMinor: 1000n,
        actualMinor: 1100n,
      }),
    ]);
  });

  it('compares provider net with the referenced ledger transfer aggregate', () => {
    const result = compareReconciliation({
      providerTransactions: [
        transaction(),
        transaction({
          id: 'txn_fee_aggregate',
          type: 'application_fee',
          amountMinor: 100,
          netMinor: 100,
          sourceId: 'fee_1',
        }),
      ],
      payments: [payment],
      refunds: [],
      disputes: [],
      ledgerPostings: [
        {
          ...postedLedger[0],
          transfer_ids: ['transfer_project'],
        },
      ],
      ledgerTransfers: [
        {
          id: 'transfer_project',
          amount: 900n,
          code: TransferCode.TransitToProjectGross,
        },
      ],
      periodStart,
      periodEnd,
    });

    expect(result.providerNetMinor).toBe(1000n);
    expect(result.ledgerNetMinor).toBe(900n);
    expect(result.differences).toEqual([
      expect.objectContaining({
        classification: 'wrong_amount',
        providerObjectId: null,
        expectedMinor: 900n,
        actualMinor: 1000n,
      }),
    ]);
  });

  it('loads historical transfers through durable lookup', async () => {
    const transfer = {
      id: 123n,
      amount: 1000n,
      code: TransferCode.TransitToProjectGross,
      debitAccountId: 1n,
      creditAccountId: 2n,
      ledger: 826,
      linked: false,
      timestamp: 1,
    };
    const result = await lookupLedgerTransfers({ lookupTransfers: async () => [transfer] }, [
      { ...postedLedger[0], transfer_ids: ['123'] },
    ]);

    expect(result.lookup).toEqual({ missingIds: [], unexpectedIds: [], error: null });
    expect(result.transfers).toEqual([
      expect.objectContaining({
        id: '123',
        amount: 1000n,
        code: TransferCode.TransitToProjectGross,
      }),
    ]);
  });

  it('fails closed when durable lookup misses a referenced transfer', () => {
    const result = compareReconciliation({
      providerTransactions: [transaction()],
      payments: [payment],
      refunds: [],
      disputes: [],
      ledgerPostings: [{ ...postedLedger[0], transfer_ids: ['123'] }],
      ledgerTransfers: [],
      ledgerTransferLookup: { missingIds: ['123'], unexpectedIds: [], error: null },
      periodStart,
      periodEnd,
    });

    expect(result.ledgerNetMinor).toBe(0n);
    expect(result.differences).toEqual([
      expect.objectContaining({
        classification: 'ledger_failure',
        providerObjectId: null,
        expectedMinor: null,
        actualMinor: null,
        details: expect.objectContaining({ missing_transfer_ids: '123' }),
      }),
    ]);
  });

  it('fails closed when durable lookup returns an unexpected transfer', () => {
    const result = compareReconciliation({
      providerTransactions: [transaction()],
      payments: [payment],
      refunds: [],
      disputes: [],
      ledgerPostings: [{ ...postedLedger[0], transfer_ids: ['123'] }],
      ledgerTransfers: [{ id: '123', amount: 1000n, code: TransferCode.TransitToProjectGross }],
      ledgerTransferLookup: { missingIds: [], unexpectedIds: ['456'], error: null },
      periodStart,
      periodEnd,
    });

    expect(result.ledgerNetMinor).toBe(0n);
    expect(result.differences).toEqual([
      expect.objectContaining({
        classification: 'ledger_failure',
        details: expect.objectContaining({ unexpected_transfer_ids: '456' }),
      }),
    ]);
  });

  it('classifies a missing ledger posting', () => {
    const result = compareReconciliation({
      providerTransactions: [transaction()],
      payments: [payment],
      refunds: [],
      disputes: [],
      ledgerPostings: [
        {
          payment_id: 'payment-1',
          posting_kind: 'one_off_settlement',
          intent_status: 'failed',
          result_status: 'failed',
          result_error: 'TigerBeetle unavailable',
        },
      ],
      periodStart,
      periodEnd,
    });

    expect(result.differences).toEqual([
      expect.objectContaining({
        classification: 'ledger_failure',
        providerObjectId: 'ch_1',
        expectedMinor: 1000n,
      }),
    ]);
  });

  it('does not treat an intent without a posting result as settled', () => {
    const result = compareReconciliation({
      providerTransactions: [transaction()],
      payments: [payment],
      refunds: [],
      disputes: [],
      ledgerPostings: [
        {
          payment_id: payment.id,
          posting_kind: 'one_off_settlement',
          intent_status: 'posted',
          result_status: null,
          result_error: null,
        },
      ],
      periodStart,
      periodEnd,
    });

    expect(result.differences).toEqual([
      expect.objectContaining({
        classification: 'ledger_failure',
        providerObjectId: 'ch_1',
      }),
    ]);
  });

  it('matches a partial refund and proportional application-fee refund', () => {
    const result = compareReconciliation({
      providerTransactions: [
        transaction(),
        transaction({
          id: 'txn_fee_refund_base',
          type: 'application_fee',
          feeMinor: 0,
          amountMinor: 100,
          netMinor: 100,
          sourceId: 'fee_1',
        }),
        transaction({
          id: 'txn_refund_1',
          type: 'refund',
          feeMinor: 0,
          amountMinor: -550,
          netMinor: -550,
          sourceId: 're_1',
        }),
        transaction({
          id: 'txn_application_fee_refund_1',
          type: 'application_fee_refund',
          feeMinor: 0,
          amountMinor: -50,
          netMinor: -50,
          sourceId: 'fr_1',
        }),
      ],
      payments: [payment],
      refunds: [
        {
          id: 'refund-1',
          payment_id: payment.id,
          stripe_refund_id: 're_1',
          amount_minor: '550',
          application_fee_refund_minor: '50',
          stripe_application_fee_refund_id: 'fr_1',
          currency: 'gbp',
          status: 'succeeded',
          created_at: new Date('2026-08-29T15:00:00.000Z'),
        },
      ],
      disputes: [],
      ledgerPostings: [
        ...postedLedger,
        {
          payment_id: payment.id,
          stripe_event_id: 're_1',
          posting_kind: 'one_off_refund',
          intent_status: 'posted',
          result_status: 'posted',
          result_error: null,
        },
      ],
      periodStart,
      periodEnd,
    });

    expect(result.differences).toEqual([]);
    expect(result.providerNetMinor).toBe(500n);
    expect(result.ledgerNetMinor).toBe(500n);
  });

  it('classifies a refund correction without a successful ledger result', () => {
    const result = compareReconciliation({
      providerTransactions: [
        transaction(),
        transaction({
          id: 'txn_refund_failure',
          type: 'refund',
          feeMinor: 0,
          amountMinor: -550,
          netMinor: -550,
          sourceId: 're_1',
        }),
      ],
      payments: [payment],
      refunds: [
        {
          id: 'refund-1',
          payment_id: payment.id,
          stripe_refund_id: 're_1',
          amount_minor: '550',
          application_fee_refund_minor: '50',
          stripe_application_fee_refund_id: null,
          currency: 'gbp',
          status: 'succeeded',
          created_at: new Date('2026-08-29T15:00:00.000Z'),
        },
      ],
      disputes: [],
      ledgerPostings: postedLedger,
      periodStart,
      periodEnd,
    });

    expect(result.differences).toEqual([
      expect.objectContaining({
        classification: 'ledger_failure',
        providerObjectId: 're_1',
        expectedMinor: -500n,
      }),
    ]);
  });

  it('matches a dispute loss against project share, not customer charge', () => {
    const feeModePayment = {
      ...payment,
      project_amount_minor: '1000',
      oss_project_fee_minor: '50',
      stripe_application_fee_minor: '150',
      customer_charge_minor: '1100',
    };
    const result = compareReconciliation({
      providerTransactions: [
        transaction({ feeMinor: 210, netMinor: 890 }),
        transaction({
          id: 'txn_fee_dispute',
          type: 'application_fee',
          feeMinor: 0,
          amountMinor: 150,
          netMinor: 150,
          sourceId: 'fee_1',
        }),
        transaction({
          id: 'txn_dispute_1',
          type: 'adjustment',
          feeMinor: 0,
          amountMinor: -1100,
          netMinor: -1100,
          sourceId: 'dp_1',
        }),
        transaction({
          id: 'txn_dispute_fee_reversal',
          type: 'application_fee_refund',
          feeMinor: 0,
          amountMinor: -150,
          netMinor: -150,
          sourceId: 'fr_dispute_1',
        }),
      ],
      payments: [feeModePayment],
      refunds: [
        {
          id: 'refund-dispute-fee',
          payment_id: feeModePayment.id,
          stripe_refund_id: 're_unused',
          amount_minor: '0',
          application_fee_refund_minor: '150',
          stripe_application_fee_refund_id: 'fr_dispute_1',
          currency: 'gbp',
          status: 'failed',
          created_at: new Date('2026-08-29T15:00:00.000Z'),
        },
      ],
      disputes: [
        {
          payment_id: feeModePayment.id,
          stripe_dispute_id: 'dp_1',
          amount_minor: '1100',
          currency: 'gbp',
          status: 'lost',
          created_at: new Date('2026-08-29T16:00:00.000Z'),
        },
      ],
      ledgerPostings: [
        ...postedLedger,
        {
          payment_id: feeModePayment.id,
          stripe_event_id: 'dp_1',
          posting_kind: 'dispute_lost',
          intent_status: 'posted',
          result_status: 'posted',
          result_error: null,
        },
      ],
      periodStart,
      periodEnd,
    });

    expect(result.differences).toEqual([]);
    expect(result.providerNetMinor).toBe(0n);
    expect(result.ledgerNetMinor).toBe(0n);
  });

  it('is deterministic and idempotent for a repeated window comparison', () => {
    const input = {
      providerTransactions: [transaction()],
      payments: [payment],
      refunds: [],
      disputes: [],
      ledgerPostings: postedLedger,
      periodStart,
      periodEnd,
    };
    expect(compareReconciliation(input)).toEqual(compareReconciliation(input));
  });
});

describe('platform reconciliation comparison', () => {
  const platformPayment = {
    ...payment,
    project_amount_minor: '1000',
    oss_project_fee_minor: '50',
    stripe_application_fee_minor: '150',
  };
  const refund = {
    id: 'refund-1',
    payment_id: payment.id,
    stripe_refund_id: 're_1',
    amount_minor: '550',
    application_fee_refund_minor: '50',
    stripe_application_fee_refund_id: 'fr_1',
    currency: 'gbp',
    status: 'succeeded',
    created_at: new Date('2026-08-29T15:00:00.000Z'),
  } as const;
  const postings = [
    {
      ...postedLedger[0],
      transfer_ids: ['platform_settlement', 'platform_tip'],
    },
    {
      payment_id: payment.id,
      stripe_event_id: 're_1',
      posting_kind: 'one_off_refund',
      intent_status: 'posted',
      result_status: 'posted',
      result_error: null,
      transfer_ids: ['platform_refund', 'platform_tip_refund'],
    },
  ] as const;
  const platformFeeAccount = accountId(
    AccountCode.PlatformProjectFeeRevenue,
    'platform',
    'oss.tips',
    'gbp',
  );
  const platformTipAccount = accountId(
    AccountCode.PlatformSupporterTipRevenue,
    'platform',
    'oss.tips',
    'gbp',
  );
  it('matches application fees and fee refunds against platform accounts', () => {
    const result = comparePlatformReconciliation({
      providerTransactions: [
        transaction({
          stripeAccountId: 'platform',
          id: 'txn_platform_fee',
          type: 'application_fee',
          amountMinor: 150,
          feeMinor: 0,
          netMinor: 150,
          sourceId: 'fee_1',
        }),
        transaction({
          stripeAccountId: 'platform',
          id: 'txn_platform_fee_refund',
          type: 'application_fee_refund',
          amountMinor: -50,
          feeMinor: 0,
          netMinor: -50,
          sourceId: 'fr_1',
        }),
      ],
      payments: [platformPayment],
      refunds: [refund],
      ledgerPostings: postings,
      ledgerTransfers: [
        {
          id: 'platform_settlement',
          amount: 50n,
          code: TransferCode.TransitToPlatformProjectFee,
          debitAccountId: accountId(110, 'payment', platformPayment.id, 'gbp'),
          creditAccountId: platformFeeAccount,
        },
        {
          id: 'platform_tip',
          amount: 100n,
          code: TransferCode.TransitToPlatformSupporterTip,
          debitAccountId: accountId(110, 'payment', platformPayment.id, 'gbp'),
          creditAccountId: platformTipAccount,
        },
        {
          id: 'platform_refund',
          amount: 25n,
          code: TransferCode.ApplicationFeeRefund,
          debitAccountId: platformFeeAccount,
          creditAccountId: accountId(
            AccountCode.StripeExternalClearing,
            'stripe_account',
            platformPayment.stripe_account_id,
            'gbp',
          ),
        },
        {
          id: 'platform_tip_refund',
          amount: 25n,
          code: TransferCode.ApplicationFeeRefund,
          debitAccountId: platformTipAccount,
          creditAccountId: accountId(
            AccountCode.StripeExternalClearing,
            'stripe_account',
            platformPayment.stripe_account_id,
            'gbp',
          ),
        },
      ],
      currency: 'gbp',
      periodStart,
      periodEnd,
    });

    expect(result.differences).toEqual([]);
    expect(result.providerNetMinor).toBe(100n);
    expect(result.ledgerNetMinor).toBe(100n);
  });

  it('classifies an application-fee refund amount mismatch', () => {
    const result = comparePlatformReconciliation({
      providerTransactions: [
        transaction({
          stripeAccountId: 'platform',
          id: 'txn_platform_fee',
          type: 'application_fee',
          amountMinor: 150,
          feeMinor: 0,
          netMinor: 150,
          sourceId: 'fee_1',
        }),
        transaction({
          stripeAccountId: 'platform',
          id: 'txn_platform_fee_refund',
          type: 'application_fee_refund',
          amountMinor: -40,
          feeMinor: 0,
          netMinor: -40,
          sourceId: 'fr_1',
        }),
      ],
      payments: [platformPayment],
      refunds: [refund],
      ledgerPostings: postings,
      currency: 'gbp',
      periodStart,
      periodEnd,
    });

    expect(result.differences).toEqual([
      expect.objectContaining({
        classification: 'wrong_amount',
        providerObjectId: 'fr_1',
        expectedMinor: -50n,
        actualMinor: -40n,
      }),
    ]);
  });
});

describe('stale Stripe event recovery', () => {
  const event = {
    id: 'evt_recovered',
    stripeAccountId: 'acct_1',
    type: 'charge.succeeded',
    apiVersion: '2026-08-26.dahlia',
    createdAt: new Date('2026-08-29T12:01:00.000Z'),
    objectId: 'ch_1',
    payload: {
      id: 'evt_recovered',
      object: 'event',
      type: 'charge.succeeded',
      account: 'acct_1',
      data: { object: { id: 'ch_1', object: 'charge' } },
    },
  } as const;
  const refundEvent = {
    ...event,
    id: 'evt_refunded',
    type: 'charge.refunded',
    payload: {
      ...event.payload,
      id: 'evt_refunded',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_1',
          object: 'charge',
          refunds: { data: [{ id: 're_1', amount: 550 }] },
        },
      },
    },
  } as const;

  function store(rows: DurableInboxRow[]) {
    const ids = new Set<string>();
    return {
      async insertIfNew(row: DurableInboxRow) {
        if (ids.has(row.stripe_event_id)) {
          return { created: false, stripeEventId: row.stripe_event_id };
        }
        ids.add(row.stripe_event_id);
        rows.push(row);
        return { created: true, stripeEventId: row.stripe_event_id };
      },
    };
  }

  it('accepts a matching raw event into durable inbox', async () => {
    const stripe = new MockStripeClient();
    stripe.events.push(event);
    const rows: DurableInboxRow[] = [];
    const inbox = store(rows);

    const result = await recoverMissingStripeEvents({
      stripe,
      store: inbox,
      stripeAccountId: 'acct_1',
      periodStart,
      periodEnd,
      differences: [{ classification: 'missing_event', providerObjectId: 'ch_1' }],
    });

    expect(result).toEqual({ recovered: 1, notFound: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      stripe_event_id: 'evt_recovered',
      stripe_account_id: 'acct_1',
      event_type: 'charge.succeeded',
    });
    await expect(
      recoverMissingStripeEvents({
        stripe,
        store: inbox,
        stripeAccountId: 'acct_1',
        periodStart,
        periodEnd,
        differences: [{ classification: 'missing_event', providerObjectId: 'ch_1' }],
      }),
    ).resolves.toEqual({ recovered: 0, notFound: 0 });
    expect(rows).toHaveLength(1);
  });

  it('reports an exact object locator that Stripe cannot find', async () => {
    const rows: DurableInboxRow[] = [];
    const result = await recoverMissingStripeEvents({
      stripe: new MockStripeClient(),
      store: store(rows),
      stripeAccountId: 'acct_1',
      periodStart,
      periodEnd,
      differences: [{ classification: 'missing_event', providerObjectId: 'ch_missing' }],
    });

    expect(result).toEqual({ recovered: 0, notFound: 1 });
    expect(rows).toEqual([]);
  });

  it('matches refund locators nested in charge.refunded events', async () => {
    const stripe = new MockStripeClient();
    stripe.events.push(refundEvent);
    const rows: DurableInboxRow[] = [];

    const result = await recoverMissingStripeEvents({
      stripe,
      store: store(rows),
      stripeAccountId: 'acct_1',
      periodStart,
      periodEnd,
      differences: [{ classification: 'missing_event', providerObjectId: 're_1' }],
    });

    expect(result).toEqual({ recovered: 1, notFound: 0 });
    expect(rows[0]).toMatchObject({
      stripe_event_id: 'evt_refunded',
      event_type: 'charge.refunded',
    });
  });

  it('propagates a transient list failure and succeeds on retry', async () => {
    const stripe = new MockStripeClient();
    stripe.eventListError = new Error('Stripe unavailable');
    const rows: DurableInboxRow[] = [];
    const args = {
      stripe,
      store: store(rows),
      stripeAccountId: 'acct_1',
      periodStart,
      periodEnd,
      differences: [{ classification: 'missing_event' as const, providerObjectId: 'ch_1' }],
    };

    await expect(recoverMissingStripeEvents(args)).rejects.toThrow('Stripe unavailable');
    stripe.eventListError = null;
    stripe.events.push(event);
    await expect(recoverMissingStripeEvents(args)).resolves.toEqual({
      recovered: 1,
      notFound: 0,
    });
  });
});
