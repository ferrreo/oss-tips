import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
  findBySlug: vi.fn(),
  checkProject: vi.fn(),
  hasRecentAuthentication: vi.fn(),
  recentAuthenticationRedirectPath: vi.fn(() => '/sign-in?returnTo=%2Fdashboard%2Fdemo%2Fstripe'),
  createStripeClient: vi.fn(),
  ensureConnectedAccount: vi.fn(),
}));

vi.mock('$lib/server/db', () => ({
  getDb: mocks.getDb,
  hasDatabaseUrl: mocks.hasDatabaseUrl,
}));

vi.mock('$lib/server/session', () => ({
  hasRecentAuthentication: mocks.hasRecentAuthentication,
  recentAuthenticationRedirectPath: mocks.recentAuthenticationRedirectPath,
}));

vi.mock('$lib/server/stripe-connect', () => ({
  ensureConnectedAccount: mocks.ensureConnectedAccount,
}));

vi.mock('@oss-tips/auth', async () => {
  const actual = await vi.importActual<typeof import('@oss-tips/auth')>('@oss-tips/auth');
  return { ...actual, checkProject: mocks.checkProject };
});

vi.mock('@oss-tips/db', async () => {
  const actual = await vi.importActual<typeof import('@oss-tips/db')>('@oss-tips/db');
  return {
    ...actual,
    createProjectsRepository: vi.fn(() => ({ findBySlug: mocks.findBySlug })),
  };
});

vi.mock('@oss-tips/payments', async () => {
  const actual = await vi.importActual<typeof import('@oss-tips/payments')>('@oss-tips/payments');
  return { ...actual, createStripeClient: mocks.createStripeClient };
});

import { POST as accountSession } from './account-session/+server';
import { POST as onboardingLink } from './onboarding-link/+server';

function event(path: string) {
  const url = new URL(`https://oss.tips/api/v1/projects/demo/stripe/${path}`);
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'idempotency-key': 'connect-request-1' },
    }),
    url,
    params: { slug: 'demo' },
    locals: {
      session: {
        user: { id: 'owner-1', email: 'owner@example.com', emailVerified: true },
      },
      actor: {
        kind: 'user',
        userId: 'owner-1',
        projectRoles: new Map([['project-1', 'owner']]),
        platformRoles: [],
      },
    },
  };
}

describe('Stripe Connect recent authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabaseUrl.mockReturnValue(true);
    mocks.findBySlug.mockResolvedValue({
      id: 'project-1',
      name: 'Demo project',
      slug: 'demo',
      status: 'published',
      default_currency: 'gbp',
    });
    mocks.checkProject.mockReturnValue({ allowed: true });
    mocks.hasRecentAuthentication.mockResolvedValue(false);
  });

  it('rejects stale authentication before creating an onboarding link', async () => {
    const response = await onboardingLink(
      event('onboarding-link') as unknown as Parameters<typeof onboardingLink>[0],
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ title: 'Recent authentication required' });
    expect(mocks.createStripeClient).not.toHaveBeenCalled();
    expect(mocks.ensureConnectedAccount).not.toHaveBeenCalled();
  });

  it('rejects stale authentication before creating an account session', async () => {
    const response = await accountSession(
      event('account-session') as unknown as Parameters<typeof accountSession>[0],
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ title: 'Recent authentication required' });
    expect(mocks.createStripeClient).not.toHaveBeenCalled();
    expect(mocks.ensureConnectedAccount).not.toHaveBeenCalled();
  });
});
