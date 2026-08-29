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
  paid: 'Paid',
  pending: 'Pending',
  processing: 'Processing',
  failed: 'Failed',
  refunded: 'Refunded',
} satisfies Record<string, string>;

const MEMBERSHIP_STATUS = {
  active: 'Active',
  past_due: 'Past due',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  entitled: 'Entitled',
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
  oneoff: 'One-off',
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

const STRIPE_CAPABILITY = {
  card_payments: 'Card payments',
  transfers: 'Transfers',
  payouts: 'Payouts',
  sepa_debit_payments: 'SEPA debit',
  link_payments: 'Link',
} satisfies Record<string, string>;

const API_SCOPE = {
  'read:payments': 'Read payments',
  'read:project': 'Read project',
  'write:webhooks': 'Write webhooks',
  'read:exports': 'Read exports',
  'read:memberships': 'Read memberships',
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

export function labelStripeCapability(value: string): string {
  return labelFrom(STRIPE_CAPABILITY, value);
}

export function labelApiScope(value: string): string {
  return value
    .split(',')
    .map((part) => labelFrom(API_SCOPE, part.trim()))
    .join(', ');
}

const ALL_LABELS = {
  ...CASE_STATUS,
  ...PAYMENT_STATUS,
  ...MEMBERSHIP_STATUS,
  ...RECONCILIATION_STATUS,
  ...ENTITLEMENT_STATUS,
  ...INBOX_STATUS,
  ...CADENCE,
  ...RISK,
  ...FEE_MODE,
  ...AUDIT_ACTION,
  ...STRIPE_CAPABILITY,
  ...API_SCOPE,
};

/** Generic fallback when the domain is unknown. Prefer a specific label* helper. */
export function humanizeMachineValue(value: string): string {
  return labelFrom(ALL_LABELS, value);
}

/** Prefer specific label* helpers; covers mixed admin tables and unknown enums. */
export function humanizeStatus(value: string): string {
  return humanizeMachineValue(value);
}
