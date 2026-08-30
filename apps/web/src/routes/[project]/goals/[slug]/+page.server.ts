import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
  const data = await parent();
  const goal = data.goals.find((item) => item.slug === params.slug || item.id === params.slug);
  if (!goal) throw error(404, 'Goal not found');
  return { ...data, goal };
};
