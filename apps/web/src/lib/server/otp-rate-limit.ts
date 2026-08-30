import { createHmac } from 'node:crypto';
import { OTP_SEND_POLICY } from '@oss-tips/auth';
import {
  createApiRateLimitsRepository,
  createOtpSendRateLimitsRepository,
  type ApiRateLimitDecision,
  type Db,
  type OtpSendRateLimitDecision,
} from '@oss-tips/db';
import { clientKey } from './security';
import { json } from './http';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Keep code-entry brute force bounded independently from OTP sends. */
export const OTP_VERIFY_POLICY = {
  email: { limit: 10, windowSeconds: 60 * 60, burst: 10 },
  ip: { limit: 30, windowSeconds: 60 * 60, burst: 30 },
} as const;

const OTP_VERIFY_EMAIL_ROUTE = 'auth.otp.verify.email';
const OTP_VERIFY_IP_ROUTE = 'auth.otp.verify.ip';

export type OtpVerifyRateLimitDecision = {
  allowed: boolean;
  reason: 'email' | 'ip' | null;
  emailRemaining: number;
  ipRemaining: number;
  retryAfterSeconds: number;
};

export function normalizeOtpEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 320 && EMAIL_PATTERN.test(email) ? email : null;
}

/** HMAC keeps low-entropy identifiers out of database rows and logs. */
export function hashOtpRateLimitKey(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex');
}

export async function consumeOtpSendRateLimit(
  db: Db,
  input: { email: string; request: Request; secret: string; now?: Date },
): Promise<OtpSendRateLimitDecision> {
  const repository = createOtpSendRateLimitsRepository(db);
  return repository.consume({
    emailKey: hashOtpRateLimitKey(input.email, input.secret),
    ipKey: hashOtpRateLimitKey(clientKey(input.request), input.secret),
    ...(input.now ? { now: input.now } : {}),
    policy: OTP_SEND_POLICY,
  });
}

function blockedVerifyDecision(
  email: ApiRateLimitDecision | null,
  ip: ApiRateLimitDecision,
): OtpVerifyRateLimitDecision {
  const blocked = [
    email && !email.allowed ? { reason: 'email' as const, decision: email } : null,
    !ip.allowed ? { reason: 'ip' as const, decision: ip } : null,
  ].filter(
    (value): value is { reason: 'email' | 'ip'; decision: ApiRateLimitDecision } => value !== null,
  );
  const first = blocked[0];
  return {
    allowed: blocked.length === 0,
    reason: first?.reason ?? null,
    emailRemaining: email?.remaining ?? OTP_VERIFY_POLICY.email.limit,
    ipRemaining: ip.remaining,
    retryAfterSeconds: first?.decision.retryAfterSeconds ?? 0,
  };
}

/** Consume verification buckets without storing raw email addresses or OTPs. */
export async function consumeOtpVerifyRateLimit(
  db: Db,
  input: { email: string | null; request: Request; secret: string; now?: Date },
): Promise<OtpVerifyRateLimitDecision> {
  const repository = createApiRateLimitsRepository(db);
  const now = input.now ?? new Date();
  const normalizedEmail = normalizeOtpEmail(input.email);
  const ip = await repository.consume({
    keyHash: hashOtpRateLimitKey(clientKey(input.request), input.secret),
    routeClass: OTP_VERIFY_IP_ROUTE,
    policy: OTP_VERIFY_POLICY.ip,
    now,
  });
  if (!normalizedEmail || !ip.allowed) return blockedVerifyDecision(null, ip);
  const emailDecision = await repository.consume({
    keyHash: hashOtpRateLimitKey(normalizedEmail, input.secret),
    routeClass: OTP_VERIFY_EMAIL_ROUTE,
    policy: OTP_VERIFY_POLICY.email,
    now,
  });
  return blockedVerifyDecision(emailDecision, ip);
}

export function otpRateLimitHeaders(decision: OtpSendRateLimitDecision): Headers {
  const remaining = Math.min(decision.emailRemaining, decision.ipRemaining);
  return new Headers({
    'ratelimit-limit': `${OTP_SEND_POLICY.emailLimit}, ${OTP_SEND_POLICY.ipLimit}`,
    'ratelimit-remaining': String(remaining),
    'ratelimit-reset': String(decision.retryAfterSeconds),
    'ratelimit-policy': `${OTP_SEND_POLICY.emailLimit};w=${OTP_SEND_POLICY.windowSeconds}, ${OTP_SEND_POLICY.ipLimit};w=${OTP_SEND_POLICY.windowSeconds}`,
    ...(decision.allowed ? {} : { 'retry-after': String(decision.retryAfterSeconds) }),
  });
}

export function otpVerifyRateLimitHeaders(decision: OtpVerifyRateLimitDecision): Headers {
  const remaining = Math.min(decision.emailRemaining, decision.ipRemaining);
  return new Headers({
    'ratelimit-limit': `${OTP_VERIFY_POLICY.email.limit}, ${OTP_VERIFY_POLICY.ip.limit}`,
    'ratelimit-remaining': String(remaining),
    'ratelimit-reset': String(decision.retryAfterSeconds),
    'ratelimit-policy': `${OTP_VERIFY_POLICY.email.limit};w=${OTP_VERIFY_POLICY.email.windowSeconds}, ${OTP_VERIFY_POLICY.ip.limit};w=${OTP_VERIFY_POLICY.ip.windowSeconds}`,
    ...(decision.allowed ? {} : { 'retry-after': String(decision.retryAfterSeconds) }),
  });
}

/** Hide Better Auth's success-body differences on the enumeration-sensitive send endpoint. */
export function uniformOtpSendResponse(
  response: Response,
  decision: OtpSendRateLimitDecision,
): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of otpRateLimitHeaders(decision)) headers.set(name, value);
  headers.set('cache-control', 'no-store');
  if (response.ok) return json({ success: true }, { status: response.status, headers });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
