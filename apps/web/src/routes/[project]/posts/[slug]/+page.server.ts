import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
  const data = await parent();
  const post = data.posts.find((item) => item.slug === params.slug || item.id === params.slug);
  if (!post) throw error(404, 'Post not found');
  return { ...data, post };
};
