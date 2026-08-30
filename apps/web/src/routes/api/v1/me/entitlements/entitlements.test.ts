import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { GET } from './+server';

type EntitlementRow = {
  id: string;
  project_id: string;
  kind: string;
  tier_rank: number;
  starts_at: Date;
  ends_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
  user_id: string;
};

class FakeDb {
  selected: unknown;
  readonly filters: unknown[][] = [];

  constructor(readonly rows: EntitlementRow[]) {}

  selectFrom() {
    const query: any = {
      select: (columns: unknown) => {
        this.selected = columns;
        return query;
      },
      where: (column: string, operator: string, value: unknown) => {
        this.filters.push([column, operator, value]);
        return query;
      },
      orderBy: () => query,
      limit: () => query,
      execute: async () =>
        this.rows
          .filter((row) =>
            this.filters.every(([column, operator, value]) => {
              if (operator === 'is' && value === null)
                return row[column as keyof EntitlementRow] === null;
              return row[column as keyof EntitlementRow] === value;
            }),
          )
          .slice(0, 100),
    };
    return query;
  }
}

function event() {
  const url = new URL('https://oss.tips/api/v1/me/entitlements');
  return {
    request: new Request(url),
    url,
    locals: {
      session: {
        session: { id: 'session-1' },
        user: { id: 'user-1' },
      },
    },
  } as Parameters<typeof GET>[0];
}

function row(overrides: Partial<EntitlementRow> = {}): EntitlementRow {
  return {
    id: 'entitlement-1',
    project_id: 'project-1',
    kind: 'one_off',
    tier_rank: 1,
    starts_at: new Date('2026-08-01T12:00:00.000Z'),
    ends_at: new Date('2026-08-31T12:00:00.000Z'),
    revoked_at: null,
    created_at: new Date('2026-08-30T12:00:00.000Z'),
    user_id: 'user-1',
    ...overrides,
  };
}

describe('GET /api/v1/me/entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
  });

  it('returns stored windows, including expired records, and omits revoked records', async () => {
    const db = new FakeDb([
      row({ id: 'finite', starts_at: new Date('2026-08-01T12:00:00.000Z') }),
      row({
        id: 'expired',
        starts_at: new Date('2026-07-01T12:00:00.000Z'),
        ends_at: new Date('2026-08-01T12:00:00.000Z'),
      }),
      row({
        id: 'revoked',
        ends_at: null,
        revoked_at: new Date('2026-08-30T12:00:00.000Z'),
      }),
    ]);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await GET(event());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: 'finite',
        project_id: 'project-1',
        kind: 'one_off',
        tier_rank: 1,
        starts_at: '2026-08-01T12:00:00.000Z',
        ends_at: '2026-08-31T12:00:00.000Z',
      },
      {
        id: 'expired',
        project_id: 'project-1',
        kind: 'one_off',
        tier_rank: 1,
        starts_at: '2026-07-01T12:00:00.000Z',
        ends_at: '2026-08-01T12:00:00.000Z',
      },
    ]);
    expect(db.selected).toEqual(['id', 'project_id', 'kind', 'tier_rank', 'starts_at', 'ends_at']);
    expect(db.filters).toContainEqual(['revoked_at', 'is', null]);
  });
});
