#!/usr/bin/env node

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { TigerBeetleLedgerClient } from '../packages/ledger/dist/index.js';

const randomId = () => BigInt(`0x${randomBytes(16).toString('hex')}`) || 1n;
const client = new TigerBeetleLedgerClient(
  process.env.TIGERBEETLE_ADDRESSES ?? '127.0.0.1:3000',
  process.env.TIGERBEETLE_CLUSTER_ID ?? '0',
);
const debitAccountId = randomId();
const creditAccountId = randomId();
const transferId = randomId();

try {
  await client.createAccounts([
    { id: debitAccountId, ledger: 1, code: 1 },
    { id: creditAccountId, ledger: 1, code: 2 },
  ]);
  const transfer = {
    id: transferId,
    debitAccountId,
    creditAccountId,
    amount: 123n,
    ledger: 1,
    code: 1,
    linked: false,
  };
  assert.equal((await client.createTransfers([transfer])).ok, true);
  assert.equal((await client.createTransfers([transfer])).ok, true);
  assert.equal(await client.getAccountBalance(debitAccountId), -123n);
  assert.equal(await client.getAccountBalance(creditAccountId), 123n);
  console.log('TigerBeetle smoke passed');
} finally {
  client.reset();
}
