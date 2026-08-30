import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(() => ({}) as never),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('@oss-tips/db', async () => {
  const actual = await vi.importActual<typeof import('@oss-tips/db')>('@oss-tips/db');
  return {
    ...actual,
    createEmailDeliveriesRepository: vi.fn(),
  };
});

import { createEmailDeliveriesRepository } from '@oss-tips/db';
import { POST } from './+server';
import { RESEND_WEBHOOK_MAX_BODY_BYTES } from './resend-webhook';

const webhookSecret = `whsec_${Buffer.from('resend-webhook-test-secret').toString('base64')}`;

function signature(body: string, id: string, timestamp: string): string {
  const key = Buffer.from(webhookSecret.slice('whsec_'.length), 'base64');
  const value = `${id}.${timestamp}.${body}`;
  return `v1,${createHmac('sha256', key).update(value).digest('base64')}`;
}

function event(body: string, headers: Record<string, string> = {}) {
  const url = new URL('https://oss.tips/api/webhooks/resend');
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
    }),
    url,
  } as Parameters<typeof POST>[0];
}

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
  const url = new URL('https://oss.tips/api/webhooks/resend');
  const request = new Request(url, {
    method: 'POST',
    headers: {
      'svix-id': 'evt_streamed',
      'svix-timestamp': String(Math.floor(Date.now() / 1000)),
      'svix-signature': 'v1,ignored',
      ...headers,
    },
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  return {
    event: { request, url } as Parameters<typeof POST>[0],
    wasCancelled: () => cancelled,
  };
}

function signedEvent(payload: Record<string, unknown>, id = 'evt_123') {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  return event(body, {
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': signature(body, id, timestamp),
  });
}

describe('Resend delivery webhook', () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('RESEND_WEBHOOK_SECRET', webhookSecret);
    vi.mocked(createEmailDeliveriesRepository).mockReturnValue({
      recordProviderEvent: vi.fn(async () => ({
        created: true,
        deliveryId: 'delivery_123',
        statusApplied: true,
      })),
    } as never);
  });

  it('rejects unsigned requests before touching delivery state', async () => {
    const response = await POST(event('{}'));

    expect(response.status).toBe(400);
    expect(createEmailDeliveriesRepository).not.toHaveBeenCalled();
  });

  it('fails closed when the webhook secret is unavailable', async () => {
    vi.stubEnv('RESEND_WEBHOOK_SECRET', '');

    const response = await POST(event('{}'));

    expect(response.status).toBe(503);
    expect(createEmailDeliveriesRepository).not.toHaveBeenCalled();
  });

  it('rejects invalid signatures', async () => {
    const response = await POST(
      event('{"type":"email.delivered"}', {
        'svix-id': 'evt_invalid',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,invalid',
      }),
    );

    expect(response.status).toBe(400);
    expect(createEmailDeliveriesRepository).not.toHaveBeenCalled();
  });

  it('records a verified delivery event idempotently', async () => {
    const response = await POST(
      signedEvent({
        type: 'email.delivered',
        created_at: '2026-08-30T12:00:00.000Z',
        data: { email_id: 're_email_123', to: ['Maintainer@Example.com'] },
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      received: true,
      processed: true,
      duplicate: false,
      matched: true,
    });
    const repository = vi.mocked(createEmailDeliveriesRepository).mock.results[0]?.value as {
      recordProviderEvent: ReturnType<typeof vi.fn>;
    };
    expect(repository.recordProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        providerEventId: 'evt_123',
        providerEmailId: 're_email_123',
        eventType: 'email.delivered',
        status: 'delivered',
        occurredAt: new Date('2026-08-30T12:00:00.000Z'),
      }),
    );
  });

  it('suppresses permanent bounces and complaints with separate reasons', async () => {
    const recordProviderEvent = vi.fn(async () => ({
      created: true,
      deliveryId: null,
      statusApplied: false,
    }));
    vi.mocked(createEmailDeliveriesRepository).mockReturnValue({ recordProviderEvent } as never);

    await POST(
      signedEvent(
        {
          type: 'email.bounced',
          created_at: '2026-08-30T12:00:00.000Z',
          data: {
            email_id: 're_email_123',
            to: ['hard-bounce@example.com'],
            bounce: { type: 'Permanent', subType: 'General', message: 'Mailbox unavailable' },
          },
        },
        'evt_bounce',
      ),
    );
    await POST(
      signedEvent(
        {
          type: 'email.complained',
          created_at: '2026-08-30T12:01:00.000Z',
          data: { email_id: 're_email_456', to: ['spam-report@example.com'] },
        },
        'evt_complaint',
      ),
    );

    expect(recordProviderEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        providerEventId: 'evt_bounce',
        status: 'bounced',
        suppression: { reason: 'bounce', emailAddresses: ['hard-bounce@example.com'] },
      }),
    );
    expect(recordProviderEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        providerEventId: 'evt_complaint',
        status: 'complained',
        suppression: { reason: 'complaint', emailAddresses: ['spam-report@example.com'] },
      }),
    );
  });

  it('does not suppress temporary bounces', async () => {
    const recordProviderEvent = vi.fn(async () => ({
      created: true,
      deliveryId: null,
      statusApplied: false,
    }));
    vi.mocked(createEmailDeliveriesRepository).mockReturnValue({ recordProviderEvent } as never);

    const response = await POST(
      signedEvent(
        {
          type: 'email.bounced',
          created_at: '2026-08-30T12:00:00.000Z',
          data: {
            email_id: 're_email_123',
            to: ['temporary@example.com'],
            bounce: { type: 'Temporary', subType: 'MailboxFull', message: 'Mailbox full' },
          },
        },
        'evt_temp',
      ),
    );

    expect(response.status).toBe(202);
    expect(recordProviderEvent).toHaveBeenCalledWith(
      expect.not.objectContaining({ suppression: expect.anything() }),
    );
  });

  it('persists provider-suppressed recipients separately from bounces', async () => {
    const recordProviderEvent = vi.fn(async () => ({
      created: true,
      deliveryId: null,
      statusApplied: false,
    }));
    vi.mocked(createEmailDeliveriesRepository).mockReturnValue({ recordProviderEvent } as never);

    const response = await POST(
      signedEvent(
        {
          type: 'email.suppressed',
          created_at: '2026-08-30T12:00:00.000Z',
          data: {
            email_id: 're_email_123',
            to: ['suppressed@example.com'],
            suppressed: { type: 'Bounced', message: 'Recipient is on suppression list' },
          },
        },
        'evt_suppressed',
      ),
    );

    expect(response.status).toBe(202);
    expect(recordProviderEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        providerEventId: 'evt_suppressed',
        providerEmailId: 're_email_123',
        eventType: 'email.suppressed',
        status: 'suppressed',
        suppression: { reason: 'provider', emailAddresses: ['suppressed@example.com'] },
      }),
    );
  });

  it('rejects oversized payloads', async () => {
    const body = 'x'.repeat(RESEND_WEBHOOK_MAX_BODY_BYTES + 1);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const response = await POST(
      event(body, {
        'content-length': String(Buffer.byteLength(body)),
        'svix-id': 'evt_large',
        'svix-timestamp': timestamp,
        'svix-signature': 'v1,ignored',
      }),
    );
    expect(response.status).toBe(413);
    expect(createEmailDeliveriesRepository).not.toHaveBeenCalled();
  });

  it('cancels an oversized chunked body without Content-Length', async () => {
    const streamed = streamedEvent([
      new Uint8Array(RESEND_WEBHOOK_MAX_BODY_BYTES),
      new Uint8Array(1),
    ]);

    const response = await POST(streamed.event);

    expect(response.status).toBe(413);
    expect(streamed.wasCancelled()).toBe(true);
    expect(createEmailDeliveriesRepository).not.toHaveBeenCalled();
  });

  it('cancels an oversized body when Content-Length is spoofed low', async () => {
    const streamed = streamedEvent(
      [new Uint8Array(RESEND_WEBHOOK_MAX_BODY_BYTES), new Uint8Array(1)],
      { 'content-length': '1' },
    );

    const response = await POST(streamed.event);

    expect(response.status).toBe(413);
    expect(streamed.wasCancelled()).toBe(true);
    expect(createEmailDeliveriesRepository).not.toHaveBeenCalled();
  });

  it.each(['bad', '-1', '1.5', '1e3', '9007199254740992'])(
    'rejects malformed Content-Length %s before reading',
    async (contentLength) => {
      const streamed = streamedEvent([new Uint8Array([1])], { 'content-length': contentLength });

      const response = await POST(streamed.event);

      expect(response.status).toBe(400);
      expect(streamed.wasCancelled()).toBe(false);
      expect(createEmailDeliveriesRepository).not.toHaveBeenCalled();
    },
  );

  it('rejects an under-limit body whose Content-Length does not match', async () => {
    const streamed = streamedEvent([new Uint8Array([1, 2])], { 'content-length': '1' });

    const response = await POST(streamed.event);

    expect(response.status).toBe(400);
    expect(createEmailDeliveriesRepository).not.toHaveBeenCalled();
  });
});
