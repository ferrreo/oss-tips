import type { RequestHandler } from './$types';
import { renderSitemap, canonicalUrl, PUBLIC_SITEMAP_PATHS } from '$lib/seo';
import { loadPublicSitemapEntries } from '$lib/server/sitemap';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { publicBaseUrl } from '../api/api-utils';

export const GET: RequestHandler = async ({ url }) => {
  const baseUrl = publicBaseUrl(url);
  const entries = hasDatabaseUrl()
    ? await loadPublicSitemapEntries(getDb(), baseUrl)
    : PUBLIC_SITEMAP_PATHS.map((path) => ({ loc: canonicalUrl(baseUrl, path) }));
  return new Response(renderSitemap(entries), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=600',
    },
  });
};
