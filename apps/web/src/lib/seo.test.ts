import { describe, expect, it } from 'vitest';
import { canonicalUrl, escapeXml, renderRobots, renderSitemap } from './seo';

describe('public SEO helpers', () => {
  it('builds canonical URLs without query or hash', () => {
    expect(canonicalUrl('https://oss.tips/', '/grove?utm_source=test#updates')).toBe(
      'https://oss.tips/grove',
    );
    expect(canonicalUrl('http://localhost:3000', 'explore')).toBe('http://localhost:3000/explore');
  });

  it('escapes XML sitemap values', () => {
    expect(escapeXml(`A & B <C> "D" 'E'`)).toBe('A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;');
    expect(renderSitemap([{ loc: 'https://oss.tips/a?x=1&y=2', lastmod: '2026-08-30' }])).toContain(
      '<loc>https://oss.tips/a?x=1&amp;y=2</loc><lastmod>2026-08-30</lastmod>',
    );
  });

  it('renders crawl rules and sitemap location', () => {
    expect(renderRobots('https://oss.tips')).toContain('Sitemap: https://oss.tips/sitemap.xml');
    expect(renderRobots('https://oss.tips')).toContain('Disallow: /dashboard');
  });
});
