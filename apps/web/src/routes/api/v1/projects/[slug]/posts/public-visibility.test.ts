import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { GET as listPosts } from './+server';
import { GET as readPost } from './[postSlug]/+server';

const publicPostId = '11111111-1111-7111-8111-111111111111';
const gatedPostId = '22222222-2222-7222-8222-222222222222';

type FakePost = {
  id: string;
  slug: string;
  title: string;
  published_at: Date;
  status: 'published';
};

class FakeDb {
  showGatedMetadata = false;
  posts: FakePost[] = [
    {
      id: publicPostId,
      slug: 'public-update',
      title: 'Public update',
      published_at: new Date('2026-08-29T12:00:00Z'),
      status: 'published',
    },
    {
      id: gatedPostId,
      slug: 'supporter-update',
      title: 'Supporter update',
      published_at: new Date('2026-08-28T12:00:00Z'),
      status: 'published',
    },
  ];

  selectFrom(table: string): any {
    const query: any = {
      select: () => query,
      innerJoin: () => query,
      where: () => query,
      orderBy: () => query,
      execute: async () =>
        table === 'post'
          ? this.posts
          : table === 'post_visibility_rule'
            ? [{ post_id: gatedPostId, id: 'rule-1' }]
            : [],
      executeTakeFirst: async () => {
        if (table === 'project') {
          return {
            id: 'project-1',
            public_show_gated_post_metadata: this.showGatedMetadata,
          };
        }
        if (table === 'post') {
          const post = this.posts[1];
          return post
            ? { ...post, public_show_gated_post_metadata: this.showGatedMetadata }
            : undefined;
        }
        return { id: 'rule-1' };
      },
    };
    return query;
  }
}

function event(slug: string, postSlug?: string) {
  const path = postSlug
    ? `/api/v1/projects/${slug}/posts/${postSlug}`
    : `/api/v1/projects/${slug}/posts`;
  return {
    params: { slug, ...(postSlug ? { postSlug } : {}) },
    request: new Request(`https://oss.tips${path}`),
  } as never;
}

describe('anonymous public post visibility', () => {
  beforeEach(() => {
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
  });

  it('hides gated posts by default while keeping public summaries unchanged', async () => {
    const db = new FakeDb();
    vi.mocked(getDb).mockReturnValue(db as never);

    const listResponse = await listPosts(event('grove'));
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual([
      {
        id: publicPostId,
        slug: 'public-update',
        title: 'Public update',
        published_at: '2026-08-29T12:00:00.000Z',
        gated: false,
      },
    ]);

    const detailResponse = await readPost(event('grove', 'supporter-update'));
    expect(detailResponse.status).toBe(404);
  });

  it('returns opted-in gated metadata without a body', async () => {
    const db = new FakeDb();
    db.showGatedMetadata = true;
    vi.mocked(getDb).mockReturnValue(db as never);

    const listResponse = await listPosts(event('grove'));
    await expect(listResponse.json()).resolves.toEqual([
      {
        id: publicPostId,
        slug: 'public-update',
        title: 'Public update',
        published_at: '2026-08-29T12:00:00.000Z',
        gated: false,
      },
      {
        id: gatedPostId,
        slug: 'supporter-update',
        title: 'Supporter update',
        published_at: '2026-08-28T12:00:00.000Z',
        gated: true,
      },
    ]);

    const detailResponse = await readPost(event('grove', 'supporter-update'));
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json();
    expect(detail).toMatchObject({ id: gatedPostId, title: 'Supporter update', gated: true });
    expect(detail).not.toHaveProperty('body');
  });
});
