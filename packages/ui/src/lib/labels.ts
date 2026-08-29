/** Human labels for enums shown in operator UI. Keep raw values in data; label at render. */

export const cadenceLabels = {
  'one-off': 'One-off',
  monthly: 'Monthly',
  annual: 'Annual',
} as const;

export const paymentStatusLabels = {
  succeeded: 'Succeeded',
  pending: 'Pending',
  failed: 'Failed',
  refunded: 'Refunded',
} as const;

export const membershipStatusLabels = {
  active: 'Active',
  past_due: 'Past due',
  cancelled: 'Cancelled',
  entitled: 'Entitled',
} as const;

export const feeModeLabels = {
  standard: 'Standard',
  project_5pct: 'Project pays 5%',
} as const;

export const stripeCapabilityLabels = {
  card_payments: 'Card payments',
  transfers: 'Transfers',
  payouts: 'Payouts',
  sepa_debit_payments: 'SEPA debit',
  link_payments: 'Link',
} as const;

export const apiScopeLabels = {
  'read:payments': 'Read payments',
  'read:project': 'Read project',
  'write:webhooks': 'Write webhooks',
  'read:exports': 'Read exports',
  'read:memberships': 'Read memberships',
} as const;

export function humanizeToken(value: string): string {
  return value
    .replace(/[_.:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function labelFor(map: Record<string, string>, value: string): string {
  return map[value] ?? humanizeToken(value);
}

export function labelCadence(value: string): string {
  return labelFor(cadenceLabels, value);
}

export function labelPaymentStatus(value: string): string {
  return labelFor(paymentStatusLabels, value);
}

export function labelMembershipStatus(value: string): string {
  return labelFor(membershipStatusLabels, value);
}

export function labelFeeMode(value: string): string {
  return labelFor(feeModeLabels, value);
}

export function labelStripeCapability(value: string): string {
  return labelFor(stripeCapabilityLabels, value);
}

export function labelApiScope(value: string): string {
  return value
    .split(',')
    .map((part) => labelFor(apiScopeLabels, part.trim()))
    .join(', ');
}
