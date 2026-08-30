import { loadSupporterPageData } from '$lib/server/page-data';
import { requireAuthenticated } from '$lib/server/session';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = (event) => {
  const session = requireAuthenticated(event);
  return loadSupporterPageData(session.user.id);
};
