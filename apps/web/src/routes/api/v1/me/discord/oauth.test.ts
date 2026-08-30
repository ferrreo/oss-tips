import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDiscordStateCookie,
  createDiscordOAuthState,
  discordCallbackUrl,
  discordStateCookie,
  sameOriginCallback,
  verifyDiscordOAuthState,
} from './oauth';

const originalSecret = process.env.BETTER_AUTH_SECRET;
const originalNodeEnv = process.env.NODE_ENV;
const originalAppUrl = process.env.PUBLIC_APP_URL;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
  else process.env.BETTER_AUTH_SECRET = originalSecret;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalAppUrl === undefined) delete process.env.PUBLIC_APP_URL;
  else process.env.PUBLIC_APP_URL = originalAppUrl;
});

describe('Discord OAuth state', () => {
  it('signs and verifies cross-process state', () => {
    process.env.BETTER_AUTH_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    const state = createDiscordOAuthState({
      userId: 'user-1',
      projectId: 'project-1',
      callbackUrl: 'https://oss.tips/me/support',
    });
    expect(state).toBeTruthy();
    expect(verifyDiscordOAuthState(state)).toMatchObject({
      userId: 'user-1',
      projectId: 'project-1',
      callbackUrl: 'https://oss.tips/me/support',
    });
    expect(verifyDiscordOAuthState(`${state}tampered`)).toBeNull();
  });

  it('emits scoped HttpOnly state cookies and rejects off-origin redirects', () => {
    process.env.PUBLIC_APP_URL = 'https://oss.tips';
    process.env.NODE_ENV = 'production';
    expect(discordCallbackUrl()).toBe('https://oss.tips/api/v1/me/discord/link/callback');
    const cookie = discordStateCookie('signed-state', true);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/v1/me/discord');
    expect(cookie).toContain('Secure');
    expect(clearDiscordStateCookie(true)).toContain('Max-Age=0');
    expect(sameOriginCallback('https://evil.example/steal', 'https://oss.tips')).toBeNull();
    expect(sameOriginCallback('https://oss.tips/me/support', 'https://oss.tips')).toBe(
      'https://oss.tips/me/support',
    );
  });
});
