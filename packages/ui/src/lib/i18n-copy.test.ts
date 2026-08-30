import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

const repositoryDirectory = resolve(import.meta.dirname, '../../../..');
const sourceDirectories = [
  resolve(import.meta.dirname, '../components'),
  resolve(import.meta.dirname, '../pages'),
  resolve(repositoryDirectory, 'apps/web/src/routes'),
];
const visibleHtmlAttributes = new Set([
  'aria-label',
  'aria-description',
  'title',
  'placeholder',
  'alt',
]);
const visibleComponentProps = new Set([
  'label',
  'help',
  'description',
  'message',
  'actionLabel',
  'caption',
  'kicker',
  'lede',
  'emptyTitle',
  'emptyMessage',
  'error',
]);
const allowedStaticCopy =
  /^(?:oss\.tips(?: admin)?|Stripe|GitHub|Google|YouTube|Vimeo|PeerTube|API|URL|HTTPS)$/;

function isAllowedStaticCopy(value: string): boolean {
  return (
    allowedStaticCopy.test(value) ||
    /^(?:https?:\/\/|www\.)\S+$/.test(value) ||
    /^\d{6}$/.test(value) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function textValue(value: unknown): string | null {
  if (!Array.isArray(value) || value.length !== 1 || value[0]?.type !== 'Text') return null;
  const text = value[0].data.trim().replace(/\s+/g, ' ');
  return text || null;
}

function collectUnkeyedCopy(source: string): string[] {
  const root = parse(source, { modern: true });
  const found: string[] = [];

  // Walk only render children. Attribute values and expression ASTs contain
  // implementation data (hrefs, roles, SVG paths, etc.), not visible copy.
  const childFields = [
    'alternate',
    'body',
    'branches',
    'catch',
    'children',
    'consequent',
    'else',
    'fallback',
    'fragment',
    'nodes',
    'pending',
    'then',
  ] as const;

  function visit(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const candidate = node as {
      type?: string;
      data?: string;
      attributes?: unknown[];
      nodes?: unknown[];
    };
    if (candidate.type === 'Text') {
      const text = candidate.data?.trim().replace(/\s+/g, ' ') ?? '';
      if (/[A-Za-zÀ-ÿ]/.test(text) && !isAllowedStaticCopy(text)) found.push(text);
    }
    if (
      candidate.type === 'RegularElement' ||
      candidate.type === 'InlineComponent' ||
      candidate.type === 'Component'
    ) {
      const visibleAttributes =
        candidate.type === 'RegularElement' ? visibleHtmlAttributes : visibleComponentProps;
      for (const attribute of candidate.attributes ?? []) {
        if (!attribute || typeof attribute !== 'object') continue;
        const item = attribute as { name?: string; value?: unknown };
        if (!visibleAttributes.has(item.name ?? '')) continue;
        const text = textValue(item.value);
        if (text && !isAllowedStaticCopy(text)) found.push(`${item.name}: ${text}`);
      }
    }
    for (const field of childFields) {
      const value = candidate[field as keyof typeof candidate];
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }

  visit(root.fragment);
  return [...new Set(found)];
}

function svelteFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...svelteFiles(file));
    else if (entry.isFile() && entry.name.endsWith('.svelte')) files.push(file);
  }
  return files;
}

describe('rendered UI copy', () => {
  it('keeps visible Svelte copy behind message keys', () => {
    const violations: string[] = [];
    for (const directory of sourceDirectories) {
      for (const file of svelteFiles(directory)) {
        const pathLabel = relative(repositoryDirectory, file);
        for (const copy of collectUnkeyedCopy(readFileSync(file, 'utf8')))
          violations.push(`${pathLabel}: ${copy}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
