import { betterAuth, type Auth, type BetterAuthOptions } from 'better-auth';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { organization } from 'better-auth/plugins/organization';
import { passkey } from '@better-auth/passkey';
import { kyselyAdapter } from '@better-auth/kysely-adapter';
import { hashAuthOtp } from '@oss-tips/domain/auth-otp';
import type { Kysely } from 'kysely';

export type AuthEnv = {
  baseUrl: string;
  secret: string;
  authDevMode?: boolean | undefined;
  sendVerificationOTP?: (data: {
    email: string;
    otp: string;
    type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';
  }) => Promise<void>;
  github?: { clientId: string; clientSecret: string } | undefined;
  google?: { clientId: string; clientSecret: string } | undefined;
  discord?: { clientId: string; clientSecret: string } | undefined;
  gitlab?: { clientId: string; clientSecret: string } | undefined;
  codeberg?: { clientId: string; clientSecret: string } | undefined;
};

export const SUPPORTED_OAUTH_PROVIDERS = [
  'github',
  'google',
  'discord',
  'gitlab',
  'codeberg',
] as const;
export type SupportedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

export function configuredOAuthProviders(
  env: Pick<AuthEnv, 'github' | 'google' | 'discord' | 'gitlab' | 'codeberg'>,
): SupportedOAuthProvider[] {
  return SUPPORTED_OAUTH_PROVIDERS.filter((provider) =>
    Boolean(env[provider]),
  ) as SupportedOAuthProvider[];
}

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
export function createAuthConfig(env: AuthEnv, database?: Kysely<any>): BetterAuthOptions {
  const sendVerificationOTP = env.sendVerificationOTP;
  if (!env.authDevMode && !sendVerificationOTP) {
    throw new Error('OTP email sender is required outside AUTH_DEV_MODE');
  }

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

  const genericProviders = env.codeberg
    ? [
        genericOAuth({
          config: [
            {
              providerId: 'codeberg',
              name: 'Codeberg',
              clientId: env.codeberg.clientId,
              clientSecret: env.codeberg.clientSecret,
              authorizationUrl: 'https://codeberg.org/login/oauth/authorize',
              tokenUrl: 'https://codeberg.org/login/oauth/access_token',
              userInfoUrl: 'https://codeberg.org/api/v1/user',
              scopes: ['read:user'],
              accountIssuer: 'https://codeberg.org',
              mapProfileToUser(profile) {
                const name = [profile.full_name, profile.login, profile.username].find(
                  (value): value is string => typeof value === 'string' && value.length > 0,
                );
                return {
                  ...(name ? { name } : {}),
                  ...(typeof profile.email === 'string' ? { email: profile.email } : {}),
                  ...(typeof profile.avatar_url === 'string' ? { image: profile.avatar_url } : {}),
                };
              },
            },
          ],
        }),
      ]
    : [];

  const options: BetterAuthOptions = {
    appName: 'oss.tips',
    baseURL: env.baseUrl,
    secret: env.secret,
    advanced: {
      database: {
        // The application schema uses UUID foreign keys for auth rows.
        generateId: 'uuid',
      },
    },
    user: {
      fields: {
        name: 'name',
        email: 'email',
        image: 'image',
        emailVerified: 'email_verified',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    session: {
      fields: {
        token: 'token',
        userId: 'user_id',
        expiresAt: 'expires_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    account: {
      encryptOAuthTokens: true,
      fields: {
        issuer: 'issuer',
        userId: 'user_id',
        providerId: 'provider_id',
        accountId: 'account_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        scope: 'scope',
        password: 'password',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    verification: {
      fields: {
        identifier: 'identifier',
        value: 'value',
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    emailAndPassword: {
      enabled: false,
    },
    socialProviders,
    plugins: [
      emailOTP({
        otpLength: OTP_LENGTH,
        expiresIn: OTP_EXPIRY_SECONDS,
        generateOTP: () => (env.authDevMode ? DEV_OTP_CODE : undefined),
        // Never persist a reusable authentication code in plaintext. HMAC keeps
        // recovery in the OTP worker possible without storing a decryptable code.
        storeOTP: {
          hash: async (otp: string) => hashAuthOtp(otp, env.secret),
        },
        // Keep Better Auth's verification-attempt ceiling explicit.
        allowedAttempts: 3,
        // A new request supersedes prior rows for this identifier.
        resendStrategy: 'rotate',
        async sendVerificationOTP({ email, otp, type }) {
          if (env.authDevMode) {
            console.info(`[auth:dev] OTP for email (or use ${DEV_OTP_CODE}): ${otp}`);
            return;
          }
          if (sendVerificationOTP) await sendVerificationOTP({ email, otp, type });
        },
      }),
      passkey({
        rpID: new URL(env.baseUrl).hostname,
        rpName: 'oss.tips',
        origin: env.baseUrl,
        schema: {
          passkey: {
            fields: {
              name: 'name',
              publicKey: 'public_key',
              userId: 'user_id',
              credentialID: 'credential_id',
              counter: 'counter',
              deviceType: 'device_type',
              backedUp: 'backed_up',
              transports: 'transports',
              createdAt: 'created_at',
              aaguid: 'aaguid',
            },
          },
        },
        ...(database
          ? {
              authentication: {
                async afterVerification({ clientData }) {
                  try {
                    await database
                      .updateTable('passkey')
                      .set({ last_used_at: new Date() })
                      .where('credential_id', '=', clientData.id)
                      .execute();
                  } catch {
                    // Last-used metadata must not turn a valid passkey sign-in into a failure.
                    console.error('[auth] Failed to update passkey last-used time');
                  }
                },
              },
            }
          : {}),
      }),
      organization(),
      ...genericProviders,
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

/** 5/hour/email and 10/hour/IP; accepted sends then follow this cooldown ladder. */
export const OTP_SEND_POLICY = {
  emailLimit: 5,
  ipLimit: 10,
  windowSeconds: 60 * 60,
  cooldownSeconds: [0, 30, 60, 5 * 60, 15 * 60, 60 * 60],
} as const;
