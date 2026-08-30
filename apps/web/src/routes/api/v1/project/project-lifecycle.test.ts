import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('../../api-utils', async () => {
  const actual = await vi.importActual<typeof import('../../api-utils')>('../../api-utils');
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

vi.mock('$lib/server/session', () => ({
  hasRecentAuthentication: vi.fn(async () => true),
  recentAuthenticationRedirectPath: vi.fn(() => '/sign-in'),
}));

vi.mock('./project-management', () => ({
  normalizedList: vi.fn((values: string[]) => values),
  projectSettings: vi.fn(),
  readProjectManagement: vi.fn(),
}));

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { hasRecentAuthentication } from '$lib/server/session';
import { authorizeProject } from '../../api-utils';
import { DELETE } from './+server';

type Project = {
  id: string;
  status: string;
  closed_at: Date | null;
  updated_at: Date;
};

type Blockers = {
  subscription?: boolean;
  payment?: boolean;
  checkout?: boolean;
  settledCheckout?: boolean;
  domain?: boolean;
  webhook?: boolean;
  apiKey?: boolean;
};

class FakeDb {
  inserts: Array<{ table: string; value: unknown }> = [];
  updates: Array<{ table: string; value: Record<string, unknown> }> = [];
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(
    public project: Project,
    public blockers: Blockers = {},
  ) {}

  transaction() {
    return {
      execute: async <T>(callback: (trx: this) => Promise<T>): Promise<T> => {
        const previous = this.transactionTail;
        let release!: () => void;
        this.transactionTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await callback(this);
        } finally {
          release();
        }
      },
    };
  }

  selectFrom(table: string): any {
    const query: any = {
      leftJoin: () => query,
      select: () => query,
      where: () => query,
      limit: () => query,
      forUpdate: () => query,
      executeTakeFirst: async () => {
        if (table === 'project') return { ...this.project };
        if (table === 'subscription' && this.blockers.subscription) return { id: 'subscription-1' };
        if (table === 'payment' && this.blockers.payment) return { id: 'payment-1' };
        if (table === 'checkout_intent' && this.blockers.checkout) return { id: 'checkout-1' };
        if (table === 'custom_domain' && this.blockers.domain) return { id: 'domain-1' };
        if (table === 'webhook_endpoint' && this.blockers.webhook) return { id: 'webhook-1' };
        if (table === 'api_key' && this.blockers.apiKey) return { id: 'key-1' };
        return undefined;
      },
    };
    return query;
  }

  updateTable(table: string): any {
    let value: Record<string, unknown> = {};
    const query: any = {
      set: (next: Record<string, unknown>) => {
        value = next;
        return query;
      },
      where: () => query,
      execute: async () => {
        this.updates.push({ table, value });
        if (table === 'project') Object.assign(this.project, value);
        return [];
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
        this.inserts.push({ table, value });
        return [];
      },
    };
    return query;
  }
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    status: 'published',
    closed_at: null,
    updated_at: new Date('2026-08-30T12:00:00.000Z'),
    ...overrides,
  };
}

function event() {
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

describe('project closure route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
    vi.mocked(hasRecentAuthentication).mockResolvedValue(true);
    vi.mocked(authorizeProject).mockResolvedValue({
      source: 'session',
      projectId: 'project-1',
      userId: 'owner-1',
      actor: {
        kind: 'user',
        userId: 'owner-1',
        projectRoles: new Map([['project-1', 'owner']]),
        platformRoles: [],
      },
    });
  });

  it('closes a project transactionally and records history, audit, and outbox rows', async () => {
    const db = new FakeDb(project());
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await DELETE(event());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'closed', project_id: 'project-1' });
    expect(db.project.status).toBe('closed');
    expect(db.project.closed_at).toBeInstanceOf(Date);
    expect(db.inserts.map(({ table }) => table)).toEqual([
      'project_status_history',
      'audit_event',
      'outbox_event',
    ]);
    expect(db.inserts[0]?.value).toMatchObject({
      from_status: 'published',
      to_status: 'closed',
      reason: 'owner_close',
    });
  });

  it('does not block closure for a settled checkout or connected Stripe account', async () => {
    const db = new FakeDb(project(), { settledCheckout: true });
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await DELETE(event());

    expect(response.status).toBe(200);
    expect(db.project.status).toBe('closed');
  });

  it('blocks an unexpired checkout intent without a settled payment', async () => {
    const db = new FakeDb(project(), { checkout: true });
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await DELETE(event());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ title: 'Project cannot be closed yet' });
    expect(db.project.status).toBe('published');
  });

  it('returns one conflict listing active external blockers without changing status', async () => {
    const db = new FakeDb(project(), {
      subscription: true,
      payment: true,
      checkout: true,
      domain: true,
      webhook: true,
      apiKey: true,
    });
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await DELETE(event());
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.detail).toContain('active memberships');
    expect(payload.detail).toContain('pending payments');
    expect(payload.detail).toContain('custom domains');
    expect(payload.detail).toContain('active webhooks');
    expect(payload.detail).toContain('active API keys');
    expect(db.project.status).toBe('published');
    expect(db.inserts).toEqual([]);
  });

  it('is idempotent after closure and does not add duplicate records', async () => {
    const closedAt = new Date('2026-08-30T12:01:00.000Z');
    const db = new FakeDb(project({ status: 'closed', closed_at: closedAt }));
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await DELETE(event());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'already_closed',
      project_id: 'project-1',
      closed_at: closedAt.toISOString(),
    });
    expect(db.inserts).toEqual([]);
  });

  it('requires recent authentication before opening the closure transaction', async () => {
    vi.mocked(hasRecentAuthentication).mockResolvedValue(false);
    const db = new FakeDb(project());
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await DELETE(event());

    expect(response.status).toBe(403);
    expect(db.project.status).toBe('published');
    expect(db.inserts).toEqual([]);
  });

  it('rejects callers without the delete capability', async () => {
    vi.mocked(authorizeProject).mockResolvedValue(new Response(null, { status: 403 }) as never);
    const db = new FakeDb(project());
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await DELETE(event());

    expect(response.status).toBe(403);
    expect(db.project.status).toBe('published');
  });

  it('serializes concurrent closure requests and records one transition', async () => {
    const db = new FakeDb(project());
    vi.mocked(getDb).mockReturnValue(db as never);

    const responses = await Promise.all([DELETE(event()), DELETE(event())]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(db.inserts.filter(({ table }) => table === 'project_status_history')).toHaveLength(1);
    expect(db.inserts.filter(({ table }) => table === 'audit_event')).toHaveLength(1);
    expect(db.inserts.filter(({ table }) => table === 'outbox_event')).toHaveLength(1);
  });
});
