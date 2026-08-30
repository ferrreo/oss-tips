import { describe, expect, it } from 'vitest';
import { AccountCode, MockLedgerClient, accountId } from '@oss-tips/ledger';
import {
  extractDisputeMetadata,
  extractProviderObjectDetails,
  extractRefundEntries,
  extractRefundMetadata,
  extractSettlementMetadata,
  reconcileOneOffEntitlement,
  parseOneOffDuration,
  postDisputeTransition,
  postOneOffRefund,
  settleOneOffPayment,
  shouldSettleOneOff,
} from './settle-one-off.js';

describe('shouldSettleOneOff', () => {
  it('settles checkout and payment_intent success only', () => {
    expect(shouldSettleOneOff('checkout.session.completed')).toBe(true);
    expect(shouldSettleOneOff('payment_intent.succeeded')).toBe(true);
    expect(shouldSettleOneOff('invoice.paid')).toBe(false);
  });
});

describe('extractSettlementMetadata', () => {
  it('reads checkout session metadata', () => {
    const meta = extractSettlementMetadata(
      {
        id: 'evt_1',
        account: 'acct_connected',
        data: {
          object: {
            object: 'checkout.session',
            id: 'cs_1',
            payment_intent: 'pi_1',
            metadata: {
              payment_id: 'pay_1',
              project_id: 'proj_1',
              currency: 'gbp',
              feature_mode: 'standard',
              project_amount_minor: '1000',
              platform_tip_minor: '100',
              customer_charge_minor: '1100',
              oss_project_fee_minor: '0',
              application_fee_minor: '100',
              cadence: 'one_off',
              show_name: 'true',
              show_amount: 'false',
              show_message: 'true',
            },
          },
        },
      },
      null,
    );
    expect('error' in meta).toBe(false);
    if ('error' in meta) return;
    expect(meta.paymentId).toBe('pay_1');
    expect(meta.stripeAccountId).toBe('acct_connected');
    expect(meta.stripePaymentIntentId).toBe('pi_1');
    expect(meta.publicOptions).toEqual({ showName: true, showAmount: false, showMessage: true });
  });

  it('captures charge and application-fee identities from verified provider objects', () => {
    expect(
      extractProviderObjectDetails({
        data: {
          object: {
            object: 'charge',
            id: 'ch_1',
            payment_intent: 'pi_1',
            application_fee: 'fee_1',
          },
        },
      }),
    ).toEqual({
      stripePaymentIntentId: 'pi_1',
      stripeChargeId: 'ch_1',
      stripeApplicationFeeId: 'fee_1',
    });
  });

  it('extracts every individual refund and never the cumulative charge amount', () => {
    expect(
      extractRefundEntries({
        data: {
          object: {
            object: 'charge',
            id: 'ch_1',
            amount_refunded: 900,
            refunds: {
              data: [
                { id: 're_1', amount: 400 },
                { id: 're_2', amount: 500 },
              ],
            },
          },
        },
      }),
    ).toEqual([
      { stripeRefundId: 're_1', refundAmountMinor: 400n },
      { stripeRefundId: 're_2', refundAmountMinor: 500n },
    ]);
  });

  it('rejects dispute metadata that disagrees with the provider amount', () => {
    const result = extractDisputeMetadata(
      {
        data: {
          object: {
            object: 'dispute',
            id: 'dp_1',
            amount: 1000,
            currency: 'gbp',
            status: 'needs_response',
            metadata: {
              payment_id: 'pay_1',
              project_id: 'proj_1',
              currency: 'gbp',
              feature_mode: 'standard',
              project_amount_minor: '1000',
              platform_tip_minor: '100',
              customer_charge_minor: '1100',
              oss_project_fee_minor: '0',
              application_fee_minor: '100',
              cadence: 'one_off',
              dispute_amount_minor: '1',
            },
          },
        },
      },
      'acct_1',
    );
    expect(result).toEqual({ error: 'Dispute amount does not match Stripe object' });
  });
});

