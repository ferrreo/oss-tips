#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const ui = join(root, 'packages/ui/src');
const web = join(root, 'apps/web/src');
const aliasPage =
  /<script\b[^>]*>[\s\S]*?\bimport\s+([A-Z]\w*)\s+from\s+['"][^'"]+\.svelte['"][\s\S]*?<\/script>\s*<\1\b[^>]*\/?>\s*(?:<\/\1>)?\s*$/;

function walk(dir, suffix, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, suffix, files);
    else if (entry.name.endsWith(suffix)) files.push(path);
  }
  return files;
}

const failures = [];

for (const component of walk(ui, '.svelte')) {
  const story = component.replace(/\.svelte$/, '.stories.ts');
  const source = readFileSync(component, 'utf8');
  const name = relative(root, component);

  if (aliasPage.test(source)) failures.push(`${name}: alias page wrapper must be removed`);
  if (!existsSync(story)) failures.push(`${name}: missing same-name story`);
  if (/<style(?:\s|>)/.test(source))
    failures.push(`${name}: component-local <style> bypasses StyleX`);
  if (/\sstyle\s*=\s*["']/.test(source))
    failures.push(`${name}: static inline style bypasses StyleX`);
  if (/\sstyle\s*=\s*\{`/.test(source))
    failures.push(`${name}: raw dynamic inline style bypasses StyleX`);
  if (/\sstyle\s*=\s*\{(?![^}]*\.style\b)[^}]*\}/s.test(source))
    failures.push(`${name}: dynamic inline style bypasses StyleX`);
  if (/document\.body\.(?:style|classList)\./.test(source))
    failures.push(`${name}: imperative body state bypasses shared global state`);
  if (/\bclass\s*=\s*["']/.test(source)) failures.push(`${name}: static class bypasses StyleX`);
  if (/from\s+['"]@stylexjs\/stylex['"]/.test(source)) {
    failures.push(`${name}: import the Svelte StyleX runtime bridge, not raw StyleX`);
  }
}

for (const sourceFile of walk(web, '.svelte')) {
  const source = readFileSync(sourceFile, 'utf8');
  const name = relative(root, sourceFile);
  if (/<style(?:\s|>)/.test(source))
    failures.push(`${name}: component-local <style> bypasses StyleX`);
  if (/\sstyle\s*=\s*["']/.test(source))
    failures.push(`${name}: static inline style bypasses StyleX`);
  if (/\sstyle\s*=\s*\{`/.test(source))
    failures.push(`${name}: raw dynamic inline style bypasses StyleX`);
  if (/\sstyle\s*=\s*\{(?![^}]*\.style\b)[^}]*\}/s.test(source))
    failures.push(`${name}: dynamic inline style bypasses StyleX`);
  if (/document\.body\.(?:style|classList)\./.test(source))
    failures.push(`${name}: imperative body state bypasses shared global state`);
  if (/\bclass\s*=\s*["']/.test(source)) failures.push(`${name}: static class bypasses StyleX`);
}

for (const story of walk(ui, '.stories.ts')) {
  const source = readFileSync(story, 'utf8');
  const name = relative(root, story);
  const variants = source.match(/export const\s+\w+/g)?.length ?? 0;

  if (!source.includes('satisfies Meta<typeof '))
    failures.push(`${name}: use satisfies Meta<typeof Component>`);
  if (/args\s*:\s*\{\s*\}/.test(source))
    failures.push(`${name}: empty args do not exercise mock data`);
  if (variants < 2) failures.push(`${name}: needs at least two meaningful story states`);
  if (!/theme\s*:\s*['"]dark['"]/.test(source))
    failures.push(`${name}: missing dark-theme parity story`);
}

const appPages = join(root, 'apps/web/src/routes');
const appTemplate = join(root, 'apps/web/src/app.html');
const appTemplateSource = readFileSync(appTemplate, 'utf8');
if (/<style(?:\s|>)/.test(appTemplateSource))
  failures.push('apps/web/src/app.html: local <style> bypasses global CSS');
if (/\sstyle\s*=\s*["']/.test(appTemplateSource))
  failures.push('apps/web/src/app.html: static inline style bypasses global CSS');
if (/\bclass\s*=\s*["']/.test(appTemplateSource))
  failures.push('apps/web/src/app.html: static class bypasses StyleX');

const globalCssPath = join(root, 'packages/ui/src/styles.css');
const globalCss = readFileSync(globalCssPath, 'utf8');
const globalCssSelectors = globalCss.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)/g, '');
if (/\.[A-Za-z_][\w-]*/.test(globalCssSelectors))
  failures.push('packages/ui/src/styles.css: component selectors belong in StyleX');
const globalInteractionSelectors = globalCssSelectors.replace(
  /body:has\(dialog\[data-pl-sheet\]\[open\]\)\s*\{[\s\S]*?\}/g,
  '',
);
if (
  /:(?:active|checked|disabled|focus(?:-visible)?|has|hover|target|visited)\b|\[(?:aria-(?:checked|current|disabled|expanded|pressed|selected)|disabled|open|tabindex)\b/.test(
    globalInteractionSelectors,
  )
)
  failures.push('packages/ui/src/styles.css: interaction selectors belong in StyleX');
if (
  !/body:has\(dialog\[data-pl-sheet\]\[open\]\)\s*\{[\s\S]*?overflow:\s*hidden\s*;/.test(globalCss)
)
  failures.push('packages/ui/src/styles.css: native sheet scroll lock is missing');
for (const shell of ['PublicNav.svelte', 'DashboardShell.svelte', 'AdminShell.svelte']) {
  const source = readFileSync(join(ui, 'components', shell), 'utf8');
  if (!/<dialog[\s\S]*?data-pl-sheet/.test(source))
    failures.push(`packages/ui/src/components/${shell}: native sheet marker is missing`);
}

const tokenJson = JSON.parse(
  readFileSync(join(root, 'packages/design-tokens/tokens.json'), 'utf8'),
);
const tokenCss = readFileSync(join(root, 'packages/design-tokens/css/paperlight.css'), 'utf8');
const tokenStylex = readFileSync(
  join(root, 'packages/design-tokens/src/paperlight.stylex.ts'),
  'utf8',
);
const tokenCssBlocks = {
  light: tokenCss.match(/:root,\s*\[data-theme='light'\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? '',
  dark: tokenCss.match(/\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? '',
};
const normaliseToken = (value) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/([,(])\./g, (_, prefix) => `${prefix}0.`);
const cssName = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

for (const name of Object.keys(tokenJson.colour.light)) {
  const variable = `--pl-${cssName(name)}`;
  for (const theme of ['light', 'dark']) {
    const expected = normaliseToken(tokenJson.colour[theme][name]);
    const actual = tokenCssBlocks[theme].match(new RegExp(`${variable}\\s*:\\s*([^;]+)`))?.[1];
    if (!actual || normaliseToken(actual) !== expected)
      failures.push(
        `packages/design-tokens/css/paperlight.css: ${variable} drifts from tokens.json (${theme})`,
      );
  }

  const stylexValues = [
    ...tokenStylex.matchAll(new RegExp(`\\b${name}:\\s*(['"])(.*?)\\1`, 'g')),
  ].map((match) => match[2]);
  for (const themeIndex of [0, 1]) {
    if (
      !stylexValues[themeIndex] ||
      normaliseToken(stylexValues[themeIndex]) !==
        normaliseToken(tokenJson.colour[['light', 'dark'][themeIndex]][name])
    )
      failures.push(
        `packages/design-tokens/src/paperlight.stylex.ts: ${name} drifts from tokens.json (${['light', 'dark'][themeIndex]})`,
      );
  }
}

const sharedTokenMappings = [
  ...Object.entries(tokenJson.typography.scale).map(([name, value]) => [
    value,
    `--pl-text-${name}`,
    `text${name[0].toUpperCase()}${name.slice(1)}`,
  ]),
  ...Object.entries(tokenJson.motion).map(([name, value]) => [
    value,
    name.startsWith('ease') ? `--pl-${cssName(name)}` : `--pl-motion-${cssName(name)}`,
    name.startsWith('ease') ? name : `motion${name[0].toUpperCase()}${name.slice(1)}`,
  ]),
];
for (const [expected, variable, stylexName] of sharedTokenMappings) {
  const cssValue = tokenCss.match(new RegExp(`${variable}\\s*:\\s*([^;]+)`))?.[1];
  if (!cssValue || normaliseToken(cssValue) !== normaliseToken(expected))
    failures.push(`packages/design-tokens/css/paperlight.css: ${variable} drifts from tokens.json`);

  const stylexValues = [
    ...tokenStylex.matchAll(new RegExp(`\\b${stylexName}:\\s*(['"])(.*?)\\1`, 'g')),
  ].map((match) => match[2]);
  if (
    stylexValues.length !== 2 ||
    stylexValues.some((value) => normaliseToken(value) !== normaliseToken(expected))
  )
    failures.push(
      `packages/design-tokens/src/paperlight.stylex.ts: ${stylexName} drifts from tokens.json`,
    );
}

for (const page of walk(appPages, '+page.svelte')) {
  const source = readFileSync(page, 'utf8');
  if (!/from\s+['"]@oss-tips\/ui\/pages\//.test(source)) {
    failures.push(`${relative(root, page)}: route must compose a directly-storied UI page`);
  }
}

if (failures.length) {
  console.error('UI architecture verification failed:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('verify-ui-architecture: ok');
