import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('@oss-tips/db', () => ({
  emailNotificationJob: vi.fn(() => ({ id: 'job-1' })),
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
import { POST } from './+server';

class FakeDb {
  projectStatus = 'published';
  projectLockCalls = 0;
  writes: string[] = [];

  constructor(private readonly closeBeforeTransaction = false) {}

  transaction() {
    if (this.closeBeforeTransaction) this.projectStatus = 'closed';
    return {
      execute: async <T>(callback: (trx: this) => Promise<T>) => callback(this),
    };
  }

  selectFrom(table: string): any {
    const query: any = {
      select: () => query,
      where: () => query,
      forUpdate: () => {
        if (table === 'project') this.projectLockCalls += 1;
        return query;
      },
      executeTakeFirst: async () => {
        if (table === 'project') return { status: this.projectStatus };
        return undefined;
      },
    };
    return query;
  }

  insertInto(table: string): any {
    let value: Record<string, unknown> = {};
    const query: any = {
      values: (next: Record<string, unknown>) => {
        value = next;
        return query;
      },
      returning: () => query,
      executeTakeFirstOrThrow: async () => ({
        ...value,
        created_at: new Date('2026-08-30T12:00:00.000Z'),
      }),
      execute: async () => {
        this.writes.push(table);
        return [];
      },
    };
    return query;
  }
}

function event() {
  const url = new URL('https://oss.tips/api/v1/project/team');
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'member@example.com', role: 'editor' }),
    }),
    url,
    locals: { session: { user: { id: 'owner-1' } } },
  } as Parameters<typeof POST>[0];
}

describe('team invite creation route', () => {
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

  it('rejects creation when closure commits after authorization precheck', async () => {
    const db = new FakeDb(true);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ title: 'Project is closed' });
    expect(db.projectLockCalls).toBe(1);
    expect(db.writes).toEqual([]);
  });
});
