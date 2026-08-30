import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const axePath = resolve(process.cwd(), 'node_modules/axe-core/axe.min.js');

const publicRoutes = [
  '/',
  '/explore',
  '/about',
  '/pricing',
  '/docs',
  '/security',
  '/transparency',
  '/terms',
  '/terms/privacy',
  '/terms/acceptable-use',
  '/terms/refunds',
  '/terms/cookies',
  '/sign-in',
  '/sign-in?returnTo=%2Fgrove%2Fsupport',
  '/grove',
  '/grove/posts/infrastructure-goal-update',
  '/grove/posts/grove-1-0',
  '/grove/goals/infrastructure-upgrade',
  '/grove/goals/documentation-overhaul',
  '/grove/support',
  '/checkout/success?payment_id=demo-payment',
  '/claim/demo-token',
  '/reply/demo-token',
  '/invite/demo-invite',
] as const;

const dashboardRoutes = [
  '/dashboard',
  '/dashboard/grove',
  '/dashboard/grove/analytics',
  '/dashboard/grove/api-keys',
  '/dashboard/grove/discord',
  '/dashboard/grove/domains',
  '/dashboard/grove/exports',
  '/dashboard/grove/goals',
  '/dashboard/grove/inbox',
  '/dashboard/grove/memberships',
  '/dashboard/grove/onboarding',
  '/dashboard/grove/payments',
  '/dashboard/grove/posts',
  '/dashboard/grove/posts/new',
  '/dashboard/grove/posts/p1',
  '/dashboard/grove/settings',
  '/dashboard/grove/stripe',
  '/dashboard/grove/supporters',
  '/dashboard/grove/team',
  '/dashboard/grove/webhooks',
] as const;

const supporterRoutes = [
  '/me',
  '/me/feed',
  '/me/memberships',
  '/me/entitlements',
  '/me/inbox',
  '/me/settings',
] as const;

const adminRoutes = [
  '/admin',
  '/admin/review',
  '/admin/directory',
  '/admin/reconciliation',
  '/admin/cases',
  '/admin/audit',
] as const;

const widths = [320, 768, 1280] as const;

async function assertRenderedRoute(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  expect(response?.status(), route).toBeLessThan(400);
  await expect(page.locator('main'), route).toHaveCount(1);
  await expect(page.locator('body'), route).toBeVisible();
  await expect(page.locator('vite-error-overlay'), route).toHaveCount(0);
}

async function assertNoHorizontalOverflow(page: Page, route: string) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  const overflow = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll<HTMLElement>('*'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const parent = element.parentElement?.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: element.className,
          left: rect.left,
          width: rect.width,
          right: rect.right,
          parentWidth: parent?.width,
        };
      })
      .filter(({ right }) => right > viewport + 1)
      .slice(0, 8);
  });
  const detail = `${route}: document overflow ${JSON.stringify(overflow)}`;
  expect(dimensions.document, detail).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(
    dimensions.body,
    `${route}: body overflow ${JSON.stringify(overflow)}`,
  ).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function assertCriticalAxe(page: Page, route: string) {
  const axeSource = await readFile(axePath, 'utf8');
  await page.route('**/__axe.js', (request) =>
    request.fulfill({ contentType: 'application/javascript', body: axeSource }),
  );
  try {
    await page.addScriptTag({ url: '/__axe.js' });
    const result = await page.evaluate(async () => {
      const axe = (
        window as Window & {
          axe?: {
            run: () => Promise<{
              violations: Array<{
                id: string;
                impact: string | null;
                nodes: Array<{ html: string }>;
              }>;
            }>;
          };
        }
      ).axe;
      if (!axe) throw new Error('axe-core did not load');
      return axe.run();
    });
    const severe = result.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(severe, `${route}: critical/serious accessibility violations`).toEqual([]);
  } finally {
    await page.unroute('**/__axe.js');
  }
}

for (const width of widths) {
  test(`public route templates render without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of publicRoutes) {
      await assertRenderedRoute(page, route);
      await assertNoHorizontalOverflow(page, route);
    }
  });

  test(`workspace route templates render without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [...dashboardRoutes, ...supporterRoutes, ...adminRoutes]) {
      await assertRenderedRoute(page, route);
      await assertNoHorizontalOverflow(page, route);
    }
  });
}

