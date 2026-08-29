import { describe, expect, it } from 'vitest';
import {
  CheckoutIntentRequestSchema,
  CheckoutIntentResponseSchema,
  WebhookEnvelopeSchema,
  ProblemDetailsSchema,
  MoneySchema,
  generateOpenApiDocument,
} from './index.js';
import { WEBHOOK_API_VERSION } from '@oss-tips/domain';

describe('money schema', () => {
  it('accepts string minor amounts', () => {
    expect(MoneySchema.parse({ amount: '1000', currency: 'gbp' })).toEqual({
      amount: '1000',
      currency: 'gbp',
    });
  });
});

describe('checkout intent schemas', () => {
  it('parses request matching docs example', () => {
    const parsed = CheckoutIntentRequestSchema.parse({
      projectAmountMinor: 1000,
      projectCurrency: 'gbp',
      platformTipMinor: 100,
      cadence: 'one_off',
      publicOptions: { showName: true, showAmount: false, showMessage: true },
    });
    expect(parsed.projectAmountMinor).toBe(1000);
  });

  it('parses checkout response', () => {
    const parsed = CheckoutIntentResponseSchema.parse({
      id: 'ci_abc',
      client_secret: 'cs_secret',
      checkout_url: 'https://checkout.stripe.com/c/pay/cs_test',
      expires_at: '2026-08-28T20:30:00Z',
      application_fee: { amount: '100', currency: 'gbp' },
      customer_charge: { amount: '1100', currency: 'gbp' },
      mode: 'payment',
    });
    expect(parsed.mode).toBe('payment');
  });
});

describe('webhook envelope', () => {
  it('validates outgoing event envelope', () => {
    const envelope = WebhookEnvelopeSchema.parse({
      id: 'evt_01J',
      type: 'membership.renewed',
      api_version: WEBHOOK_API_VERSION,
      created_at: '2026-08-28T20:00:00Z',
      project_id: 'prj_01J',
      data: { object: { membership_id: 'm1' } },
    });
    expect(envelope.type).toBe('membership.renewed');
  });
});

describe('problem details', () => {
  it('parses RFC 9457 shape', () => {
    const p = ProblemDetailsSchema.parse({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Project not found',
    });
    expect(p.status).toBe(404);
  });
});

describe('openapi', () => {
  it('generates OpenAPI 3.1 document with checkout path', () => {
    const doc = generateOpenApiDocument();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.paths?.['/api/v1/projects/{slug}/checkout-intents']).toBeDefined();
  });
});
