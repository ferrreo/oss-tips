import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

import { getDb, hasDatabaseUrl } from '$lib/server/db';
import { GET } from './+server';

type PaymentRow = {
  id: string;
  project_id: string;
  user_id: string | null;
  project_slug: string;
  project_amount_minor: number;
  currency: string;
  cadence: string;
  status: string;
  created_at: Date;
  settled_at: Date | null;
};

type AdjustmentRow = {
  payment_id: string;
  amount_minor: number;
  application_fee_refund_minor?: number | null;
  status: string;
};

class FakeDb {
  readonly selected = new Map<string, unknown>();

  constructor(
    readonly payments: PaymentRow[],
    readonly refunds: AdjustmentRow[] = [],
    readonly disputes: AdjustmentRow[] = [],
  ) {}

  selectFrom(table: string) {
    const filters: Array<[string, string, unknown]> = [];
    const query: any = {
      innerJoin: () => query,
      select: (columns: unknown) => {
        this.selected.set(table, columns);
        return query;
      },
      where: (column: string, operator: string, value: unknown) => {
        filters.push([column, operator, value]);
        return query;
      },
      orderBy: () => query,
      limit: () => query,
      execute: async () => {
        const rows =
          table === 'payment' ? this.payments : table === 'refund' ? this.refunds : this.disputes;
        return rows
          .filter((row) =>
            filters.every(([column, operator, value]) => {
              const key = column.includes('.') ? column.slice(column.indexOf('.') + 1) : column;
              const current = row[key as keyof typeof row];
              return operator === 'in' ? (value as unknown[]).includes(current) : current === value;
            }),
          )
          .slice(0, 100);
      },
    };
    return query;
  }
}

function event() {
  const url = new URL('https://oss.tips/api/v1/me/support');
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

const settledAt = new Date('2026-08-30T12:00:00.000Z');

function payment(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: 'payment-1',
    project_id: 'project-1',
    user_id: 'user-1',
    project_slug: 'grove',
    project_amount_minor: 1_000,
    currency: 'gbp',
    cadence: 'one_off',
    status: 'succeeded',
    created_at: settledAt,
    settled_at: settledAt,
    ...overrides,
  };
}

describe('GET /api/v1/me/support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
  });

  it('returns settled net support by currency and omits reversed or pending rows', async () => {
    const db = new FakeDb(
      [
        payment({ id: 'partial', project_amount_minor: 1_000 }),
        payment({ id: 'full', status: 'refunded' }),
        payment({ id: 'open', project_amount_minor: 1_000 }),
        payment({ id: 'lost', status: 'disputed' }),
        payment({ id: 'won', status: 'disputed' }),
        payment({ id: 'usd', currency: 'usd', project_amount_minor: 2_500 }),
        payment({ id: 'pending', status: 'pending', settled_at: null }),
      ],
      [
        {
          payment_id: 'partial',
          amount_minor: 200,
          application_fee_refund_minor: 20,
          status: 'succeeded',
        },
        {
          payment_id: 'full',
          amount_minor: 1_000,
          application_fee_refund_minor: 100,
          status: 'succeeded',
        },
      ],
      [
        { payment_id: 'open', amount_minor: 200, status: 'open' },
        { payment_id: 'lost', amount_minor: 100, status: 'lost' },
        { payment_id: 'won', amount_minor: 100, status: 'won' },
      ],
    );
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await GET(event());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: 'partial',
        project_id: 'project-1',
        project_slug: 'grove',
        amount: { amount: '820', currency: 'gbp' },
        status: 'succeeded',
        created_at: settledAt.toISOString(),
      },
      {
        id: 'open',
        project_id: 'project-1',
        project_slug: 'grove',
        amount: { amount: '800', currency: 'gbp' },
        status: 'succeeded',
        created_at: settledAt.toISOString(),
      },
      {
        id: 'lost',
        project_id: 'project-1',
        project_slug: 'grove',
        amount: { amount: '900', currency: 'gbp' },
        status: 'disputed',
        created_at: settledAt.toISOString(),
      },
      {
        id: 'won',
        project_id: 'project-1',
        project_slug: 'grove',
        amount: { amount: '1000', currency: 'gbp' },
        status: 'disputed',
        created_at: settledAt.toISOString(),
      },
      {
        id: 'usd',
        project_id: 'project-1',
        project_slug: 'grove',
        amount: { amount: '2500', currency: 'usd' },
        status: 'succeeded',
        created_at: settledAt.toISOString(),
      },
    ]);
  });
});
