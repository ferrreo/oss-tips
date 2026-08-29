import { describe, expect, it } from 'vitest';
import {
  cadenceLabel,
  cadencePhrase,
  entitlementStatusLabel,
  membershipStatusLabel,
  paymentStatusLabel,
} from './labels.js';

describe('public payment labels', () => {
  it('never returns raw membership enums', () => {
    expect(membershipStatusLabel('active')).toBe('Active membership');
    expect(membershipStatusLabel('past_due')).toBe('Past due');
    expect(membershipStatusLabel('cancelled')).toBe('Cancelled');
    expect(membershipStatusLabel('canceled')).toBe('Cancelled');
  });

  it('never returns raw entitlement enums', () => {
    expect(entitlementStatusLabel('active')).toBe('Active');
    expect(entitlementStatusLabel('permanent')).toBe('Permanent');
    expect(entitlementStatusLabel('expired')).toBe('Expired');
  });

  it('never returns raw cadence enums', () => {
    expect(cadenceLabel('monthly')).toBe('Monthly');
    expect(cadenceLabel('annual')).toBe('Annual');
    expect(cadenceLabel('one-off')).toBe('One-off');
    expect(cadencePhrase('monthly')).toBe('monthly membership');
    expect(cadencePhrase('one-off')).toBe('one-off support');
  });

  it('never returns raw payment enums', () => {
    expect(paymentStatusLabel('succeeded')).toBe('Paid');
    expect(paymentStatusLabel('pending')).toBe('Processing');
    expect(paymentStatusLabel('failed')).toBe('Failed');
    expect(paymentStatusLabel('refunded')).toBe('Refunded');
  });
});
