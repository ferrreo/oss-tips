export type OneOffDuration =
  | 'none'
  | 'days_30'
  | 'days_90'
  | 'days_365'
  | 'permanent';

export type EntitlementKind = 'one_off' | 'membership';

export type EntitlementSnapshot = {
  kind: EntitlementKind;
  tierRank: number;
  tierId: string | null;
  startsAt: Date;
  endsAt: Date | null;
  revokedAt: Date | null;
};

const DURATION_MS: Record<Exclude<OneOffDuration, 'none' | 'permanent'>, number> = {
  days_30: 30 * 24 * 60 * 60 * 1000,
  days_90: 90 * 24 * 60 * 60 * 1000,
  days_365: 365 * 24 * 60 * 60 * 1000,
};

export function oneOffEndsAt(
  duration: OneOffDuration,
  startsAt: Date,
): Date | null {
  if (duration === 'none') return startsAt;
  if (duration === 'permanent') return null;
  return new Date(startsAt.getTime() + DURATION_MS[duration]);
}

export function isEntitlementActive(
  entitlement: EntitlementSnapshot,
  now = new Date(),
): boolean {
  if (entitlement.revokedAt) return false;
  if (now < entitlement.startsAt) return false;
  if (entitlement.endsAt && now > entitlement.endsAt) return false;
  if (entitlement.kind === 'one_off' && entitlement.endsAt && entitlement.endsAt.getTime() === entitlement.startsAt.getTime()) {
    return false; // duration none
  }
  return true;
}

export type VisibilityRule =
  | { kind: 'public' }
  | { kind: 'signed_in_supporter' }
  | { kind: 'minimum_tier_rank'; rank: number }
  | { kind: 'selected_tier_ids'; tierIds: readonly string[] };

export function canViewContent(args: {
  rule: VisibilityRule;
  signedIn: boolean;
  activeEntitlements: readonly EntitlementSnapshot[];
  now?: Date;
}): boolean {
  const now = args.now ?? new Date();
  const active = args.activeEntitlements.filter((e) => isEntitlementActive(e, now));

  switch (args.rule.kind) {
    case 'public':
      return true;
    case 'signed_in_supporter':
      return args.signedIn && active.length > 0;
    case 'minimum_tier_rank': {
      const rule = args.rule;
      if (rule.kind !== 'minimum_tier_rank') return false;
      return active.some((e) => e.tierRank >= rule.rank);
    }
    case 'selected_tier_ids': {
      const rule = args.rule;
      if (rule.kind !== 'selected_tier_ids') return false;
      return active.some((e) => e.tierId != null && rule.tierIds.includes(e.tierId));
    }
    default: {
      const _exhaustive: never = args.rule;
      return _exhaustive;
    }
  }
}

/** Higher-tier payments do not aggregate; keep the highest active entitlement. */
export function highestTierRank(entitlements: readonly EntitlementSnapshot[], now = new Date()): number {
  return entitlements
    .filter((e) => isEntitlementActive(e, now))
    .reduce((max, e) => Math.max(max, e.tierRank), 0);
}
