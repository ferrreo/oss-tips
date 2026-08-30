import { describe, expect, it } from 'vitest';
import { CreateAccountStatus, CreateTransferStatus, type Transfer } from 'tigerbeetle-node';
import {
  AccountCode,
  TigerBeetleLedgerClient,
  createLedgerClient,
  MockLedgerClient,
  accountId,
  buildDisputeIntent,
  buildOneOffRefundIntent,
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
    expect(intent.transfers.map((transfer) => transfer.linked)).toEqual([true, true, false]);

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

describe('refund and dispute corrections', () => {
  it('reverses a full one-off settlement without leaving balances behind', async () => {
    const settlement = buildOneOffSettlementIntent({
      ...baseInput,
      stripeEventId: 'pi_refund_1',
      featureMode: 'standard',
    });
    const refund = buildOneOffRefundIntent({
      stripeAccountId: baseInput.stripeAccountId,
      stripeEventId: 're_1',
      paymentId: baseInput.paymentId,
      projectId: baseInput.projectId,
      currency: baseInput.currency,
      refundCustomerChargeMinor: 1100n,
      originalCustomerChargeMinor: 1100n,
      originalProjectShareMinor: 1000n,
      originalPlatformFeeMinor: 0n,
      originalPlatformTipMinor: 100n,
    });
    expect(refund.transfers.map((transfer) => transfer.amount)).toEqual([1000n, 100n]);
    expect(refund.transfers.map((transfer) => transfer.linked)).toEqual([true, false]);

    const client = new MockLedgerClient();
    expect((await replayIntents(client, [settlement, refund])).failed).toBe(0);
    expect(
      await client.getAccountBalance(
        accountId(AccountCode.StripeExternalClearing, 'stripe_account', 'acct_test', 'gbp'),
      ),
    ).toBe(0n);
    expect(
      await client.getAccountBalance(
        accountId(AccountCode.ProjectGrossSupport, 'project', 'proj_456', 'gbp'),
      ),
    ).toBe(0n);
    expect(
      await client.getAccountBalance(
        accountId(AccountCode.PlatformSupporterTipRevenue, 'platform', 'oss.tips', 'gbp'),
      ),
    ).toBe(0n);
  });

  it('rounds partial refunds while preserving the customer amount', () => {
    const refund = buildOneOffRefundIntent({
      ...baseInput,
      stripeEventId: 're_partial',
      originalCustomerChargeMinor: 1100n,
      originalProjectShareMinor: 1000n,
      originalPlatformFeeMinor: 0n,
      originalPlatformTipMinor: 100n,
      refundCustomerChargeMinor: 550n,
    });
    expect(refund.transfers.reduce((sum, transfer) => sum + transfer.amount, 0n)).toBe(550n);
    expect(refund.metadata.refundCustomerChargeMinor).toBe(550n);
  });

  it('preserves the original project amount in five-percent mode', () => {
    const refund = buildOneOffRefundIntent({
      stripeAccountId: baseInput.stripeAccountId,
      stripeEventId: 're_five_percent',
      paymentId: baseInput.paymentId,
      projectId: baseInput.projectId,
      currency: baseInput.currency,
      refundCustomerChargeMinor: 1100n,
      originalCustomerChargeMinor: 1100n,
      originalProjectAmountMinor: 1000n,
      originalProjectShareMinor: 950n,
      originalPlatformFeeMinor: 50n,
      originalPlatformTipMinor: 100n,
      featureMode: 'contributes_5_percent',
    });
    expect(refund.metadata.projectAmountMinor).toBe(1000n);
    expect(refund.metadata.featureMode).toBe('contributes_5_percent');
  });

  it('moves disputed support through suspense and closes either outcome', async () => {
    const settlement = buildOneOffSettlementIntent({ ...baseInput, featureMode: 'standard' });
    const opened = buildDisputeIntent({
      stripeAccountId: baseInput.stripeAccountId,
      stripeEventId: 'dp_win',
      paymentId: baseInput.paymentId,
      projectId: baseInput.projectId,
      currency: baseInput.currency,
      amountMinor: 1000n,
      outcome: 'opened',
    });
    const won = buildDisputeIntent({
      stripeAccountId: baseInput.stripeAccountId,
      stripeEventId: 'dp_win',
      paymentId: baseInput.paymentId,
      projectId: baseInput.projectId,
      currency: baseInput.currency,
      amountMinor: 1000n,
      outcome: 'won',
    });
    const client = new MockLedgerClient();
    expect((await replayIntents(client, [settlement, opened, won])).failed).toBe(0);
    expect(
      await client.getAccountBalance(
        accountId(AccountCode.ProjectGrossSupport, 'project', 'proj_456', 'gbp'),
      ),
    ).toBe(1000n);

    const lost = buildDisputeIntent({
      stripeAccountId: baseInput.stripeAccountId,
      stripeEventId: 'dp_loss',
      paymentId: baseInput.paymentId,
      projectId: baseInput.projectId,
      currency: baseInput.currency,
      amountMinor: 1000n,
      outcome: 'lost',
    });
    expect(lost.transfers[0]?.code).toBe(1140);
  });

  it('moves full disputed gross across project and platform allocations', async () => {
    const settlement = buildOneOffSettlementIntent({ ...baseInput, featureMode: 'standard' });
    const opened = buildDisputeIntent({
      stripeAccountId: baseInput.stripeAccountId,
      stripeEventId: 'dp_full',
      paymentId: baseInput.paymentId,
      projectId: baseInput.projectId,
      currency: baseInput.currency,
      amountMinor: 1100n,
      outcome: 'opened',
      originalCustomerChargeMinor: 1100n,
      originalProjectShareMinor: 1000n,
      originalPlatformFeeMinor: 0n,
      originalPlatformTipMinor: 100n,
    });
    const won = buildDisputeIntent({
      stripeAccountId: baseInput.stripeAccountId,
      stripeEventId: 'dp_full',
      paymentId: baseInput.paymentId,
      projectId: baseInput.projectId,
      currency: baseInput.currency,
      amountMinor: 1100n,
      outcome: 'won',
      originalCustomerChargeMinor: 1100n,
      originalProjectShareMinor: 1000n,
      originalPlatformFeeMinor: 0n,
      originalPlatformTipMinor: 100n,
    });
    const client = new MockLedgerClient();
    expect((await replayIntents(client, [settlement, opened, won])).failed).toBe(0);
    expect(
      await client.getAccountBalance(
        accountId(AccountCode.UnreconciledSuspense, 'stripe_account', 'acct_test', 'gbp'),
      ),
    ).toBe(0n);
    expect(
      await client.getAccountBalance(
        accountId(AccountCode.PlatformSupporterTipRevenue, 'platform', 'oss.tips', 'gbp'),
      ),
    ).toBe(100n);
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
    expect(
      await client.lookupTransfers(client.listTransfers().map((transfer) => transfer.id)),
    ).toHaveLength(3);
  });
});

describe('TigerBeetle adapter', () => {
  it('maps accounts and linked transfers to the official client shape', async () => {
    const calls = { accounts: [], transfers: [], destroyed: false } as {
      accounts: unknown[];
      transfers: unknown[];
      destroyed: boolean;
    };
    const client = new TigerBeetleLedgerClient(['127.0.0.1:3000'], 7n, {
      createClient: () => ({
        createAccounts: async (accounts) => {
          calls.accounts.push(...accounts);
          return accounts.map(() => ({ timestamp: 0n, status: 0xffff_ffff }));
        },
        createTransfers: async (transfers) => {
          calls.transfers.push(...transfers);
          return transfers.map(() => ({ timestamp: 0n, status: 0xffff_ffff }));
        },
        lookupAccounts: async () => [
          {
            id: 123n,
            debits_pending: 0n,
            debits_posted: 4n,
            credits_pending: 0n,
            credits_posted: 9n,
            user_data_128: 0n,
            user_data_64: 0n,
            user_data_32: 0,
            reserved: 0,
            ledger: 1,
            code: 1,
            flags: 0,
            timestamp: 1n,
          },
        ],
        lookupTransfers: async () => [],
        destroy: () => {
          calls.destroyed = true;
        },
      }),
    });
    const intent = buildOneOffSettlementIntent({ ...baseInput, featureMode: 'standard' });
    const result = await replayIntents(client, [intent]);
    expect(result.succeeded).toBe(1);
    expect((calls.accounts[0] as { timestamp: bigint }).timestamp).toBe(0n);
    expect((calls.transfers[0] as { timestamp: bigint }).timestamp).toBe(0n);
    expect((calls.transfers[0] as { flags: number }).flags).toBe(1);
    expect((calls.transfers.at(-1) as { flags: number }).flags).toBe(0);
    expect(await client.getAccountBalance(123n)).toBe(5n);
    client.reset();
    expect(calls.destroyed).toBe(true);
  });

  it('looks up persisted transfers after an adapter restart', async () => {
    const stored = new Map<bigint, Transfer>();
    const module = {
      createClient: () => ({
        createAccounts: async (accounts: { id: bigint }[]) =>
          accounts.map(() => ({ timestamp: 0n, status: CreateAccountStatus.created })),
        createTransfers: async (transfers: Transfer[]) => {
          for (const transfer of transfers) stored.set(transfer.id, transfer);
          return transfers.map(() => ({ timestamp: 0n, status: CreateTransferStatus.created }));
        },
        lookupAccounts: async () => [],
        lookupTransfers: async (ids: bigint[]) =>
          ids.flatMap((id) => {
            const transfer = stored.get(id);
            return transfer ? [transfer] : [];
          }),
        destroy: () => {},
      }),
    };
    const intent = buildOneOffSettlementIntent({ ...baseInput, featureMode: 'standard' });
    const first = new TigerBeetleLedgerClient(['127.0.0.1:3000'], 7n, module);
    await expect(replayIntents(first, [intent])).resolves.toMatchObject({ succeeded: 1 });
    first.reset();

    const second = new TigerBeetleLedgerClient(['127.0.0.1:3000'], 7n, module);
    expect(second.listTransfers()).toEqual([]);
    const transfers = await second.lookupTransfers(intent.transfers.map((transfer) => transfer.id));
    expect(transfers.map((transfer) => transfer.id)).toEqual(
      intent.transfers.map((transfer) => transfer.id),
    );
    expect(transfers[1]).toMatchObject({
      amount: 1000n,
      code: 1010,
      debitAccountId: intent.transfers[1]?.debitAccountId,
      creditAccountId: intent.transfers[1]?.creditAccountId,
    });
    second.reset();
  });

  it('replays an already committed linked batch without changing balances', async () => {
    const stored = new Map<bigint, Transfer>();
    const balances = new Map<bigint, { debits: bigint; credits: bigint }>();
    let lookupCount = 0;
    const client = new TigerBeetleLedgerClient(['127.0.0.1:3000'], 7n, {
      createClient: () => ({
        createAccounts: async (accounts) => {
          for (const account of accounts) {
            if (!balances.has(account.id)) balances.set(account.id, { debits: 0n, credits: 0n });
          }
          return accounts.map(() => ({ timestamp: 0n, status: 0xffff_ffff }));
        },
        createTransfers: async (batch) => {
          if (batch.every((transfer) => stored.has(transfer.id))) {
            return batch.map((transfer, index) => ({
              timestamp: stored.get(transfer.id)?.timestamp ?? 1n,
              status:
                index === 0
                  ? CreateTransferStatus.exists
                  : CreateTransferStatus.linked_event_failed,
            }));
          }
          for (const transfer of batch) {
            stored.set(transfer.id, transfer);
            const debit = balances.get(transfer.debit_account_id);
            const credit = balances.get(transfer.credit_account_id);
            if (!debit || !credit) throw new Error('test account missing');
            debit.debits += transfer.amount;
            credit.credits += transfer.amount;
          }
          return batch.map(() => ({ timestamp: 1n, status: CreateTransferStatus.created }));
        },
        lookupAccounts: async (ids) =>
          ids.map((id) => {
            const balance = balances.get(id) ?? { debits: 0n, credits: 0n };
            return {
              id,
              debits_pending: 0n,
              debits_posted: balance.debits,
              credits_pending: 0n,
              credits_posted: balance.credits,
              user_data_128: 0n,
              user_data_64: 0n,
              user_data_32: 0,
              reserved: 0,
              ledger: 826,
              code: 1,
              flags: 0,
              timestamp: 1n,
            };
          }),
        lookupTransfers: async (ids) => {
          lookupCount += 1;
          if (lookupCount <= 2) return [];
          return ids.flatMap((id) => {
            const transfer = stored.get(id);
            return transfer ? [transfer] : [];
          });
        },
        destroy: () => {},
      }),
    });
    const intent = buildOneOffSettlementIntent({ ...baseInput, featureMode: 'standard' });
    const transit = accountId(AccountCode.PaymentTransit, 'payment', baseInput.paymentId, 'gbp');

    const first = await replayIntents(client, [intent]);
    const firstBalance = await client.getAccountBalance(transit);
    const firstTransferCount = client.listTransfers().length;
    const second = await replayIntents(client, [intent]);

    expect(first.succeeded).toBe(1);
    expect(second.succeeded).toBe(1);
    expect(await client.getAccountBalance(transit)).toBe(firstBalance);
    expect(client.listTransfers()).toHaveLength(firstTransferCount);
    expect(lookupCount).toBe(3);

    const original = stored.get(intent.transfers[0]!.id)!;
    stored.set(original.id, { ...original, amount: original.amount + 1n });
    const conflict = await replayIntents(client, [intent]);
    expect(conflict.failed).toBe(1);
    expect(conflict.results[0]?.error).toMatch(/different amount/);
    expect(lookupCount).toBe(4);
    client.reset();
  });

  it('rejects an existing account with a different definition', async () => {
    const client = new TigerBeetleLedgerClient(['127.0.0.1:3000'], 7n, {
      createClient: () => ({
        createAccounts: async () => [{ timestamp: 1n, status: CreateAccountStatus.exists }],
        createTransfers: async () => [],
        lookupAccounts: async (ids) =>
          ids.map((id) => ({
            id,
            debits_pending: 0n,
            debits_posted: 0n,
            credits_pending: 0n,
            credits_posted: 0n,
            user_data_128: 0n,
            user_data_64: 0n,
            user_data_32: 0,
            reserved: 0,
            ledger: 826,
            code: 999,
            flags: 0,
            timestamp: 1n,
          })),
        lookupTransfers: async () => [],
        destroy: () => {},
      }),
    });

    await expect(client.createAccounts([{ id: 123n, ledger: 826, code: 100 }])).rejects.toThrow(
      /different code/,
    );
    client.reset();
  });

  it('does not silently fall back to mock ledger in production mode', () => {
    expect(() => createLedgerClient({})).toThrow(/TIGERBEETLE_ADDRESSES/);
    expect(createLedgerClient({ LEDGER_MODE: 'mock', NODE_ENV: 'test' })).toBeInstanceOf(
      MockLedgerClient,
    );
    expect(() => createLedgerClient({ LEDGER_MODE: 'mock', NODE_ENV: 'production' })).toThrow(
      'only allowed in local development or tests',
    );
    expect(() => createLedgerClient({ LEDGER_MODE: 'mock' })).toThrow(
      'only allowed in local development or tests',
    );
  });
});
