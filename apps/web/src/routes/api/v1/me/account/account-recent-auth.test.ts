import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  getDb: vi.fn(),
  hasDatabaseUrl: vi.fn(() => true),
}));

vi.mock('$lib/server/session', () => ({
  hasRecentAuthentication: vi.fn(),
  recentAuthenticationRedirectPath: vi.fn(() => '/sign-in?returnTo=%2Fapi%2Fv1%2Fme%2Faccount'),
}));

import { getDb } from '$lib/server/db';
import { hasRecentAuthentication } from '$lib/server/session';
import { toPublicSupporter } from '../../../public-api';
import { DELETE } from './+server';

type PaymentRow = {
  id: string;
  user_id: string | null;
  project_amount_minor: number;
  customer_charge_minor: number;
  receipt_email: string | null;
  public_show_name: boolean;
  public_show_amount: boolean;
  public_show_message: boolean;
  public_display_name: string | null;
  public_message: string | null;
  currency: string;
  status: string;
  cadence: string;
  settled_at: Date | null;
  created_at: Date;
};

type ProfileRow = {
  user_id: string;
  project_id: string;
  display_name: string | null;
  show_name: boolean;
  show_amount: boolean;
  show_message: boolean;
};

class FakeDeletionDb {
  readonly operations: string[] = [];
  readonly audits: unknown[] = [];
  transactionCount = 0;
  userExists = true;

  constructor(
    readonly payments: PaymentRow[],
    readonly profiles: ProfileRow[],
    readonly ownedProject = false,
  ) {}

  selectFrom(table: string): any {
    const query: any = {
      select: () => query,
      where: () => query,
      limit: () => query,
      forUpdate: () => query,
      executeTakeFirst: async () => {
        if (table === 'user') {
          this.operations.push('lock:user');
          return this.userExists ? { id: 'user-1' } : undefined;
        }
        if (table === 'project_member' && this.ownedProject) return { id: 'project-1' };
        return undefined;
      },
    };
    return query;
  }

  transaction() {
    this.transactionCount += 1;
    return {
      execute: async <T>(callback: (trx: this) => Promise<T>) => callback(this),
    };
  }

  updateTable(table: string): any {
    let changes: Partial<PaymentRow> = {};
    let userId: string | undefined;
    const query: any = {
      set: (value: Partial<PaymentRow>) => {
        changes = value;
        return query;
      },
      where: (_column: string, _operator: string, value: string) => {
        userId = value;
        return query;
      },
      execute: async () => {
        this.operations.push(`update:${table}`);
        if (table === 'payment') {
          for (const payment of this.payments) {
            if (payment.user_id === userId) Object.assign(payment, changes);
          }
        }
      },
    };
    return query;
  }

  deleteFrom(table: string): any {
    let userId: string | undefined;
    const query: any = {
      where: (_column: string, _operator: string, value: string) => {
        userId = value;
        return query;
      },
      execute: async () => {
        this.operations.push(`delete:${table}`);
        if (table === 'supporter_public_profile') {
          for (let index = this.profiles.length - 1; index >= 0; index -= 1) {
            if (this.profiles[index]?.user_id === userId) this.profiles.splice(index, 1);
          }
        }
      },
      executeTakeFirst: async () => {
        this.operations.push(`delete:${table}`);
        if (table === 'user') {
          this.userExists = false;
          for (const payment of this.payments) {
            if (payment.user_id === userId) payment.user_id = null;
          }
          return { numDeletedRows: 1n };
        }
        return { numDeletedRows: 0n };
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
        this.operations.push(`insert:${table}`);
        if (table === 'audit_event') this.audits.push(value);
      },
    };
    return query;
  }
}

function payment(): PaymentRow {
  return {
    id: 'payment-1',
    user_id: 'user-1',
    project_amount_minor: 1200,
    customer_charge_minor: 1250,
    receipt_email: 'user@example.com',
    public_show_name: true,
    public_show_amount: true,
    public_show_message: true,
    public_display_name: 'Ada Lovelace',
    public_message: 'Keep building.',
    currency: 'gbp',
    status: 'succeeded',
    cadence: 'one_off',
    settled_at: new Date('2026-08-30T12:00:00.000Z'),
    created_at: new Date('2026-08-30T12:00:00.000Z'),
  };
}

function deletionEvent() {
  const url = new URL('https://oss.tips/api/v1/me/account');
  return {
    request: new Request(url, { method: 'DELETE' }),
    url,
    locals: {
      session: {
        session: { id: 'session-1' },
        user: { id: 'user-1' },
      },
    },
    cookies: { delete: vi.fn() },
  } as never;
}

describe('account deletion recent authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a stale session before reading or deleting account data', async () => {
    const db = {
      selectFrom: vi.fn(() => {
        throw new Error('must not query');
      }),
    };
    vi.mocked(getDb).mockReturnValue(db as never);
    vi.mocked(hasRecentAuthentication).mockResolvedValue(false);
    const url = new URL('https://oss.tips/api/v1/me/account');

    const response = await DELETE({
      request: new Request(url, { method: 'DELETE' }),
      url,
      locals: {
        session: {
          session: { id: 'session-1' },
          user: { id: 'user-1' },
        },
      },
      cookies: { delete: vi.fn() },
    } as never);

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(db.selectFrom).not.toHaveBeenCalled();
  });

  it('scrubs deleted supporter recognition before the user row is removed', async () => {
    const paid = payment();
    const db = new FakeDeletionDb(
      [paid],
      [
        {
          user_id: 'user-1',
          project_id: 'project-1',
          display_name: 'Ada Lovelace',
          show_name: true,
          show_amount: true,
          show_message: true,
        },
      ],
    );
    vi.mocked(getDb).mockReturnValue(db as never);
    vi.mocked(hasRecentAuthentication).mockResolvedValue(true);

    const response = await DELETE(deletionEvent());

    expect(response.status).toBe(204);
    expect(db.operations).toEqual([
      'lock:user',
      'update:payment',
      'delete:supporter_public_profile',
      'insert:audit_event',
      'delete:user',
    ]);
    expect(db.profiles).toEqual([]);
    expect(paid).toMatchObject({
      user_id: null,
      customer_charge_minor: 1250,
      project_amount_minor: 1200,
      receipt_email: null,
      public_show_name: false,
      public_show_amount: false,
      public_show_message: false,
      public_display_name: null,
      public_message: null,
    });

    const publicSupporter = toPublicSupporter({
      display_name: paid.public_display_name,
      show_name: paid.public_show_name,
      show_amount: paid.public_show_amount,
      show_message: paid.public_show_message,
      amount: paid.project_amount_minor,
      currency: paid.currency,
      message: paid.public_message,
      created_at: paid.created_at,
    });
    expect(publicSupporter).toEqual({
      display_name: null,
      message: null,
      created_at: paid.created_at.toISOString(),
    });
  });

  it('rechecks project ownership after locking the user row', async () => {
    const db = new FakeDeletionDb([], [], true);
    vi.mocked(getDb).mockReturnValue(db as never);
    vi.mocked(hasRecentAuthentication).mockResolvedValue(true);

    const response = await DELETE(deletionEvent());

    expect(response.status).toBe(409);
    expect(db.operations).toEqual(['lock:user']);
    expect(db.userExists).toBe(true);
  });
});
