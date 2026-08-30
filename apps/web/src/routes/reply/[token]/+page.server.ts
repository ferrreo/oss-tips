import type { PageServerLoad } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { loadGuestReplyPage } from '$lib/server/guest-access';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!hasDatabaseUrl()) {
    return {
      accessState: 'unavailable' as const,
      project: null,
      thread: null,
      expires: '',
    };
  }
  return loadGuestReplyPage(getDb(), params.token);
};
