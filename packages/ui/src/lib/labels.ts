/** Human labels for machine enums. UI copy never shows the raw enum. */

function titleFromSnake(value: string): string {
  return value
    .replace(/[._-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelFrom(map: Record<string, string>, value: string): string {
  const labeled = map[value];
  return labeled === undefined ? titleFromSnake(value) : labeled;
}

const CASE_STATUS = {
  open: 'Open',
  investigating: 'Investigating',
  waiting: 'Waiting',
  resolved: 'Resolved',
} satisfies Record<string, string>;

const PAYMENT_STATUS = {
  succeeded: 'Succeeded',
  pending: 'Pending',
  failed: 'Failed',
  refunded: 'Refunded',
} satisfies Record<string, string>;

const MEMBERSHIP_STATUS = {
  active: 'Active',
  past_due: 'Past due',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
} satisfies Record<string, string>;

const RECONCILIATION_STATUS = {
  aligned: 'Aligned',
  matched: 'Matched',
  mismatch: 'Mismatch',
  pending: 'Pending',
} satisfies Record<string, string>;

const ENTITLEMENT_STATUS = {
  active: 'Active',
  permanent: 'Permanent',
  expired: 'Expired',
} satisfies Record<string, string>;

const INBOX_STATUS = {
  open: 'Open',
  waiting: 'Waiting',
  closed: 'Closed',
  resolved: 'Resolved',
  awaiting_reply: 'Awaiting reply',
  'awaiting reply': 'Awaiting reply',
} satisfies Record<string, string>;

const CADENCE = {
  'one-off': 'One-off',
  one_off: 'One-off',
  monthly: 'Monthly',
  annual: 'Annual',
  yearly: 'Yearly',
} satisfies Record<string, string>;

const RISK = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
} satisfies Record<string, string>;

const FEE_MODE = {
  standard: 'Standard',
  project_5pct: 'Project pays 5%',
} satisfies Record<string, string>;

const AUDIT_ACTION = {
  'project.review.hold': 'Held project for review',
  'project.review.approve': 'Approved project',
  'refund.exceptional': 'Issued exceptional refund',
  'project.restrict.payments': 'Restricted project payments',
  'case.open': 'Opened case',
  'account.recovery.start': 'Started account recovery',
  'reconciliation.flag': 'Flagged reconciliation difference',
  'project.fee_mode.change': 'Changed project fee mode',
  'api_key.revoke': 'Revoked API key',
  'view_as.start': 'Started view-as session',
} satisfies Record<string, string>;

export function labelCaseStatus(status: string): string {
  return labelFrom(CASE_STATUS, status);
}

export function labelPaymentStatus(status: string): string {
  return labelFrom(PAYMENT_STATUS, status);
}

export function labelMembershipStatus(status: string): string {
  return labelFrom(MEMBERSHIP_STATUS, status);
}

export function labelReconciliationStatus(status: string): string {
  return labelFrom(RECONCILIATION_STATUS, status);
}

export function labelEntitlementStatus(status: string): string {
  return labelFrom(ENTITLEMENT_STATUS, status);
}

export function labelInboxStatus(status: string): string {
  return labelFrom(INBOX_STATUS, status);
}

export function labelCadence(cadence: string): string {
  return labelFrom(CADENCE, cadence);
}

export function labelRisk(risk: string): string {
  return labelFrom(RISK, risk);
}

export function labelFeeMode(mode: string): string {
  return labelFrom(FEE_MODE, mode);
}

export function labelAuditAction(action: string): string {
  return labelFrom(AUDIT_ACTION, action);
}
