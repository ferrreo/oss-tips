import { expect, test } from '@playwright/test';

type CheckoutRequest = {
  projectAmountMinor: number;
  cadence: string;
  publicOptions: {
    showName: boolean;
    showAmount: boolean;
    showMessage: boolean;
    displayName?: string;
    message?: string;
  };
};

async function mockCheckout(page: import('@playwright/test').Page, requests: CheckoutRequest[]) {
  await page.route('**/api/v1/projects/grove/checkout-intents', async (route) => {
    const request = JSON.parse(route.request().postData() ?? '{}') as CheckoutRequest;
    requests.push(request);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: `checkout-demo-${requests.length}`,
        client_secret: null,
        checkout_url: `https://checkout.stripe.com/c/pay/cs_test_${requests.length}`,
        expires_at: '2030-01-01T00:00:00.000Z',
        application_fee: { amount: '0', currency: 'usd' },
        customer_charge: { amount: String(request.projectAmountMinor), currency: 'usd' },
        mode: request.cadence === 'one_off' ? 'payment' : 'subscription',
      }),
    });
  });
  await page.route('https://checkout.stripe.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Stripe checkout mock</title>' }),
  );
}

async function warmCheckout(page: import('@playwright/test').Page): Promise<void> {
  try {
    await page.evaluate(() => import('/src/lib/checkout.ts'));
  } catch {
    await page.waitForLoadState('networkidle');
  }
}

test('one-off and recurring support create checkout intents and stay processing until confirmation', async ({
  page,
}) => {
  const requests: CheckoutRequest[] = [];
  await mockCheckout(page, requests);

  for (const [cadence, amount] of [
    ['one-off', 'Choose US$25.00'],
    ['monthly', 'Choose US$10.00'],
    ['annual', 'Choose US$50.00'],
  ] as const) {
    await page.goto('/grove/support', { waitUntil: 'networkidle' });
    if (cadence === 'one-off') await warmCheckout(page);
    await page
      .getByRole('button', {
        name: cadence === 'one-off' ? 'One-off' : cadence === 'monthly' ? 'Monthly' : 'Annual',
      })
      .click();
    await page.getByRole('button', { name: amount }).click();
    await page.getByRole('button', { name: 'Continue to checkout' }).click();
    await expect(page).toHaveURL(/checkout\.stripe\.com\/c\/pay\/cs_test_/);

    await page.goto(`/checkout/success?payment_id=demo-${cadence}`, {
      waitUntil: 'networkidle',
    });
    await expect(page.getByRole('heading', { name: 'Payment is being confirmed' })).toBeVisible();
    await expect(page.getByText('No access was granted.')).toHaveCount(0);
  }

  await expect.poll(() => requests.length).toBe(3);
  expect(requests.map(({ cadence: value }) => value)).toEqual(['one_off', 'monthly', 'annual']);
  expect(requests[0]).toMatchObject({ projectAmountMinor: 2500 });
  expect(requests[1]).toMatchObject({ projectAmountMinor: 1000 });
  expect(requests[2]).toMatchObject({ projectAmountMinor: 5000 });
});

