import { createHmac, timingSafeEqual } from 'node:crypto';

export const AUTH_OTP_HASH_PREFIX = 'otp:v1:';
export const AUTH_OTP_LENGTH = 6;

const AUTH_OTP_HASH_PATTERN = /^otp:v1:([0-9a-f]{64})$/;
const AUTH_OTP_VALUE_PATTERN = /^(otp:v1:[0-9a-f]{64}):(\d+)$/;

function assertOtp(code: string): void {
  if (!/^\d{6}$/.test(code)) throw new Error('Auth OTP must contain six digits');
}

function digest(code: string, secret: string): Buffer {
  assertOtp(code);
  if (!secret) throw new Error('Auth OTP secret is required');
  return createHmac('sha256', secret).update(`sign-in:${code}`, 'utf8').digest();
}

/** Hash sign-in OTPs without storing a recoverable code. Server-only. */
export function hashAuthOtp(code: string, secret: string): string {
  return `${AUTH_OTP_HASH_PREFIX}${digest(code, secret).toString('hex')}`;
}

export type ParsedAuthOtpValue = {
  hash: string;
  attempts: number;
};

/** Parse Better Auth's stored `<hash>:<attempts>` value. */
export function parseAuthOtpValue(value: string): ParsedAuthOtpValue | null {
  const match = AUTH_OTP_VALUE_PATTERN.exec(value);
  const hash = match?.[1];
  const attempts = match?.[2];
  if (!hash || attempts === undefined) return null;
  return { hash, attempts: Number(attempts) };
}

/** Recover a six-digit code for the OTP worker; code exists only in memory. */
export function recoverAuthOtp(value: string, secret: string): string | null {
  const parsed = parseAuthOtpValue(value);
  if (!parsed || !Number.isSafeInteger(parsed.attempts) || !secret) return null;
  const expected = Buffer.from(parsed.hash.slice(AUTH_OTP_HASH_PREFIX.length), 'hex');
  for (let number = 0; number < 1_000_000; number += 1) {
    const code = number.toString().padStart(AUTH_OTP_LENGTH, '0');
    const candidate = digest(code, secret);
    if (timingSafeEqual(candidate, expected)) return code;
  }
  return null;
}

export function isAuthOtpHash(value: string): boolean {
  return AUTH_OTP_HASH_PATTERN.test(value);
}
