export type SitemapEntry = {
  loc: string;
  lastmod?: string;
};

export const PUBLIC_SITEMAP_PATHS = [
  '/',
  '/explore',
  '/about',
  '/docs',
  '/pricing',
  '/security',
  '/transparency',
  '/terms',
  '/terms/privacy',
  '/terms/acceptable-use',
  '/terms/refunds',
  '/terms/cookies',
] as const;

/** Build an absolute canonical URL without carrying query strings or hashes. */
export function canonicalUrl(origin: string, pathname: string): string {
  const url = new URL(
    pathname.startsWith('/') ? pathname : `/${pathname}`,
    origin.endsWith('/') ? origin : `${origin}/`,
  );
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character] ?? character,
  );
}

export function renderRobots(baseUrl: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /dashboard',
    'Disallow: /me',
    'Disallow: /api/',
    'Disallow: /checkout',
    'Disallow: /claim/',
    'Disallow: /reply/',
    `Sitemap: ${canonicalUrl(baseUrl, '/sitemap.xml')}`,
    '',
  ].join('\n');
}

export function renderSitemap(entries: readonly SitemapEntry[]): string {
  const unique = new Map(entries.map((entry) => [entry.loc, entry]));
  const urls = [...unique.values()].map(
    (entry) =>
      `<url><loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''}</url>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
  ].join('');
}
