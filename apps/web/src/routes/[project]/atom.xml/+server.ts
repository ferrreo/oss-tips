import type { RequestHandler } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { problem, publicBaseUrl } from '../../api/api-utils';
import { publicFeed } from '$lib/server/public-feed';

export const GET: RequestHandler = async ({ params, url }) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const feed = await publicFeed(getDb(), {
    projectSlug: params.project,
    baseUrl: publicBaseUrl(url),
    format: 'atom',
  });
  if (!feed) return problem(404, 'Project not found');
  return new Response(feed, {
    headers: {
      'content-type': 'application/atom+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
};
