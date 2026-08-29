import { createAuth, type AuthEnv } from '@oss-tips/auth';
import { getDb, hasDatabaseUrl } from './db';

type AppAuth = ReturnType<typeof createAuth>;

let cached: AppAuth | null = null;

function authEnvFromProcess(): AuthEnv {
  const baseUrl = process.env.BETTER_AUTH_URL ?? process.env.PUBLIC_APP_URL ?? 'http://localhost:3000';
  const secret = process.env.BETTER_AUTH_SECRET ?? 'dev-only-change-me-min-32-chars!!';
  const authDevMode = process.env.AUTH_DEV_MODE === 'true' || process.env.NODE_ENV !== 'production';

  const env: AuthEnv = {
    baseUrl,
    secret,
    authDevMode,
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

  return env;
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
