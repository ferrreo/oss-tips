import { checkProject } from '@oss-tips/auth';
import { presignPrivateAttachment } from '@oss-tips/storage';
import type { RequestHandler } from './$types';
import { problem } from '../../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { getStorage } from '$lib/server/storage';
import { json } from '$lib/server/http';
import { canAccessPrivatePostAttachment } from '$lib/server/private-post-access';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Return a short-lived private URL only after project-owner or entitlement checks. */
export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!UUID.test(event.params.id)) return problem(404, 'Attachment not found');

  const db = getDb();
  const variantName = event.url.searchParams.get('variant');
  if (variantName !== null && !['sm', 'md', 'lg'].includes(variantName)) {
    return problem(400, 'Invalid asset variant');
  }
  const asset = await db
    .selectFrom('object_asset')
    .select(['id', 'project_id', 'storage_key', 'content_type', 'byte_size', 'visibility'])
    .where('id', '=', event.params.id)
    .where('visibility', '=', 'private')
    .where('soft_deleted_at', 'is', null)
    .executeTakeFirst();
  if (!asset || asset.storage_key.startsWith('pending/')) {
    return problem(404, 'Attachment not found');
  }

  if (!asset.project_id) return problem(404, 'Attachment not found');
  const operator = event.locals.actor;
  const canManageProject = Boolean(
    operator && checkProject(operator, 'project.publish_posts', asset.project_id).allowed,
  );
  const attachments = await db
    .selectFrom('post_attachment')
    .innerJoin('post_revision', 'post_revision.id', 'post_attachment.post_revision_id')
    .innerJoin('post', 'post.id', 'post_revision.post_id')
    .innerJoin('project', 'project.id', 'post.project_id')
    .select([
      'post.id as post_id',
      'post_revision.id as post_revision_id',
      'post_revision.revision_number',
      'post.status as post_status',
      'project.status as project_status',
    ])
    .where('post_attachment.object_asset_id', '=', asset.id)
    .where('post.project_id', '=', asset.project_id)
    .execute();
  if (attachments.length === 0 && !canManageProject) return problem(404, 'Attachment not found');
  const latestRevisionByPost = new Map<string, string>();
  const postIds = [...new Set(attachments.map((attachment) => attachment.post_id))];
  if (postIds.length > 0) {
    const revisions = await db
      .selectFrom('post_revision')
      .select(['post_id', 'id', 'revision_number'])
      .where('post_id', 'in', postIds)
      .orderBy('revision_number', 'desc')
      .execute();
    for (const revision of revisions) {
      if (!latestRevisionByPost.has(revision.post_id)) {
        latestRevisionByPost.set(revision.post_id, revision.id);
      }
    }
  }
  const currentAttachments = attachments.filter(
    (attachment) => latestRevisionByPost.get(attachment.post_id) === attachment.post_revision_id,
  );
  const publishedPostIds = [
    ...new Set(
      currentAttachments
        .filter((item) => item.post_status === 'published' && item.project_status === 'published')
        .map((item) => item.post_id),
    ),
  ];
  if (publishedPostIds.length === 0 && !canManageProject) {
    return problem(404, 'Attachment not found');
  }
  const rules =
    publishedPostIds.length === 0
      ? []
      : await db
          .selectFrom('post_visibility_rule')
          .select(['post_id', 'rule_kind', 'minimum_tier_rank', 'selected_tier_ids'])
          .where('post_id', 'in', publishedPostIds)
          .execute();
  const rulesByPost = new Map<string, typeof rules>();
  for (const rule of rules)
    rulesByPost.set(rule.post_id, [...(rulesByPost.get(rule.post_id) ?? []), rule]);
  const publicPost =
    publishedPostIds.length > 0 &&
    publishedPostIds.every((postId) => {
      const postRules = rulesByPost.get(postId) ?? [];
      return postRules.length === 1 && postRules[0]?.rule_kind === 'public';
    });

  const session = event.locals.session;
  let entitled = canManageProject || publicPost;
  if (!entitled && session) {
    const entitlements = await db
      .selectFrom('entitlement')
      .select(['kind', 'tier_rank', 'tier_id', 'starts_at', 'ends_at', 'revoked_at'])
      .where('project_id', '=', asset.project_id)
      .where('user_id', '=', session.user.id)
      .execute();
    entitled =
      publishedPostIds.length > 0 &&
      publishedPostIds.every((postId) => {
        const postRules = rulesByPost.get(postId) ?? [];
        if (postRules.length !== 1) return false;
        if (postRules[0]?.rule_kind === 'public') return true;
        return canAccessPrivatePostAttachment({
          rule: postRules[0] ?? null,
          entitlements,
          now: new Date(),
        });
      });
  }
  if (!entitled) {
    return session
      ? problem(403, 'Private attachment access denied')
      : problem(401, 'Authentication required');
  }

  const variant =
    variantName === null
      ? null
      : await db
          .selectFrom('object_asset_variant')
          .select([
            'variant_name',
            'storage_key',
            'content_type',
            'byte_size',
            'width',
            'height',
            'visibility',
          ])
          .where('object_asset_id', '=', asset.id)
          .where('variant_name', '=', variantName as 'sm' | 'md' | 'lg')
          .where('visibility', '=', 'private')
          .executeTakeFirst();
  if (variantName !== null && !variant) return problem(404, 'Asset variant not found');

  let signed;
  try {
    signed = await presignPrivateAttachment(
      getStorage(),
      variant?.storage_key ?? asset.storage_key,
      () => true,
    );
  } catch {
    return problem(503, 'Storage unavailable', 'Private attachment signing failed');
  }
  if (event.url.searchParams.get('redirect') === '1') {
    return new Response(null, {
      status: 302,
      headers: {
        location: signed.url,
        'cache-control': 'private, no-store',
      },
    });
  }
  return json(
    {
      id: asset.id,
      url: signed.url,
      expires_at: signed.expiresAt,
      content_type: variant?.content_type ?? asset.content_type,
      content_length: Number(variant?.byte_size ?? asset.byte_size),
      ...(variant === undefined || variant === null
        ? {}
        : { width: variant.width, height: variant.height, variant: variant.variant_name }),
    },
    { headers: { 'cache-control': 'private, no-store' } },
  );
};
