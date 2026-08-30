import { describe, expect, it } from 'vitest';
import {
  discordTokenEncryptionKey,
  requireHttpsUrl,
  validateWebProductionConfig,
} from './runtime-config.js';

const completeProductionEnv = {
  NODE_ENV: 'production',
  MALWARE_SCANNER_HOST: 'clamav',
  PUBLIC_APP_URL: 'https://oss.tips',
  BETTER_AUTH_SECRET: 'a-secret-that-is-long-enough-for-auth',
  RESEND_WEBHOOK_SECRET: 'whsec_test',
  API_RATE_LIMIT_SECRET: 'rate-limit-secret',
};

describe('web production configuration', () => {
  it('accepts complete production configuration', () => {
    expect(() => validateWebProductionConfig(completeProductionEnv)).not.toThrow();
    expect(requireHttpsUrl('https://oss.tips/', 'PUBLIC_APP_URL')).toBe('https://oss.tips');
  });

  it('rejects local or insecure public URLs', () => {
    expect(() => requireHttpsUrl(undefined, 'PUBLIC_APP_URL')).toThrow('is required');
    expect(() => requireHttpsUrl('http://oss.tips', 'PUBLIC_APP_URL')).toThrow('must use');
    expect(() => requireHttpsUrl('https://localhost:3000', 'PUBLIC_APP_URL')).toThrow('must use');
  });

  it('requires webhook and rate-limit configuration in production', () => {
    expect(() =>
      validateWebProductionConfig({ ...completeProductionEnv, RESEND_WEBHOOK_SECRET: '' }),
    ).toThrow('RESEND_WEBHOOK_SECRET is required');
    expect(() =>
      validateWebProductionConfig({ ...completeProductionEnv, API_RATE_LIMIT_SECRET: '' }),
    ).toThrow('API_RATE_LIMIT_SECRET is required');
  });

  it('requires malware scanning before serving production uploads', () => {
    expect(() =>
      validateWebProductionConfig({ ...completeProductionEnv, MALWARE_SCANNER_HOST: '' }),
    ).toThrow('MALWARE_SCANNER_HOST');
  });

  it('does not reuse the webhook key for Discord tokens in production', () => {
    expect(
      discordTokenEncryptionKey({ NODE_ENV: 'production', WEBHOOK_ENCRYPTION_KEY: 'shared' }),
    ).toBeUndefined();
    expect(
      discordTokenEncryptionKey({
        NODE_ENV: 'production',
        DISCORD_TOKEN_ENCRYPTION_KEY: 'dedicated',
      }),
    ).toBe('dedicated');
    expect(
      discordTokenEncryptionKey({ NODE_ENV: 'development', WEBHOOK_ENCRYPTION_KEY: 'local' }),
    ).toBe('local');
  });
});
