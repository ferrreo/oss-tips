import type { Db } from '@oss-tips/db';

export type FeedPost = {
  slug: string;
  title: string;
  body: string;
  publishedAt: Date;
};

export function selectPublicFeedPosts<T extends { id: string }>(
  posts: T[],
  gatedIds: ReadonlySet<string>,
): T[] {
  return posts.filter((post) => !gatedIds.has(post.id));
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function excerpt(body: string): string {
  const text = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_>`~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 240 ? `${text.slice(0, 237).trimEnd()}…` : text;
}

export function renderPublicFeed(args: {
  format: 'rss' | 'atom';
  title: string;
  description: string;
  baseUrl: string;
  projectSlug: string;
  posts: FeedPost[];
}): string {
  const projectUrl = `${args.baseUrl}/${args.projectSlug}`;
  const items = args.posts
    .map((post) => {
      const url = `${projectUrl}/posts/${post.slug}`;
      const summary = excerpt(post.body);
      return args.format === 'rss'
        ? `<item><title>${xml(post.title)}</title><link>${xml(url)}</link><guid isPermaLink="true">${xml(url)}</guid><pubDate>${post.publishedAt.toUTCString()}</pubDate><description>${xml(summary)}</description></item>`
        : `<entry><title>${xml(post.title)}</title><id>${xml(url)}</id><link href="${xml(url)}"/><updated>${post.publishedAt.toISOString()}</updated><summary>${xml(summary)}</summary></entry>`;
    })
    .join('');
  if (args.format === 'rss') {
    return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(args.title)}</title><link>${xml(projectUrl)}</link><description>${xml(args.description || args.title)}</description>${items}</channel></rss>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${xml(args.title)}</title><id>${xml(projectUrl)}</id><link href="${xml(projectUrl)}"/><updated>${(args.posts[0]?.publishedAt ?? new Date(0)).toISOString()}</updated><subtitle>${xml(args.description || args.title)}</subtitle>${items}</feed>`;
}

export async function publicFeed(
  db: Db,
  args: { projectSlug: string; baseUrl: string; format: 'rss' | 'atom' },
): Promise<string | null> {
  const project = await db
    .selectFrom('project')
    .select(['id', 'name', 'description'])
    .where('slug', '=', args.projectSlug)
    .where('status', '=', 'published')
    .executeTakeFirst();
  if (!project) return null;
  const posts = await db
    .selectFrom('post')
    .select(['id', 'slug', 'title', 'published_at'])
    .where('project_id', '=', project.id)
    .where('status', '=', 'published')
    .where('published_at', 'is not', null)
    .orderBy('published_at', 'desc')
    .limit(50)
    .execute();
  const publicPosts = posts.length
    ? new Set(
        (
          await db
            .selectFrom('post_visibility_rule')
            .select('post_id')
            .where(
              'post_id',
              'in',
              posts.map((post) => post.id),
            )
            .where('rule_kind', '!=', 'public')
            .execute()
        ).map((row) => row.post_id),
      )
    : new Set<string>();
  const revisions = posts.length
    ? await db
        .selectFrom('post_revision')
        .select(['post_id', 'body_markdown', 'revision_number'])
        .where(
          'post_id',
          'in',
          posts.map((post) => post.id),
        )
        .orderBy('revision_number', 'desc')
        .execute()
    : [];
  const latest = new Map<string, string>();
  for (const revision of revisions)
    if (!latest.has(revision.post_id)) latest.set(revision.post_id, revision.body_markdown);
  return renderPublicFeed({
    format: args.format,
    title: project.name,
    description: project.description ?? '',
    baseUrl: args.baseUrl,
    projectSlug: args.projectSlug,
    posts: selectPublicFeedPosts(
      posts.filter((post): post is typeof post & { published_at: Date } =>
        Boolean(post.published_at),
      ),
      publicPosts,
    ).map((post) => ({
      slug: post.slug,
      title: post.title,
      body: latest.get(post.id) ?? '',
      publishedAt: post.published_at as Date,
    })),
  });
}
