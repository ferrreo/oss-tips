import {
  configuredOAuthProviders,
  createAuth,
  type AuthEnv,
  type SupportedOAuthProvider,
} from '@oss-tips/auth';
import { getDb, hasDatabaseUrl } from './db';
import { requireHttpsUrl } from './runtime-config';

type AppAuth = ReturnType<typeof createAuth>;
type AuthDatabase = Exclude<Parameters<typeof createAuth>[1], undefined>;

let cached: AppAuth | null = null;

export function getAuthSecret(): string {
  const configuredSecret = process.env.BETTER_AUTH_SECRET;
  if (!configuredSecret && process.env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET is required in production');
  }
  return configuredSecret ?? 'dev-only-change-me-min-32-chars!!';
}

/** Local-only demo bypass. Never enabled implicitly or in production. */
export function isAuthDevMode(): boolean {
  return process.env.AUTH_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production';
}

function authEnvFromProcess(): AuthEnv {
  const configuredBaseUrl = process.env.BETTER_AUTH_URL ?? process.env.PUBLIC_APP_URL;
  const baseUrl =
    process.env.NODE_ENV === 'production'
      ? requireHttpsUrl(configuredBaseUrl, 'BETTER_AUTH_URL')
      : (configuredBaseUrl ?? 'http://localhost:3000');
  const secret = getAuthSecret();
  const authDevMode = isAuthDevMode();

  const env: AuthEnv = {
    baseUrl,
    secret,
    authDevMode,
    ...(authDevMode
      ? {}
      : {
          // The verification-row trigger durably queues the OTP; web never sends it inline.
          sendVerificationOTP: async () => {},
        }),
  };

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    env.github = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    env.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    env.discord = {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    };
  }
  if (process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET) {
    env.gitlab = {
      clientId: process.env.GITLAB_CLIENT_ID,
      clientSecret: process.env.GITLAB_CLIENT_SECRET,
    };
  }
  if (process.env.CODEBERG_CLIENT_ID && process.env.CODEBERG_CLIENT_SECRET) {
    env.codeberg = {
      clientId: process.env.CODEBERG_CLIENT_ID,
      clientSecret: process.env.CODEBERG_CLIENT_SECRET,
    };
  }

  return env;
}

/** Public provider ids for account settings; never expose OAuth credentials. */
export function getConfiguredOAuthProviders(): SupportedOAuthProvider[] {
  const configured = (clientId: string | undefined, clientSecret: string | undefined) =>
    clientId && clientSecret ? { clientId, clientSecret } : undefined;
  return configuredOAuthProviders({
    github: configured(process.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_SECRET),
    google: configured(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET),
    discord: configured(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_CLIENT_SECRET),
    gitlab: configured(process.env.GITLAB_CLIENT_ID, process.env.GITLAB_CLIENT_SECRET),
    codeberg: configured(process.env.CODEBERG_CLIENT_ID, process.env.CODEBERG_CLIENT_SECRET),
  });
}

/** Lazily construct Better Auth bound to the app database. */
export function getAuth(): AppAuth {
  if (cached) return cached;
  if (!hasDatabaseUrl()) {
    throw new Error('DATABASE_URL is required for Better Auth');
  }
  cached = createAuth(authEnvFromProcess(), getDb());
  return cached;
}

/** Construct Better Auth on a caller-owned transaction. */
export function createAuthForDatabase(database: AuthDatabase): AppAuth {
  return createAuth(authEnvFromProcess(), database);
}
