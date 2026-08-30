import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('../../../api-utils', async () => {
  const actual = await vi.importActual<typeof import('../../../api-utils')>('../../../api-utils');
  return {
    ...actual,
    authorizeProject: vi.fn(),
    auditRecord: vi.fn(() => ({})),
  };
});

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { authorizeProject } from '../../../api-utils';
import { DELETE, PATCH } from './[id]/+server';

class FakeDb {
  transactionCalls = 0;
  projectLockCalls = 0;
  projectStatus = 'published';
  writes: string[] = [];

  constructor(
    private readonly memberRole = 'owner',
    private readonly raceAsOwner = false,
    private readonly closeBeforeTransaction = false,
  ) {}

  transaction() {
    this.transactionCalls += 1;
    if (this.closeBeforeTransaction) this.projectStatus = 'closed';
    return {
      execute: async <T>(callback: (trx: this) => Promise<T>) => callback(this),
    };
  }

  selectFrom(table: string): any {
    const query: any = {
      innerJoin: () => query,
      select: () => query,
      where: () => query,
      forUpdate: () => {
        if (table === 'project') this.projectLockCalls += 1;
        return query;
      },
      executeTakeFirst: async () =>
        table === 'project'
          ? { status: this.projectStatus }
          : table === 'project_member'
            ? {
                id: 'member-owner',
                user_id: 'owner-1',
                name: 'Ada Lovelace',
                email: 'ada@example.com',
                role: this.memberRole,
                capabilities: [],
                created_at: new Date('2026-08-01T00:00:00.000Z'),
                updated_at: new Date('2026-08-01T00:00:00.000Z'),
              }
            : undefined,
      execute: async () => [],
    };
    return query;
  }

  updateTable(table: string): any {
    const query: any = {
      set: () => query,
      where: () => query,
      returning: () => query,
      executeTakeFirst: async () => {
        this.writes.push(table);
        if (table !== 'project_member' || this.raceAsOwner) return undefined;
        return {
          id: 'member-editor',
          user_id: 'editor-1',
          role: 'admin',
          capabilities: [],
          created_at: new Date('2026-08-01T00:00:00.000Z'),
          updated_at: new Date('2026-08-01T00:00:00.000Z'),
        };
      },
    };
    return query;
  }

  deleteFrom(table: string): any {
    const query: any = {
      where: () => query,
      executeTakeFirst: async () => {
        this.writes.push(table);
        return { numDeletedRows: this.raceAsOwner ? 0n : 1n };
      },
    };
    return query;
  }
}

function event() {
  const url = new URL('https://oss.tips/api/v1/project/team/member-owner');
  return {
    request: new Request(url, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    }),
    url,
    params: { id: 'member-owner' },
    locals: { session: { user: { id: 'owner-1' } } },
  } as Parameters<typeof PATCH>[0];
}

function deleteEvent() {
  const url = new URL('https://oss.tips/api/v1/project/team/member-editor');
  return {
    request: new Request(url, { method: 'DELETE' }),
    url,
    params: { id: 'member-editor' },
    locals: { session: { user: { id: 'owner-1' } } },
  } as Parameters<typeof DELETE>[0];
}

describe('project team member owner invariant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
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

  it('routes owner changes through the ownership transfer workflow', async () => {
    const db = new FakeDb();
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await PATCH(event());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ title: 'Transfer ownership first' });
    expect(db.transactionCalls).toBe(0);
  });

  it('rejects a patch when transfer promotes member after the initial read', async () => {
    const db = new FakeDb('editor', true);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await PATCH(event());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ title: 'Transfer ownership first' });
  });

  it('rejects a delete when transfer promotes member after the initial read', async () => {
    const db = new FakeDb('editor', true);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await DELETE(deleteEvent());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ title: 'Transfer ownership first' });
  });

  it('rejects a patch when closure commits after the initial read', async () => {
    const db = new FakeDb('editor', false, true);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await PATCH(event());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ title: 'Project is closed' });
    expect(db.projectLockCalls).toBe(1);
    expect(db.writes).toEqual([]);
  });

  it('rejects a delete when closure commits after the initial read', async () => {
    const db = new FakeDb('editor', false, true);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await DELETE(deleteEvent());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ title: 'Project is closed' });
    expect(db.projectLockCalls).toBe(1);
    expect(db.writes).toEqual([]);
  });
});