const correctionPayload = {
  data: {
    object: {
      object: 'charge',
      id: 'ch_1',
      currency: 'gbp',
      metadata: {
        payment_id: 'pay_1',
        project_id: 'proj_1',
        currency: 'gbp',
        feature_mode: 'standard',
        project_amount_minor: '1000',
        platform_tip_minor: '100',
        customer_charge_minor: '1100',
        oss_project_fee_minor: '0',
        application_fee_minor: '100',
        cadence: 'one_off',
        refund_id: 're_1',
        refund_amount_minor: '550',
        dispute_id: 'dp_1',
        dispute_amount_minor: '1000',
      },
    },
  },
};

describe('ledger corrections', () => {
  it('requires a refund id and posts one refund exactly once', async () => {
    const metadata = extractRefundMetadata(correctionPayload, 'acct_1');
    expect('error' in metadata).toBe(false);
    if ('error' in metadata) return;
    const ledger = new MockLedgerClient();
    const first = await postOneOffRefund({ ledger, metadata });
    const second = await postOneOffRefund({ ledger, metadata });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(ledger.listTransfers()).toHaveLength(2);
  });

  it('uses recurring fee allocation when correcting a membership refund', async () => {
    const metadata = extractRefundMetadata(
      {
        data: {
          object: {
            object: 'charge',
            id: 'ch_membership',
            currency: 'gbp',
            metadata: {
              ...correctionPayload.data.object.metadata,
              cadence: 'monthly',
              oss_project_fee_minor: '20',
              application_fee_minor: '120',
              refund_id: 're_membership',
              refund_amount_minor: '1100',
            },
          },
        },
      },
      'acct_1',
    );
    expect('error' in metadata).toBe(false);
    if ('error' in metadata) return;
    const ledger = new MockLedgerClient();
    const result = await postOneOffRefund({ ledger, metadata });
    expect(result).toMatchObject({ ok: true, applicationFeeRefundMinor: 120n });
  });

  it('posts dispute open and win transitions to the project account', async () => {
    const metadata = extractDisputeMetadata(correctionPayload, 'acct_1', 'opened');
    expect('error' in metadata).toBe(false);
    if ('error' in metadata) return;
    const ledger = new MockLedgerClient();
    const opened = await postDisputeTransition({ ledger, metadata, outcome: 'opened' });
    const won = await postDisputeTransition({ ledger, metadata, outcome: 'won' });
    expect(opened.ok).toBe(true);
    expect(won.ok).toBe(true);
    expect(
      await ledger.getAccountBalance(
        accountId(AccountCode.UnreconciledSuspense, 'stripe_account', 'acct_1', 'gbp'),
      ),
    ).toBe(0n);
  });

  it('moves full disputed charge allocation through suspense', async () => {
    const metadata = extractDisputeMetadata(
      {
        data: {
          object: {
            object: 'dispute',
            id: 'dp_full',
            amount: 1100,
            currency: 'gbp',
            status: 'needs_response',
            payment_intent: 'pi_full',
            metadata: {
              payment_id: 'pay_full',
              project_id: 'proj_1',
              currency: 'gbp',
              feature_mode: 'standard',
              project_amount_minor: '1000',
              platform_tip_minor: '100',
              customer_charge_minor: '1100',
              oss_project_fee_minor: '0',
              application_fee_minor: '100',
              cadence: 'one_off',
            },
          },
        },
      },
      'acct_1',
    );
    expect('error' in metadata).toBe(false);
    if ('error' in metadata) return;
    const ledger = new MockLedgerClient();
    const settlement = await settleOneOffPayment({
      ledger,
      stripeEventId: 'evt_full_success',
      metadata,
    });
    expect(settlement.ok).toBe(true);
    const opened = await postDisputeTransition({ ledger, metadata, outcome: 'opened' });
    expect(opened.ok).toBe(true);
    expect(
      await ledger.getAccountBalance(
        accountId(AccountCode.UnreconciledSuspense, 'stripe_account', 'acct_1', 'gbp'),
      ),
    ).toBe(1100n);
    const won = await postDisputeTransition({ ledger, metadata, outcome: 'won' });
    expect(won.ok).toBe(true);
    expect(
      await ledger.getAccountBalance(
        accountId(AccountCode.UnreconciledSuspense, 'stripe_account', 'acct_1', 'gbp'),
      ),
    ).toBe(0n);
  });
});

