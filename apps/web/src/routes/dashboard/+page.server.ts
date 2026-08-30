import { requireAuthenticated } from '$lib/server/session';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
  requireAuthenticated(event);
  return {};
};
