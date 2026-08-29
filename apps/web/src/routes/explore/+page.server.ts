import { loadCatalogPageData } from '$lib/server/page-data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => loadCatalogPageData();
