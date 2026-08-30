import { describe, expect, it } from 'vitest';
import {
  createAuthConfig,
  configuredOAuthProviders,
  DEV_OTP_CODE,
  isDevOtpAccepted,
  OTP_POLICY,
  OTP_SEND_POLICY,
  SUPPORTED_OAUTH_PROVIDERS,
  buildSessionCookie,
  readSessionTokenFromCookie,
  checkProject,
  clearSessionCookie,
  hasPlatformRole,
  hasProjectMembership,
  parsePlatformRole,
  parseProjectRole,
  signInRedirectPath,
} from './index.js';
import { hashAuthOtp } from '@oss-tips/domain/auth-otp';

describe('auth config', () => {
  it('disables passwords and configures OTP policy', async () => {
    const config = createAuthConfig({
      baseUrl: 'https://oss.tips',
      secret: 'test-secret-min-32-chars-long!!',
      authDevMode: true,
    });
    expect(config.emailAndPassword?.enabled).toBe(false);
    expect(config.account?.encryptOAuthTokens).toBe(true);
    expect(OTP_POLICY.length).toBe(6);
    expect(OTP_POLICY.expirySeconds).toBe(300);
    expect(OTP_SEND_POLICY).toMatchObject({ emailLimit: 5, ipLimit: 10, windowSeconds: 3600 });
    expect(OTP_SEND_POLICY.cooldownSeconds).toEqual([0, 30, 60, 300, 900, 3600]);
    expect(config.plugins?.length).toBe(3);

    const emailOtp = config.plugins?.find((plugin) => plugin.id === 'email-otp') as
      | {
          options?: {
            storeOTP?: string | { hash?: (otp: string) => Promise<string> };
            allowedAttempts?: number;
            resendStrategy?: string;
            generateOTP?: () => string | undefined;
          };
        }
      | undefined;
    expect(emailOtp?.options).toMatchObject({
      allowedAttempts: 3,
      resendStrategy: 'rotate',
    });
    expect(emailOtp?.options?.generateOTP?.()).toBe(DEV_OTP_CODE);
    const storeOTP = emailOtp?.options?.storeOTP;
    expect(typeof storeOTP).toBe('object');
    expect(await (storeOTP as { hash: (otp: string) => Promise<string> }).hash('123456')).toBe(
      hashAuthOtp('123456', 'test-secret-min-32-chars-long!!'),
    );
  });

  it('accepts dev OTP 000000 when AUTH_DEV_MODE', () => {
    expect(
      isDevOtpAccepted(
        { baseUrl: 'https://oss.tips', secret: 'x', authDevMode: true },
        'a@b.com',
        DEV_OTP_CODE,
      ),
    ).toBe(true);
    expect(
      isDevOtpAccepted(
        { baseUrl: 'https://oss.tips', secret: 'x', authDevMode: false },
        'a@b.com',
        DEV_OTP_CODE,
      ),
    ).toBe(false);
  });

  it('requires a real OTP sender outside AUTH_DEV_MODE', () => {
    expect(() =>
      createAuthConfig({
        baseUrl: 'https://oss.tips',
        secret: 'test-secret-min-32-chars-long!!',
        authDevMode: false,
      }),
    ).toThrow('OTP email sender is required outside AUTH_DEV_MODE');
  });

  it('leaves session security delivery to the transactional database trigger', () => {
    const config = createAuthConfig(
      {
        baseUrl: 'https://oss.tips',
        secret: 'test-secret-min-32-chars-long!!',
        authDevMode: true,
      },
      {} as never,
    );
    expect(config.databaseHooks).toBeUndefined();
  });

  it('configures Codeberg through Better Auth generic OAuth', () => {
    const codeberg = { clientId: 'codeberg-client', clientSecret: 'codeberg-secret' };
    const config = createAuthConfig({
      baseUrl: 'https://oss.tips',
      secret: 'test-secret-min-32-chars-long!!',
      authDevMode: true,
      github: { clientId: 'github-client', clientSecret: 'github-secret' },
      codeberg,
    });

    expect(SUPPORTED_OAUTH_PROVIDERS).toEqual([
      'github',
      'google',
      'discord',
      'gitlab',
      'codeberg',
    ]);
    expect(configuredOAuthProviders({ github: codeberg, codeberg })).toEqual([
      'github',
      'codeberg',
    ]);
    const genericOAuthPlugin = config.plugins?.find((plugin) => plugin.id === 'generic-oauth') as
      { options?: { config?: Array<Record<string, unknown>> } } | undefined;
    expect(genericOAuthPlugin?.options?.config?.[0]).toMatchObject({
      providerId: 'codeberg',
      authorizationUrl: 'https://codeberg.org/login/oauth/authorize',
      tokenUrl: 'https://codeberg.org/login/oauth/access_token',
      userInfoUrl: 'https://codeberg.org/api/v1/user',
      scopes: ['read:user'],
      accountIssuer: 'https://codeberg.org',
      clientId: codeberg.clientId,
      clientSecret: codeberg.clientSecret,
    });
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

  it('accepts only domain role unions', () => {
    expect(parseProjectRole('owner')).toBe('owner');
    expect(parseProjectRole('OWNER')).toBeNull();
    expect(parsePlatformRole('auditor')).toBe('auditor');
    expect(parsePlatformRole('root')).toBeNull();
  });

  it('checks project and platform membership', () => {
    const actor = {
      kind: 'user' as const,
      userId: 'u1',
      projectRoles: new Map([['p1', 'owner' as const]]),
      platformRoles: ['auditor' as const],
    };
    expect(hasProjectMembership(actor, 'p1')).toBe(true);
    expect(hasProjectMembership(actor, 'p2')).toBe(false);
    expect(hasPlatformRole(actor)).toBe(true);
    expect(signInRedirectPath('/dashboard/p1?tab=team')).toBe(
      '/sign-in?returnTo=%2Fdashboard%2Fp1%3Ftab%3Dteam',
    );
    expect(signInRedirectPath('https://evil.example')).toBe('/sign-in?returnTo=%2F');
  });
});
