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

vi.mock('./project-management', () => ({
  projectSettings: vi.fn(async () => ({ id: 'project-1' })),
  readProjectManagement: vi.fn(),
  publishEligibility: vi.fn((project: ProjectState) => {
    const missing: string[] = [];
    if (!project.website_url) missing.push('website');
    if (!project.support_email) missing.push('support_email');
    else if (!project.support_email_verified_at) missing.push('verified_support_email');
    if (!project.open_source_declared) missing.push('open_source_declaration');
    return { eligible: missing.length === 0, missing };
  }),
  validatePublishEligibility: vi.fn((value) => value),
}));

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { readProjectManagement } from './project-management';
import { POST } from './publish/+server';

type ProjectState = {
  id: string;
  status: string;
  website_url: string | null;
  support_email: string | null;
  support_email_verified_at: Date | null;
  open_source_declared: boolean;
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
      executeTakeFirst: async () => (table === 'project' ? { id: this.project.id } : undefined),
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
    status: 'draft',
    website_url: 'https://example.com',
    support_email: 'owner@example.com',
    support_email_verified_at: new Date('2026-08-30T10:00:00.000Z'),
    open_source_declared: true,
    ...overrides,
  };
}

function event() {
  const url = new URL('https://oss.tips/api/v1/project/publish');
  return {
    request: new Request(url, {
      method: 'POST',
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
  } as Parameters<typeof POST>[0];
}

describe('project publish route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
  });

  it('rechecks current eligibility after locking the project row', async () => {
    const db = new FakeDb(project());
    vi.mocked(getDb).mockReturnValue(db as never);
    vi.mocked(readProjectManagement).mockImplementation(async (connection) => {
      const current = connection as unknown as FakeDb;
      current.events.push('eligibility-read');
      current.project.support_email_verified_at = null;
      return {
        project: current.project,
        repository: undefined,
        claim: undefined,
      } as never;
    });

    const response = await POST(event());

    expect(response.status).toBe(409);
    expect(db.events).toEqual(['lock', 'eligibility-read']);
    expect(db.project.status).toBe('draft');
    expect(db.inserts).toEqual([]);
  });

  it('publishes an eligible project inside the same locked transaction', async () => {
    const db = new FakeDb(project());
    vi.mocked(getDb).mockReturnValue(db as never);
    vi.mocked(readProjectManagement).mockImplementation(async (connection) => {
      const current = connection as unknown as FakeDb;
      current.events.push('eligibility-read');
      return {
        project: current.project,
        repository: undefined,
        claim: { status: 'verified' },
      } as never;
    });

    const response = await POST(event());

    expect(response.status).toBe(200);
    expect(db.events).toEqual(['lock', 'eligibility-read', 'update:project']);
    expect(db.project.status).toBe('published');
    expect(db.inserts.map(({ table }) => table)).toEqual([
      'project_status_history',
      'audit_event',
      'outbox_event',
    ]);
  });
});
