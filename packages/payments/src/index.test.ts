import { describe, expect, it } from 'vitest';
import {
  acceptStripeEventIntoInbox,
  createCheckoutIntent,
  createStripeClient,
  computeInvoiceApplicationFeeAmount,
  isAllowedStripeWebhookEvent,
  MockStripeClient,
  orchestrateRefund,
  shouldOfferCryptoPayment,
  signStripeWebhookPayload,
  verifyStripeWebhook,
  type DurableInboxRow,
  type DurableInboxStore,
} from './index.js';

describe('payments checkout', () => {
  it('computes fees via domain and never uses client fee', async () => {
    const client = new MockStripeClient();
    const result = await createCheckoutIntent(
      client,
      {
        project: 'rust',
        projectAmountMinor: 1000,
        projectCurrency: 'gbp',
        platformTipMinor: 100,
        cadence: 'one_off',
        publicOptions: { showName: true, showAmount: false, showMessage: true },
      },
      {
        projectId: 'prj_1',
        stripeAccountId: 'acct_test',
        featureMode: 'standard',
        capabilities: { cardPayments: true, cryptoPayments: false },
        successUrl: 'https://oss.tips/success',
        cancelUrl: 'https://oss.tips/cancel',
      },
    );

    expect(result.applicationFeeMinor).toBe('100');
    expect(result.customerChargeMinor).toBe('1100');
    expect(result.clientSecret).toContain('_secret_mock');
    expect(client.sessions[0]?.applicationFeeMinor).toBe(100);
  });

  it('gates crypto unless crypto_payments active', () => {
    expect(shouldOfferCryptoPayment({ cardPayments: true, cryptoPayments: false })).toBe(false);
    expect(shouldOfferCryptoPayment({ cardPayments: true, cryptoPayments: true })).toBe(true);
  });

  it('creates subscription checkout with stripe price', async () => {
    const client = new MockStripeClient();
    await createCheckoutIntent(
      client,
      {
        project: 'rust',
        tierId: 'tier_1',
        projectAmountMinor: 500,
        projectCurrency: 'gbp',
        platformTipMinor: 50,
        cadence: 'monthly',
        publicOptions: { showName: false, showAmount: false, showMessage: false },
      },
      {
        projectId: 'prj_1',
        stripeAccountId: 'acct_test',
        featureMode: 'contributes_5_percent',
        capabilities: { cardPayments: true, cryptoPayments: true },
        successUrl: 'https://oss.tips/success',
        cancelUrl: 'https://oss.tips/cancel',
        stripePriceId: 'price_monthly',
      },
    );
    expect(client.sessions[0]?.mode).toBe('subscription');
    expect(client.sessions[0]?.enableCrypto).toBe(true);
  });
});

describe('invoice application fee', () => {
  it('matches docs formula', () => {
    const { applicationFeeMinor } = computeInvoiceApplicationFeeAmount({
      projectMembershipAmountMinor: 1000,
      projectFeeRateBps: 200,
      supporterPlatformTipMinor: 100,
      currency: 'gbp',
    });
    expect(applicationFeeMinor).toBe(120n);
  });
});

describe('refunds', () => {
  it('refunds application fee proportionally', async () => {
    const client = new MockStripeClient();
    const result = await orchestrateRefund(client, {
      stripeAccountId: 'acct_test',
      chargeId: 'ch_test',
      refundAmountMinor: 550,
      currency: 'gbp',
      originalCustomerChargeMinor: 1100,
      originalApplicationFeeMinor: 150,
      reason: 'requested_by_customer',
    });
    expect(result.applicationFeeRefundMinor).toBe('75');
    expect(result.status).toBe('succeeded');
  });
});

describe('webhook allowlist', () => {
  it('accepts documented events', () => {
    expect(isAllowedStripeWebhookEvent('invoice.created')).toBe(true);
    expect(isAllowedStripeWebhookEvent('unknown.event')).toBe(false);
  });
});

describe('durable inbox', () => {
  it('verifies signature and inserts idempotently', async () => {
    const secret = 'whsec_test_secret';
    const payload = {
      id: 'evt_test_1',
      object: 'event',
      api_version: '2025-01-27.acacia',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test' } },
    };
    const rawBody = JSON.stringify(payload);
    const signature = signStripeWebhookPayload({ rawBody, webhookSecret: secret });
    const event = verifyStripeWebhook({
      rawBody,
      signatureHeader: signature,
      webhookSecret: secret,
    });

    const seen = new Map<string, DurableInboxRow>();
    const store: DurableInboxStore = {
      async insertIfNew(row) {
        if (seen.has(row.stripe_event_id)) {
          return { created: false, stripeEventId: row.stripe_event_id };
        }
        seen.set(row.stripe_event_id, row);
        return { created: true, stripeEventId: row.stripe_event_id };
      },
    };

    const first = await acceptStripeEventIntoInbox({
      event,
      store,
      rawBodyByteLength: Buffer.byteLength(rawBody),
    });
    const second = await acceptStripeEventIntoInbox({
      event,
      store,
      rawBodyByteLength: Buffer.byteLength(rawBody),
    });

    expect(first).toEqual({
      kind: 'accepted',
      stripeEventId: 'evt_test_1',
      type: 'checkout.session.completed',
      created: true,
    });
    expect(second).toMatchObject({ kind: 'accepted', created: false });
    expect(seen.size).toBe(1);
  });

  it('rejects unsupported event types before insert', async () => {
    const result = await acceptStripeEventIntoInbox({
      event: {
        id: 'evt_x',
        type: 'customer.created',
        apiVersion: null,
        account: null,
        payload: {},
      },
      store: {
        async insertIfNew() {
          throw new Error('should not insert');
        },
      },
      rawBodyByteLength: 10,
    });
    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      expect(result.status).toBe(400);
    }
  });
});

describe('checkout metadata', () => {
  it('embeds settlement fields for the finance worker', async () => {
    const client = new MockStripeClient();
    await createCheckoutIntent(
      client,
      {
        project: 'rust',
        projectAmountMinor: 1000,
        projectCurrency: 'gbp',
        platformTipMinor: 100,
        cadence: 'one_off',
        publicOptions: { showName: true, showAmount: false, showMessage: true },
      },
      {
        projectId: 'prj_1',
        paymentId: '00000000-0000-7000-8000-000000000001',
        stripeAccountId: 'acct_test',
        featureMode: 'standard',
        capabilities: { cardPayments: true, cryptoPayments: false },
        successUrl: 'https://oss.tips/success',
        cancelUrl: 'https://oss.tips/cancel',
      },
    );
    const meta = client.sessions[0]?.metadata;
    expect(meta?.payment_id).toBe('00000000-0000-7000-8000-000000000001');
    expect(meta?.project_amount_minor).toBe('1000');
    expect(meta?.platform_tip_minor).toBe('100');
    expect(meta?.feature_mode).toBe('standard');
  });
});

describe('stripe client factory', () => {
  it('returns mock when key unset', () => {
    const client = createStripeClient();
    expect(client).toBeInstanceOf(MockStripeClient);
  });
});
