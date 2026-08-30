import type { PageServerLoad } from './$types';
import { isDemoMode } from '$lib/server/page-data';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { loadSupporterFeed } from '$lib/server/supporter-feed';
import { requireAuthenticated } from '$lib/server/session';
import { supporterFeed } from '@oss-tips/ui/pages/supporter/supporter-demo.js';

export const load: PageServerLoad = async (event) => {
  event.setHeaders({ 'cache-control': 'private, no-store' });
  const session = requireAuthenticated(event);
  if (isDemoMode()) return { feed: supporterFeed };
  if (!hasDatabaseUrl()) return { feed: [], feedError: true as const };
  try {
    return { feed: await loadSupporterFeed(getDb(), session.user.id) };
  } catch (cause) {
    console.error('[supporter-feed] Failed to load page feed', cause);
    return { feed: [], feedError: true as const };
  }
};
