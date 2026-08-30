import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

const publicPost = {
  id: 'public-post',
  slug: 'public-post',
  title: 'Public update',
  excerpt: 'Public details',
  body: 'Public details',
};

const gatedPost = {
  id: 'gated-post',
  slug: 'gated-post',
  title: 'Supporter update',
  excerpt: '',
  body: '',
};

function event(posts: readonly object[], slug: string) {
  return {
    params: { slug },
    parent: async () => ({ posts }),
  } as never;
}

describe('public post SSR visibility', () => {
  it('returns 404 when default-hidden gated metadata is absent', async () => {
    await expect(load(event([publicPost], 'gated-post'))).rejects.toMatchObject({ status: 404 });
  });

  it('serves metadata-only gated results without body content', async () => {
    await expect(load(event([gatedPost], 'gated-post'))).resolves.toMatchObject({
      post: gatedPost,
    });
  });

  it('keeps public post content available', async () => {
    await expect(load(event([publicPost], 'public-post'))).resolves.toMatchObject({
      post: publicPost,
    });
  });
});
