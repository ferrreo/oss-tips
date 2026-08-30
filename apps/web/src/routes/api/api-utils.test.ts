import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@oss-tips/db';
import {
  apiRateLimitHeaders,
  apiRateLimitResponse,
  apiRateLimitSecret,
  encryptWebhookSecretForStorage,
  enforceApiRateLimit,
  getWebhookEncryptionKey,
  hashApiRateLimitKey,
  JSON_BODY_MAX_BYTES,
  readJson,
  readJsonText,
  readJsonValue,
  type ApiEvent,
} from './api-utils.js';

const objectSchema = {
  safeParse(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { success: true as const, data: value as Record<string, unknown> }
      : { success: false as const, error: { message: 'body must be an object' } };
  },
};

function streamRequest(chunks: string[], headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  let index = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index === chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index++]));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request('https://oss.tips/api/mutation', {
    method: 'POST',
    body: stream,
    headers,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  return { request, wasCancelled: () => cancelled };
}

function event(method: string, path: string): ApiEvent {
  return {
    request: new Request(`https://oss.tips${path}`, { method }),
    url: new URL(`https://oss.tips${path}`),
    locals: { session: { user: { id: 'user-1' } } },
  } as ApiEvent;
}

describe('API rate-limit boundary', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('keeps durable principal keys opaque and stable', () => {
    const first = hashApiRateLimitKey('session:user-1');
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(hashApiRateLimitKey('session:user-1'));
    expect(first).not.toContain('user-1');
  });

  it('requires a dedicated rate-limit secret in production', () => {
    expect(() =>
      apiRateLimitSecret({ NODE_ENV: 'production', BETTER_AUTH_SECRET: 'auth-secret' }),
    ).toThrow('API_RATE_LIMIT_SECRET is required in production');
    expect(
      apiRateLimitSecret({ NODE_ENV: 'production', API_RATE_LIMIT_SECRET: 'rate-limit-secret' }),
    ).toBe('rate-limit-secret');
  });

  it('returns RFC rate-limit headers with 429 Problem Details', async () => {
    const response = apiRateLimitResponse({
      allowed: false,
      limit: 20,
      remaining: 0,
      burst: 20,
      windowSeconds: 60,
      resetAt: new Date('2026-08-29T12:01:00.000Z'),
      retryAfterSeconds: 12,
    });
    expect(response.status).toBe(429);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(response.headers.get('retry-after')).toBe('12');
    expect(response.headers.get('ratelimit-limit')).toBe('20');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('ratelimit-reset')).toBe('12');
    expect(response.headers.get('ratelimit-policy')).toBe('20;w=60;burst=20');
    await expect(response.json()).resolves.toMatchObject({ status: 429 });
  });

  it('fails closed for mutations when PostgreSQL limiter is unavailable', async () => {
    const db = {
      transaction: () => ({
        execute: async () => {
          throw new Error('connection refused');
        },
      }),
    } as unknown as Db;
    const failure = await enforceApiRateLimit(event('POST', '/api/v1/project/posts'), db, {
      kind: 'session',
      key: hashApiRateLimitKey('session:user-1'),
    });
    expect(failure?.status).toBe(503);
    await expect(failure?.json()).resolves.toMatchObject({
      title: 'Rate limiter unavailable',
      status: 503,
    });
  });

  it('allows authenticated reads to continue during a limiter outage', async () => {
    const db = {
      transaction: () => ({
        execute: async () => {
          throw new Error('connection refused');
        },
      }),
    } as unknown as Db;
    await expect(
      enforceApiRateLimit(event('GET', '/api/v1/project/posts'), db, {
        kind: 'session',
        key: hashApiRateLimitKey('session:user-1'),
      }),
    ).resolves.toBeNull();
  });
});

describe('webhook encryption boundary', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns a 503 when the envelope key is missing', async () => {
    vi.stubEnv('WEBHOOK_ENCRYPTION_KEY', '');
    const result = getWebhookEncryptionKey();
    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) return;
    expect(result.status).toBe(503);
    await expect(result.json()).resolves.toMatchObject({
      title: 'Webhook secrets unavailable',
      status: 503,
    });
  });

  it('fails closed when the envelope key is not 32 bytes', async () => {
    vi.stubEnv('WEBHOOK_ENCRYPTION_KEY', 'not-a-32-byte-key');
    const result = encryptWebhookSecretForStorage('whsec_test');
    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) return;
    expect(result.status).toBe(503);
    await expect(result.json()).resolves.toMatchObject({
      title: 'Webhook secrets unavailable',
      detail: 'WEBHOOK_ENCRYPTION_KEY must decode to 32 bytes',
      status: 503,
    });
  });
});

describe('bounded JSON request bodies', () => {
  it('parses a normal body before schema validation', async () => {
    const body = JSON.stringify({ value: 'ok' });
    const request = new Request('https://oss.tips/api/mutation', {
      method: 'POST',
      body,
      headers: { 'content-length': String(new TextEncoder().encode(body).byteLength) },
    });
    await expect(readJson(request, objectSchema)).resolves.toEqual({ value: 'ok' });
  });

  it('accepts a body at the exact byte boundary', async () => {
    const encoder = new TextEncoder();
    const prefix = '{"value":"';
    const suffix = '"}';
    const body = `${prefix}${'x'.repeat(
      JSON_BODY_MAX_BYTES - encoder.encode(prefix + suffix).byteLength,
    )}${suffix}`;
    const result = await readJsonValue(
      new Request('https://oss.tips/api/mutation', {
        method: 'POST',
        body,
        headers: { 'content-length': String(encoder.encode(body).byteLength) },
      }),
    );
    expect(result).toEqual({ value: 'x'.repeat(JSON_BODY_MAX_BYTES - 12) });
  });

  it('cancels a chunked body as soon as it exceeds the limit', async () => {
    const { request, wasCancelled } = streamRequest([
      '{"value":"',
      'x'.repeat(JSON_BODY_MAX_BYTES),
      '"}',
    ]);
    const result = await readJsonValue(request);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(413);
    expect(wasCancelled()).toBe(true);
  });

  it('rejects a low Content-Length when received bytes exceed the limit', async () => {
    const { request, wasCancelled } = streamRequest(['x'.repeat(JSON_BODY_MAX_BYTES + 1)], {
      'content-length': '1',
    });
    const result = await readJsonValue(request);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(413);
    expect(wasCancelled()).toBe(true);
  });

  it('rejects a declared length mismatch before JSON parsing', async () => {
    const result = await readJsonValue(
      new Request('https://oss.tips/api/mutation', {
        method: 'POST',
        body: '{"value":"ok"}',
        headers: { 'content-length': '1' },
      }),
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
  });

  it('rejects malformed Content-Length and malformed JSON', async () => {
    const invalidLength = await readJsonValue(
      new Request('https://oss.tips/api/mutation', {
        method: 'POST',
        body: '{}',
        headers: { 'content-length': 'not-a-number' },
      }),
    );
    expect(invalidLength).toBeInstanceOf(Response);
    expect((invalidLength as Response).status).toBe(400);

    const invalidJson = await readJsonText(
      new Request('https://oss.tips/api/mutation', { method: 'POST', body: '{' }),
    );
    expect(invalidJson).toBe('{');
    const parsed = await readJsonValue(
      new Request('https://oss.tips/api/mutation', { method: 'POST', body: '{' }),
    );
    expect(parsed).toBeInstanceOf(Response);
    expect((parsed as Response).status).toBe(400);
  });
});
