import {
  loadAdminDashboardPageData,
  requireAdminPageCapability,
} from '$lib/server/page-data-access';
import { requirePlatformMembership } from '$lib/server/session';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  const actor = requirePlatformMembership(event);
  requireAdminPageCapability(actor, event.url.pathname);
  return loadAdminDashboardPageData(actor);
};
