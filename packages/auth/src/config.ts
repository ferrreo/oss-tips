import { betterAuth, type Auth, type BetterAuthOptions } from 'better-auth';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { organization } from 'better-auth/plugins/organization';
import { passkey } from '@better-auth/passkey';

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
 * Better Auth configuration: email OTP, passkeys, social stubs. No passwords.
 */
export function createAuthConfig(env: AuthEnv): BetterAuthOptions {
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

  return {
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
          // Production: delegate to @oss-tips/email via app wiring
          console.info(`[auth] OTP queued for ${email}`);
        },
      }),
      passkey({
        rpID: 'oss.tips',
        rpName: 'oss.tips',
        origin: env.baseUrl,
      }),
      organization(),
    ],
  };
}

export function createAuth(env: AuthEnv): Auth {
  return betterAuth(createAuthConfig(env));
}

export const OTP_POLICY = {
  length: OTP_LENGTH,
  expirySeconds: OTP_EXPIRY_SECONDS,
} as const;