describe('settleOneOffPayment', () => {
  it('posts linked transfers with zero transit', async () => {
    const ledger = new MockLedgerClient();
    const result = await settleOneOffPayment({
      ledger,
      stripeEventId: 'evt_settle_1',
      metadata: {
        paymentId: 'pay_settle_1',
        projectId: 'proj_1',
        stripeAccountId: 'acct_1',
        currency: 'gbp',
        projectAmountMinor: 1000n,
        platformTipMinor: 100n,
        featureMode: 'standard',
        cadence: 'one_off',
        customerChargeMinor: 1100n,
        ossProjectFeeMinor: 0n,
        applicationFeeMinor: 100n,
        stripePaymentIntentId: 'pi_1',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transitBalance).toBe(0n);
    expect(ledger.listTransfers().length).toBeGreaterThan(0);
  });

  it('is idempotent on replay', async () => {
    const ledger = new MockLedgerClient();
    const metadata = {
      paymentId: 'pay_settle_2',
      projectId: 'proj_1',
      stripeAccountId: 'acct_1',
      currency: 'gbp',
      projectAmountMinor: 1000n,
      platformTipMinor: 0n,
      featureMode: 'standard' as const,
      cadence: 'one_off',
      customerChargeMinor: 1000n,
      ossProjectFeeMinor: 0n,
      applicationFeeMinor: 0n,
      stripePaymentIntentId: null,
    };

    const first = await settleOneOffPayment({
      ledger,
      stripeEventId: 'evt_settle_2',
      metadata,
    });
    const second = await settleOneOffPayment({
      ledger,
      stripeEventId: 'evt_settle_2',
      metadata,
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });

  it('uses payment intent identity across checkout and payment events', async () => {
    const ledger = new MockLedgerClient();
    const metadata = {
      paymentId: 'pay_settle_3',
      projectId: 'proj_1',
      stripeAccountId: 'acct_1',
      currency: 'gbp',
      projectAmountMinor: 1000n,
      platformTipMinor: 0n,
      featureMode: 'standard' as const,
      cadence: 'one_off',
      customerChargeMinor: 1000n,
      ossProjectFeeMinor: 0n,
      applicationFeeMinor: 0n,
      stripePaymentIntentId: 'pi_stable',
    };
    await settleOneOffPayment({ ledger, stripeEventId: 'evt_checkout', metadata });
    await settleOneOffPayment({ ledger, stripeEventId: 'evt_payment_intent', metadata });
    expect(ledger.listTransfers()).toHaveLength(2);
  });

  it('uses stable payment identity when one success event omits payment intent', async () => {
    const ledger = new MockLedgerClient();
    const metadata = {
      paymentId: 'pay_settle_thin_event',
      projectId: 'proj_1',
      stripeAccountId: 'acct_1',
      currency: 'gbp',
      projectAmountMinor: 1000n,
      platformTipMinor: 0n,
      featureMode: 'standard' as const,
      cadence: 'one_off',
      customerChargeMinor: 1000n,
      ossProjectFeeMinor: 0n,
      applicationFeeMinor: 0n,
      stripePaymentIntentId: null as string | null,
    };
    await settleOneOffPayment({ ledger, stripeEventId: 'evt_checkout_without_pi', metadata });
    await settleOneOffPayment({
      ledger,
      stripeEventId: 'evt_payment_intent_with_pi',
      metadata: { ...metadata, stripePaymentIntentId: 'pi_recovered' },
    });
    expect(ledger.listTransfers()).toHaveLength(2);
  });

  it('does not post client-supplied fee values', async () => {
    const ledger = new MockLedgerClient();
    const result = await settleOneOffPayment({
      ledger,
      stripeEventId: 'evt_bad_fee',
      metadata: {
        paymentId: 'pay_bad_fee',
        projectId: 'proj_1',
        stripeAccountId: 'acct_1',
        currency: 'gbp',
        projectAmountMinor: 1000n,
        platformTipMinor: 100n,
        featureMode: 'standard',
        cadence: 'one_off',
        customerChargeMinor: 1100n,
        ossProjectFeeMinor: 1n,
        applicationFeeMinor: 101n,
        stripePaymentIntentId: 'pi_bad_fee',
      },
    });
    expect(result.ok).toBe(false);
    expect(ledger.listTransfers()).toHaveLength(0);
  });

  it('does not settle an unpaid checkout session', async () => {
    const ledger = new MockLedgerClient();
    const result = await settleOneOffPayment({
      ledger,
      stripeEventId: 'evt_unpaid',
      metadata: {
        paymentId: 'pay_unpaid',
        projectId: 'proj_1',
        stripeAccountId: 'acct_1',
        currency: 'gbp',
        projectAmountMinor: 1000n,
        platformTipMinor: 0n,
        featureMode: 'standard',
        cadence: 'one_off',
        customerChargeMinor: 1000n,
        ossProjectFeeMinor: 0n,
        applicationFeeMinor: 0n,
        stripePaymentIntentId: 'pi_unpaid',
        paymentStatus: 'unpaid',
      },
    });
    expect(result).toEqual({
      ok: false,
      error: 'payment status unpaid is not settled',
      skipped: true,
    });
    expect(ledger.listTransfers()).toHaveLength(0);
  });
});

describe('one-off entitlement policy', () => {
  it('accepts configured durations and prorates timed access after reversal', () => {
    expect(parseOneOffDuration('days_30')).toBe('days_30');
    expect(parseOneOffDuration(null)).toBe('none');
    const startsAt = new Date('2026-01-01T00:00:00.000Z');
    const result = reconcileOneOffEntitlement({
      duration: 'days_30',
      startsAt,
      originalChargeMinor: 1000n,
      refundedChargeMinor: 500n,
    });
    expect(result.grant).toBe(true);
    expect(result.revoke).toBe(false);
    expect(result.endsAt).toEqual(new Date('2026-01-16T00:00:00.000Z'));
  });

  it('treats persisted year duration as canonical 365-day access', () => {
    expect(parseOneOffDuration('year')).toBe('days_365');
    const startsAt = new Date('2026-01-01T00:00:00.000Z');
    expect(
      reconcileOneOffEntitlement({
        duration: parseOneOffDuration('year'),
        startsAt,
        originalChargeMinor: 1000n,
        refundedChargeMinor: 0n,
      }).endsAt,
    ).toEqual(new Date('2027-01-01T00:00:00.000Z'));
  });

  it('revokes immediately on full reversal and keeps permanent access on partial reversal', () => {
    const startsAt = new Date('2026-01-01T00:00:00.000Z');
    expect(
      reconcileOneOffEntitlement({
        duration: 'days_90',
        startsAt,
        originalChargeMinor: 1000n,
        refundedChargeMinor: 1000n,
      }),
    ).toMatchObject({ grant: true, revoke: true, endsAt: startsAt });
    expect(
      reconcileOneOffEntitlement({
        duration: 'permanent',
        startsAt,
        originalChargeMinor: 1000n,
        refundedChargeMinor: 500n,
      }),
    ).toEqual({ grant: true, revoke: false, endsAt: null });
  });
});
