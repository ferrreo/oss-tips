import { describe, expect, it } from 'vitest';
import {
  CONTENT_SECURITY_POLICY,
  MemoryRateLimiter,
  rateLimitHeaders,
  rateLimitForRequest,
  rateLimitResponse,
  sameOriginGuard,
  withSecurityHeaders,
} from './security.js';

const appUrl = new URL('https://oss.tips/api/v1/projects/grove');

function request(method: string, headers?: Record<string, string>): Request {
  return new Request(appUrl, { method, headers });
}

describe('same-origin mutation guard', () => {
  it('allows safe requests and same-origin mutations', () => {
    expect(sameOriginGuard(request('GET'), appUrl)).toBeNull();
    expect(sameOriginGuard(request('POST', { origin: appUrl.origin }), appUrl)).toBeNull();
    expect(
      sameOriginGuard(request('PATCH', { referer: `${appUrl.origin}/dashboard` }), appUrl),
    ).toBeNull();
  });

  it('blocks missing and cross-origin mutation metadata', async () => {
    const missing = sameOriginGuard(request('POST'), appUrl);
    const crossOrigin = sameOriginGuard(
      request('DELETE', { origin: 'https://evil.example' }),
      appUrl,
    );

    expect(missing?.status).toBe(403);
    expect(crossOrigin?.status).toBe(403);
    expect(await crossOrigin?.json()).toMatchObject({
      title: 'Cross-origin request blocked',
      status: 403,
    });
  });

  it('keeps API-key integrations, Better Auth, and Stripe webhooks on their own boundaries', () => {
    const apiKey = `Bearer oss_sk_${'a'.repeat(32)}`;
    expect(sameOriginGuard(request('POST', { authorization: apiKey }), appUrl)).toBeNull();
    expect(
      sameOriginGuard(
        request('POST', { origin: 'https://evil.example' }),
        new URL('https://oss.tips/api/auth/sign-in'),
      ),
    ).toBeNull();
    expect(
      sameOriginGuard(
        request('POST', { origin: 'https://evil.example' }),
        new URL('https://oss.tips/api/webhooks/stripe'),
      ),
    ).toBeNull();
  });
});

describe('memory rate limiter', () => {
  it('returns standard headers and resets after its window', () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter(() => now);
    const first = limiter.check('ip', 2, 1);
    const second = limiter.check('ip', 2, 1);
    const blocked = limiter.check('ip', 2, 1);

    expect(first.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(blocked.allowed).toBe(false);
    expect(rateLimitHeaders(blocked).get('retry-after')).toBe('1');
    expect(rateLimitResponse(blocked).status).toBe(429);

    now += 1_000;
    expect(limiter.check('ip', 2, 1).allowed).toBe(true);
  });

  it('caps public analytics events per ingress IP without a durable key', () => {
    const analyticsUrl = new URL('https://oss.tips/api/v1/projects/grove/analytics/events');
    const analyticsRequest = () =>
      new Request(analyticsUrl, {
        method: 'POST',
        headers: { 'cf-connecting-ip': '198.51.100.50' },
      });

    let decision;
    for (let index = 0; index < 120; index += 1) {
      decision = rateLimitForRequest(analyticsRequest(), analyticsUrl);
    }
    expect(decision?.allowed).toBe(true);
    expect(rateLimitForRequest(analyticsRequest(), analyticsUrl)?.allowed).toBe(false);
  });
});

describe('security response headers', () => {
  it('adds baseline headers without replacing application headers', () => {
    const response = withSecurityHeaders(
      new Response('ok', { headers: { 'content-type': 'text/plain', etag: '"demo"' } }),
      appUrl,
    );

    expect(response.headers.get('content-security-policy')).toBe(CONTENT_SECURITY_POLICY);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('etag')).toBe('"demo"');
  });
});
