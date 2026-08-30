import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { POST } from './accept/+server';

type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

type Invite = {
  id: string;
  project_id: string;
  email: string;
  role: string;
  capabilities: string[];
  invited_by: string;
  status: InviteStatus;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type Member = {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  capabilities: string[];
};

class FakeDb {
  members: Member[] = [];
  inserts: Array<{ table: string; value: unknown }> = [];
  forUpdateCalls = 0;
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(
    public invite: Invite | null,
    public projectStatus = 'published',
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
    const conditions: Record<string, unknown> = {};
    const query: any = {
      select: () => query,
      selectAll: () => query,
      where: (field: string, _operator: string, value: unknown) => {
        conditions[field] = value;
        return query;
      },
      forUpdate: () => {
        this.forUpdateCalls += 1;
        return query;
      },
      executeTakeFirst: async () => {
        if (table === 'project_team_invite') {
          return this.invite && this.invite.id === conditions.id ? this.invite : undefined;
        }
        if (table === 'project_member') {
          return this.members.find(
            (member) =>
              member.project_id === conditions.project_id && member.user_id === conditions.user_id,
          );
        }
        if (table === 'project') return { status: this.projectStatus };
        return undefined;
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
        const invite = this.invite;
        if (table === 'project_team_invite' && invite && invite.id === conditions.id) {
          Object.assign(invite, changes);
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
        if (table === 'project_member') this.members.push(value as Member);
        return [];
      },
    };
    return query;
  }
}

function invite(overrides: Partial<Invite> = {}): Invite {
  const now = new Date('2026-08-30T12:00:00.000Z');
  return {
    id: 'invite-1',
    project_id: 'project-1',
    email: 'member@example.com',
    role: 'editor',
    capabilities: ['project.manage_team'],
    invited_by: 'owner-1',
    status: 'pending',
    expires_at: new Date(now.getTime() + 60 * 60 * 1000),
    accepted_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function session(email = 'member@example.com', emailVerified = true): App.Locals['session'] {
  return {
    session: { id: 'session-1' },
    user: { id: 'member-1', email, name: 'Member', emailVerified },
  } as App.Locals['session'];
}

function event(currentSession: App.Locals['session'] | null = session()) {
  const url = new URL('https://oss.tips/api/v1/project/team/invites/invite-1/accept');
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }),
    url,
    params: { id: 'invite-1' },
    locals: { session: currentSession },
  } as Parameters<typeof POST>[0];
}

describe('team invite acceptance route', () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T12:00:00.000Z'));
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
  });

  it('rejects signed-out requests before opening a transaction', async () => {
    const response = await POST(event(null));

    expect(response.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
  });

  it('rejects an unverified matching email before opening a transaction', async () => {
    const response = await POST(event(session('member@example.com', false)));

    expect(response.status).toBe(403);
    expect(getDb).not.toHaveBeenCalled();
  });

  it('returns 404 for missing invite and locks the lookup', async () => {
    const db = new FakeDb(null);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event());

    expect(response.status).toBe(404);
    expect(db.forUpdateCalls).toBe(1);
  });

  it('returns 403 without changing invite for a mismatched email', async () => {
    const db = new FakeDb(invite());
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event(session('other@example.com')));

    expect(response.status).toBe(403);
    expect(db.invite?.status).toBe('pending');
    expect(db.members).toEqual([]);
    expect(db.inserts).toEqual([]);
  });

  it('marks an expired pending invite and returns 410', async () => {
    const db = new FakeDb(invite({ expires_at: new Date('2026-08-30T11:59:00.000Z') }));
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event());

    expect(response.status).toBe(410);
    expect(db.invite?.status).toBe('expired');
    expect(db.inserts).toEqual([]);
  });

  it.each(['revoked', 'accepted'] as const)('returns 409 for %s invite', async (status) => {
    const db = new FakeDb(invite({ status }));
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event());

    expect(response.status).toBe(409);
    expect(db.inserts).toEqual([]);
  });

  it('accepts matching invite and creates one membership', async () => {
    const db = new FakeDb(invite());
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'accepted', project_id: 'project-1' });
    expect(db.invite?.status).toBe('accepted');
    expect(db.members).toHaveLength(1);
    expect(db.inserts.map(({ table }) => table)).toEqual([
      'project_member',
      'audit_event',
      'outbox_event',
    ]);
  });

  it('rejects acceptance after project closure', async () => {
    const db = new FakeDb(invite(), 'closed');
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event());

    expect(response.status).toBe(409);
    expect(db.invite?.status).toBe('pending');
    expect(db.members).toEqual([]);
    expect(db.inserts).toEqual([]);
  });

  it('serializes concurrent acceptance and rejects second attempt', async () => {
    const db = new FakeDb(invite());
    vi.mocked(getDb).mockReturnValue(db as never);

    const responses = await Promise.all([POST(event()), POST(event())]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(db.members).toHaveLength(1);
    expect(db.forUpdateCalls).toBe(3);
  });
});
