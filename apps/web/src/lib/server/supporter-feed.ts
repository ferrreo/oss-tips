import {
  canViewContent,
  isEntitlementActive,
  type EntitlementSnapshot,
  type VisibilityRule,
} from '@oss-tips/domain';
import type { Db } from '@oss-tips/db';
import type { SupporterFeedPost } from '@oss-tips/ui/pages/supporter/SupporterFeedPage.svelte';
import { isPendingStorageKey } from './storage';
import { toVisibilityRule, type StoredVisibilityRule } from './private-post-access';

export type SupporterFeedPostRow = {
  id: string;
  project_id: string;
  slug: string;
  title: string;
  published_at: Date | null;
  status: string;
  project_status: string;
  project_slug: string;
  project_name: string;
};

export type SupporterFeedRevisionRow = {
  post_id: string;
  body_markdown: string;
  revision_number: number;
};

export type SupporterFeedRuleRow = StoredVisibilityRule & { post_id: string };

export type SupporterFeedAttachmentRow = {
  post_id: string;
  revision_number: number;
  id: string;
  object_asset_id: string;
  sort_order: number;
  content_type: string;
  byte_size: string | number | bigint;
  storage_key: string;
};

export type SupporterFeedEntitlementRow = {
  project_id: string;
  kind: string;
  tier_rank: number;
  tier_id: string | null;
  starts_at: Date;
  ends_at: Date | null;
  revoked_at: Date | null;
};

export function activeSupporterEntitlements(
  rows: readonly SupporterFeedEntitlementRow[],
  now: Date,
): Map<string, EntitlementSnapshot[]> {
  const entitlementsByProject = new Map<string, EntitlementSnapshot[]>();
  for (const row of rows) {
    if (row.kind !== 'membership' && row.kind !== 'one_off') continue;
    const entitlement: EntitlementSnapshot = {
      kind: row.kind,
      tierRank: row.tier_rank,
      tierId: row.tier_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      revokedAt: row.revoked_at,
    };
    if (!isEntitlementActive(entitlement, now)) continue;
    entitlementsByProject.set(row.project_id, [
      ...(entitlementsByProject.get(row.project_id) ?? []),
      entitlement,
    ]);
  }
  return entitlementsByProject;
}

export function normalizeSupporterFeedRule(
  rows: readonly StoredVisibilityRule[],
): { rule: VisibilityRule; gated: boolean } | null {
  if (rows.length === 0) return { rule: { kind: 'public' }, gated: false };
  if (rows.length !== 1) return null;
  if (rows[0]?.rule_kind === 'public') {
    return rows[0].minimum_tier_rank === null && rows[0].selected_tier_ids === null
      ? { rule: { kind: 'public' }, gated: false }
      : null;
  }
  const rule = toVisibilityRule(rows[0] ?? null);
  return rule ? { rule, gated: rule.kind !== 'public' } : null;
}

