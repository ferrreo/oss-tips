import { describe, expect, it } from 'vitest';
import { MockLedgerClient } from '@oss-tips/ledger';
import {
  extractSettlementMetadata,
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
});
