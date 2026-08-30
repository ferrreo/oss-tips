import { PostSummarySchema } from '@oss-tips/api-contracts';
import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { jsonWithEtag, problem } from '../../../../api-utils';
import { toPostSummary } from '../../../../public-api';
import { publicPostVisibility } from '$lib/server/public-posts';

export const GET: RequestHandler = async ({ params, request }) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  if (!params.slug) return problem(400, 'Missing project slug');

  const db = getDb();
  const project = await db
    .selectFrom('project')
    .select(['id', 'public_show_gated_post_metadata'])
    .where('slug', '=', params.slug)
    .where('status', '=', 'published')
    .executeTakeFirst();
  if (!project) return problem(404, 'Project not found');
  const posts = await db
    .selectFrom('post')
    .select(['id', 'slug', 'title', 'published_at', 'status'])
    .where('project_id', '=', project.id)
    .where('status', '=', 'published')
    .orderBy('published_at', 'desc')
    .execute();
  const gated = posts.length
    ? new Set(
        (
          await db
            .selectFrom('post_visibility_rule')
            .select(['post_id'])
            .where(
              'post_id',
              'in',
              posts.map((post) => post.id),
            )
            .where('rule_kind', '!=', 'public')
            .execute()
        ).map((row) => row.post_id),
      )
    : new Set<string>();
  const payload = posts.flatMap((post) => {
    const isGated = gated.has(post.id);
    if (publicPostVisibility(isGated, project.public_show_gated_post_metadata) === 'hidden') {
      return [];
    }
    return [PostSummarySchema.parse(toPostSummary(post, isGated))];
  });
  return jsonWithEtag(request, payload);
};
