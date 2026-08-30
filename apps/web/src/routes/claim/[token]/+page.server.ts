import type { PageServerLoad } from './$types';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { loadGuestClaimPage } from '$lib/server/guest-access';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!hasDatabaseUrl()) {
    return {
      accessState: 'unavailable' as const,
      project: null,
      amountMinor: 0,
      cadence: 'one-off',
      reference: '',
      expires: '',
    };
  }
  return loadGuestClaimPage(getDb(), params.token);
};
