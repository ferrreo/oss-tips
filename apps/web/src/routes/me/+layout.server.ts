import { loadSupporterPageData } from '$lib/server/page-data';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => loadSupporterPageData();
