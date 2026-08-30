import { PostSummarySchema } from '@oss-tips/api-contracts';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { jsonWithEtag, problem } from '../../../../../api-utils';
import { toPostSummary } from '../../../../../public-api';
import { publicPostVisibility } from '$lib/server/public-posts';

export const GET: RequestHandler = async ({ params, request }) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!params.slug || !params.postSlug) return problem(400, 'Missing post path');

  const db = getDb();
  const post = await db
    .selectFrom('post')
    .innerJoin('project', 'project.id', 'post.project_id')
    .select([
      'post.id',
      'post.slug',
      'post.title',
      'post.published_at',
      'post.status',
      'project.public_show_gated_post_metadata',
    ])
    .where('project.slug', '=', params.slug)
    .where('project.status', '=', 'published')
    .where('post.slug', '=', params.postSlug)
    .where('post.status', '=', 'published')
    .executeTakeFirst();
  if (!post) return problem(404, 'Post not found');
  const visibility = await db
    .selectFrom('post_visibility_rule')
    .select(['id'])
    .where('post_id', '=', post.id)
    .where('rule_kind', '!=', 'public')
    .executeTakeFirst();
  const isGated = Boolean(visibility);
  if (publicPostVisibility(isGated, post.public_show_gated_post_metadata) === 'hidden') {
    return problem(404, 'Post not found');
  }
  const payload = PostSummarySchema.parse(toPostSummary(post, isGated));
  return jsonWithEtag(request, payload);
};
