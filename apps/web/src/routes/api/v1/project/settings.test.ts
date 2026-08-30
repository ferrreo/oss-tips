import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor, ProjectRole } from '@oss-tips/auth';

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

vi.mock('@oss-tips/db', async () => {
  const actual = await vi.importActual<typeof import('@oss-tips/db')>('@oss-tips/db');
  return { ...actual, withEmailSuppressionLock: vi.fn() };
});

vi.mock('./project-management', () => ({
  projectSettings: vi.fn(async () => ({ id: 'project-1' })),
  readProjectManagement: vi.fn(),
  normalizedList: vi.fn((values: string[]) => values),
}));

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { authorizeProject } from '../../api-utils';
import { withEmailSuppressionLock } from '@oss-tips/db';
import { projectSettings, readProjectManagement } from './project-management';
import { GET, PUT } from './+server';

type ProjectState = {
  id: string;
  status: string;
  default_currency: string;
  support_email: string | null;
  support_email_verified_at: Date | null;
  min_support_minor: string | null;
  max_support_minor: string | null;
  public_show_gated_post_metadata: boolean;
};

class FakeDb {
  events: string[] = [];
  inserts: Array<{ table: string; value: unknown }> = [];

  constructor(public project: ProjectState) {}

  transaction() {
    return {
      execute: async <T>(callback: (trx: this) => Promise<T>) => callback(this),
    };
  }

  selectFrom(table: string): any {
    const query: any = {
      select: () => query,
      selectAll: () => query,
      where: () => query,
      forUpdate: () => {
        if (table === 'project') this.events.push('lock');
        return query;
      },
      executeTakeFirst: async () =>
        table === 'project'
          ? {
              support_email: this.project.support_email,
              status: this.project.status,
            }
          : undefined,
    };
    return query;
  }

  deleteFrom(table: string): any {
    const query: any = {
      where: () => query,
      execute: async () => {
        this.events.push(`delete:${table}`);
        return [];
      },
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
      execute: async () => {
        if (table === 'project') Object.assign(this.project, changes);
        this.events.push(`update:${table}`);
        return [{ numUpdatedRows: 1n }];
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

function project(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    id: 'project-1',
    status: 'published',
    default_currency: 'gbp',
    support_email: 'owner@example.com',
    support_email_verified_at: new Date('2026-08-30T10:00:00.000Z'),
    min_support_minor: null,
    max_support_minor: null,
    public_show_gated_post_metadata: false,
    ...overrides,
  };
}

function actor(role: ProjectRole): Actor {
  return {
    kind: 'user',
    userId: `user-${role}`,
    projectRoles: new Map([['project-1', role]]),
    platformRoles: [],
  };
}

function event(body: unknown = undefined, method = 'PUT') {
  const url = new URL('https://oss.tips/api/v1/project');
  return {
    request: new Request(url, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    }),
    url,
    locals: {
      session: {
        session: { id: 'session-1' },
        user: { id: 'owner-1', email: 'owner@example.com', emailVerified: true },
      },
    },
  } as Parameters<typeof PUT>[0];
}

describe('project settings support email rotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
    vi.mocked(withEmailSuppressionLock).mockImplementation(async (db, _email, callback) =>
      callback(db),
    );
    vi.mocked(authorizeProject).mockResolvedValue({
      source: 'session',
      projectId: 'project-1',
      userId: 'owner-1',
      actor: actor('owner'),
    });
    vi.mocked(readProjectManagement).mockImplementation(
      async (connection) =>
        ({
          project: (connection as unknown as FakeDb).project,
          repository: undefined,
          claim: undefined,
        }) as never,
    );
  });

  it('demotes a published project when support email actually rotates', async () => {
    const db = new FakeDb(project());
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await PUT(event({ support_email: 'new@example.com' }));

    expect(response.status).toBe(200);
    expect(db.project).toMatchObject({
      status: 'draft',
      support_email: 'new@example.com',
      support_email_verified_at: null,
    });
    expect(db.inserts.map(({ table }) => table)).toEqual([
      'project_status_history',
      'audit_event',
      'outbox_event',
    ]);
    expect(db.inserts[0]?.value).toMatchObject({
      from_status: 'published',
      to_status: 'draft',
      reason: 'support_email_changed',
    });
    expect(db.inserts[2]?.value).toMatchObject({
      payload: { status: 'draft' },
    });
  });

  it('preserves published status when only email casing differs', async () => {
    const db = new FakeDb(project());
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await PUT(event({ support_email: 'OWNER@EXAMPLE.COM' }));

    expect(response.status).toBe(200);
    expect(db.project.status).toBe('published');
    expect(db.project.support_email_verified_at).not.toBeNull();
    expect(db.events).toEqual(['update:project']);
    expect(db.inserts.map(({ table }) => table)).toEqual(['audit_event', 'outbox_event']);
    expect(withEmailSuppressionLock).not.toHaveBeenCalled();
  });

  it('persists the gated post metadata opt-in', async () => {
    const db = new FakeDb(project());
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await PUT(event({ public_display: { show_gated_post_metadata: true } }));

    expect(response.status).toBe(200);
    expect(db.project.public_show_gated_post_metadata).toBe(true);
  });

  it.each(['finance', 'editor', 'community', 'analyst'] as const)(
    'does not expose settings to %s project members',
    async (role) => {
      vi.mocked(authorizeProject).mockResolvedValue({
        source: 'session',
        projectId: 'project-1',
        userId: `user-${role}`,
        actor: actor(role),
      });

      const response = await GET(event(undefined, 'GET'));

      expect(response.status).toBe(403);
      expect(projectSettings).not.toHaveBeenCalled();
    },
  );

  it('does not expose settings through a read-only project API key', async () => {
    vi.mocked(authorizeProject).mockResolvedValue({
      source: 'api_key',
      projectId: 'project-1',
      actor: {
        kind: 'api_key',
        projectId: 'project-1',
        scopes: new Set(['project:read']),
        keyId: 'key-1',
        rateLimitKey: 'rate-key-1',
      },
    });

    const response = await GET(event(undefined, 'GET'));

    expect(response.status).toBe(403);
    expect(projectSettings).not.toHaveBeenCalled();
  });
});
