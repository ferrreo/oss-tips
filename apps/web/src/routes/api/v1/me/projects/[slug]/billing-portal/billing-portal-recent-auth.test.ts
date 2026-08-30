import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
  hasRecentAuthentication: vi.fn(),
  recentAuthenticationRedirectPath: vi.fn(() => '/sign-in?returnTo=%2Fapi%2Fv1%2Fme%2Fprojects'),
  createStripeClient: vi.fn(),
}));

vi.mock('$lib/server/db', () => ({
  getDb: mocks.getDb,
  hasDatabaseUrl: mocks.hasDatabaseUrl,
}));

vi.mock('$lib/server/session', () => ({
  hasRecentAuthentication: mocks.hasRecentAuthentication,
  recentAuthenticationRedirectPath: mocks.recentAuthenticationRedirectPath,
}));

vi.mock('@oss-tips/payments', async () => {
  const actual = await vi.importActual<typeof import('@oss-tips/payments')>('@oss-tips/payments');
  return { ...actual, createStripeClient: mocks.createStripeClient };
});

import { createStripeClient } from '@oss-tips/payments';
import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { hasRecentAuthentication } from '$lib/server/session';
import { POST } from './+server';

function event() {
  const url = new URL('https://oss.tips/api/v1/me/projects/grove/billing-portal');
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'idempotency-key': 'portal-1' },
    }),
    url,
    params: { slug: 'grove' },
    locals: {
      session: {
        session: { id: 'session-1' },
        user: { id: 'user-1' },
      },
    },
  } as Parameters<typeof POST>[0];
}

function db(binding = { stripe_customer_id: 'cus_test', stripe_account_id: 'acct_test' }) {
  const query: any = {
    innerJoin: vi.fn(() => query),
    select: vi.fn(() => query),
    where: vi.fn(() => query),
    executeTakeFirst: vi.fn().mockResolvedValue(binding),
  };
  return { selectFrom: vi.fn(() => query) };
}

describe('billing portal recent authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
    vi.mocked(hasRecentAuthentication).mockResolvedValue(true);
  });

  it('rejects stale authentication before loading billing data or creating a Stripe client', async () => {
    const database = db();
    vi.mocked(getDb).mockReturnValue(database as never);
    vi.mocked(hasRecentAuthentication).mockResolvedValue(false);

    const response = await POST(event());

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ title: 'Recent authentication required' });
    expect(database.selectFrom).not.toHaveBeenCalled();
    expect(createStripeClient).not.toHaveBeenCalled();
  });

  it('creates a portal session for a recently authenticated supporter', async () => {
    const database = db();
    const createCustomerPortalSession = vi.fn().mockResolvedValue({
      id: 'bps_test',
      url: 'https://billing.stripe.com/session/bps_test',
    });
    vi.mocked(getDb).mockReturnValue(database as never);
    vi.mocked(createStripeClient).mockReturnValue({ createCustomerPortalSession } as never);

    const response = await POST(event());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'bps_test',
      url: 'https://billing.stripe.com/session/bps_test',
    });
    expect(createCustomerPortalSession).toHaveBeenCalledWith({
      stripeAccountId: 'acct_test',
      customerId: 'cus_test',
      returnUrl: 'https://oss.tips/me/memberships',
      idempotencyKey: 'portal-1',
    });
  });
});
