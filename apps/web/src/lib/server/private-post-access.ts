import { canViewContent, type EntitlementSnapshot, type VisibilityRule } from '@oss-tips/domain';

export type StoredVisibilityRule = {
  rule_kind: string;
  minimum_tier_rank: number | null;
  selected_tier_ids: unknown;
};

export type StoredEntitlement = {
  kind: string;
  tier_rank: number;
  tier_id: string | null;
  starts_at: Date;
  ends_at: Date | null;
  revoked_at: Date | null;
};

/**
 * Private post assets inherit post visibility. Unknown or missing rules fail
 * closed so an orphaned asset never becomes an entitlement bypass.
 */
export function canAccessPrivatePostAttachment(input: {
  rule: StoredVisibilityRule | null;
  entitlements: readonly StoredEntitlement[];
  now?: Date;
}): boolean {
  const rule = toVisibilityRule(input.rule);
  if (!rule) return false;
  const entitlements: EntitlementSnapshot[] = input.entitlements.flatMap((item) => {
    if (item.kind !== 'membership' && item.kind !== 'one_off') return [];
    return [
      {
        kind: item.kind,
        tierRank: item.tier_rank,
        tierId: item.tier_id,
        startsAt: item.starts_at,
        endsAt: item.ends_at,
        revokedAt: item.revoked_at,
      },
    ];
  });
  return canViewContent({
    rule,
    signedIn: true,
    activeEntitlements: entitlements,
    now: input.now,
  });
}

export function toVisibilityRule(rule: StoredVisibilityRule | null): VisibilityRule | null {
  if (!rule) return null;
  if (rule.rule_kind === 'signed_in_supporter') return { kind: 'signed_in_supporter' };
  if (
    rule.rule_kind === 'minimum_tier_rank' &&
    Number.isInteger(rule.minimum_tier_rank) &&
    rule.minimum_tier_rank !== null &&
    rule.minimum_tier_rank >= 0
  ) {
    return { kind: 'minimum_tier_rank', rank: rule.minimum_tier_rank };
  }
  if (rule.rule_kind === 'selected_tier_ids') {
    const ids = parseTierIds(rule.selected_tier_ids);
    return ids.length > 0 ? { kind: 'selected_tier_ids', tierIds: ids } : null;
  }
  return null;
}

function parseTierIds(value: unknown): string[] {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}
