import { describe, expect, it } from 'vitest';
import { guestTimestamp } from './guest-access.js';

describe('guestTimestamp', () => {
  it('keeps expiry values locale-neutral for UI formatting', () => {
    expect(guestTimestamp(new Date('2026-09-01T12:34:56.000Z'))).toBe('2026-09-01T12:34:56.000Z');
  });
});
