import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('../../../api-utils', async () => {
  const actual = await vi.importActual<typeof import('../../../api-utils')>('../../../api-utils');
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

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { hasRecentAuthentication } from '$lib/server/session';
import { POST } from './transfer/+server';

type Member = {
  id: string;
  user_id: string;
  role: string;
  email: string;
  email_verified: boolean;
  updated_at?: Date;
};

class FakeDb {
  members: Member[];
  inserts: Array<{ table: string; value: unknown }> = [];
  projectStatus: string;
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(members: Member[], projectStatus = 'published') {
    this.members = members;
    this.projectStatus = projectStatus;
  }

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
    const conditions: Record<string, unknown> = {};
    const query: any = {
      innerJoin: () => query,
      select: () => query,
      where: (field: string, _operator: string, value: unknown) => {
        conditions[field] = value;
        return query;
      },
      forUpdate: () => query,
      executeTakeFirst: async () => {
        if (table === 'project') return { id: 'project-1', status: this.projectStatus };
        return undefined;
      },
      execute: async () => {
        if (table !== 'project_member') return [];
        return this.members.map((member) => ({ ...member }));
      },
    };
    return query;
  }

  updateTable(table: string): any {
    let changes: Record<string, unknown> = {};
    const conditions: Record<string, unknown> = {};
    const query: any = {
      set: (value: Record<string, unknown>) => {
        changes = value;
        return query;
      },
      where: (field: string, _operator: string, value: unknown) => {
        conditions[field] = value;
        return query;
      },
      execute: async () => {
        if (table === 'project_member') {
          const member = this.members.find((candidate) => candidate.id === conditions.id);
          if (member) Object.assign(member, changes);
        }
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

function members(overrides: Partial<Member>[] = []): Member[] {
  const base: Member[] = [
    {
      id: 'member-owner',
      user_id: 'owner-1',
      role: 'owner',
      email: 'owner@example.com',
      email_verified: true,
    },
    {
      id: 'member-target',
      user_id: 'target-1',
      role: 'editor',
      email: 'target@example.com',
      email_verified: true,
    },
  ];
  return base.map((member, index) => ({ ...member, ...overrides[index] }));
}

function event(email: string) {
  const url = new URL('https://oss.tips/api/v1/project/ownership/transfer');
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
    url,
    locals: {
      session: {
        session: { id: 'session-1' },
        user: { id: 'owner-1', email: 'owner@example.com', emailVerified: true },
      },
    },
  } as Parameters<typeof POST>[0];
}

describe('project ownership transfer route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
    vi.mocked(hasRecentAuthentication).mockResolvedValue(true);
  });

  it('transfers to a verified member using a case-insensitive email', async () => {
    const db = new FakeDb(members());
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event('TARGET@EXAMPLE.COM'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'transferred',
      project_id: 'project-1',
      previous_owner_id: 'owner-1',
      new_owner_id: 'target-1',
    });
    expect(db.members.filter((member) => member.role === 'owner')).toHaveLength(1);
    expect(db.members).toEqual([
      expect.objectContaining({ user_id: 'owner-1', role: 'admin' }),
      expect.objectContaining({ user_id: 'target-1', role: 'owner' }),
    ]);
    expect(db.inserts.map(({ table }) => table)).toEqual(['audit_event', 'outbox_event']);
  });

  it('allows a closed owner to transfer ownership for account recovery', async () => {
    const db = new FakeDb(members(), 'closed');
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event('target@example.com'));

    expect(response.status).toBe(200);
    expect(db.members.filter((member) => member.role === 'owner')).toHaveLength(1);
  });

  it('rejects an unverified target without changing membership', async () => {
    const db = new FakeDb(members([{}, { email_verified: false }]));
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event('target@example.com'));

    expect(response.status).toBe(409);
    expect(db.members.map((member) => member.role)).toEqual(['owner', 'editor']);
    expect(db.inserts).toEqual([]);
  });

  it('requires recent authentication', async () => {
    vi.mocked(hasRecentAuthentication).mockResolvedValue(false);
    const db = new FakeDb(members());
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event('target@example.com'));

    expect(response.status).toBe(403);
    expect(db.members.map((member) => member.role)).toEqual(['owner', 'editor']);
  });

  it('serializes concurrent transfers and preserves exactly one owner', async () => {
    const db = new FakeDb(members());
    vi.mocked(getDb).mockReturnValue(db as never);

    const responses = await Promise.all([
      POST(event('target@example.com')),
      POST(event('target@example.com')),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(db.members.filter((member) => member.role === 'owner')).toHaveLength(1);
    expect(db.inserts.filter(({ table }) => table === 'audit_event')).toHaveLength(1);
  });
});
