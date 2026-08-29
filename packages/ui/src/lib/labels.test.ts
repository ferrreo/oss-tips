import { describe, expect, it } from 'vitest';
import {
  humanizeToken,
  labelApiScope,
  labelCadence,
  labelFeeMode,
  labelMembershipStatus,
  labelPaymentStatus,
  labelStripeCapability,
} from './labels.js';

describe('labels', () => {
  it('labels cadences without exposing raw enums', () => {
    expect(labelCadence('one-off')).toBe('One-off');
    expect(labelCadence('monthly')).toBe('Monthly');
    expect(labelCadence('annual')).toBe('Annual');
  });

  it('labels payment and membership statuses', () => {
    expect(labelPaymentStatus('succeeded')).toBe('Succeeded');
    expect(labelPaymentStatus('refunded')).toBe('Refunded');
    expect(labelMembershipStatus('past_due')).toBe('Past due');
    expect(labelMembershipStatus('entitled')).toBe('Entitled');
  });

  it('labels Stripe capabilities and fee modes', () => {
    expect(labelStripeCapability('card_payments')).toBe('Card payments');
    expect(labelStripeCapability('sepa_debit_payments')).toBe('SEPA debit');
    expect(labelFeeMode('project_5pct')).toBe('Project pays 5%');
  });

  it('labels API scopes, including comma-separated lists', () => {
    expect(labelApiScope('read:payments')).toBe('Read payments');
    expect(labelApiScope('read:payments, read:memberships')).toBe('Read payments, Read memberships');
  });

  it('falls back to a readable token for unknown values', () => {
    expect(humanizeToken('charges_enabled')).toBe('Charges Enabled');
    expect(labelCadence('quarterly')).toBe('Quarterly');
  });
});
