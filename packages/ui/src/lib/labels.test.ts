import { describe, expect, it } from 'vitest';
import {
  labelAuditAction,
  labelCadence,
  labelCaseStatus,
  labelEntitlementStatus,
  labelFeeMode,
  labelApiScope,
  labelInboxStatus,
  labelMembershipStatus,
  labelPaymentStatus,
  labelReconciliationStatus,
  labelRisk,
  labelStripeCapability,
  humanizeStatus,
} from './labels.js';

describe('labels', () => {
  it('maps every case status', () => {
    expect(labelCaseStatus('open')).toBe('Open');
    expect(labelCaseStatus('investigating')).toBe('Investigating');
    expect(labelCaseStatus('waiting')).toBe('Waiting');
    expect(labelCaseStatus('resolved')).toBe('Resolved');
  });

  it('maps every payment status', () => {
    expect(labelPaymentStatus('succeeded')).toBe('Succeeded');
    expect(labelPaymentStatus('pending')).toBe('Pending');
    expect(labelPaymentStatus('failed')).toBe('Failed');
    expect(labelPaymentStatus('refunded')).toBe('Refunded');
  });

  it('maps every membership status', () => {
    expect(labelMembershipStatus('active')).toBe('Active');
    expect(labelMembershipStatus('past_due')).toBe('Past due');
    expect(labelMembershipStatus('cancelled')).toBe('Cancelled');
    expect(labelMembershipStatus('canceled')).toBe('Cancelled');
    expect(labelMembershipStatus('entitled')).toBe('Entitled');
  });

  it('maps every reconciliation status', () => {
    expect(labelReconciliationStatus('aligned')).toBe('Aligned');
    expect(labelReconciliationStatus('matched')).toBe('Matched');
    expect(labelReconciliationStatus('mismatch')).toBe('Mismatch');
    expect(labelReconciliationStatus('pending')).toBe('Pending');
  });

  it('maps entitlement and inbox statuses', () => {
    expect(labelEntitlementStatus('active')).toBe('Active');
    expect(labelEntitlementStatus('permanent')).toBe('Permanent');
    expect(labelEntitlementStatus('expired')).toBe('Expired');
    expect(labelInboxStatus('open')).toBe('Open');
    expect(labelInboxStatus('waiting')).toBe('Waiting');
    expect(labelInboxStatus('closed')).toBe('Closed');
    expect(labelInboxStatus('resolved')).toBe('Resolved');
    expect(labelInboxStatus('awaiting_reply')).toBe('Awaiting reply');
    expect(labelInboxStatus('awaiting reply')).toBe('Awaiting reply');
  });

  it('maps cadence, risk, fee mode, and audit actions', () => {
    expect(labelCadence('one-off')).toBe('One-off');
    expect(labelCadence('one_off')).toBe('One-off');
    expect(labelCadence('monthly')).toBe('Monthly');
    expect(labelCadence('annual')).toBe('Annual');
    expect(labelRisk('high')).toBe('High');
    expect(labelRisk('medium')).toBe('Medium');
    expect(labelRisk('low')).toBe('Low');
    expect(labelFeeMode('standard')).toBe('Standard');
    expect(labelFeeMode('project_5pct')).toBe('Project pays 5%');
    expect(labelStripeCapability('card_payments')).toBe('Card payments');
    expect(labelApiScope('read:payments,write:webhooks')).toBe('Read payments, Write webhooks');
    expect(labelAuditAction('case.open')).toBe('Opened case');
    expect(labelAuditAction('refund.exceptional')).toBe('Issued exceptional refund');
  });

  it('humanizes unknown machine values instead of returning them raw', () => {
    expect(labelCaseStatus('needs_owner')).toBe('Needs Owner');
    expect(labelPaymentStatus('chargeback_open')).toBe('Chargeback Open');
    expect(labelInboxStatus('needs_first_reply')).toBe('Needs First Reply');
    expect(labelAuditAction('foo.bar_baz')).toBe('Foo Bar Baz');
    expect(labelCaseStatus('needs_owner')).not.toBe('needs_owner');
    expect(labelMembershipStatus('past_due')).not.toBe('past_due');
    expect(humanizeStatus('project_5pct')).toBe('Project pays 5%');
    expect(humanizeStatus('first_payment')).toBe('First Payment');
    expect(humanizeStatus('mismatch')).toBe('Mismatch');
  });
});