export function buildSupporterFeed(input: {
  posts: readonly SupporterFeedPostRow[];
  revisions: readonly SupporterFeedRevisionRow[];
  rules: readonly SupporterFeedRuleRow[];
  attachments: readonly SupporterFeedAttachmentRow[];
  entitlementsByProject: ReadonlyMap<string, readonly EntitlementSnapshot[]>;
  now: Date;
}): SupporterFeedPost[] {
  const revisions = new Map<string, SupporterFeedRevisionRow>();
  for (const revision of input.revisions) {
    const current = revisions.get(revision.post_id);
    if (!current || revision.revision_number > current.revision_number) {
      revisions.set(revision.post_id, revision);
    }
  }

  const rules = new Map<string, SupporterFeedRuleRow[]>();
  for (const rule of input.rules) {
    rules.set(rule.post_id, [...(rules.get(rule.post_id) ?? []), rule]);
  }

  return input.posts.flatMap((post) => {
    if (
      post.status !== 'published' ||
      post.project_status !== 'published' ||
      !input.entitlementsByProject.has(post.project_id)
    ) {
      return [];
    }
    const visibility = normalizeSupporterFeedRule(rules.get(post.id) ?? []);
    if (!visibility) return [];
    const activeEntitlements = input.entitlementsByProject.get(post.project_id) ?? [];
    if (
      !canViewContent({
        rule: visibility.rule,
        signedIn: true,
        activeEntitlements,
        now: input.now,
      })
    ) {
      return [];
    }

    const revision = revisions.get(post.id);
    const attachments = input.attachments
      .filter(
        (attachment) =>
          attachment.post_id === post.id &&
          attachment.revision_number === revision?.revision_number &&
          !isPendingStorageKey(attachment.storage_key),
      )
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((attachment) => ({
        id: attachment.id,
        asset_id: attachment.object_asset_id,
        content_type: attachment.content_type,
        content_length: Number(attachment.byte_size),
        download_url: `/api/v1/assets/${encodeURIComponent(attachment.object_asset_id)}/download?redirect=1`,
      }));

    return [
      {
        id: post.id,
        project_id: post.project_id,
        project_slug: post.project_slug,
        project_name: post.project_name,
        slug: post.slug,
        title: post.title,
        published_at: post.published_at?.toISOString() ?? null,
        gated: visibility.gated,
        body: revision?.body_markdown ?? '',
        attachments,
      },
    ];
  });
}

export async function loadSupporterFeed(db: Db, userId: string): Promise<SupporterFeedPost[]> {
  const now = new Date();
  const entitlementRows = await db
    .selectFrom('entitlement')
    .select(['project_id', 'kind', 'tier_rank', 'tier_id', 'starts_at', 'ends_at', 'revoked_at'])
    .where('user_id', '=', userId)
    .execute();
  const entitlementsByProject = activeSupporterEntitlements(entitlementRows, now);
  const projectIds = [...entitlementsByProject.keys()];
  if (projectIds.length === 0) return [];

  const posts = (await db
    .selectFrom('post')
    .innerJoin('project', 'project.id', 'post.project_id')
    .select([
      'post.id',
      'post.project_id',
      'post.slug',
      'post.title',
      'post.published_at',
      'post.status',
      'project.status as project_status',
      'project.slug as project_slug',
      'project.name as project_name',
    ])
    .where('post.project_id', 'in', projectIds)
    .where('post.status', '=', 'published')
    .where('project.status', '=', 'published')
    .orderBy('post.published_at', 'desc')
    .limit(100)
    .execute()) as SupporterFeedPostRow[];
  if (posts.length === 0) return [];

  const postIds = posts.map((post) => post.id);
  const [revisions, rules, attachments] = await Promise.all([
    db
      .selectFrom('post_revision')
      .select(['post_id', 'body_markdown', 'revision_number'])
      .where('post_id', 'in', postIds)
      .orderBy('revision_number', 'desc')
      .execute() as Promise<SupporterFeedRevisionRow[]>,
    db
      .selectFrom('post_visibility_rule')
      .select(['post_id', 'rule_kind', 'minimum_tier_rank', 'selected_tier_ids'])
      .where('post_id', 'in', postIds)
      .execute() as Promise<SupporterFeedRuleRow[]>,
    db
      .selectFrom('post_attachment')
      .innerJoin('post_revision', 'post_revision.id', 'post_attachment.post_revision_id')
      .innerJoin('object_asset', 'object_asset.id', 'post_attachment.object_asset_id')
      .select([
        'post_revision.post_id',
        'post_revision.revision_number',
        'post_attachment.id',
        'post_attachment.object_asset_id',
        'post_attachment.sort_order',
        'object_asset.content_type',
        'object_asset.byte_size',
        'object_asset.storage_key',
      ])
      .where('post_revision.post_id', 'in', postIds)
      .where('object_asset.soft_deleted_at', 'is', null)
      .where('object_asset.visibility', '=', 'private')
      .execute() as Promise<SupporterFeedAttachmentRow[]>,
  ]);

  return buildSupporterFeed({
    posts,
    revisions,
    rules,
    attachments,
    entitlementsByProject,
    now,
  });
}
