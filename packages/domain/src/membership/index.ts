export type MembershipStatus =
  'active' | 'grace' | 'cancelled' | 'expired' | 'incomplete' | 'past_due';

export type MembershipEvent =
  | { kind: 'invoice_paid'; periodEnd: Date }
  | { kind: 'invoice_failed'; at: Date }
  | { kind: 'cancel_requested'; at: Date }
  | { kind: 'period_ended'; at: Date }
  | { kind: 'grace_ended'; at: Date }
  | { kind: 'refund_full'; at: Date }
  | { kind: 'chargeback_lost'; at: Date };

export const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

export type MembershipState = {
  status: MembershipStatus;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
};

export function initialMembershipState(): MembershipState {
  return {
    status: 'incomplete',
    currentPeriodEnd: null,
    graceEndsAt: null,
    cancelAtPeriodEnd: false,
  };
}

export function reduceMembership(state: MembershipState, event: MembershipEvent): MembershipState {
  switch (event.kind) {
    case 'invoice_paid':
      return {
        status: 'active',
        currentPeriodEnd: event.periodEnd,
        graceEndsAt: null,
        cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      };
    case 'invoice_failed':
      if (state.status === 'active' || state.status === 'past_due') {
        return {
          ...state,
          status: 'grace',
          graceEndsAt: new Date(event.at.getTime() + GRACE_PERIOD_MS),
        };
      }
      return { ...state, status: 'past_due' };
    case 'cancel_requested':
      return { ...state, cancelAtPeriodEnd: true };
    case 'period_ended':
      if (state.cancelAtPeriodEnd) {
        return {
          status: 'cancelled',
          currentPeriodEnd: state.currentPeriodEnd,
          graceEndsAt: null,
          cancelAtPeriodEnd: true,
        };
      }
      return state;
    case 'grace_ended':
      if (state.status === 'grace') {
        return { ...state, status: 'expired', graceEndsAt: null };
      }
      return state;
    case 'refund_full':
    case 'chargeback_lost':
      return {
        status: 'expired',
        currentPeriodEnd: state.currentPeriodEnd,
        graceEndsAt: null,
        cancelAtPeriodEnd: state.cancelAtPeriodEnd,
      };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function hasActiveAccess(state: MembershipState, now = new Date()): boolean {
  if (state.status === 'active') {
    if (state.cancelAtPeriodEnd && state.currentPeriodEnd && now > state.currentPeriodEnd) {
      return false;
    }
    return true;
  }
  if (state.status === 'grace' && state.graceEndsAt && now <= state.graceEndsAt) {
    return true;
  }
  return false;
}
