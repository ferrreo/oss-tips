import type { PageServerLoad } from './$types';
import { loadTransparencyPageData } from '$lib/server/page-data';

export const load: PageServerLoad = () => loadTransparencyPageData();
