import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const demoBaseURL = 'http://127.0.0.1:4173';
const authBaseURL = 'http://127.0.0.1:4174';
const localBrowser =
  process.env.PLAYWRIGHT_EXECUTABLE_PATH ??
  ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((path) => existsSync(path));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: demoBaseURL,
    launchOptions: localBrowser ? { executablePath: localBrowser } : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'demo',
      testMatch: /(?:route-templates|journeys)\.spec\.ts/,
    },
    {
      name: 'authorization',
      testMatch: /authorization\.spec\.ts/,
      use: { baseURL: authBaseURL },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @oss-tips/web dev --host 127.0.0.1 --port 4173',
      url: `${demoBaseURL}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL: '',
        DEMO_MODE: 'true',
        AUTH_DEV_MODE: 'true',
        NODE_ENV: 'development',
        SVELTEKIT_OUT_DIR: '.svelte-kit-e2e-demo',
        VITE_CACHE_DIR: 'node_modules/.vite-e2e-demo',
        PUBLIC_APP_URL: demoBaseURL,
        BETTER_AUTH_URL: demoBaseURL,
      },
    },
    {
      command: 'pnpm --filter @oss-tips/web dev --host 127.0.0.1 --port 4174',
      url: `${authBaseURL}/sign-in`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL: '',
        DEMO_MODE: 'false',
        AUTH_DEV_MODE: 'false',
        NODE_ENV: 'development',
        SVELTEKIT_OUT_DIR: '.svelte-kit-e2e-auth',
        VITE_CACHE_DIR: 'node_modules/.vite-e2e-auth',
        PUBLIC_APP_URL: authBaseURL,
        BETTER_AUTH_URL: authBaseURL,
      },
    },
  ],
});
