import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('$lib/server/auth', () => ({
  getAuthSecret: vi.fn(() => 'test-secret'),
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
  };
});

vi.mock('@oss-tips/db', async () => {
  const actual = await vi.importActual<typeof import('@oss-tips/db')>('@oss-tips/db');
  return { ...actual, withEmailSuppressionLock: vi.fn() };
});

import { getDb } from '$lib/server/db';
import { withEmailSuppressionLock } from '@oss-tips/db';
import { POST } from './verification/+server';

type Query = {
  select: (...args: unknown[]) => Query;
  where: (...args: unknown[]) => Query;
  orderBy: (...args: unknown[]) => Query;
  forUpdate: () => Query;
  executeTakeFirst: () => Promise<unknown>;
  execute: () => Promise<unknown>;
};

class FakeDb {
  inLock = false;
  verificationCreatedAt: Date | null = null;
  inserts: Array<{ table: string; value: unknown }> = [];
  project = {
    support_email: 'maintainer@example.com',
    support_email_verified_at: null as Date | null,
    status: 'draft',
  };

  selectFrom(table: string): Query {
    const query = {
      select: () => query,
      where: () => query,
      orderBy: () => query,
      forUpdate: () => query,
      executeTakeFirst: async () => {
        if (table === 'project') return this.project;
        if (table === 'verification' && this.inLock && this.verificationCreatedAt) {
          return { created_at: this.verificationCreatedAt };
        }
        return undefined;
      },
      execute: async () => [],
    };
    return query;
  }

  transaction() {
    return { execute: async <T>(callback: (trx: this) => Promise<T>) => callback(this) };
  }

  deleteFrom(table: string) {
    const query = {
      where: () => query,
      execute: async () => {
        if (table === 'verification') this.verificationCreatedAt = null;
        return [];
      },
    };
    return query;
  }

  insertInto(table: string) {
    let value: unknown;
    const query = {
      values: (next: unknown) => {
        value = next;
        return query;
      },
      execute: async () => {
        if (table === 'verification') this.verificationCreatedAt = new Date();
        this.inserts.push({ table, value });
        return [];
      },
    };
    return query;
  }

  updateTable(table: string) {
    let changes: Record<string, unknown> = {};
    const query = {
      set: (next: Record<string, unknown>) => {
        changes = next;
        return query;
      },
      where: () => query,
      execute: async () => {
        if (table === 'project') Object.assign(this.project, changes);
        return [];
      },
    };
    return query;
  }
}

function event(body: unknown = { action: 'send' }) {
  const url = new URL('https://oss.tips/api/v1/project/support-email/verification');
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
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

describe('support email verification resend locking', () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T12:00:00.000Z'));
    vi.clearAllMocks();
    vi.mocked(withEmailSuppressionLock).mockImplementation(async (db, _email, callback) => {
      const fakeDb = db as unknown as FakeDb;
      fakeDb.inLock = true;
      try {
        return await callback(db);
      } finally {
        fakeDb.inLock = false;
      }
    });
  });

  it('applies resend cooldown after first request commits under the lock', async () => {
    const db = new FakeDb();
    vi.mocked(getDb).mockReturnValue(db as never);

    const first = await POST(event());
    const second = await POST(event());

    expect(first.status).toBe(202);
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).toBe('30');
  });

  it('demotes a published project when the support email rotates', async () => {
    const db = new FakeDb();
    db.project.status = 'published';
    db.project.support_email_verified_at = new Date('2026-08-30T10:00:00.000Z');
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event({ action: 'send', email: 'new@example.com' }));

    expect(response.status).toBe(202);
    expect(db.project).toMatchObject({
      status: 'draft',
      support_email: 'new@example.com',
      support_email_verified_at: null,
    });
    expect(db.inserts.map(({ table }) => table)).toContain('project_status_history');
    expect(db.inserts.find(({ table }) => table === 'project_status_history')?.value).toMatchObject(
      {
        from_status: 'published',
        to_status: 'draft',
        reason: 'support_email_changed',
      },
    );
    expect(db.inserts.find(({ table }) => table === 'outbox_event')?.value).toMatchObject({
      payload: { status: 'draft' },
    });
  });

  it('preserves verification when only email casing differs', async () => {
    const db = new FakeDb();
    db.project.status = 'published';
    db.project.support_email = 'MAINTAINER@EXAMPLE.COM';
    db.project.support_email_verified_at = new Date('2026-08-30T10:00:00.000Z');
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await POST(event({ action: 'send', email: 'maintainer@example.com' }));

    expect(response.status).toBe(200);
    expect(db.project.status).toBe('published');
    expect(db.project.support_email_verified_at).not.toBeNull();
    expect(db.inserts).toEqual([]);
  });
});
