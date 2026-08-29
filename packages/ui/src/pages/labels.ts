/** Human labels for payment and membership values shown on public surfaces. */

function titleFromEnum(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function membershipStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active membership';
    case 'past_due':
      return 'Past due';
    case 'cancelled':
    case 'canceled':
      return 'Cancelled';
    default:
      return titleFromEnum(status);
  }
}

export function entitlementStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'permanent':
      return 'Permanent';
    case 'expired':
      return 'Expired';
    default:
      return titleFromEnum(status);
  }
}

export function cadenceLabel(cadence: string): string {
  switch (cadence) {
    case 'monthly':
      return 'Monthly';
    case 'annual':
    case 'yearly':
      return 'Annual';
    case 'one-off':
    case 'one_off':
    case 'oneoff':
      return 'One-off';
    default:
      return titleFromEnum(cadence);
  }
}

export function paymentStatusLabel(status: string): string {
  switch (status) {
    case 'succeeded':
    case 'paid':
      return 'Paid';
    case 'pending':
    case 'processing':
      return 'Processing';
    case 'failed':
      return 'Failed';
    case 'refunded':
      return 'Refunded';
    default:
      return titleFromEnum(status);
  }
}

export function cadencePhrase(cadence: string): string {
  switch (cadence) {
    case 'monthly':
      return 'monthly membership';
    case 'annual':
    case 'yearly':
      return 'annual membership';
    case 'one-off':
    case 'one_off':
    case 'oneoff':
      return 'one-off support';
    default:
      return cadenceLabel(cadence).toLowerCase();
  }
}
