import { describe, expect, it } from 'vitest';
import {
  redactString,
  redactBody,
  redactHeaders,
  redactCookieHeader,
  createLogger,
  SPAN_NAMES,
  paymentSpan,
  webhookSpan,
} from './index.js';

describe('redaction', () => {
  it('strips emails and signed urls', () => {
    expect(redactString('contact user@example.com')).toContain('[REDACTED_EMAIL]');
    expect(redactString('https://s3.example.com/x?X-Amz-Signature=abc')).toContain('[REDACTED_SIGNED_URL]');
  });

  it('redacts auth headers and bodies', () => {
    expect(redactHeaders({ authorization: 'Bearer x', 'content-type': 'json' })).toEqual({
      authorization: '[REDACTED]',
      'content-type': 'json',
    });
    expect(redactBody({ email: 'a@b.com', name: 'Rust' })).toEqual({ email: '[REDACTED]', name: 'Rust' });
    expect(redactCookieHeader('session=abc; other=1')).toContain('[REDACTED]');
  });
});

describe('spans', () => {
  it('names payment and webhook paths', () => {
    expect(paymentSpan('checkout')).toBe(SPAN_NAMES.paymentCheckoutIntent);
    expect(webhookSpan('outgoing_deliver')).toBe(SPAN_NAMES.outgoingWebhookDeliver);
  });
});

describe('logger', () => {
  it('sanitizes structured fields', () => {
    const logger = createLogger('test');
    expect(() => logger.info('hello', { headers: { authorization: 'x' } })).not.toThrow();
  });
});
