import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('@oss-tips/db', async () => {
  const actual = await vi.importActual<typeof import('@oss-tips/db')>('@oss-tips/db');
  return { ...actual, createStripeEventsRepository: vi.fn() };
});

import { createStripeEventsRepository } from '@oss-tips/db';
import { POST } from './+server';
import { DURABLE_INBOX_MAX_BODY_BYTES } from '@oss-tips/payments';

function streamedEvent(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  let index = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++];
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  const url = new URL('https://oss.tips/api/webhooks/stripe');
  const request = new Request(url, {
    method: 'POST',
    headers: { 'stripe-signature': 'ignored', ...headers },
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  return {
    event: { request, url } as Parameters<typeof POST>[0],
    wasCancelled: () => cancelled,
  };
}

describe('Stripe webhook body boundary', () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
  });

  it('cancels an oversized chunked body without Content-Length', async () => {
    const streamed = streamedEvent([
      new Uint8Array(DURABLE_INBOX_MAX_BODY_BYTES),
      new Uint8Array(1),
    ]);

    const response = await POST(streamed.event);

    expect(response.status).toBe(413);
    expect(streamed.wasCancelled()).toBe(true);
    expect(createStripeEventsRepository).not.toHaveBeenCalled();
  });

  it('cancels an oversized body when Content-Length is spoofed low', async () => {
    const streamed = streamedEvent(
      [new Uint8Array(DURABLE_INBOX_MAX_BODY_BYTES), new Uint8Array(1)],
      { 'content-length': '1' },
    );

    const response = await POST(streamed.event);

    expect(response.status).toBe(413);
    expect(streamed.wasCancelled()).toBe(true);
    expect(createStripeEventsRepository).not.toHaveBeenCalled();
  });

  it.each(['bad', '-1', '1.5', '1e3', '9007199254740992'])(
    'rejects malformed Content-Length %s before reading',
    async (contentLength) => {
      const streamed = streamedEvent([new Uint8Array([1])], { 'content-length': contentLength });

      const response = await POST(streamed.event);

      expect(response.status).toBe(400);
      expect(streamed.wasCancelled()).toBe(false);
      expect(createStripeEventsRepository).not.toHaveBeenCalled();
    },
  );

  it('rejects an under-limit body whose Content-Length does not match', async () => {
    const streamed = streamedEvent([new Uint8Array([1, 2])], { 'content-length': '1' });

    const response = await POST(streamed.event);

    expect(response.status).toBe(400);
    expect(createStripeEventsRepository).not.toHaveBeenCalled();
  });
});
