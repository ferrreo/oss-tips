import type { Post } from '@oss-tips/ui/fixtures/demo.js';
import type { PageServerLoad } from './$types';

const emptyDraft: Post = {
  id: '',
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  publishedAt: '',
  publishedLabel: 'Draft',
  tierVisibility: 'Public',
  author: '',
};

export const load: PageServerLoad = async ({ parent }) => {
  const data = await parent();
  return { ...data, draft: emptyDraft, recentPosts: data.posts };
};
