import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
  const data = await parent();
  const draft = data.posts.find((post) => post.id === params.id || post.slug === params.id);
  if (!draft) throw error(404, 'Post not found');
  return { ...data, draft, recentPosts: data.posts };
};
