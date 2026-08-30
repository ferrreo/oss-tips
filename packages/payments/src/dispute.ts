import { normalizeCurrency, minorUnits, validateIdentifier } from './validation.js';

export const DISPUTE_TRANSFER_CODE = {
  opened: 1120,
  won: 1130,
  lost: 1140,
} as const;

export type DisputeCorrectionAction = 'opened' | 'won' | 'lost' | 'none';

export type DisputeCorrection = {
  action: DisputeCorrectionAction;
  transferCode: (typeof DISPUTE_TRANSFER_CODE)[keyof typeof DISPUTE_TRANSFER_CODE] | null;
  stripeDisputeId: string;
  amountMinor: string;
  currency: string;
};

export type DisputeCorrectionInput = {
  eventType: string;
  status: string;
  stripeDisputeId: string;
  amountMinor: number | bigint;
  currency: string;
  previousStatus?: string | undefined;
};

const OPEN_STATUSES = new Set(['warning_needs_response', 'needs_response', 'under_review']);

function normalizeStatus(status: string): 'open' | 'won' | 'lost' | 'other' {
  if (status === 'won') return 'won';
  if (status === 'lost') return 'lost';
  if (OPEN_STATUSES.has(status)) return 'open';
  return 'other';
}

/**
 * Map a dispute event to one append-only ledger correction.
 * Duplicate status notifications and stale open notifications produce no movement.
 */
export function computeDisputeCorrection(input: DisputeCorrectionInput): DisputeCorrection {
  if (
    input.eventType !== 'charge.dispute.created' &&
    input.eventType !== 'charge.dispute.updated' &&
    input.eventType !== 'charge.dispute.closed'
  ) {
    throw new Error('Unsupported dispute event type');
  }
  validateIdentifier(input.stripeDisputeId, 'Dispute id', 'dp_');
  const currency = normalizeCurrency(input.currency);
  const amountMinor = minorUnits(input.amountMinor, 'Dispute amount', false);
  const current = normalizeStatus(input.status);
  const previous = input.previousStatus ? normalizeStatus(input.previousStatus) : undefined;

  let action: DisputeCorrectionAction = 'none';
  if ((previous === 'won' || previous === 'lost') && current !== previous) {
    action = 'none';
  } else if (current === 'open') {
    action = previous === undefined || previous === 'other' ? 'opened' : 'none';
  } else if (current === 'won') {
    action = previous === 'won' ? 'none' : 'won';
  } else if (current === 'lost') {
    action = previous === 'lost' ? 'none' : 'lost';
  }

  return {
    action,
    transferCode: action === 'none' ? null : DISPUTE_TRANSFER_CODE[action],
    stripeDisputeId: input.stripeDisputeId,
    amountMinor: amountMinor.toString(),
    currency,
  };
}
