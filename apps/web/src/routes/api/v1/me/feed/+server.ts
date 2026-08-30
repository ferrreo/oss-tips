import type { RequestHandler } from './$types';
import { requireSession, problem } from '../../../api-utils';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { loadSupporterFeed } from '$lib/server/supporter-feed';
import { json } from '$lib/server/http';

/** Return published posts visible to the current supporter, with gated asset handles. */
export const GET: RequestHandler = async (event) => {
  if (!hasDatabaseUrl()) return problem(503, 'Database unavailable', 'DATABASE_URL is required');
  const session = requireSession(event);
  if (session instanceof Response) return session;
  try {
    const feed = await loadSupporterFeed(getDb(), session.userId);
    return json(feed, { headers: { 'cache-control': 'private, no-store' } });
  } catch (cause) {
    console.error('[supporter-feed] Failed to load feed', cause);
    return problem(503, 'Feed unavailable', 'The supporter feed is temporarily unavailable');
  }
};
