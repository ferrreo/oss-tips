import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createCheckoutIntent: vi.fn(),
  createStripeClient: vi.fn(),
}));

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('$lib/server/session', () => ({
  hasRecentAuthentication: vi.fn(async () => true),
  recentAuthenticationRedirectPath: vi.fn(() => '/sign-in'),
}));

vi.mock('@oss-tips/payments', async () => {
  const actual = await vi.importActual<typeof import('@oss-tips/payments')>('@oss-tips/payments');
  return {
    ...actual,
    createCheckoutIntent: mocks.createCheckoutIntent,
    createStripeClient: mocks.createStripeClient,
  };
});

vi.mock('../../../../api-utils', async () => {
  const actual =
    await vi.importActual<typeof import('../../../../api-utils')>('../../../../api-utils');
  return {
    ...actual,
    authorizeProject: vi.fn(async () => ({
      source: 'session',
      projectId: 'project-1',
      userId: 'owner-1',
    })),
    auditRecord: vi.fn(() => ({})),
  };
});

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { DELETE } from '../../../project/+server';
import { POST } from './+server';

type Project = {
  id: string;
  slug: string;
  status: string;
  default_currency: string;
  min_support_minor: string | null;
  max_support_minor: string | null;
  updated_at: Date;
};

class FakeDb {
  payments: unknown[] = [];
  intents: unknown[] = [];
  events: string[] = [];
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(public project: Project) {}

  transaction() {
    return {
      execute: async <T>(callback: (trx: this) => Promise<T>): Promise<T> => {
        const previous = this.transactionTail;
        let release!: () => void;
        this.transactionTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        const payments = [...this.payments];
        const intents = [...this.intents];
        try {
          return await callback(this);
        } catch (error) {
          this.payments = payments;
          this.intents = intents;
          throw error;
        } finally {
          release();
        }
      },
    };
  }

  selectFrom(table: string) {
    const query: any = {
      innerJoin: () => query,
      leftJoin: () => query,
      select: () => query,
      selectAll: () => query,
      where: () => query,
      limit: () => query,
      forUpdate: () => {
        this.events.push(`lock:${table}`);
        return query;
      },
      executeTakeFirst: async () => {
        if (table === 'project') return { ...this.project };
        if (table === 'stripe_connected_account') {
          return {
            project_id: 'project-1',
            stripe_account_id: 'acct_test',
            charges_enabled: true,
            payouts_enabled: true,
            capabilities: { card_payments: 'active' },
          };
        }
        return undefined;
      },
    };
    return query;
  }

  insertInto(table: string) {
    let value: unknown;
    const query: any = {
      values: (next: unknown) => {
        value = next;
        return query;
      },
      onConflict: () => query,
      execute: async () => {
        if (table === 'payment') this.payments.push(value);
        if (table === 'checkout_intent') this.intents.push(value);
      },
    };
    return query;
  }

  updateTable(table: string) {
    let changes: Record<string, unknown> = {};
    const query: any = {
      set: (next: Record<string, unknown>) => {
        changes = next;
        return query;
      },
      where: () => query,
      execute: async () => {
        if (table === 'project') Object.assign(this.project, changes);
      },
    };
    return query;
  }
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    slug: 'grove',
    status: 'published',
    default_currency: 'gbp',
    min_support_minor: null,
    max_support_minor: null,
    updated_at: new Date('2026-08-30T12:00:00.000Z'),
    ...overrides,
  };
}

function event() {
  const url = new URL('https://oss.tips/api/v1/projects/grove/checkout');
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'race-1' },
      body: JSON.stringify({
        projectAmountMinor: 1000,
        projectCurrency: 'gbp',
        platformTipMinor: 0,
        cadence: 'one_off',
        publicOptions: { showName: true, showAmount: true, showMessage: false },
      }),
    }),
    url,
    params: { slug: 'grove' },
    locals: { session: null },
  } as Parameters<typeof POST>[0];
}

function closureEvent() {
  const url = new URL('https://oss.tips/api/v1/project');
  return {
    request: new Request(url, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    }),
    url,
    locals: {
      session: {
        session: { id: 'session-1' },
        user: { id: 'owner-1', email: 'owner@example.com', emailVerified: true },
      },
    },
  } as Parameters<typeof DELETE>[0];
}

describe('checkout persistence race', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
    mocks.createStripeClient.mockReturnValue({});
  });

  it('rejects checkout when closure wins provider/persistence interleaving', async () => {
    const db = new FakeDb(project());
    vi.mocked(getDb).mockReturnValue(db as never);

    let providerStarted!: () => void;
    let releaseProvider!: () => void;
    const providerReady = new Promise<void>((resolve) => {
      providerStarted = resolve;
    });
    const providerReleased = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    mocks.createCheckoutIntent.mockImplementation(async () => {
      providerStarted();
      await providerReleased;
      return {
        intentId: 'payment-1',
        clientSecret: null,
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test',
        expiresAt: '2026-08-30T12:30:00.000Z',
        applicationFeeMinor: '100',
        customerChargeMinor: '1000',
        currency: 'gbp',
        mode: 'payment',
      };
    });

    const responsePromise = POST(event());
    await providerReady;
    const closureResponse = await DELETE(closureEvent());
    expect(closureResponse.status).toBe(200);
    releaseProvider();

    const response = await responsePromise;

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ title: 'Checkout unavailable' });
    expect(db.project.status).toBe('closed');
    expect(db.payments).toEqual([]);
    expect(db.intents).toEqual([]);
    expect(db.events).toContain('lock:project');
  });
});
