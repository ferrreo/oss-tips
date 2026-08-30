import { describe, expect, it } from 'vitest';
import { renderPublicFeed, selectPublicFeedPosts } from './public-feed';

describe('public post feeds', () => {
  it('renders escaped RSS excerpts and Atom links', () => {
    const posts = [
      {
        slug: 'release',
        title: 'A & B',
        body: '# Ready <now>',
        publishedAt: new Date('2026-08-30T10:00:00Z'),
      },
    ];
    const rss = renderPublicFeed({
      format: 'rss',
      title: 'Project',
      description: '',
      baseUrl: 'https://oss.tips',
      projectSlug: 'demo',
      posts,
    });
    const atom = renderPublicFeed({
      format: 'atom',
      title: 'Project',
      description: '',
      baseUrl: 'https://oss.tips',
      projectSlug: 'demo',
      posts,
    });
    expect(rss).toContain('<title>A &amp; B</title>');
    expect(rss).toContain('Ready &lt;now');
    expect(atom).toContain('<link href="https://oss.tips/demo/posts/release"/>');
  });

  it('leaves gated posts out of public feeds', () => {
    const posts = [
      { id: 'public', slug: 'public', title: 'Public', body: '', publishedAt: new Date() },
      { id: 'private', slug: 'private', title: 'Private', body: '', publishedAt: new Date() },
    ];
    expect(selectPublicFeedPosts(posts, new Set(['private'])).map((post) => post.id)).toEqual([
      'public',
    ]);
  });
});
