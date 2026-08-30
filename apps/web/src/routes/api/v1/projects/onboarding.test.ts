import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('../../api-utils', async () => {
  const actual = await vi.importActual<typeof import('../../api-utils')>('../../api-utils');
  return {
    ...actual,
    enforceApiRateLimit: vi.fn(async () => null),
    hashApiRateLimitKey: vi.fn((value: string) => value),
  };
});

vi.mock('../project/project-management', () => ({
  projectSettings: vi.fn(),
}));

import { getDb } from '$lib/server/db';
import { projectSettings } from '../project/project-management';
import { POST } from './+server';

type Insert = { table: string; value: unknown };

function fakeDb(inserts: Insert[], organisationMembership?: { role: string }) {
  const operations: string[] = [];
  const membershipQuery = {
    select: () => membershipQuery,
    where: () => membershipQuery,
    forUpdate: () => membershipQuery,
    executeTakeFirst: async () => organisationMembership,
  };
  const userQuery = {
    select: () => userQuery,
    where: () => userQuery,
    forUpdate: () => userQuery,
    executeTakeFirst: async () => {
      operations.push('lock:user');
      return { id: 'owner-1' };
    },
  };
  return {
    operations,
    transaction: () => ({
      execute: async <T>(callback: (trx: unknown) => Promise<T>) =>
        callback({
          selectFrom: (table: string) => (table === 'user' ? userQuery : membershipQuery),
          insertInto(table: string) {
            return {
              values(value: unknown) {
                return {
                  execute: async () => {
                    operations.push(`insert:${table}`);
                    inserts.push({ table, value });
                    return [];
                  },
                };
              },
            };
          },
        }),
    }),
    selectFrom: () => membershipQuery,
  };
}

const validBody = {
  name: 'Ledger Kit',
  slug: 'ledger-kit',
  description: 'A maintained open-source ledger toolkit.',
  website_url: 'https://ledger.example',
  support_email: 'Maintainer@Example.com',
  repository_url: 'https://github.com/acme/ledger-kit.git',
  open_source_declared: true,
  open_source_license: 'MIT',
  default_currency: 'gbp',
  discovery: {
    ecosystems: ['Rust', 'rust'],
    languages: ['Rust'],
    tags: ['Infrastructure'],
  },
};

function event(body: unknown, session: App.Locals['session'] = null) {
  const url = new URL('https://oss.tips/api/v1/projects');
  return {
    request: new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    url,
    locals: { session },
  } as Parameters<typeof POST>[0];
}

describe('project onboarding route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an owned draft with normalized repository and discovery data', async () => {
    const inserts: Insert[] = [];
    const db = fakeDb(inserts);
    vi.mocked(getDb).mockReturnValue(db as never);
    vi.mocked(projectSettings).mockResolvedValue({ id: 'created-project' } as never);
    const session = {
      user: { id: 'owner-1', email: 'owner@example.com', emailVerified: true },
    } as App.Locals['session'];

    const response = await POST(event(validBody, session));

    expect(response.status).toBe(201);
    expect(db.operations[0]).toBe('lock:user');
    expect(response.headers.get('location')).toMatch(/^\/api\/v1\/project\?project_id=/);
    expect(await response.json()).toEqual({ id: 'created-project' });
    expect(inserts.map(({ table }) => table)).toEqual([
      'organisation',
      'organisation_member',
      'project',
      'project_member',
      'project_repository',
      'project_feature_mode',
      'audit_event',
      'outbox_event',
    ]);
    expect(inserts[2]?.value).toMatchObject({
      name: 'Ledger Kit',
      status: 'draft',
      support_email: 'maintainer@example.com',
      open_source_declared: true,
      discovery_ecosystems: ['rust'],
      discovery_languages: ['rust'],
      discovery_tags: ['infrastructure'],
    });
    expect(inserts[4]?.value).toMatchObject({
      provider: 'github',
      external_id: 'acme/ledger-kit',
      url: 'https://github.com/acme/ledger-kit',
      verification_status: 'pending',
    });
  });

  it('rejects unauthenticated creation before touching the database', async () => {
    const response = await POST(event(validBody));

    expect(response.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
  });

  it('requires a verified sign-in email', async () => {
    const session = {
      user: { id: 'owner-1', email: 'owner@example.com', emailVerified: false },
    } as App.Locals['session'];

    const response = await POST(event(validBody, session));

    expect(response.status).toBe(403);
  });

  it('does not let a non-member create inside another organisation', async () => {
    const inserts: Insert[] = [];
    vi.mocked(getDb).mockReturnValue(fakeDb(inserts) as never);
    const session = {
      user: { id: 'outsider-1', email: 'owner@example.com', emailVerified: true },
    } as App.Locals['session'];

    const response = await POST(
      event({ ...validBody, organisation_id: '0197c3a0-1234-7123-8123-123456789abc' }, session),
    );

    expect(response.status).toBe(403);
    expect(inserts).toEqual([]);
  });
});
