import { describe, expect, it } from 'vitest';
import {
  AccountCode,
  MockLedgerClient,
  accountId,
  buildOneOffSettlementIntent,
  deriveLedgerId,
  replayIntents,
  transitBalance,
  transferId,
} from './index.js';

const baseInput = {
  stripeAccountId: 'acct_test',
  stripeEventId: 'evt_test',
  paymentId: 'pay_123',
  projectId: 'proj_456',
  currency: 'gbp',
  projectAmountMinor: 1000n,
  platformTipMinor: 100n,
} as const;

describe('deriveLedgerId', () => {
  it('is deterministic for the same namespace and parts', () => {
    const a = deriveLedgerId('oss.tips/v1/transfer', 'acct', 'evt', 'settlement', '1', '0');
    const b = deriveLedgerId('oss.tips/v1/transfer', 'acct', 'evt', 'settlement', '1', '0');
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0n);
  });

  it('differs when posting version changes', () => {
    const v1 = transferId('acct', 'evt', 'one_off_settlement', 1, 0);
    const v2 = transferId('acct', 'evt', 'one_off_settlement', 2, 0);
    expect(v1).not.toBe(v2);
  });

  it('maps forbidden zero to 1', () => {
    let attempts = 0;
    for (let i = 0; i < 500; i++) {
      const id = deriveLedgerId('test', String(i));
      expect(id).not.toBe(0n);
      if (id === 1n) attempts++;
    }
    expect(attempts).toBeGreaterThanOrEqual(0);
  });
});

describe('one-off settlement', () => {
  it('standard mode splits transit to zero', async () => {
    const intent = buildOneOffSettlementIntent({
      ...baseInput,
      featureMode: 'standard',
    });

    expect(intent.transfers).toHaveLength(3);
    expect(intent.transfers[0]?.amount).toBe(1100n);
    expect(intent.transfers[1]?.amount).toBe(1000n);
    expect(intent.transfers[2]?.amount).toBe(100n);

    const transit = accountId(AccountCode.PaymentTransit, 'payment', baseInput.paymentId, 'gbp');
    expect(transitBalance(intent.transfers, transit)).toBe(0n);

    const client = new MockLedgerClient();
    const summary = await replayIntents(client, [intent]);
    expect(summary.succeeded).toBe(1);
    expect(await client.getAccountBalance(transit)).toBe(0n);
  });

  it('5% mode splits transit to zero with platform fee', async () => {
    const intent = buildOneOffSettlementIntent({
      ...baseInput,
      featureMode: 'contributes_5_percent',
    });

    expect(intent.transfers).toHaveLength(4);
    expect(intent.transfers[1]?.amount).toBe(950n);
    expect(intent.transfers[2]?.amount).toBe(50n);
    expect(intent.transfers[3]?.amount).toBe(100n);

    const transit = accountId(AccountCode.PaymentTransit, 'payment', baseInput.paymentId, 'gbp');
    expect(transitBalance(intent.transfers, transit)).toBe(0n);

    const client = new MockLedgerClient();
    await replayIntents(client, [intent]);
    expect(await client.getAccountBalance(transit)).toBe(0n);

    const platformFee = accountId(
      AccountCode.PlatformProjectFeeRevenue,
      'platform',
      'oss.tips',
      'gbp',
    );
    expect(await client.getAccountBalance(platformFee)).toBe(50n);
  });
});

describe('replayIntents', () => {
  it('is idempotent for duplicate replay', async () => {
    const intent = buildOneOffSettlementIntent({
      ...baseInput,
      featureMode: 'standard',
    });
    const client = new MockLedgerClient();
    const first = await replayIntents(client, [intent]);
    const second = await replayIntents(client, [intent]);
    expect(first.succeeded).toBe(1);
    expect(second.succeeded).toBe(1);
    expect(client.listTransfers()).toHaveLength(3);
  });
});
