import { describe, expect, it } from 'vitest';
import {
  createSupportEmailVerificationValue,
  supportEmailCodeFromVerificationValue,
  supportEmailCodeHash,
  supportEmailCodeMatches,
  supportEmailIdentifier,
} from './support-email-verification.js';

describe('support email verification values', () => {
  it('derives project-scoped identifiers with a keyed email digest', () => {
    expect(supportEmailIdentifier('project-1', 'owner@example.com', 'test-secret')).toBe(
      'project-support-email:project-1:23dfcf3b6238359e7ebcfca93ca16b405fb3d0a400fa2860f8324b866f05f188',
    );
  });

  it('round-trips a v2 value without storing plaintext code', () => {
    const result = createSupportEmailVerificationValue(
      'project-support-email:project-1:hash',
      'test-secret',
    );

    expect(result.value).toMatch(/^support-email:v2:[A-Za-z0-9_-]{22}:[a-f0-9]{64}$/);
    expect(result.code).toMatch(/^\d{6}$/);
    expect(
      supportEmailCodeFromVerificationValue(
        'project-support-email:project-1:hash',
        result.value,
        'test-secret',
      ),
    ).toBe(result.code);
    expect(
      supportEmailCodeMatches(
        'project-support-email:project-1:hash',
        result.code,
        result.value,
        'test-secret',
      ),
    ).toBe(true);
    expect(result.value).not.toContain(result.code);
  });

  it('rejects altered values and keeps legacy hash comparison', () => {
    const identifier = 'project-support-email:project-1:hash';
    const hash = supportEmailCodeHash(identifier, '123456', 'test-secret');

    expect(supportEmailCodeMatches(identifier, '123456', hash, 'test-secret')).toBe(true);
    expect(supportEmailCodeMatches(identifier, '654321', hash, 'test-secret')).toBe(false);
    expect(
      supportEmailCodeFromVerificationValue(identifier, 'support-email:v1:bad', 'test-secret'),
    ).toBeNull();
  });
});
