import { loadProjectPageData } from '$lib/server/page-data';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ params }) =>
  loadProjectPageData(params.project, { publicOnly: true });
