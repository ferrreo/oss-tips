import { describe, expect, it } from 'vitest';
import {
  createAuthConfig,
  DEV_OTP_CODE,
  isDevOtpAccepted,
  OTP_POLICY,
  buildSessionCookie,
  readSessionTokenFromCookie,
  checkProject,
  clearSessionCookie,
} from './index.js';

describe('auth config', () => {
  it('disables passwords and configures OTP policy', () => {
    const config = createAuthConfig({
      baseUrl: 'https://oss.tips',
      secret: 'test-secret-min-32-chars-long!!',
      authDevMode: true,
    });
    expect(config.emailAndPassword?.enabled).toBe(false);
    expect(OTP_POLICY.length).toBe(6);
    expect(OTP_POLICY.expirySeconds).toBe(300);
    expect(config.plugins?.length).toBe(3);
  });

  it('accepts dev OTP 000000 when AUTH_DEV_MODE', () => {
    expect(
      isDevOtpAccepted({ baseUrl: 'https://oss.tips', secret: 'x', authDevMode: true }, 'a@b.com', DEV_OTP_CODE),
    ).toBe(true);
    expect(
      isDevOtpAccepted({ baseUrl: 'https://oss.tips', secret: 'x', authDevMode: false }, 'a@b.com', DEV_OTP_CODE),
    ).toBe(false);
  });
});

describe('sveltekit cookies', () => {
  it('builds and reads session cookie', () => {
    const cookie = buildSessionCookie('tok123');
    expect(cookie.name).toBe('oss_tips.session_token');
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.sameSite).toBe('lax');
    const header = `${cookie.name}=${cookie.value}; other=1`;
    expect(readSessionTokenFromCookie(header)).toBe('tok123');
    expect(clearSessionCookie().options.maxAge).toBe(0);
  });
});

describe('permissions', () => {
  it('wraps domain canProject', () => {
    const actor = {
      kind: 'user' as const,
      userId: 'u1',
      projectRoles: new Map([['p1', 'owner' as const]]),
      platformRoles: [],
    };
    expect(checkProject(actor, 'project.refund', 'p1').allowed).toBe(true);
  });
});
