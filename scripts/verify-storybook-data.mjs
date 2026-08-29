#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const needle = 'Page composition stub';
const scanExt = new Set(['.svelte', '.ts', '.js']);
const scanRoots = ['packages/ui/src', 'apps/web/src'];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path, files);
      continue;
    }
    if (scanExt.has(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

const stubHits = [];
for (const rel of scanRoots) {
  for (const file of walk(join(root, rel))) {
    if (readFileSync(file, 'utf8').includes(needle)) {
      stubHits.push(relative(root, file));
    }
  }
}

if (stubHits.length > 0) {
  console.error(`Found "${needle}" in:`);
  for (const file of stubHits) {
    console.error(`  ${file}`);
  }
  process.exit(1);
}

const dashboardDir = join(root, 'packages/ui/src/pages/dashboard');
const missingReexport = [];
for (const name of readdirSync(dashboardDir)) {
  if (!name.endsWith('.svelte')) {
    continue;
  }
  const text = readFileSync(join(dashboardDir, name), 'utf8');
  if (!text.includes('../project/')) {
    missingReexport.push(name);
  }
}

if (missingReexport.length > 0) {
  console.error('Dashboard pages must re-export from ../project/:');
  for (const name of missingReexport) {
    console.error(`  ${name}`);
  }
  process.exit(1);
}

const importRoots = ['packages/ui/src', 'packages/ui/.storybook', 'apps/web/src'];
const legacyStorybook = /['"](@storybook\/svelte(?:\/[^'"]*)?)['"]/g;
const legacyHits = [];

for (const rel of importRoots) {
  const dir = join(root, rel);
  try {
    readdirSync(dir);
  } catch {
    continue;
  }
  for (const file of walk(dir)) {
    const text = readFileSync(file, 'utf8');
    let match;
    legacyStorybook.lastIndex = 0;
    while ((match = legacyStorybook.exec(text))) {
      if (!match[1].startsWith('@storybook/svelte-vite')) {
        legacyHits.push(`${relative(root, file)} → ${match[1]}`);
      }
    }
  }
}

if (legacyHits.length > 0) {
  console.error("Use '@storybook/svelte-vite', not '@storybook/svelte':");
  for (const hit of legacyHits) {
    console.error(`  ${hit}`);
  }
  process.exit(1);
}

console.log('verify-storybook-data: ok');
