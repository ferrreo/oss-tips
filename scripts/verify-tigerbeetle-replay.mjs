#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  AccountCode,
  accountId,
  buildOneOffRefundIntent,
  buildOneOffSettlementIntent,
  replayIntents,
  TigerBeetleLedgerClient,
} from '../packages/ledger/dist/index.js';

if (process.env.TIGERBEETLE_REPLAY_DRILL_CONFIRM !== 'fresh-isolated-cluster') {
  throw new Error(
    'Set TIGERBEETLE_REPLAY_DRILL_CONFIRM=fresh-isolated-cluster before writing drill transfers',
  );
}

const addresses = process.env.TIGERBEETLE_ADDRESSES?.trim();
const clusterId = process.env.TIGERBEETLE_CLUSTER_ID?.trim();
if (!addresses) throw new Error('TIGERBEETLE_ADDRESSES is required');
if (!clusterId || !/^\d+$/.test(clusterId)) {
  throw new Error('TIGERBEETLE_CLUSTER_ID must be an unsigned integer');
}

const input = {
  stripeAccountId: 'acct_replay_drill',
  paymentId: '00000000-0000-4000-8000-000000000001',
  projectId: '00000000-0000-4000-8000-000000000002',
  currency: 'gbp',
  projectAmountMinor: 1000n,
  platformTipMinor: 100n,
  featureMode: 'standard',
};
const settlement = buildOneOffSettlementIntent({
  ...input,
  stripeEventId: 'evt_replay_drill_settlement',
});
const refund = buildOneOffRefundIntent({
  ...input,
  stripeEventId: 'evt_replay_drill_refund',
  refundCustomerChargeMinor: 1100n,
  originalCustomerChargeMinor: 1100n,
  originalProjectShareMinor: 1000n,
  originalPlatformFeeMinor: 0n,
  originalPlatformTipMinor: 100n,
});
const intents = [settlement, refund];
const client = new TigerBeetleLedgerClient(addresses, clusterId);

try {
  const first = await replayIntents(client, intents);
  assert.equal(first.total, intents.length);
  assert.equal(first.failed, 0, JSON.stringify(first.results));
  const transferCount = client.listTransfers().length;

  const second = await replayIntents(client, intents);
  assert.equal(second.total, intents.length);
  assert.equal(second.failed, 0, JSON.stringify(second.results));
  assert.equal(client.listTransfers().length, transferCount);
  assert.equal(
    transferCount,
    intents.reduce((count, intent) => count + intent.transfers.length, 0),
  );

  for (const [code, scopeKind, scopeId] of [
    [AccountCode.StripeExternalClearing, 'stripe_account', input.stripeAccountId],
    [AccountCode.ProjectGrossSupport, 'project', input.projectId],
    [AccountCode.PlatformSupporterTipRevenue, 'platform', 'oss.tips'],
  ]) {
    assert.equal(
      await client.getAccountBalance(accountId(code, scopeKind, scopeId, input.currency)),
      0n,
    );
  }
  console.log(`TigerBeetle replay drill passed (${transferCount} transfers, idempotent replay)`);
} finally {
  client.reset();
}