test('supporter wall opt-in and removal are sent as explicit checkout options', async ({
  page,
}) => {
  const requests: CheckoutRequest[] = [];
  await mockCheckout(page, requests);

  await page.goto('/grove/support', { waitUntil: 'networkidle' });
  await page.getByLabel('Display name').fill('Ada');
  await page.getByLabel('Public message').fill('Thank you for the releases.');
  await page.getByRole('checkbox', { name: 'Show my name' }).check();
  await page.getByRole('checkbox', { name: 'Show my amount' }).check();
  await page.getByRole('checkbox', { name: 'Show my message' }).check();
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await expect(page).toHaveURL(/checkout\.stripe\.com\/c\/pay\/cs_test_1/);

  await page.goto('/grove/support', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await expect(page).toHaveURL(/checkout\.stripe\.com\/c\/pay\/cs_test_2/);

  await expect.poll(() => requests.length).toBe(2);
  expect(requests[0]?.publicOptions).toEqual({
    showName: true,
    showAmount: true,
    showMessage: true,
    displayName: 'Ada',
    message: 'Thank you for the releases.',
  });
  expect(requests[1]?.publicOptions).toEqual({
    showName: false,
    showAmount: false,
    showMessage: false,
  });
});

test('membership cancellation reports next-renewal state and demo shows grace/refund records', async ({
  page,
}) => {
  let cancelBody: unknown;
  await page.route('**/api/v1/me/memberships/mem1', async (route) => {
    cancelBody = JSON.parse(route.request().postData() ?? '{}');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/me/memberships', { waitUntil: 'networkidle' });
  await expect(page.getByText('Active memberships', { exact: true })).toBeVisible();
  await expect(page.getByText('Past due', { exact: true })).toBeVisible();
  await expect(page.getByText('Grace period still open')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancel Grove membership at renewal' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Membership ends after the paid period.' }),
  ).toBeVisible();
  expect(cancelBody).toEqual({ cancel_at_period_end: true });

  await page.goto('/dashboard/grove/memberships', { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('row').filter({ hasText: 'dylan_builds' }).filter({ hasText: 'Past due' }),
  ).toHaveCount(1);
  await page.goto('/dashboard/grove/payments', { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('row').filter({ hasText: 'opensourcefan' }).filter({ hasText: 'Refunded' }),
  ).toHaveCount(1);
});

test('public routes deny gated post metadata while private attachment route stays unavailable without storage data', async ({
  page,
}) => {
  const gatedPost = await page.goto('/grove/posts/private-registry-checks', {
    waitUntil: 'networkidle',
  });
  expect(gatedPost?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();

  const attachment = await page.request.get(
    '/api/v1/assets/11111111-1111-7111-8111-111111111111/download',
  );
  expect(attachment.status()).toBe(503);
  await expect(attachment.json()).resolves.toMatchObject({ title: 'Database unavailable' });
});

test('supporter and project reply UIs report success and failure states', async ({ page }) => {
  let replyCount = 0;
  let projectReplyBody: unknown;
  await page.route('**/api/v1/me/threads/t2/messages', async (route) => {
    replyCount += 1;
    await route.fulfill(
      replyCount === 1
        ? { status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) }
        : {
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ title: 'Unavailable' }),
          },
    );
  });
  await page.route('**/api/v1/project/threads/t1/messages', async (route) => {
    projectReplyBody = JSON.parse(route.request().postData() ?? '{}');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('/me/inbox', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Receipt for one-off support from Grove/ }).click();
  const reply = page.getByRole('textbox', { name: 'Reply' });
  await reply.fill('Thanks for the update.');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(reply).toHaveValue('');

  await reply.fill('Please confirm the next release date.');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(page.getByRole('alert')).toContainText('Reply could not be sent. Try again.');
  await expect.poll(() => replyCount).toBe(2);

  await page.goto('/dashboard/grove/inbox', { waitUntil: 'networkidle' });
  const projectReply = page.getByRole('textbox', { name: 'Reply' });
  await expect(projectReply).toBeVisible();
  await projectReply.fill('Thanks for the update.');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(projectReply).toHaveValue('');
  expect(projectReplyBody).toEqual({ body: 'Thanks for the update.' });
});

test('admin refund is visible in immutable audit history, with no refund control in demo cases', async ({
  page,
}) => {
  await page.goto('/admin/cases', { waitUntil: 'networkidle' });
  await expect(
    page.getByText('Restrictions, refunds, and ownership changes stay on this case.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /refund/i })).toHaveCount(0);

  await page.goto('/admin/audit', { waitUntil: 'networkidle' });
  const refundRow = page.getByRole('row').filter({ hasText: 'pay_11' });
  await expect(refundRow).toContainText('Issued exceptional refund');
  await expect(refundRow).toContainText(
    'Duplicate one-off from opensourcefan refunded with immutable reason.',
  );
});

test('custom-host support keeps checkout on the Stripe host', async ({ page }) => {
  const requests: string[] = [];
  await page.route('**/api/v1/projects/grove/checkout-intents', async (route) => {
    requests.push(route.request().url());
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'checkout-demo-custom',
        client_secret: null,
        checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_custom',
        expires_at: '2030-01-01T00:00:00.000Z',
        application_fee: { amount: '0', currency: 'usd' },
        customer_charge: { amount: '1000', currency: 'usd' },
        mode: 'payment',
      }),
    });
  });
  await page.route('https://checkout.stripe.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Stripe checkout mock</title>' }),
  );

  await page.goto('/dashboard/grove/domains', { waitUntil: 'networkidle' });
  await expect(page.getByText('Checkout stays on oss.tips.')).toBeVisible();
  await page.goto('http://grove.localhost:4173/grove/support', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await expect(page).toHaveURL(/checkout\.stripe\.com\/c\/pay\/cs_test_custom/);
  await expect.poll(() => requests.length).toBe(1);
  expect(new URL(requests[0] ?? '').hostname).toBe('grove.localhost');
});

test('guest reply and claim links stay honest when demo has no database', async ({ page }) => {
  await page.goto('/reply/demo-token', { waitUntil: 'networkidle' });
  await expect(page.getByRole('alert')).toContainText('Reply is unavailable');
  await expect(page.getByRole('textbox')).toHaveCount(0);

  await page.goto('/claim/demo-token', { waitUntil: 'networkidle' });
  await expect(page.getByRole('alert')).toContainText('Claim is unavailable');
  await expect(page.getByRole('textbox')).toHaveCount(0);
});