test('public navigation sheet is keyboard accessible on compact screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/about', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  const trigger = page.locator('button[aria-controls="public-nav-sheet"]');
  const sheet = page.locator('dialog[data-pl-sheet]');
  await trigger.focus();
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(sheet).toBeVisible();
  await expect
    .poll(() => sheet.evaluate((element) => (element as HTMLDialogElement).open))
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflowY))
    .toBe('hidden');

  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  await expect
    .poll(() => sheet.evaluate((element) => (element as HTMLDialogElement).open))
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflowY))
    .toBe('visible');

  await trigger.click();
  await sheet.getByRole('link', { name: 'Explore', exact: true }).click();
  await expect(page).toHaveURL(/\/explore$/);
});

test('SSR brand assets hydrate from HTTP build URLs', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', (message) => messages.push(message.text()));
  page.on('pageerror', (error) => messages.push(error.message));

  await page.goto('/', { waitUntil: 'networkidle' });
  const assets = await page
    .locator('img')
    .evaluateAll((images) =>
      images.map((image) => image.currentSrc || image.getAttribute('src') || ''),
    );
  const brandAssets = assets.filter((src) =>
    /oss-tips-wordmark|hero-landscape-paperlight/.test(src),
  );

  expect(brandAssets.length).toBeGreaterThanOrEqual(2);
  expect(brandAssets.every((src) => new URL(src, page.url()).protocol === 'http:')).toBe(true);
  expect(messages.filter((message) => /file:|hydration/i.test(message))).toEqual([]);
});

test('dashboard and admin navigation sheets return focus after Escape', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });

  await page.goto('/dashboard/grove', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const dashboardTrigger = page.getByRole('button', { name: 'Open project navigation' });
  await dashboardTrigger.click();
  await expect(page.getByRole('dialog', { name: 'Project dashboard navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dashboardTrigger).toBeFocused();

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const adminTrigger = page.getByRole('button', { name: 'Open admin navigation' });
  await adminTrigger.click();
  await expect(page.getByRole('dialog', { name: 'Admin navigation' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(adminTrigger).toBeFocused();
});

test('sign-in and checkout templates keep their honest states', async ({ page }) => {
  await page.goto('/sign-in', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  const signInError = page.getByRole('alert');
  await expect(signInError).toBeVisible();
  await expect(signInError).toContainText('We could not send your sign-in code. Try again.');

  await page.goto('/checkout/success?payment_id=demo-payment', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { name: 'Payment is being confirmed' })).toBeVisible();
  await expect(page.getByText('demo-payment')).toBeVisible();
  await expect(page.getByText('No access was granted.')).toHaveCount(0);
});

test('sign-in preserves invite return path after OTP verification', async ({ page }) => {
  await page.route('**/api/auth/email-otp/send-verification-otp', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.route('**/api/auth/sign-in/email-otp', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );

  await page.goto('/sign-in?returnTo=%2Finvite%2Fdemo-invite', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill('member@example.com');
  await page.getByRole('button', { name: 'Send sign-in code' }).click();
  await page.getByLabel('One-time code').fill('381204');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();

  await expect(page).toHaveURL(/\/invite\/demo-invite$/);
});

test('project creation validates before making an API request', async ({ page }) => {
  await page.goto('/dashboard', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { name: 'Give your project a home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Check the highlighted fields before creating your project.',
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('reduced motion is honoured by primary controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
  await expect
    .poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
    .toBe(true);
  const duration = await page
    .getByRole('button', { name: 'Send sign-in code' })
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(duration.split(',').every((value) => Number.parseFloat(value) <= 0.01)).toBe(true);
});

test('route templates have no critical or serious axe violations', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const route of [
    '/',
    '/explore',
    '/grove',
    '/grove/support',
    '/sign-in',
    '/invite/demo-invite',
    '/checkout/success?payment_id=demo-payment',
    '/dashboard',
    '/dashboard/grove',
    '/me',
    '/admin',
  ]) {
    await assertRenderedRoute(page, route);
    await assertCriticalAxe(page, route);
  }
});
