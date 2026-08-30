import { describe, expect, it } from 'vitest';
import {
  normalizePublicAppUrl,
  requireProductionPublicAppUrl,
  validateWorkerProductionConfig,
  workerPublicUrl,
} from './runtime-config.js';

const completeProductionEnv = {
  NODE_ENV: 'production',
  MALWARE_SCANNER_HOST: 'clamav',
  S3_ENDPOINT: 'https://storage.oss.tips',
  S3_ACCESS_KEY_ID: 'access',
  S3_SECRET_ACCESS_KEY: 'secret',
  WEBHOOK_ENCRYPTION_KEY: 'base64:key',
  RESEND_API_KEY: 're_test',
  BETTER_AUTH_SECRET: 'auth-secret',
  PUBLIC_APP_URL: 'https://oss.tips',
};

describe('general worker production configuration', () => {
  it('accepts required integrations', () => {
    expect(() => validateWorkerProductionConfig(completeProductionEnv)).not.toThrow();
  });

  it('rejects missing integrations before claiming jobs', () => {
    expect(() =>
      validateWorkerProductionConfig({ ...completeProductionEnv, WEBHOOK_ENCRYPTION_KEY: '' }),
    ).toThrow('WEBHOOK_ENCRYPTION_KEY');
    expect(() =>
      validateWorkerProductionConfig({ ...completeProductionEnv, RESEND_API_KEY: '' }),
    ).toThrow('RESEND_API_KEY');
  });

  it('requires the malware scanner before starting production maintenance', () => {
    expect(() =>
      validateWorkerProductionConfig({ ...completeProductionEnv, MALWARE_SCANNER_HOST: '' }),
    ).toThrow('MALWARE_SCANNER_HOST');
  });

  it('rejects unsafe public URLs before claiming production jobs', () => {
    expect(() => requireProductionPublicAppUrl('http://oss.tips')).toThrow('must use');
    expect(() => requireProductionPublicAppUrl('https://localhost:3000')).toThrow('must use');
    expect(() => requireProductionPublicAppUrl('https://user:secret@oss.tips')).toThrow('invalid');
  });

  it('keeps localhost URLs available for local notification tests and development', () => {
    expect(normalizePublicAppUrl('http://localhost:3000')).toBe('http://localhost:3000');
    expect(normalizePublicAppUrl(undefined)).toBe('https://oss.tips');
  });

  it('builds links only from validated public URLs', () => {
    expect(workerPublicUrl('https://oss.tips', '/grove/posts/release')).toBe(
      'https://oss.tips/grove/posts/release',
    );
    expect(() => workerPublicUrl('http://evil.example', '/grove/posts/release')).toThrow(
      'must use HTTPS',
    );
  });

  it('does not require production integrations in local mode', () => {
    expect(() => validateWorkerProductionConfig({ NODE_ENV: 'test' })).not.toThrow();
  });

  it('lets a dedicated OTP worker start without general worker integrations', () => {
    const otpEnv = {
      NODE_ENV: 'production',
      RESEND_API_KEY: 're_test',
      BETTER_AUTH_SECRET: 'auth-secret',
      PUBLIC_APP_URL: 'https://oss.tips',
    };
    expect(() => validateWorkerProductionConfig(otpEnv, { otpOnly: true })).not.toThrow();
    expect(() =>
      validateWorkerProductionConfig({ ...otpEnv, RESEND_API_KEY: '' }, { otpOnly: true }),
    ).toThrow('RESEND_API_KEY');
    expect(() =>
      validateWorkerProductionConfig({ ...otpEnv, BETTER_AUTH_SECRET: '' }, { otpOnly: true }),
    ).toThrow('BETTER_AUTH_SECRET');
    expect(() =>
      validateWorkerProductionConfig({ ...otpEnv, PUBLIC_APP_URL: '' }, { otpOnly: true }),
    ).toThrow('PUBLIC_APP_URL');
  });
});
