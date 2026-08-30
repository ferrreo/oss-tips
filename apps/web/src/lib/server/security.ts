import { problem } from './http';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const API_KEY_AUTHORIZATION = /^Bearer\s+oss_sk_[A-Za-z0-9_-]{32,}$/;
const AUTH_PATH = /^\/api\/auth(?:\/|$)/;
const STRIPE_WEBHOOK_PATH = '/api/webhooks/stripe';
const MAX_RATE_LIMIT_ENTRIES = 10_000;

/**
 * Static fallback for API responses. HTML responses receive SvelteKit's nonce
 * augmented policy from svelte.config.js.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' https://js.stripe.com",
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.stripe.com",
  "connect-src 'self' https://api.stripe.com https://*.stripe.com https://*.stripe.network https://fonts.googleapis.com https://fonts.gstatic.com",
  'frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://*.stripe.com',
  "form-action 'self' https://checkout.stripe.com",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
].join('; ');

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  windowSeconds: number;
};

type RateLimitEntry = { count: number; resetAt: number };

/**
 * ponytail: process-local limiter is only a cheap public-edge ceiling;
 * replace it with PostgreSQL/Cloudflare enforcement before horizontal scale.
 */
export class MemoryRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(private readonly now: () => number = Date.now) {}

  check(key: string, limit: number, windowSeconds: number): RateLimitDecision {
    const now = this.now();
    const windowMs = windowSeconds * 1000;
    let entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      this.entries.set(key, entry);
    }

    entry.count += 1;
    if (this.entries.size > MAX_RATE_LIMIT_ENTRIES) {
      for (const [entryKey, value] of this.entries) {
        if (value.resetAt <= now) this.entries.delete(entryKey);
      }
      if (this.entries.size > MAX_RATE_LIMIT_ENTRIES) {
        const oldestKey = this.entries.keys().next().value;
        if (oldestKey) this.entries.delete(oldestKey);
      }
    }

    const remaining = Math.max(0, limit - entry.count);
    return {
      allowed: entry.count <= limit,
      limit,
      remaining,
      resetAt: entry.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      windowSeconds,
    };
  }
}

const rateLimiter = new MemoryRateLimiter();

function isUnsafeMutation(request: Request): boolean {
  return UNSAFE_METHODS.has(request.method.toUpperCase());
}

function isApiKeyRequest(request: Request): boolean {
  return API_KEY_AUTHORIZATION.test(request.headers.get('authorization')?.trim() ?? '');
}

function isSecurityException(pathname: string, request: Request): boolean {
  return AUTH_PATH.test(pathname) || pathname === STRIPE_WEBHOOK_PATH || isApiKeyRequest(request);
}

function allowedOrigins(url: URL): Set<string> {
  const origins = new Set([url.origin]);
  const configured = process.env.PUBLIC_APP_URL;
  if (configured) {
    try {
      origins.add(new URL(configured).origin);
    } catch {
      // Invalid deployment configuration must not widen the origin set.
    }
  }
  return origins;
}

/** Return a Problem Details response when an unsafe browser mutation is cross-origin. */
export function sameOriginGuard(request: Request, url: URL): Response | null {
  if (!isUnsafeMutation(request) || isSecurityException(url.pathname, request)) return null;

  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return problem(
      403,
      'Cross-origin request blocked',
      'Unsafe requests must originate from this site',
    );
  }

  const origin = request.headers.get('origin')?.trim();
  const referer = request.headers.get('referer')?.trim();
  const source = origin || referer;
  if (!source) {
    return problem(
      403,
      'Origin required',
      'Unsafe requests must include a same-origin Origin or Referer header',
    );
  }

  let sourceOrigin: string;
  try {
    sourceOrigin = new URL(source).origin;
  } catch {
    return problem(403, 'Origin check failed', 'Unsafe request origin is invalid');
  }

  if (!allowedOrigins(url).has(sourceOrigin)) {
    return problem(
      403,
      'Cross-origin request blocked',
      'Unsafe requests must originate from this site',
    );
  }
  return null;
}

export function clientKey(request: Request): string {
  const cloudflareAddress = request.headers.get('cf-connecting-ip')?.trim();
  if (cloudflareAddress) return cloudflareAddress;
  const forwardedAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedAddress || 'unknown';
}

/** Apply only the low-risk public/checkout ceilings suitable for one process. */
export function rateLimitForRequest(request: Request, url: URL): RateLimitDecision | null {
  const path = url.pathname;
  if (
    request.method.toUpperCase() === 'POST' &&
    /\/api\/v1\/projects\/[^/]+\/checkout(?:-intents)?$/.test(path)
  ) {
    return rateLimiter.check(`checkout:${clientKey(request)}`, 10, 600);
  }

  if (
    request.method.toUpperCase() === 'POST' &&
    /\/api\/v1\/projects\/[^/]+\/analytics\/events$/.test(path)
  ) {
    return rateLimiter.check(`analytics:${clientKey(request)}`, 120, 60);
  }

  if (request.method.toUpperCase() === 'GET' && path.startsWith('/api/v1/projects')) {
    const search = path === '/api/v1/projects' && url.searchParams.has('query');
    return rateLimiter.check(
      `${search ? 'search' : 'public'}:${clientKey(request)}`,
      search ? 30 : 120,
      60,
    );
  }

  return null;
}

export function rateLimitHeaders(decision: RateLimitDecision): Headers {
  return new Headers({
    'ratelimit-limit': String(decision.limit),
    'ratelimit-remaining': String(decision.remaining),
    'ratelimit-reset': String(decision.retryAfterSeconds),
    'ratelimit-policy': `${decision.limit};w=${decision.windowSeconds}`,
    ...(decision.allowed ? {} : { 'retry-after': String(decision.retryAfterSeconds) }),
  });
}

export function rateLimitResponse(decision: RateLimitDecision): Response {
  return problem(429, 'Too many requests', 'Please retry after the rate limit window resets', {
    headers: rateLimitHeaders(decision),
  });
}

function securityHeaders(url: URL): Headers {
  const headers = new Headers({
    'content-security-policy': CONTENT_SECURITY_POLICY,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy':
      'camera=(), geolocation=(), microphone=(), payment=(self "https://js.stripe.com"), usb=()',
  });
  if (
    (process.env.NODE_ENV === 'production' || process.env.HSTS_ENABLED === 'true') &&
    url.protocol === 'https:'
  ) {
    headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  }
  return headers;
}

export function withSecurityHeaders(
  response: Response,
  url: URL,
  rateLimit?: RateLimitDecision | null,
): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of securityHeaders(url)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  if (rateLimit) {
    for (const [name, value] of rateLimitHeaders(rateLimit)) headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
