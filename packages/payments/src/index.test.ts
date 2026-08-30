import { describe, expect, it, vi } from 'vitest';
import {
  acceptStripeEventIntoInbox,
  applyInvoiceApplicationFee,
  classifyStripeWebhookEvent,
  computeDisputeCorrection,
  createCheckoutIntent,
  createStripeClient,
  computeInvoiceApplicationFeeAmount,
  isStripeEventNewer,
  isAllowedStripeWebhookEvent,
  MockStripeClient,
  RealStripeClient,
  orchestrateRefund,
  paymentIdForIdempotencyKey,
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
        publicOptions: {
          showName: true,
          showAmount: false,
          showMessage: true,
          displayName: 'Ada Lovelace',
          message: 'Thank you for the work.',
        },
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
    expect(client.sessions[0]?.metadata).toMatchObject({
      show_name: 'true',
      show_amount: 'false',
      show_message: 'true',
      display_name: 'Ada Lovelace',
      public_message: 'Thank you for the work.',
    });
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
        userId: 'user_1',
        featureMode: 'contributes_5_percent',
        capabilities: { cardPayments: true, cryptoPayments: true },
        successUrl: 'https://oss.tips/success',
        cancelUrl: 'https://oss.tips/cancel',
        idempotencyKey: 'project_1:subscription-checkout',
        stripePriceId: 'price_monthly',
      },
    );
    expect(client.sessions[0]?.mode).toBe('subscription');
    expect(client.sessions[0]?.enableCrypto).toBe(true);
    expect(client.sessions[0]?.recurringTipMinor).toBe(50);
    expect(client.sessions[0]?.metadata.user_id).toBe('user_1');
    expect(client.sessions[0]?.idempotencyKey).toBe('project_1:subscription-checkout');
  });

  it('reuses one Stripe session for an idempotent retry', async () => {
    const client = new MockStripeClient();
    const input = {
      project: 'rust',
      projectAmountMinor: 1000,
      projectCurrency: 'gbp',
      platformTipMinor: 100,
      cadence: 'one_off' as const,
      publicOptions: { showName: true, showAmount: false, showMessage: true },
    };
    const context = {
      projectId: 'prj_1',
      stripeAccountId: 'acct_test',
      featureMode: 'standard' as const,
      capabilities: { cardPayments: true, cryptoPayments: false },
      successUrl: 'https://oss.tips/success',
      cancelUrl: 'https://oss.tips/cancel',
      idempotencyKey: 'checkout-retry-1',
    };
    const first = await createCheckoutIntent(client, input, context);
    const second = await createCheckoutIntent(client, input, context);
    expect(second.intentId).toBe(first.intentId);
    expect(second.clientSecret).toBe(first.clientSecret);
    expect(client.sessions).toHaveLength(1);
  });

  it('rejects untrusted or unsafe checkout values before Stripe', async () => {
    const client = new MockStripeClient();
    const context = {
      projectId: 'prj_1',
      stripeAccountId: 'acct_test',
      featureMode: 'standard' as const,
      capabilities: { cardPayments: true, cryptoPayments: false },
      successUrl: 'https://oss.tips/success',
      cancelUrl: 'https://oss.tips/cancel',
    };
    await expect(
      createCheckoutIntent(
        client,
        {
          project: 'rust',
          projectAmountMinor: 100,
          projectCurrency: 'gbp',
          platformTipMinor: 0,
          cadence: 'one_off',
          publicOptions: { showName: true, showAmount: false, showMessage: true },
        },
        context,
      ),
    ).rejects.toThrow('below the minimum');
    await expect(
      createCheckoutIntent(
        client,
        {
          project: 'rust',
          projectAmountMinor: Number.MAX_SAFE_INTEGER,
          projectCurrency: 'gbp',
          platformTipMinor: 1,
          cadence: 'one_off',
          publicOptions: { showName: true, showAmount: false, showMessage: true },
        },
        context,
      ),
    ).rejects.toThrow('exceeds the maximum');
    expect(client.sessions).toHaveLength(0);
  });

  it('rejects currencies without a settlement ledger before Stripe', async () => {
    const client = new MockStripeClient();
    await expect(
      createCheckoutIntent(
        client,
        {
          project: 'rust',
          projectAmountMinor: 1000,
          projectCurrency: 'cad',
          platformTipMinor: 0,
          cadence: 'one_off',
          publicOptions: { showName: false, showAmount: false, showMessage: false },
        },
        {
          projectId: 'prj_1',
          stripeAccountId: 'acct_test',
          featureMode: 'standard',
          capabilities: { cardPayments: true, cryptoPayments: false },
          successUrl: 'https://oss.tips/success',
          cancelUrl: 'https://oss.tips/cancel',
        },
      ),
    ).rejects.toThrow('Unsupported currency');
    expect(client.sessions).toHaveLength(0);
  });

  it('applies configured limits in JPY minor units', async () => {
    const client = new MockStripeClient();
    await expect(
      createCheckoutIntent(
        client,
        {
          project: 'rust',
          projectAmountMinor: 499,
          projectCurrency: 'jpy',
          platformTipMinor: 0,
          cadence: 'one_off',
          publicOptions: { showName: false, showAmount: false, showMessage: false },
        },
        {
          projectId: 'prj_1',
          stripeAccountId: 'acct_test',
          featureMode: 'standard',
          capabilities: { cardPayments: true, cryptoPayments: false },
          successUrl: 'https://oss.tips/success',
          cancelUrl: 'https://oss.tips/cancel',
          limits: { minimumProjectAmountMinor: 500, maximumProjectAmountMinor: 50000 },
        },
      ),
    ).rejects.toThrow('below the minimum');

    const result = await createCheckoutIntent(
      client,
      {
        project: 'rust',
        projectAmountMinor: 1000,
        projectCurrency: 'jpy',
        platformTipMinor: 0,
        cadence: 'one_off',
        publicOptions: { showName: false, showAmount: false, showMessage: false },
      },
      {
        projectId: 'prj_1',
        stripeAccountId: 'acct_test',
        featureMode: 'standard',
        capabilities: { cardPayments: true, cryptoPayments: false },
        successUrl: 'https://oss.tips/success',
        cancelUrl: 'https://oss.tips/cancel',
        limits: { minimumProjectAmountMinor: 500, maximumProjectAmountMinor: 50000 },
      },
    );
    expect(result.currency).toBe('jpy');
    expect(client.sessions.at(-1)?.amountMinor).toBe(1000);
  });

  it('rejects a membership amount that differs from authoritative tier price', async () => {
    await expect(
      createCheckoutIntent(
        new MockStripeClient(),
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
          featureMode: 'standard',
          capabilities: { cardPayments: true, cryptoPayments: false },
          successUrl: 'https://oss.tips/success',
          cancelUrl: 'https://oss.tips/cancel',
          stripePriceId: 'price_monthly',
          authoritativePrice: { amountMinor: 600, currency: 'gbp', cadence: 'monthly' },
        },
      ),
    ).rejects.toThrow('does not match selected amount');
  });

  it('fails closed for malformed public input', async () => {
    await expect(
      createCheckoutIntent(
        new MockStripeClient(),
        {
          project: 42 as unknown as string,
          projectAmountMinor: 1000,
          projectCurrency: 'gbp',
          platformTipMinor: 0,
          cadence: 'one_off',
          publicOptions: { showName: true, showAmount: true, showMessage: true },
        },
        {
          projectId: 'prj_1',
          stripeAccountId: 'acct_test',
          featureMode: 'standard',
          capabilities: { cardPayments: true, cryptoPayments: false },
          successUrl: 'https://oss.tips/success',
          cancelUrl: 'https://oss.tips/cancel',
        },
      ),
    ).rejects.toThrow('Project slug is invalid');
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

  it('updates a connected-account invoice and finalises only after fee update', async () => {
    const client = new MockStripeClient();
    const result = await applyInvoiceApplicationFee(client, {
      stripeAccountId: 'acct_test',
      invoiceId: 'in_test',
      projectMembershipAmountMinor: 1000,
      projectFeeRateBps: 200,
      supporterPlatformTipMinor: 100,
      currency: 'GBP',
      invoiceTotalMinor: 1100,
      idempotencyKey: 'invoice-created-1',
      finalize: true,
    });
    expect(result).toMatchObject({
      invoiceId: 'in_test',
      applicationFeeMinor: '120',
      currency: 'gbp',
      finalized: true,
    });
    expect(client.invoiceUpdates[0]?.applicationFeeMinor).toBe(120);
    expect(client.finalizedInvoices).toHaveLength(1);
  });

  it('rejects an invoice fee larger than invoice total', async () => {
    await expect(
      applyInvoiceApplicationFee(new MockStripeClient(), {
        stripeAccountId: 'acct_test',
        invoiceId: 'in_test',
        projectMembershipAmountMinor: 1000,
        projectFeeRateBps: 200,
        supporterPlatformTipMinor: 100,
        currency: 'gbp',
        invoiceTotalMinor: 50,
      }),
    ).rejects.toThrow('exceeds invoice total');
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

  it('uses exact application-fee refund endpoint for partial refunds', async () => {
    const client = new MockStripeClient();
    const result = await orchestrateRefund(client, {
      stripeAccountId: 'acct_test',
      chargeId: 'ch_test',
      refundAmountMinor: 550,
      currency: 'gbp',
      originalCustomerChargeMinor: 1100,
      originalApplicationFeeMinor: 150,
      reason: 'requested_by_customer',
      stripeApplicationFeeId: 'fee_test',
      idempotencyKey: 'refund-1',
    });
    expect(result.applicationFeeRefundMinor).toBe('75');
    expect(result.applicationFeeRefundId).toMatch(/^fr_/);
    expect(client.refunds[0]?.refundApplicationFee).toBe(false);
    expect(client.applicationFeeRefunds[0]?.amountMinor).toBe(75);
  });

  it('rejects invalid refund reasons and repeated over-refunds', async () => {
    const client = new MockStripeClient();
    await expect(
      orchestrateRefund(client, {
        stripeAccountId: 'acct_test',
        chargeId: 'ch_test',
        refundAmountMinor: 1,
        currency: 'gbp',
        originalCustomerChargeMinor: 100,
        originalApplicationFeeMinor: 5,
        reason: '',
      }),
    ).rejects.toThrow('reason is invalid');
    await expect(
      orchestrateRefund(client, {
        stripeAccountId: 'acct_test',
        chargeId: 'ch_test',
        refundAmountMinor: 60,
        currency: 'gbp',
        originalCustomerChargeMinor: 100,
        originalApplicationFeeMinor: 5,
        previouslyRefundedCustomerChargeMinor: 60,
        previouslyRefundedApplicationFeeMinor: 3,
        reason: 'duplicate',
      }),
    ).rejects.toThrow('remaining charge');
  });

  it('rejects inconsistent prior fee corrections', async () => {
    await expect(
      orchestrateRefund(new MockStripeClient(), {
        stripeAccountId: 'acct_test',
        chargeId: 'ch_test',
        refundAmountMinor: 10,
        currency: 'gbp',
        originalCustomerChargeMinor: 100,
        originalApplicationFeeMinor: 5,
        previouslyRefundedCustomerChargeMinor: 0,
        previouslyRefundedApplicationFeeMinor: 1,
        reason: 'duplicate',
      }),
    ).rejects.toThrow('inconsistent with charge refunds');
  });
});

describe('webhook allowlist', () => {
  it('accepts documented events', () => {
    expect(isAllowedStripeWebhookEvent('invoice.created')).toBe(true);
    expect(isAllowedStripeWebhookEvent('unknown.event')).toBe(false);
  });

  it('classifies event families and ignores stale delivery order', () => {
    expect(
      classifyStripeWebhookEvent({ type: 'charge.dispute.created', objectId: 'dp_test' }),
    ).toEqual({
      accepted: true,
      kind: 'dispute',
      type: 'charge.dispute.created',
      objectId: 'dp_test',
    });
    expect(classifyStripeWebhookEvent({ type: 'unknown.event' })).toMatchObject({
      accepted: false,
      kind: 'unsupported',
    });
    expect(
      isStripeEventNewer({ id: 'evt_new', createdAt: 20 }, { id: 'evt_old', createdAt: 10 }),
    ).toBe(true);
    expect(
      isStripeEventNewer({ id: 'evt_old', createdAt: 10 }, { id: 'evt_new', createdAt: 20 }),
    ).toBe(false);
  });

  it('handles duplicate and out-of-order delivery deterministically', () => {
    const delivery = [
      { id: 'evt_opened', createdAt: 10 },
      { id: 'evt_closed', createdAt: 30 },
      { id: 'evt_review', createdAt: 20 },
      { id: 'evt_closed', createdAt: 30 },
    ];
    let current: { id: string; createdAt: number } | undefined;
    let applied = 0;
    for (const incoming of delivery) {
      if (isStripeEventNewer(incoming, current)) {
        current = incoming;
        applied += 1;
      }
    }
    expect(applied).toBe(2);
    expect(current).toEqual({ id: 'evt_closed', createdAt: 30 });
  });
});

describe('dispute corrections', () => {
  it('creates append-only open/won/lost corrections and suppresses stale states', () => {
    expect(
      computeDisputeCorrection({
        eventType: 'charge.dispute.created',
        status: 'needs_response',
        stripeDisputeId: 'dp_test',
        amountMinor: 1000,
        currency: 'GBP',
      }),
    ).toMatchObject({ action: 'opened', transferCode: 1120, amountMinor: '1000', currency: 'gbp' });
    expect(
      computeDisputeCorrection({
        eventType: 'charge.dispute.closed',
        status: 'won',
        previousStatus: 'under_review',
        stripeDisputeId: 'dp_test',
        amountMinor: 1000,
        currency: 'gbp',
      }).transferCode,
    ).toBe(1130);
    expect(
      computeDisputeCorrection({
        eventType: 'charge.dispute.updated',
        status: 'needs_response',
        previousStatus: 'lost',
        stripeDisputeId: 'dp_test',
        amountMinor: 1000,
        currency: 'gbp',
      }).action,
    ).toBe('none');
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

  it('rejects a connected-account event addressed to another account', async () => {
    await expect(
      acceptStripeEventIntoInbox({
        event: {
          id: 'evt_wrong_account',
          type: 'payment_intent.succeeded',
          apiVersion: null,
          account: 'acct_other',
          payload: {},
        },
        expectedStripeAccountId: 'acct_expected',
        store: {
          async insertIfNew() {
            throw new Error('should not insert');
          },
        },
        rawBodyByteLength: 10,
      }),
    ).resolves.toMatchObject({ kind: 'rejected', status: 400, title: 'Unexpected Stripe account' });
  });
});

describe('webhook verification', () => {
  it('normalises event ordering and object identity from signed payloads', () => {
    const rawBody = JSON.stringify({
      id: 'evt_ordered',
      object: 'event',
      created: 123,
      api_version: '2026-08-26.dahlia',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_ordered', object: 'payment_intent' } },
    });
    const event = verifyStripeWebhook({
      rawBody,
      signatureHeader: signStripeWebhookPayload({ rawBody, webhookSecret: 'whsec_ordered' }),
      webhookSecret: 'whsec_ordered',
    });
    expect(event).toMatchObject({ id: 'evt_ordered', createdAt: 123, objectId: 'pi_ordered' });
  });

  it('rejects empty webhook boundary values before signature work', () => {
    expect(() =>
      verifyStripeWebhook({
        rawBody: '',
        signatureHeader: 't=1,v1=x',
        webhookSecret: 'whsec_test',
      }),
    ).toThrow('payload is required');
    expect(() =>
      verifyStripeWebhook({ rawBody: '{}', signatureHeader: '', webhookSecret: 'whsec_test' }),
    ).toThrow('signature header is required');
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
  it('allows mock only in local development or tests', () => {
    const client = createStripeClient(undefined, { NODE_ENV: 'test' });
    expect(client).toBeInstanceOf(MockStripeClient);
    expect(() => createStripeClient(undefined, { NODE_ENV: 'production' })).toThrow(
      'STRIPE_SECRET_KEY is required',
    );
    expect(() => createStripeClient(undefined, {})).toThrow('mock mode is only allowed');
  });

  it('does not silently downgrade an invalid configured key to mock', () => {
    expect(() => createStripeClient('not-a-stripe-key')).toThrow('Stripe secret key is invalid');
  });

  it('keeps Connect account onboarding idempotent in the mock', async () => {
    const client = new MockStripeClient();
    const first = await client.createConnectedAccount({
      displayName: 'Rust project',
      country: 'gb',
      defaultCurrency: 'GBP',
      idempotencyKey: 'account-1',
    });
    const second = await client.createConnectedAccount({
      displayName: 'Rust project',
      country: 'gb',
      defaultCurrency: 'GBP',
      idempotencyKey: 'account-1',
    });
    expect(second).toEqual(first);
    expect(client.connectedAccounts).toHaveLength(1);
    const link = await client.createConnectedAccountLink({
      stripeAccountId: first.stripeAccountId,
      refreshUrl: 'https://oss.tips/connect/refresh',
      returnUrl: 'https://oss.tips/connect/return',
      idempotencyKey: 'account-link-1',
    });
    expect(link.url).toContain(first.stripeAccountId);
    const session = await client.createConnectedAccountSession({
      stripeAccountId: first.stripeAccountId,
      idempotencyKey: 'account-session-1',
    });
    expect(session.clientSecret).toContain('_secret_mock');
    expect(session.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('keeps customer portal sessions idempotent and rejects wrong customer IDs', async () => {
    const client = new MockStripeClient();
    const first = await client.createCustomerPortalSession({
      stripeAccountId: 'acct_test',
      customerId: 'cus_test',
      returnUrl: 'https://oss.tips/me/memberships',
      idempotencyKey: 'portal-1',
    });
    const second = await client.createCustomerPortalSession({
      stripeAccountId: 'acct_test',
      customerId: 'cus_test',
      returnUrl: 'https://oss.tips/me/memberships',
      idempotencyKey: 'portal-1',
    });
    expect(second).toEqual(first);
    expect(client.customerPortalSessions).toHaveLength(1);
    await expect(
      client.createCustomerPortalSession({
        stripeAccountId: 'acct_test',
        customerId: 'acct_not_customer',
        returnUrl: 'https://oss.tips/me/memberships',
      }),
    ).rejects.toThrow('Stripe customer id is invalid');
    await expect(
      client.createCustomerPortalSession({
        stripeAccountId: 'acct_test',
        customerId: 'cus_test',
        returnUrl: 'http://evil.example/me/memberships',
      }),
    ).rejects.toThrow('Customer portal return URL must use HTTPS');
  });

  it('derives one payment record ID for every retry key', () => {
    expect(paymentIdForIdempotencyKey('checkout-retry-1')).toBe(
      paymentIdForIdempotencyKey('checkout-retry-1'),
    );
    expect(paymentIdForIdempotencyKey('checkout-retry-1')).not.toBe(
      paymentIdForIdempotencyKey('checkout-retry-2'),
    );
  });
});

describe('recurring subscription tips', () => {
  it('updates a tip to zero and reuses the idempotent result', async () => {
    const client = new MockStripeClient();
    const params = {
      stripeAccountId: 'acct_test',
      subscriptionId: 'sub_test',
      currentTipMinor: 100,
      platformTipMinor: 0,
      currency: 'GBP',
      cadence: 'monthly' as const,
      idempotencyKey: 'membership-tip-1',
    };

    const first = await client.updateSubscriptionTip(params);
    const retry = await client.updateSubscriptionTip(params);

    expect(first).toEqual({ subscriptionId: 'sub_test', platformTipMinor: 0 });
    expect(retry).toEqual(first);
    expect(client.subscriptionTipUpdates).toHaveLength(1);
  });

  it('replaces a marked Stripe item without proration', async () => {
    const client = new RealStripeClient('sk_test_tipupdate');
    const stripe = {
      products: { create: vi.fn() },
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          metadata: { platform_tip_minor: '100' },
          items: {
            data: [
              {
                id: 'si_tip',
                metadata: { oss_tips_component: 'platform_tip' },
                quantity: 1,
                price: {
                  currency: 'gbp',
                  product: 'prod_tip',
                  recurring: { interval: 'month' },
                  unit_amount: 100,
                },
              },
            ],
          },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    Object.defineProperty(client, 'stripe', { value: stripe });

    await client.updateSubscriptionTip({
      stripeAccountId: 'acct_test',
      subscriptionId: 'sub_test',
      currentTipMinor: 100,
      platformTipMinor: 250,
      currency: 'gbp',
      cadence: 'monthly',
      idempotencyKey: 'membership-tip-2',
    });

    expect(stripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_test',
      {
        items: [
          {
            id: 'si_tip',
            metadata: { oss_tips_component: 'platform_tip' },
            price_data: {
              currency: 'gbp',
              product: 'prod_tip',
              recurring: { interval: 'month' },
              unit_amount: 250,
            },
            quantity: 1,
          },
        ],
        metadata: { platform_tip_minor: '250' },
        proration_behavior: 'none',
      },
      { idempotencyKey: 'membership-tip-2', stripeAccount: 'acct_test' },
    );
    expect(stripe.products.create).not.toHaveBeenCalled();
  });

  it('recognises a completed zero-tip deletion on an idempotent retry', async () => {
    const client = new RealStripeClient('sk_test_tipretry');
    const stripe = {
      products: { create: vi.fn() },
      subscriptions: {
        retrieve: vi
          .fn()
          .mockResolvedValueOnce({
            metadata: { platform_tip_minor: '100' },
            items: {
              data: [
                {
                  id: 'si_tip',
                  metadata: { oss_tips_component: 'platform_tip' },
                  quantity: 1,
                  price: {
                    currency: 'gbp',
                    product: 'prod_tip',
                    recurring: { interval: 'month' },
                    unit_amount: 100,
                  },
                },
              ],
            },
          })
          .mockResolvedValueOnce({
            metadata: { platform_tip_minor: '0' },
            items: { data: [] },
          }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    Object.defineProperty(client, 'stripe', { value: stripe });
    const params = {
      stripeAccountId: 'acct_test',
      subscriptionId: 'sub_test',
      currentTipMinor: 100,
      platformTipMinor: 0,
      currency: 'gbp',
      cadence: 'monthly' as const,
      idempotencyKey: 'membership-tip-retry',
    };

    await client.updateSubscriptionTip(params);
    await client.updateSubscriptionTip(params);

    expect(stripe.subscriptions.update).toHaveBeenCalledTimes(1);
  });

  it('rejects negative recurring tips before provider calls', async () => {
    const client = new MockStripeClient();
    await expect(
      client.updateSubscriptionTip({
        stripeAccountId: 'acct_test',
        subscriptionId: 'sub_test',
        currentTipMinor: 0,
        platformTipMinor: -1,
        currency: 'gbp',
        cadence: 'monthly',
      }),
    ).rejects.toThrow('Recurring tip must be non-negative');
    expect(client.subscriptionTipUpdates).toHaveLength(0);
  });
});
