import { requireMalwareScannerConfig } from '@oss-tips/storage';

const DEFAULT_PUBLIC_APP_URL = 'https://oss.tips';
const LOCAL_PUBLIC_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function parsePublicAppUrl(value: string | undefined, required: boolean): URL {
  if (!value?.trim()) {
    if (required) throw new Error('PUBLIC_APP_URL is required in production');
    return new URL(DEFAULT_PUBLIC_APP_URL);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('PUBLIC_APP_URL is invalid');
  }

  if (!url.hostname || url.username || url.password) {
    throw new Error('PUBLIC_APP_URL is invalid');
  }

  const localHost = LOCAL_PUBLIC_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !(localHost && url.protocol === 'http:')) {
    throw new Error('PUBLIC_APP_URL must use HTTPS');
  }
  return url;
}

export function normalizePublicAppUrl(value: string | undefined): string {
  return parsePublicAppUrl(value, false).toString().replace(/\/$/, '');
}

export function requireProductionPublicAppUrl(value: string | undefined): string {
  const url = parsePublicAppUrl(value, true);
  if (url.protocol !== 'https:' || LOCAL_PUBLIC_HOSTS.has(url.hostname)) {
    throw new Error('PUBLIC_APP_URL must use a non-local HTTPS URL in production');
  }
  return url.toString().replace(/\/$/, '');
}

export function workerPublicUrl(value: string | undefined, path: string): string {
  return new URL(path, normalizePublicAppUrl(value)).toString();
}

/** Fail before claiming jobs when required production integrations are absent. */
export function validateWorkerProductionConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { otpOnly?: boolean } = {},
): void {
  if (env.NODE_ENV !== 'production') return;
  if (!options.otpOnly) requireMalwareScannerConfig(env);
  const required = options.otpOnly
    ? ([
        ['RESEND_API_KEY', env.RESEND_API_KEY],
        ['BETTER_AUTH_SECRET', env.BETTER_AUTH_SECRET],
        ['PUBLIC_APP_URL', env.PUBLIC_APP_URL],
      ] as const)
    : ([
        ['S3_ENDPOINT', env.S3_ENDPOINT],
        ['S3_ACCESS_KEY_ID', env.S3_ACCESS_KEY_ID],
        ['S3_SECRET_ACCESS_KEY', env.S3_SECRET_ACCESS_KEY],
        ['WEBHOOK_ENCRYPTION_KEY', env.WEBHOOK_ENCRYPTION_KEY],
        ['RESEND_API_KEY', env.RESEND_API_KEY],
        ['BETTER_AUTH_SECRET', env.BETTER_AUTH_SECRET],
        ['PUBLIC_APP_URL', env.PUBLIC_APP_URL],
      ] as const);
  const missing = required.filter(([, value]) => !value?.trim()).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Production worker configuration missing: ${missing.join(', ')}`);
  }
  requireProductionPublicAppUrl(env.PUBLIC_APP_URL);
}
