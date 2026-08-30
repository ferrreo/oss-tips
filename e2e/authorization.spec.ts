import { expect, test } from '@playwright/test';

test('unauthenticated workspace routes redirect to sign-in with a safe return path', async ({
  page,
}) => {
  for (const route of ['/dashboard', '/dashboard/grove', '/me', '/admin']) {
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveURL(new RegExp(`/sign-in\\?returnTo=${encodeURIComponent(route)}`));
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  }
});
