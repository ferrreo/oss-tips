import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));
vi.mock('$lib/server/storage', () => ({ getStorage: vi.fn() }));
vi.mock('@oss-tips/auth', () => ({
  checkProject: vi.fn(() => ({ allowed: false })),
}));

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { getStorage } from '$lib/server/storage';
import { GET } from './+server';

const id = '11111111-1111-4111-8111-111111111111';
const asset = {
  id,
  project_id: 'project-1',
  storage_key:
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.txt',
  content_type: 'text/plain',
  byte_size: 4,
  visibility: 'private',
};

type Post = {
  post_id: string;
  post_revision_id: string;
  revision_number: number;
  post_status: string;
  project_status: string;
};
type Revision = { post_id: string; id: string; revision_number: number };
type Rule = {
  post_id: string;
  rule_kind: string;
  minimum_tier_rank: number | null;
  selected_tier_ids: unknown;
};
type Entitlement = {
  kind: string;
  tier_rank: number;
  tier_id: string | null;
  starts_at: Date;
  ends_at: Date | null;
  revoked_at: Date | null;
};

class FakeDb {
  constructor(
    private readonly posts: Post[],
    private readonly rules: Rule[],
    private readonly entitlements: Entitlement[] = [],
    private readonly revisions: Revision[] = posts.map(
      ({ post_id, post_revision_id, revision_number }) => ({
        post_id,
        id: post_revision_id,
        revision_number,
      }),
    ),
  ) {}

  selectFrom(table: string) {
    const query = {
      select: () => query,
      innerJoin: () => query,
      where: () => query,
      orderBy: () => query,
      executeTakeFirst: async () => (table === 'object_asset' ? asset : undefined),
      execute: async () => {
        if (table === 'post_attachment') return this.posts;
        if (table === 'post_revision') return this.revisions;
        if (table === 'post_visibility_rule') return this.rules;
        if (table === 'entitlement') return this.entitlements;
        return [];
      },
    };
    return query;
  }
}

function event(session?: { user: { id: string } }, redirect = false) {
  const url = new URL(`https://oss.tips/api/v1/assets/${id}/download`);
  if (redirect) url.searchParams.set('redirect', '1');
  return {
    request: new Request(url),
    url,
    params: { id },
    locals: { session },
  } as Parameters<typeof GET>[0];
}

function setup(
  posts: Post[],
  rules: Rule[],
  entitlements: Entitlement[] = [],
  revisions?: Revision[],
) {
  vi.mocked(getDb).mockReturnValue(new FakeDb(posts, rules, entitlements, revisions) as never);
  vi.mocked(getStorage).mockReturnValue({
    presignGet: vi.fn(async () => ({
      url: 'https://storage.example.test/signed',
      expiresAt: '2026-08-30T12:05:00.000Z',
      key: asset.storage_key,
      bucket: 'oss-private-content',
    })),
  } as never);
  vi.mocked(hasDatabaseUrl).mockReturnValue(true);
}

const published = {
  post_id: 'post-1',
  post_revision_id: 'revision-1',
  revision_number: 1,
  post_status: 'published',
  project_status: 'published',
};
const publicRule = {
  post_id: 'post-1',
  rule_kind: 'public',
  minimum_tier_rank: null,
  selected_tier_ids: null,
};
const gatedRule = {
  post_id: 'post-1',
  rule_kind: 'minimum_tier_rank',
  minimum_tier_rank: 2,
  selected_tier_ids: null,
};
const activeBacker = {
  kind: 'membership',
  tier_rank: 2,
  tier_id: 'backer',
  starts_at: new Date('2026-01-01T00:00:00.000Z'),
  ends_at: null,
  revoked_at: null,
};

describe('private attachment download visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs a private object for an anonymous reader only through a current public post', async () => {
    setup([published], [publicRule]);

    const response = await GET(event());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id, url: 'https://storage.example.test/signed' });
  });

  it('redirects an anonymous public-post attachment to its short-lived object URL', async () => {
    setup([published], [publicRule]);

    const response = await GET(event(undefined, true));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://storage.example.test/signed');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('does not redirect a gated attachment without an entitlement', async () => {
    setup([published], [gatedRule]);

    const response = await GET(event(undefined, true));

    expect(response.status).toBe(401);
  });

  it('fails closed when a private asset is reused by public and gated posts', async () => {
    setup(
      [published, { ...published, post_id: 'post-2', post_revision_id: 'revision-2' }],
      [publicRule, { ...gatedRule, post_id: 'post-2' }],
    );

    expect((await GET(event(undefined, true))).status).toBe(401);
    expect((await GET(event({ user: { id: 'supporter-1' } }))).status).toBe(403);

    setup(
      [published, { ...published, post_id: 'post-2', post_revision_id: 'revision-2' }],
      [publicRule, { ...gatedRule, post_id: 'post-2' }],
      [activeBacker],
    );
    expect((await GET(event({ user: { id: 'supporter-1' } }))).status).toBe(200);
  });

  it('evaluates visibility from the current post revision', async () => {
    setup(
      [published],
      [gatedRule],
      [],
      [{ post_id: 'post-1', id: 'revision-2', revision_number: 2 }],
    );

    expect((await GET(event())).status).toBe(404);
  });

  it('requires entitlement for a gated published post', async () => {
    setup([published], [gatedRule]);

    expect((await GET(event())).status).toBe(401);
    expect((await GET(event({ user: { id: 'supporter-1' } }))).status).toBe(403);

    setup([published], [gatedRule], [activeBacker]);
    expect((await GET(event({ user: { id: 'supporter-1' } }))).status).toBe(200);
  });

  it('does not expose an attachment from a draft or unpublished project', async () => {
    setup([{ ...published, post_status: 'draft' }], [publicRule]);
    expect((await GET(event())).status).toBe(404);

    setup([{ ...published, project_status: 'draft' }], [publicRule]);
    expect((await GET(event())).status).toBe(404);
  });
});
