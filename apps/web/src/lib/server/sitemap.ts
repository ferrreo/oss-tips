import type { Db } from '@oss-tips/db';
import { canonicalUrl, PUBLIC_SITEMAP_PATHS, type SitemapEntry } from '$lib/seo';

type DateValue = Date | string | null | undefined;

function lastmod(value: DateValue): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

/** Read only public, published content for the canonical sitemap. */
export async function loadPublicSitemapEntries(db: Db, baseUrl: string): Promise<SitemapEntry[]> {
  const projects = await db
    .selectFrom('project')
    .select(['id', 'slug', 'updated_at'])
    .where('status', '=', 'published')
    .orderBy('updated_at', 'desc')
    .execute();
  const projectIds = projects.map((project) => project.id);
  if (projectIds.length === 0) {
    return PUBLIC_SITEMAP_PATHS.map((path) => ({ loc: canonicalUrl(baseUrl, path) }));
  }

  const [posts, goals] = await Promise.all([
    db
      .selectFrom('post')
      .select(['id', 'project_id', 'slug', 'published_at', 'updated_at'])
      .where('project_id', 'in', projectIds)
      .where('status', '=', 'published')
      .where('published_at', 'is not', null)
      .orderBy('published_at', 'desc')
      .execute(),
    db
      .selectFrom('project_goal')
      .select(['id', 'project_id', 'updated_at'])
      .where('project_id', 'in', projectIds)
      .where('is_active', '=', true)
      .where('status', '=', 'published')
      .orderBy('updated_at', 'desc')
      .execute(),
  ]);
  const gatedPostIds = posts.length
    ? new Set(
        (
          await db
            .selectFrom('post_visibility_rule')
            .select(['post_id', 'rule_kind'])
            .where(
              'post_id',
              'in',
              posts.map((post) => post.id),
            )
            .execute()
        )
          .filter((rule) => rule.rule_kind !== 'public')
          .map((rule) => rule.post_id),
      )
    : new Set<string>();
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const entries: SitemapEntry[] = PUBLIC_SITEMAP_PATHS.map((path) => ({
    loc: canonicalUrl(baseUrl, path),
  }));

  for (const project of projects) {
    entries.push({
      loc: canonicalUrl(baseUrl, `/${project.slug}`),
      lastmod: lastmod(project.updated_at),
    });
  }
  for (const post of posts) {
    if (gatedPostIds.has(post.id)) continue;
    const project = projectById.get(post.project_id);
    if (!project) continue;
    entries.push({
      loc: canonicalUrl(baseUrl, `/${project.slug}/posts/${post.slug}`),
      lastmod: lastmod(post.updated_at ?? post.published_at),
    });
  }
  for (const goal of goals) {
    const project = projectById.get(goal.project_id);
    if (!project) continue;
    entries.push({
      loc: canonicalUrl(baseUrl, `/${project.slug}/goals/${goal.id}`),
      lastmod: lastmod(goal.updated_at),
    });
  }
  return entries;
}
