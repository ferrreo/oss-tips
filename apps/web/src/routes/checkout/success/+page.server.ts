import { loadCheckoutSuccessPageData } from '$lib/server/page-data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) =>
  loadCheckoutSuccessPageData(url.searchParams.get('payment_id'));
