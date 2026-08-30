import { describe, expect, it } from 'vitest';
import { calculateRecurringEntitlement } from './index.js';

describe('calculateRecurringEntitlement', () => {
  const periodStart = new Date('2026-08-01T12:00:00.000Z');
  const periodEnd = new Date('2026-09-01T12:00:00.000Z');

  it('shortens access in proportion to a partial reversal', () => {
    expect(
      calculateRecurringEntitlement({
        periodStart,
        periodEnd,
        originalChargeMinor: 1100n,
        refundedChargeMinor: 550n,
        disputedChargeMinor: 0n,
      }),
    ).toEqual({ endsAt: new Date('2026-08-17T00:00:00.000Z'), revoke: false });
  });

  it('revokes on a full reversal', () => {
    expect(
      calculateRecurringEntitlement({
        periodStart,
        periodEnd,
        originalChargeMinor: 1100n,
        refundedChargeMinor: 0n,
        disputedChargeMinor: 1100n,
      }),
    ).toEqual({ endsAt: periodStart, revoke: true });
  });
});
