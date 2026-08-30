#!/usr/bin/env node

import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = resolve(root, 'apps/web/build');
const buildEntry = resolve(buildDir, 'index.js');
const basePort = await freePort();
const baseUrl = `http://127.0.0.1:${basePort}`;
const publicRoutes = [
  '/',
  '/explore',
  '/grove',
  '/grove/posts/infrastructure-goal-update',
  '/grove/goals/infrastructure-upgrade',
];
const dashboardRoutes = ['/dashboard/grove', '/dashboard/grove/analytics'];
const budgets = {
  publicJs: 170 * 1024,
  dashboardJs: 320 * 1024,
  publicHtml: 100 * 1024,
  dashboardHtml: 150 * 1024,
};

await stat(buildEntry).catch(() => {
  throw new Error('Production web build missing. Run `pnpm build` first.');
});

const server = spawn(process.execPath, [buildEntry], {
  cwd: root,
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(basePort),
    NODE_ENV: 'test',
    DEMO_MODE: 'true',
    DATABASE_URL: '',
    AUTH_DEV_MODE: 'true',
    BETTER_AUTH_SECRET: 'performance-budget-check',
    PUBLIC_APP_URL: baseUrl,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (chunk) => (serverOutput += chunk));
server.stderr.on('data', (chunk) => (serverOutput += chunk));

try {
  await waitForServer();
  const publicMeasurements = await Promise.all(publicRoutes.map((route) => measureRoute(route)));
  const dashboardMeasurements = await Promise.all(
    dashboardRoutes.map((route) => measureRoute(route)),
  );
  const publicMax = largest(publicMeasurements);
  const dashboardMax = largest(dashboardMeasurements);
  for (const measurement of [...publicMeasurements, ...dashboardMeasurements]) {
    console.log(
      `${measurement.route}: ${formatBytes(measurement.js)} JS, ${formatBytes(measurement.html)} HTML`,
    );
  }
  const checks = [
    ['public JS', publicMax.js, budgets.publicJs],
    ['dashboard JS', dashboardMax.js, budgets.dashboardJs],
    ['public HTML', publicMax.html, budgets.publicHtml],
    ['dashboard HTML', dashboardMax.html, budgets.dashboardHtml],
  ];

  for (const [label, bytes, budget] of checks) {
    console.log(`${label}: ${formatBytes(bytes)} / ${formatBytes(budget)}`);
  }
  const failures = checks.filter(([, bytes, budget]) => bytes >= budget);
  if (failures.length > 0) {
    throw new Error(`Performance budget exceeded: ${failures.map(([label]) => label).join(', ')}`);
  }
} catch (error) {
  if (serverOutput.trim()) console.error(serverOutput.trim());
  throw error;
} finally {
  server.kill('SIGTERM');
  await once(server, 'close').catch(() => undefined);
}

async function measureRoute(route) {
  const response = await fetch(new URL(route, baseUrl), { headers: { accept: 'text/html' } });
  if (!response.ok) throw new Error(`${route} returned ${response.status}`);
  const html = await response.text();
  const assets = new Set();
  const references = [
    ...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+\.js(?:\?[^"']*)?)["']/g),
    ...html.matchAll(/import\(\s*["']([^"']+\.js(?:\?[^"']*)?)["']\)/g),
  ];
  for (const match of references) {
    const asset = new URL(match[1], new URL(route, baseUrl));
    if (asset.origin === baseUrl && asset.pathname.startsWith('/_app/')) assets.add(asset.href);
  }
  const appAsset = [...assets].find((asset) => asset.includes('/entry/app.'));
  if (appAsset) {
    const appSource = await fetchAsset(appAsset);
    const dependencyMap = parseDependencyMap(appSource);
    const nodeLoaders = parseNodeLoaders(appSource);
    const nodeIds =
      html
        .match(/node_ids:\s*\[([^\]]+)\]/)?.[1]
        ?.split(',')
        .map((value) => Number(value.trim()))
        .filter(Number.isInteger) ?? [];
    for (const nodeId of nodeIds) {
      const loader = nodeLoaders[nodeId];
      if (!loader) continue;
      assets.add(new URL(`../nodes/${loader.file}`, appAsset).href);
      for (const index of loader.dependencies) {
        const dependency = dependencyMap[index];
        if (dependency) assets.add(new URL(dependency, appAsset).href);
      }
    }
  }
  const pending = [...assets];
  const visited = new Set();
  let js = 0;
  while (pending.length > 0) {
    const asset = pending.pop();
    if (!asset || visited.has(asset)) continue;
    visited.add(asset);
    const source = await fetchAsset(asset);
    if (asset.endsWith('.js')) {
      js += brotliCompressSync(source).length;
      for (const match of source
        .toString('utf8')
        .matchAll(/(?:from|import)\s*(?:\(\s*)?["']([^"']+\.js)["']/g)) {
        const dependency = new URL(match[1], asset);
        if (dependency.origin === baseUrl && dependency.pathname.startsWith('/_app/'))
          pending.push(dependency.href);
      }
    }
  }
  return { route, html: brotliCompressSync(Buffer.from(html)).length, js };
}

async function fetchAsset(asset) {
  const response = await fetch(asset);
  if (!response.ok) throw new Error(`${new URL(asset).pathname} returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function parseDependencyMap(source) {
  const values = source.toString('utf8').match(/\.f\|\|\(\.f=\[(.*?)\]\)/s)?.[1] ?? '';
  return [...values.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function parseNodeLoaders(source) {
  const nodes = [];
  for (const match of source
    .toString('utf8')
    .matchAll(
      /=>[A-Za-z_$]+\(\(\)=>import\(`\.\.\/nodes\/([^`]+)`\),[A-Za-z_$]+\(\[([^\]]*)\]\)/g,
    )) {
    nodes.push({
      file: match[1],
      dependencies: match[2]
        .split(',')
        .map((value) => Number(value.trim()))
        .filter(Number.isInteger),
    });
  }
  return nodes;
}

function largest(measurements) {
  return {
    js: Math.max(...measurements.map((measurement) => measurement.js)),
    html: Math.max(...measurements.map((measurement) => measurement.html)),
  };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error(`Production web server exited with ${server.exitCode}`);
    try {
      await fetch(baseUrl);
      return;
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
  }
  throw new Error('Production web server did not start within 30 seconds');
}

async function freePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  probe.close();
  await once(probe, 'close');
  if (!address || typeof address === 'string') throw new Error('Could not allocate a local port');
  return address.port;
}
