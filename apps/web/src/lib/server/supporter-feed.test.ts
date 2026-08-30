import { describe, expect, it } from 'vitest';
import type { EntitlementSnapshot } from '@oss-tips/domain';
import {
  activeSupporterEntitlements,
  buildSupporterFeed,
  normalizeSupporterFeedRule,
  type SupporterFeedPostRow,
} from './supporter-feed';

const now = new Date('2026-08-30T12:00:00.000Z');
const entitlement: EntitlementSnapshot = {
  kind: 'membership',
  tierRank: 1,
  tierId: 'tier-1',
  startsAt: new Date('2026-08-01T00:00:00.000Z'),
  endsAt: null,
  revokedAt: null,
};

function post(overrides: Partial<SupporterFeedPostRow> = {}): SupporterFeedPostRow {
  return {
    id: 'post-1',
    project_id: 'project-1',
    slug: 'update',
    title: 'Update',
    published_at: new Date('2026-08-30T10:00:00.000Z'),
    status: 'published',
    project_status: 'published',
    project_slug: 'project',
    project_name: 'Project',
    ...overrides,
  };
}

const publicRule = {
  post_id: 'post-1',
  rule_kind: 'public',
  minimum_tier_rank: null,
  selected_tier_ids: null,
};

describe('supporter feed visibility', () => {
  it('derives project scope from current entitlements only', () => {
    const projects = activeSupporterEntitlements(
      [
        {
          project_id: 'active',
          kind: 'membership',
          tier_rank: 1,
          tier_id: 'tier-1',
          starts_at: new Date('2026-08-01T00:00:00.000Z'),
          ends_at: null,
          revoked_at: null,
        },
        {
          project_id: 'expired',
          kind: 'one_off',
          tier_rank: 1,
          tier_id: 'tier-1',
          starts_at: new Date('2026-07-01T00:00:00.000Z'),
          ends_at: new Date('2026-08-01T00:00:00.000Z'),
          revoked_at: null,
        },
        {
          project_id: 'revoked',
          kind: 'membership',
          tier_rank: 1,
          tier_id: 'tier-1',
          starts_at: new Date('2026-08-01T00:00:00.000Z'),
          ends_at: null,
          revoked_at: new Date('2026-08-15T00:00:00.000Z'),
        },
      ],
      now,
    );
    expect([...projects.keys()]).toEqual(['active']);
  });

  it('fails closed for duplicate public visibility rows', () => {
    expect(normalizeSupporterFeedRule([publicRule, publicRule])).toBeNull();
  });

  it('only includes published posts from projects with active entitlements', () => {
    expect(normalizeSupporterFeedRule([publicRule])).toMatchObject({
      rule: { kind: 'public' },
      gated: false,
    });
    const posts = [
      post(),
      post({ id: 'unsupported', project_id: 'project-2' }),
      post({ id: 'unpublished-project', project_status: 'closed' }),
      post({ id: 'gated', title: 'Gated update' }),
      post({ id: 'duplicate-rule', title: 'Malformed update' }),
    ];
    const rules = [
      publicRule,
      { ...publicRule, post_id: 'unsupported' },
      { ...publicRule, post_id: 'unpublished-project' },
      {
        ...publicRule,
        post_id: 'gated',
        rule_kind: 'minimum_tier_rank',
        minimum_tier_rank: 1,
      },
      { ...publicRule, post_id: 'duplicate-rule' },
      { ...publicRule, post_id: 'duplicate-rule' },
    ];
    const feed = buildSupporterFeed({
      posts,
      revisions: [
        { post_id: 'post-1', body_markdown: 'Public body', revision_number: 1 },
        { post_id: 'gated', body_markdown: 'Gated body', revision_number: 1 },
      ],
      rules,
      attachments: [],
      entitlementsByProject: new Map([['project-1', [entitlement]]]),
      now,
    });

    expect(feed.map((item) => item.id)).toEqual(['post-1', 'gated']);
    expect(feed.find((item) => item.id === 'gated')).toMatchObject({
      gated: true,
      body: 'Gated body',
    });
  });
});
