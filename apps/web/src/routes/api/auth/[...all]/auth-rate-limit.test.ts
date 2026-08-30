import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authHandler: vi.fn(),
  consumeOtpSendRateLimit: vi.fn(),
  consumeOtpVerifyRateLimit: vi.fn(),
}));

vi.mock('@oss-tips/auth', async () => {
  const actual = await vi.importActual<typeof import('@oss-tips/auth')>('@oss-tips/auth');
  return { ...actual, toSvelteKitHandler: vi.fn(() => mocks.authHandler) };
});
vi.mock('$lib/server/auth', () => ({
  getAuth: vi.fn(() => ({})),
  getAuthSecret: vi.fn(() => 'test-auth-secret'),
}));
vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(() => ({})),
  hasDatabaseUrl: vi.fn(() => true),
}));
vi.mock('$lib/server/otp-rate-limit', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/otp-rate-limit')>(
    '$lib/server/otp-rate-limit',
  );
  return {
    ...actual,
    consumeOtpSendRateLimit: mocks.consumeOtpSendRateLimit,
    consumeOtpVerifyRateLimit: mocks.consumeOtpVerifyRateLimit,
  };
});

import { POST } from './+server';

const allowedSend = {
  allowed: true,
  reason: null,
  emailRemaining: 4,
  ipRemaining: 9,
  resetAt: new Date('2026-08-29T13:00:00.000Z'),
  retryAfterSeconds: 3600,
};

const allowedVerify = {
  allowed: true,
  reason: null,
  emailRemaining: 9,
  ipRemaining: 29,
  retryAfterSeconds: 0,
};

function event(path: string, body: unknown) {
  const url = new URL(`https://oss.tips${path}`);
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    url,
    params: {},
    locals: { session: null, actor: null },
  } as Parameters<typeof POST>[0];
}

describe('Better Auth OTP rate-limit boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authHandler.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    mocks.consumeOtpSendRateLimit.mockResolvedValue(allowedSend);
    mocks.consumeOtpVerifyRateLimit.mockResolvedValue(allowedVerify);
  });

  it('checks normalized email and client IP before sign-in OTP verification', async () => {
    mocks.consumeOtpVerifyRateLimit.mockResolvedValue({
      ...allowedVerify,
      allowed: false,
      reason: 'email',
      emailRemaining: 0,
      retryAfterSeconds: 3600,
    });

    const response = await POST(
      event('/api/auth/sign-in/email-otp', { email: ' Person@Example.com ', otp: '123456' }),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ title: 'Too many OTP requests', status: 429 });
    expect(response.headers.get('retry-after')).toBe('3600');
    expect(mocks.consumeOtpVerifyRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'person@example.com', secret: 'test-auth-secret' }),
    );
    expect(mocks.authHandler).not.toHaveBeenCalled();
  });

  it('returns same generic 429 response for an IP block', async () => {
    mocks.consumeOtpVerifyRateLimit.mockResolvedValue({
      ...allowedVerify,
      allowed: false,
      reason: 'ip',
      ipRemaining: 0,
      retryAfterSeconds: 120,
    });

    const response = await POST(
      event('/api/auth/email-otp/verify-email', { email: 'person@example.com', otp: '123456' }),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      type: 'about:blank',
      title: 'Too many OTP requests',
      status: 429,
      detail: 'Please wait before trying again',
    });
    expect(response.headers.get('retry-after')).toBe('120');
    expect(mocks.authHandler).not.toHaveBeenCalled();
  });

  it('passes allowed verification through to Better Auth with original body intact', async () => {
    const requestEvent = event('/api/auth/sign-in/email-otp', {
      email: 'person@example.com',
      otp: '123456',
    });

    const response = await POST(requestEvent);

    expect(response.status).toBe(200);
    expect(mocks.consumeOtpVerifyRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.authHandler).toHaveBeenCalledWith(requestEvent);
  });

  it('keeps existing send limiter on send-verification-otp only', async () => {
    const response = await POST(
      event('/api/auth/email-otp/send-verification-otp', { email: 'person@example.com' }),
    );

    expect(response.status).toBe(200);
    expect(mocks.consumeOtpSendRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.consumeOtpVerifyRateLimit).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ success: true });
  });

  it('rate-limits the email-otp verification check endpoint before Better Auth', async () => {
    mocks.consumeOtpVerifyRateLimit.mockResolvedValue({
      ...allowedVerify,
      allowed: false,
      reason: 'email',
      emailRemaining: 0,
      retryAfterSeconds: 42,
    });

    const response = await POST(
      event('/api/auth/email-otp/check-verification-otp', {
        email: 'person@example.com',
        otp: '123456',
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('42');
    expect(mocks.authHandler).not.toHaveBeenCalled();
  });
});
