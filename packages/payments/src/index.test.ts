import { describe, expect, it } from 'vitest';
import {
  createCheckoutIntent,
  createStripeClient,
  computeInvoiceApplicationFeeAmount,
  isAllowedStripeWebhookEvent,
  MockStripeClient,
  orchestrateRefund,
  shouldOfferCryptoPayment,
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

describe('stripe client factory', () => {
  it('returns mock when key unset', () => {
    const client = createStripeClient();
    expect(client).toBeInstanceOf(MockStripeClient);
  });
});
