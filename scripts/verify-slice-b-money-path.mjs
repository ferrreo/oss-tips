import assert from 'node:assert/strict';
import {
  acceptStripeEventIntoInbox,
  createCheckoutIntent,
  MockStripeClient,
  signStripeWebhookPayload,
  verifyStripeWebhook,
} from '../packages/payments/dist/index.js';
import { MockLedgerClient } from '../packages/ledger/dist/index.js';
import {
  extractSettlementMetadata,
  settleOneOffPayment,
} from '../apps/finance-worker/dist/settle-one-off.js';

const secret = 'whsec_verify_slice_b';
const client = new MockStripeClient();
const paymentId = '11111111-1111-7111-8111-111111111111';
const intent = await createCheckoutIntent(
  client,
  {
    project: 'demo',
    projectAmountMinor: 1000,
    projectCurrency: 'gbp',
    platformTipMinor: 100,
    cadence: 'one_off',
    publicOptions: { showName: true, showAmount: false, showMessage: false },
  },
  {
    projectId: '22222222-2222-7222-8222-222222222222',
    paymentId,
    stripeAccountId: 'acct_demo',
    featureMode: 'standard',
    capabilities: { cardPayments: true, cryptoPayments: false },
    successUrl: 'https://oss.tips/ok',
    cancelUrl: 'https://oss.tips/cancel',
  },
);

const sessionMeta = client.sessions[0].metadata;
const payload = {
  id: 'evt_verify_slice_b',
  object: 'event',
  api_version: '2025-01-27.acacia',
  type: 'checkout.session.completed',
  account: 'acct_demo',
  data: {
    object: {
      object: 'checkout.session',
      id: 'cs_verify',
      payment_intent: 'pi_verify',
      metadata: sessionMeta,
    },
  },
};
const rawBody = JSON.stringify(payload);
const signature = signStripeWebhookPayload({ rawBody, webhookSecret: secret });
const event = verifyStripeWebhook({ rawBody, signatureHeader: signature, webhookSecret: secret });

const seen = new Map();
const inbox = await acceptStripeEventIntoInbox({
  event,
  rawBodyByteLength: Buffer.byteLength(rawBody),
  store: {
    async insertIfNew(row) {
      if (seen.has(row.stripe_event_id)) {
        return { created: false, stripeEventId: row.stripe_event_id };
      }
      seen.set(row.stripe_event_id, row);
      return { created: true, stripeEventId: row.stripe_event_id };
    },
  },
});
assert.equal(inbox.kind, 'accepted');
assert.equal(inbox.created, true);

const extracted = extractSettlementMetadata(payload, 'acct_demo');
assert.ok(!('error' in extracted), extracted.error);
const ledger = new MockLedgerClient();
const settlement = await settleOneOffPayment({
  ledger,
  stripeEventId: payload.id,
  metadata: extracted,
});
assert.equal(settlement.ok, true);
assert.equal(settlement.transitBalance, 0n);
assert.equal(intent.intentId, paymentId);
console.log(
  JSON.stringify({
    ok: true,
    paymentId,
    inbox: inbox.kind,
    transitBalance: settlement.transitBalance.toString(),
    transfers: ledger.listTransfers().length,
  }),
);
