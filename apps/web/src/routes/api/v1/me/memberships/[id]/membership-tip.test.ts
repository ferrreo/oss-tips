import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('@oss-tips/payments', async () => {
  const actual = await vi.importActual<typeof import('@oss-tips/payments')>('@oss-tips/payments');
  return { ...actual, createStripeClient: vi.fn() };
});

vi.mock('$lib/server/session', () => ({
  hasRecentAuthentication: vi.fn(),
  recentAuthenticationRedirectPath: vi.fn(() => '/sign-in?returnTo=%2Fapi%2Fv1%2Fme%2Fmemberships'),
}));

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { createStripeClient } from '@oss-tips/payments';
import { hasRecentAuthentication } from '$lib/server/session';
import { PATCH } from './+server';

type MembershipRow = {
  id: string;
  project_id: string;
  tier_id: string;
  user_id: string;
  status: string;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string;
  stripe_account_id: string;
  platform_tip_minor: string | bigint | null;
  currency: string | null;
  cadence: string | null;
};

class FakeDb {
  readonly audits: unknown[] = [];
  transactionCount = 0;

  constructor(
    readonly membership: MembershipRow,
    readonly tipAnchorId = membership.id,
  ) {}

  transaction() {
    this.transactionCount += 1;
    return {
      execute: async <T>(callback: (trx: this) => Promise<T>) => callback(this),
    };
  }

  selectFrom(table: string): any {
    let ordered = false;
    const query: any = {
      select: () => query,
      where: () => query,
      orderBy: () => {
        ordered = true;
        return query;
      },
      forUpdate: () => query,
      executeTakeFirst: async () =>
        table === 'subscription'
          ? ordered
            ? { id: this.tipAnchorId }
            : this.membership
          : undefined,
    };
    return query;
  }

  updateTable(table: string): any {
    let changes: Record<string, unknown> = {};
    const query: any = {
      set: (value: Record<string, unknown>) => {
        changes = value;
        return query;
      },
      where: () => query,
      returning: () => query,
      executeTakeFirst: async () => {
        if (table !== 'subscription') return undefined;
        Object.assign(this.membership, changes);
        return this.membership;
      },
    };
    return query;
  }

  insertInto(table: string): any {
    let value: unknown;
    const query: any = {
      values: (next: unknown) => {
        value = next;
        return query;
      },
      execute: async () => {
        if (table === 'audit_event') this.audits.push(value);
        return [];
      },
    };
    return query;
  }
}

function membership(overrides: Partial<MembershipRow> = {}): MembershipRow {
  return {
    id: 'membership-1',
    project_id: 'project-1',
    tier_id: 'tier-1',
    user_id: 'user-1',
    status: 'active',
    current_period_end: new Date('2026-09-15T00:00:00.000Z'),
    cancel_at_period_end: false,
    stripe_subscription_id: 'sub_test',
    stripe_account_id: 'acct_test',
    platform_tip_minor: '100',
    currency: 'gbp',
    cadence: 'monthly',
    ...overrides,
  };
}

function event(body: unknown, headers: Record<string, string> = {}) {
  const url = new URL('https://oss.tips/api/v1/me/memberships/membership-1');
  return {
    request: new Request(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    url,
    params: { id: 'membership-1' },
    locals: {
      session: {
        session: { id: 'session-1' },
        user: { id: 'user-1' },
      },
    },
  } as Parameters<typeof PATCH>[0];
}

describe('supporter membership tip PATCH', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
    vi.mocked(hasRecentAuthentication).mockResolvedValue(true);
  });

  it.each([
    [{ cancel_at_period_end: true }, {}],
    [{ platform_tip: { amount: '50', currency: 'gbp' } }, { 'idempotency-key': 'tip-stale' }],
  ])('rejects financial mutation when authentication is stale: %j', async (body, headers) => {
    const db = new FakeDb(membership());
    vi.mocked(getDb).mockReturnValue(db as never);
    vi.mocked(hasRecentAuthentication).mockResolvedValue(false);

    const response = await PATCH(event(body, headers));

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ title: 'Recent authentication required' });
    expect(db.transactionCount).toBe(0);
    expect(createStripeClient).not.toHaveBeenCalled();
  });

  it('updates Stripe and persists a zero tip for the signed-in supporter', async () => {
    const db = new FakeDb(membership());
    const stripe = {
      updateSubscriptionTip: vi.fn().mockResolvedValue({
        subscriptionId: 'sub_test',
        platformTipMinor: 0,
      }),
    };
    vi.mocked(getDb).mockReturnValue(db as never);
    vi.mocked(createStripeClient).mockReturnValue(stripe as never);

    const response = await PATCH(
      event({ platform_tip: { amount: '0', currency: 'gbp' } }, { 'idempotency-key': 'tip-1' }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: 'membership-1',
      platform_tip: { amount: '0', currency: 'gbp' },
    });
    expect(stripe.updateSubscriptionTip).toHaveBeenCalledWith({
      stripeAccountId: 'acct_test',
      subscriptionId: 'sub_test',
      currentTipMinor: 100n,
      platformTipMinor: 0n,
      currency: 'gbp',
      cadence: 'monthly',
      idempotencyKey: 'tip-1',
    });
    expect(db.membership.platform_tip_minor).toBe(0n);
    expect(db.audits[0]).toMatchObject({
      action: 'membership.updated',
      metadata_redacted: { platform_tip_minor: '0' },
    });

    const retry = await PATCH(
      event({ platform_tip: { amount: '0', currency: 'gbp' } }, { 'idempotency-key': 'tip-1' }),
    );
    expect(retry.status).toBe(200);
    expect(stripe.updateSubscriptionTip).toHaveBeenCalledTimes(1);
  });

  it('rejects a tip with missing idempotency or mismatched currency', async () => {
    const db = new FakeDb(membership());
    const stripe = { updateSubscriptionTip: vi.fn() };
    vi.mocked(getDb).mockReturnValue(db as never);
    vi.mocked(createStripeClient).mockReturnValue(stripe as never);

    const missingKey = await PATCH(event({ platform_tip: { amount: '50', currency: 'gbp' } }));
    expect(missingKey.status).toBe(400);

    const wrongCurrency = await PATCH(
      event({ platform_tip: { amount: '50', currency: 'usd' } }, { 'idempotency-key': 'tip-2' }),
    );
    expect(wrongCurrency.status).toBe(409);
    expect(stripe.updateSubscriptionTip).not.toHaveBeenCalled();
    expect(db.membership.platform_tip_minor).toBe('100');
  });

  it('only changes the oldest active recurring membership', async () => {
    const db = new FakeDb(membership(), 'membership-older');
    const stripe = { updateSubscriptionTip: vi.fn() };
    vi.mocked(getDb).mockReturnValue(db as never);
    vi.mocked(createStripeClient).mockReturnValue(stripe as never);

    const response = await PATCH(
      event({ platform_tip: { amount: '50', currency: 'gbp' } }, { 'idempotency-key': 'tip-3' }),
    );

    expect(response.status).toBe(409);
    expect(stripe.updateSubscriptionTip).not.toHaveBeenCalled();
    expect(db.membership.platform_tip_minor).toBe('100');
  });
});
