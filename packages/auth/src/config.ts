import { betterAuth, type Auth, type BetterAuthOptions } from 'better-auth';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { organization } from 'better-auth/plugins/organization';
import { passkey } from '@better-auth/passkey';
import { kyselyAdapter } from '@better-auth/kysely-adapter';
import type { Kysely } from 'kysely';

export type AuthEnv = {
  baseUrl: string;
  secret: string;
  authDevMode?: boolean | undefined;
  github?: { clientId: string; clientSecret: string } | undefined;
  google?: { clientId: string; clientSecret: string } | undefined;
  discord?: { clientId: string; clientSecret: string } | undefined;
  gitlab?: { clientId: string; clientSecret: string } | undefined;
};

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 5 * 60;

/** Dev OTP accepted for any email when AUTH_DEV_MODE=true. */
export const DEV_OTP_CODE = '000000';

export function isDevOtpAccepted(env: AuthEnv, email: string, code: string): boolean {
  if (!env.authDevMode) return false;
  return code === DEV_OTP_CODE && email.length > 0;
}

/**
 * Better Auth configuration: email OTP, passkeys, social providers. No passwords.
 */
export function createAuthConfig(
  env: AuthEnv,
  database?: Kysely<any>,
): BetterAuthOptions {
  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

  if (env.github) {
    socialProviders.github = env.github;
  }
  if (env.google) {
    socialProviders.google = env.google;
  }
  if (env.discord) {
    socialProviders.discord = env.discord;
  }
  if (env.gitlab) {
    socialProviders.gitlab = env.gitlab;
  }

  const options: BetterAuthOptions = {
    appName: 'oss.tips',
    baseURL: env.baseUrl,
    secret: env.secret,
    emailAndPassword: {
      enabled: false,
    },
    socialProviders,
    plugins: [
      emailOTP({
        otpLength: OTP_LENGTH,
        expiresIn: OTP_EXPIRY_SECONDS,
        async sendVerificationOTP({ email, otp }) {
          if (env.authDevMode) {
            console.info(`[auth:dev] OTP for ${email}: ${otp} (or use ${DEV_OTP_CODE})`);
            return;
          }
          console.info(`[auth] OTP queued for ${email}`);
        },
      }),
      passkey({
        rpID: new URL(env.baseUrl).hostname,
        rpName: 'oss.tips',
        origin: env.baseUrl,
      }),
      organization(),
    ],
  };

  if (database) {
    options.database = kyselyAdapter(database, { type: 'postgres', transaction: true });
  }

  return options;
}

export function createAuth(env: AuthEnv, database?: Kysely<any>): Auth {
  return betterAuth(createAuthConfig(env, database));
}

export const OTP_POLICY = {
  length: OTP_LENGTH,
  expirySeconds: OTP_EXPIRY_SECONDS,
} as const;
