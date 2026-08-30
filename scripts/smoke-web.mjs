#!/usr/bin/env node

const baseUrl = process.argv[2] ?? process.env.SMOKE_URL ?? 'http://127.0.0.1:3000';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 30_000);
const deadline = Date.now() + timeoutMs;
const healthUrl = new URL('/api/v1/health', baseUrl);
let lastError = 'service did not become healthy';

while (Date.now() < deadline) {
  try {
    const response = await fetch(healthUrl);
    const body = await response.json();

    if (response.ok && body?.status === 'ok') {
      console.log(`web smoke passed: ${healthUrl}`);
      process.exit(0);
    }

    lastError = `health endpoint returned ${response.status}`;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }

  await new Promise((resolve) => setTimeout(resolve, 250));
}

console.error(`web smoke failed: ${lastError}`);
process.exit(1);
