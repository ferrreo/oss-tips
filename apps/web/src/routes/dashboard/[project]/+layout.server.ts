import {
  loadProjectDashboardPageData,
  requireProjectPageCapability,
} from '$lib/server/page-data-access';
import { requireProjectMembership } from '$lib/server/session';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  const actor = requireProjectMembership(event, event.params.project);
  requireProjectPageCapability(actor, event.params.project, event.url.pathname);
  return loadProjectDashboardPageData(event.params.project, actor, event.url.pathname);
};
