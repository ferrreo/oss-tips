import 'reflect-metadata';
import { toSvelteKitHandler } from '@oss-tips/auth';
import type { OtpSendRateLimitDecision } from '@oss-tips/db';
import type { RequestHandler } from './$types';
import { getAuth, getAuthSecret } from '$lib/server/auth';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { problem } from '$lib/server/http';
import { readJsonValue } from '../../api-utils';
import {
  consumeOtpSendRateLimit,
  consumeOtpVerifyRateLimit,
  hashOtpRateLimitKey,
  normalizeOtpEmail,
  otpRateLimitHeaders,
  otpVerifyRateLimitHeaders,
  type OtpVerifyRateLimitDecision,
  uniformOtpSendResponse,
} from '$lib/server/otp-rate-limit';

const OTP_SEND_PATH = '/email-otp/send-verification-otp';
const OTP_VERIFY_PATHS = [
  '/sign-in/email-otp',
  '/email-otp/verify-email',
  '/email-otp/check-verification-otp',
] as const;

const handle: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) {
    return problem(503, 'Auth unavailable', 'DATABASE_URL is required for Better Auth');
  }

  const isOtpSend = event.request.method === 'POST' && event.url.pathname.endsWith(OTP_SEND_PATH);
  const isOtpVerify =
    event.request.method === 'POST' &&
    OTP_VERIFY_PATHS.some((path) => event.url.pathname.endsWith(path));
  let otpDecision: OtpSendRateLimitDecision | undefined;
  let otpVerifyDecision: OtpVerifyRateLimitDecision | undefined;
  if (isOtpSend || isOtpVerify) {
    const body = await readJsonValue(event.request.clone());
    if (body instanceof Response) return body;
    const email = normalizeOtpEmail(
      typeof body === 'object' && body !== null && 'email' in body
        ? (body as { email?: unknown }).email
        : undefined,
    );
    if (isOtpSend && email) {
      const secret = getAuthSecret();
      try {
        otpDecision = await consumeOtpSendRateLimit(getDb(), {
          email,
          request: event.request,
          secret,
        });
      } catch (error) {
        console.error('[auth] OTP rate limiter unavailable', {
          emailKey: hashOtpRateLimitKey(email, secret),
          error: error instanceof Error ? error.message : 'unknown error',
        });
        return problem(
          503,
          'Authentication unavailable',
          'OTP delivery is temporarily unavailable',
        );
      }
      if (!otpDecision.allowed) {
        return problem(429, 'Too many OTP requests', 'Please wait before requesting another code', {
          headers: otpRateLimitHeaders(otpDecision),
        });
      }
    }
    if (isOtpVerify) {
      const secret = getAuthSecret();
      try {
        otpVerifyDecision = await consumeOtpVerifyRateLimit(getDb(), {
          email,
          request: event.request,
          secret,
        });
      } catch (error) {
        console.error('[auth] OTP verification rate limiter unavailable', {
          error: error instanceof Error ? error.message : 'unknown error',
        });
        return problem(
          503,
          'Authentication unavailable',
          'OTP verification is temporarily unavailable',
        );
      }
      if (!otpVerifyDecision.allowed) {
        return problem(429, 'Too many OTP requests', 'Please wait before trying again', {
          headers: otpVerifyRateLimitHeaders(otpVerifyDecision),
        });
      }
    }
  }

  const auth = getAuth();
  const kitHandler = toSvelteKitHandler(auth);
  const response = await kitHandler(event);
  if (!isOtpSend || !otpDecision) return response;
  return uniformOtpSendResponse(response, otpDecision);
};

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
