import { describe, expect, it } from 'vitest';
import { canAccessPrivatePostAttachment } from './private-post-access';

const now = new Date('2026-08-29T12:00:00.000Z');
const entitlement = (
  overrides: Partial<
    Parameters<typeof canAccessPrivatePostAttachment>[0]['entitlements'][number]
  > = {},
) => ({
  kind: 'membership',
  tier_rank: 2,
  tier_id: 'backer',
  starts_at: new Date('2026-01-01T00:00:00.000Z'),
  ends_at: null,
  revoked_at: null,
  ...overrides,
});

describe('private post attachment access', () => {
  it('requires an attachment relation and a supported visibility rule', () => {
    expect(canAccessPrivatePostAttachment({ rule: null, entitlements: [entitlement()], now })).toBe(
      false,
    );
    expect(
      canAccessPrivatePostAttachment({
        rule: { rule_kind: 'public', minimum_tier_rank: null, selected_tier_ids: null },
        entitlements: [entitlement()],
        now,
      }),
    ).toBe(false);
  });

  it('rejects stale, revoked, and lower-tier entitlements', () => {
    const rule = { rule_kind: 'minimum_tier_rank', minimum_tier_rank: 2, selected_tier_ids: null };
    expect(
      canAccessPrivatePostAttachment({ rule, entitlements: [entitlement({ tier_rank: 1 })], now }),
    ).toBe(false);
    expect(
      canAccessPrivatePostAttachment({
        rule,
        entitlements: [entitlement({ ends_at: new Date('2026-08-28T12:00:00.000Z') })],
        now,
      }),
    ).toBe(false);
    expect(
      canAccessPrivatePostAttachment({
        rule,
        entitlements: [entitlement({ revoked_at: new Date('2026-08-28T12:00:00.000Z') })],
        now,
      }),
    ).toBe(false);
    expect(canAccessPrivatePostAttachment({ rule, entitlements: [entitlement()], now })).toBe(true);
  });

  it('matches selected tier IDs without accepting a different tier rank', () => {
    const rule = {
      rule_kind: 'selected_tier_ids',
      minimum_tier_rank: null,
      selected_tier_ids: ['supporter'],
    };
    expect(
      canAccessPrivatePostAttachment({
        rule,
        entitlements: [entitlement({ tier_rank: 4, tier_id: 'backer' })],
        now,
      }),
    ).toBe(false);
    expect(
      canAccessPrivatePostAttachment({
        rule,
        entitlements: [entitlement({ tier_rank: 1, tier_id: 'supporter' })],
        now,
      }),
    ).toBe(true);
  });
});
