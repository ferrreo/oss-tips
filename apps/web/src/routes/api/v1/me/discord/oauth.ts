import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const DISCORD_STATE_COOKIE = 'oss_tips.discord_oauth_state';
export const DISCORD_STATE_TTL_SECONDS = 10 * 60;

export type DiscordOAuthState = {
  userId: string;
  projectId: string;
  callbackUrl: string;
  nonce: string;
  expiresAt: number;
};

function stateSecret(): string | null {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV === 'production') return null;
  return 'dev-only-change-me-min-32-chars!!';
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createDiscordOAuthState(
  input: Omit<DiscordOAuthState, 'nonce' | 'expiresAt'>,
): string | null {
  const secret = stateSecret();
  if (!secret) return null;
  const payload = encode(
    JSON.stringify({
      ...input,
      nonce: randomBytes(16).toString('base64url'),
      expiresAt: Math.floor(Date.now() / 1000) + DISCORD_STATE_TTL_SECONDS,
    } satisfies DiscordOAuthState),
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyDiscordOAuthState(value: string | null): DiscordOAuthState | null {
  const secret = stateSecret();
  if (!secret || !value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(signature);
  if (expectedBytes.length !== actualBytes.length || !timingSafeEqual(expectedBytes, actualBytes)) {
    return null;
  }
  const decoded = decode(payload);
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(decoded) as Partial<DiscordOAuthState>;
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.projectId !== 'string' ||
      typeof parsed.callbackUrl !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return parsed as DiscordOAuthState;
  } catch {
    return null;
  }
}

export function discordStateCookie(value: string, secure: boolean): string {
  return [
    `${DISCORD_STATE_COOKIE}=${value}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/api/v1/me/discord',
    `Max-Age=${DISCORD_STATE_TTL_SECONDS}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function discordStateIdentifier(state: DiscordOAuthState): string {
  return `discord-oauth:${state.userId}:${state.nonce}`;
}

export function discordStateFingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function clearDiscordStateCookie(secure: boolean): string {
  return [
    `${DISCORD_STATE_COOKIE}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/api/v1/me/discord',
    'Max-Age=0',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function discordCallbackUrl(): string | null {
  const configured = process.env.PUBLIC_APP_URL;
  if (!configured) return null;
  try {
    const base = new URL(configured);
    if (
      base.username ||
      base.password ||
      (process.env.NODE_ENV === 'production' && base.protocol !== 'https:')
    ) {
      return null;
    }
    return `${base.toString().replace(/\/$/, '')}/api/v1/me/discord/link/callback`;
  } catch {
    return null;
  }
}

export function sameOriginCallback(value: string, baseUrl: string): string | null {
  try {
    const target = new URL(value);
    const base = new URL(baseUrl);
    if (target.origin !== base.origin || target.username || target.password) return null;
    return target.toString();
  } catch {
    return null;
  }
}
