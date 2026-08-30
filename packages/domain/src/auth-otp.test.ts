import { describe, expect, it } from 'vitest';
import { hashAuthOtp, isAuthOtpHash, parseAuthOtpValue, recoverAuthOtp } from './auth-otp.js';

describe('auth OTP storage', () => {
  it('stores only an HMAC and recovers code in memory', () => {
    const secret = 'test-auth-secret';
    const value = `${hashAuthOtp('000042', secret)}:0`;

    expect(value).not.toContain('000042');
    expect(isAuthOtpHash(value.slice(0, -2))).toBe(true);
    expect(parseAuthOtpValue(value)).toEqual({ hash: value.slice(0, -2), attempts: 0 });
    expect(recoverAuthOtp(value, secret)).toBe('000042');
    expect(recoverAuthOtp(value, 'wrong-secret')).toBeNull();
  });

  it('rejects malformed values and codes', () => {
    expect(() => hashAuthOtp('42', 'secret')).toThrow('six digits');
    expect(parseAuthOtpValue('plain:0')).toBeNull();
    expect(recoverAuthOtp('otp:v1:not-a-hash:0', 'secret')).toBeNull();
  });
});
