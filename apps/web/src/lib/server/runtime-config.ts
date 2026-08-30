import { requireMalwareScannerConfig } from '@oss-tips/storage';

export function requireHttpsUrl(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is required in production`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is invalid`);
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1'
  ) {
    throw new Error(`${name} must use a non-local HTTPS URL in production`);
  }
  return url.toString().replace(/\/$/, '');
}

/** Fail before serving traffic when required production integrations are absent. */
export function validateWebProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  requireMalwareScannerConfig(env);
  requireHttpsUrl(env.PUBLIC_APP_URL, 'PUBLIC_APP_URL');
  if (env.BETTER_AUTH_URL) requireHttpsUrl(env.BETTER_AUTH_URL, 'BETTER_AUTH_URL');
  if (!env.BETTER_AUTH_SECRET?.trim()) {
    throw new Error('BETTER_AUTH_SECRET is required in production');
  }
  if (!env.RESEND_WEBHOOK_SECRET?.trim()) {
    throw new Error('RESEND_WEBHOOK_SECRET is required in production');
  }
  if (!env.API_RATE_LIMIT_SECRET?.trim()) {
    throw new Error('API_RATE_LIMIT_SECRET is required in production');
  }
  if (
    (env.DISCORD_CLIENT_ID || env.DISCORD_CLIENT_SECRET) &&
    !env.DISCORD_TOKEN_ENCRYPTION_KEY?.trim()
  ) {
    throw new Error('DISCORD_TOKEN_ENCRYPTION_KEY is required in production');
  }
}

export function discordTokenEncryptionKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const dedicated = env.DISCORD_TOKEN_ENCRYPTION_KEY?.trim();
  if (dedicated) return dedicated;
  if (env.NODE_ENV === 'production') return undefined;
  return env.WEBHOOK_ENCRYPTION_KEY?.trim() || undefined;
}
