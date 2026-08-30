import { describe, expect, it } from 'vitest';
import type { GuestAccessToken } from '../types.js';
import {
  hashGuestAccessToken,
  hashGuestEmail,
  isGuestAccessTokenFormat,
  normalizeGuestEmail,
  statusOfGuestAccessToken,
} from './guestAccess.js';

function token(overrides: Partial<GuestAccessToken> = {}): GuestAccessToken {
  return {
    id: '0198d6e8-0000-7000-8000-000000000001',
    kind: 'claim',
    token_hash: 'hash',
    payment_id: '0198d6e8-0000-7000-8000-000000000002',
    thread_id: null,
    email_hash: hashGuestEmail('guest@example.com'),
    attempt_count: 0,
    expires_at: new Date('2026-09-01T00:00:00.000Z'),
    used_at: null,
    created_at: new Date('2026-08-29T00:00:00.000Z'),
    ...overrides,
  };
}

describe('guest access token primitives', () => {
  it('normalizes email before hashing and never stores raw token material', () => {
    expect(normalizeGuestEmail('  Guest@Example.COM ')).toBe('guest@example.com');
    expect(hashGuestEmail(' Guest@Example.COM ')).toBe(hashGuestEmail('guest@example.com'));
    expect(hashGuestAccessToken('gat_test')).toHaveLength(64);
    expect(hashGuestAccessToken('gat_test')).not.toBe('gat_test');
  });

  it('accepts only generated token shape', () => {
    expect(isGuestAccessTokenFormat(`gat_${'a'.repeat(43)}`)).toBe(true);
    expect(isGuestAccessTokenFormat('gat_short')).toBe(false);
    expect(isGuestAccessTokenFormat('gat_' + 'a'.repeat(42) + '/')).toBe(false);
  });

  it('reports missing, expired, used, and active states', () => {
    const now = new Date('2026-08-29T12:00:00.000Z');
    expect(statusOfGuestAccessToken(undefined, now)).toBe('missing');
    expect(
      statusOfGuestAccessToken(token({ expires_at: new Date('2026-08-29T11:59:00.000Z') }), now),
    ).toBe('expired');
    expect(statusOfGuestAccessToken(token({ used_at: now }), now)).toBe('used');
    expect(statusOfGuestAccessToken(token({ attempt_count: 5 }), now)).toBe('locked');
    expect(statusOfGuestAccessToken(token(), now)).toBe('valid');
  });
});
