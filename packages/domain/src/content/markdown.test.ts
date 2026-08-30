import { describe, expect, it } from 'vitest';
import {
  normalizeMarkdown,
  parseMarkdown,
  parseSafeEmbed,
  renderSafeMarkdown,
  serializeMarkdown,
} from './markdown.js';

describe('post markdown', () => {
  it('normalizes line endings without changing markdown constructs', () => {
    const fixture = '# Update\r\n\r\n- **ship**\r\n- `safe`\r\n';
    expect(normalizeMarkdown(fixture)).toBe('# Update\n\n- **ship**\n- `safe`\n');
  });

  it('renders common post constructs and keeps source HTML inert', () => {
    const html = renderSafeMarkdown(
      '# Release\n\n> Read **this** [guide](/docs).\n\n- [x] shipped\n- [ ] next\n\n```ts\nconst value = "<safe>";\n```\n\n<table><img src=x onerror=alert(1)></table>',
    );

    expect(html).toContain('<h1>Release</h1>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<strong>this</strong>');
    expect(html).toContain('<a href="/docs"');
    expect(html).toContain('type="checkbox" disabled aria-label="Completed task" checked');
    expect(html).toContain('aria-label="Incomplete task"');
    expect(html).toContain('<pre><code class="language-ts">');
    expect(html).toContain('&lt;table&gt;');
    expect(html).not.toContain('<table><img');
  });

  it('rejects executable links, unsafe images, and event-handler markup', () => {
    const html = renderSafeMarkdown(
      '[run](javascript:alert(1)) ![x](data:text/html,<svg onload=alert(1)>) <img src=x onerror=alert(1)> <script>alert(1)</script>',
    );

    expect(html).not.toMatch(/href\s*=\s*"javascript:/i);
    expect(html).not.toMatch(/src\s*=\s*"data:/i);
    expect(html).not.toMatch(/<[^>]*\bon[a-z]+\s*=/i);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('keeps safe absolute links and image attributes escaped', () => {
    const html = renderSafeMarkdown(
      '[oss.tips](https://oss.tips) ![maintainer & team](https://cdn.example.test/a.png "ignored <title>")',
    );

    expect(html).toContain('href="https://oss.tips"');
    expect(html).toContain('src="https://cdn.example.test/a.png"');
    expect(html).toContain('alt="maintainer &amp; team"');
    expect(html).not.toContain('<title>');
  });

  it('renders only allowlisted embeds as safe provider links', () => {
    const html = renderSafeMarkdown(
      '@[video](https://www.youtube.com/watch?v=abc) @[video](https://video.example.test/watch/abc)',
    );

    expect(html).toContain('data-embed-provider="youtube"');
    expect(html).toContain('Open YouTube embed');
    expect(html).toContain('@[video](https://video.example.test/watch/abc)');
    expect(parseSafeEmbed('https://player.vimeo.com/video/123')?.provider).toBe('vimeo');
    expect(parseSafeEmbed('http://www.youtube.com/watch?v=abc')).toBeNull();
    expect(parseSafeEmbed('https://youtube.com.evil.example/watch?v=abc')).toBeNull();
  });

  it('accepts localized accessible labels without trusting them as markup', () => {
    const html = renderSafeMarkdown(
      '- [x] shipped\n\n@[video](https://www.youtube.com/watch?v=abc)',
      {
        labels: {
          completedTask: 'Aufgabe erledigt',
          openEmbed: (provider) => `${provider} öffnen`,
        },
      },
    );

    expect(html).toContain('aria-label="Aufgabe erledigt"');
    expect(html).toContain('YouTube öffnen');
  });

  it('round-trips the supported block and inline corpus', () => {
    const fixture = [
      '# Release notes #',
      '',
      '> Read **this** [guide](/docs).',
      '',
      '- [x] shipped',
      '- [ ] next',
      '',
      '1. first',
      '2. second',
      '',
      '| Name | Status |',
      '| :--- | ---: |',
      '| `oss.tips` | **ready** |',
      '',
      '---',
      '',
      '![maintainer](https://cdn.example.test/avatar.png "avatar")',
      '',
      '@[video](https://www.youtube.com/watch?v=abc) <https://oss.tips>',
      '',
      '```ts',
      'const value = "<safe>";',
      '```',
      '',
      '[^note]: See the **full** release.',
      '',
    ].join('\n');

    const document = parseMarkdown(fixture);
    expect(document.children.map((block) => block.type)).toEqual([
      'heading',
      'blockquote',
      'list',
      'list',
      'table',
      'thematicBreak',
      'paragraph',
      'paragraph',
      'codeBlock',
      'footnote',
    ]);
    expect(serializeMarkdown(document)).toBe(fixture);
  });

  it('supports editing AST nodes before serializing', () => {
    const document = parseMarkdown('# Original\n');
    const heading = document.children[0];
    if (!heading || heading.type !== 'heading') throw new Error('heading fixture was not parsed');
    heading.children = [{ type: 'text', value: 'Edited' }];
    expect(serializeMarkdown(document)).toBe('# Edited\n');
  });
});
