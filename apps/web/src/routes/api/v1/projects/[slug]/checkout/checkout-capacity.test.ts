import { describe, expect, it } from 'vitest';
import {
  TierMemberCapReachedError,
  withTierCapacity,
  type TierCheckoutReservation,
} from './checkout-capacity';

type Intent = {
  id: string;
  project_id: string;
  currency: string;
  project_amount_minor: bigint;
  platform_tip_minor: bigint;
  tier_id: string;
  cadence: string;
  public_show_name: boolean;
  public_show_amount: boolean;
  public_show_message: boolean;
  expires_at: Date;
};

type Payment = { id: string; status: string };

class FakeDb {
  tier = { member_cap: 1 };
  subscriptions: Array<{ project_id: string; tier_id: string; status: string }> = [];
  intents = new Map<string, Intent>();
  payments = new Map<string, Payment>();
  private queue = Promise.resolve();

  transaction() {
    return {
      execute: async <T>(callback: (trx: this) => Promise<T>): Promise<T> => {
        const previous = this.queue;
        let release!: () => void;
        this.queue = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        const intents = new Map(this.intents);
        try {
          return await callback(this);
        } catch (error) {
          this.intents = intents;
          throw error;
        } finally {
          release();
        }
      },
    };
  }

  selectFrom(table: string) {
    const clauses: Array<[string, string, unknown]> = [];
    let joinedPayment = false;
    const query: any = {
      select: () => query,
      selectAll: () => query,
      leftJoin: () => {
        joinedPayment = true;
        return query;
      },
      where: (column: string | (() => unknown), operator?: string, value?: unknown) => {
        if (typeof column === 'string') clauses.push([column, operator ?? '', value]);
        return query;
      },
      forUpdate: () => query,
      executeTakeFirst: async () => {
        if (table === 'tier') return this.tier;
        if (table === 'checkout_intent' && !joinedPayment) {
          const id = clauses.find(([column]) => column === 'id')?.[2];
          return typeof id === 'string' ? this.intents.get(id) : undefined;
        }
        if (table === 'subscription') {
          return {
            count: this.subscriptions.filter(
              (row) =>
                row.project_id === 'project-1' &&
                row.tier_id === 'tier-1' &&
                ['active', 'grace'].includes(row.status),
            ).length,
          };
        }
        if (table === 'checkout_intent' && joinedPayment) {
          const now = new Date();
          return {
            count: [...this.intents.values()].filter((intent) => {
              const payment = this.payments.get(intent.id);
              return (
                intent.project_id === 'project-1' &&
                intent.tier_id === 'tier-1' &&
                intent.cadence !== 'one_off' &&
                intent.expires_at > now &&
                intent.id !== clauses.find(([column]) => column === 'checkout_intent.id')?.[2] &&
                (!payment || ['pending', 'processing'].includes(payment.status))
              );
            }).length,
          };
        }
        return undefined;
      },
      executeTakeFirstOrThrow: async () => query.executeTakeFirst(),
    };
    return query;
  }

  insertInto(table: string) {
    let value!: Intent;
    const query: any = {
      values: (next: Intent) => {
        value = next;
        return query;
      },
      onConflict: () => query,
      execute: async () => {
        if (table === 'checkout_intent' && !this.intents.has(value.id)) {
          this.intents.set(value.id, value);
        }
      },
    };
    return query;
  }
}

function reservation(
  id: string,
  expiresAt = new Date(Date.now() + 60_000),
): TierCheckoutReservation {
  return {
    id,
    projectId: 'project-1',
    userId: null,
    currency: 'gbp',
    projectAmountMinor: 1000n,
    platformTipMinor: 0n,
    tierId: 'tier-1',
    cadence: 'monthly' as const,
    publicShowName: true,
    publicShowAmount: false,
    publicShowMessage: false,
    expiresAt,
  };
}

function storedIntent(value: TierCheckoutReservation): Intent {
  return {
    id: value.id,
    project_id: value.projectId,
    currency: value.currency,
    project_amount_minor: value.projectAmountMinor,
    platform_tip_minor: value.platformTipMinor,
    tier_id: value.tierId,
    cadence: value.cadence,
    public_show_name: value.publicShowName,
    public_show_amount: value.publicShowAmount,
    public_show_message: value.publicShowMessage,
    expires_at: value.expiresAt,
  };
}

function run(
  db: FakeDb,
  id: string,
  operation: () => Promise<string>,
  expiresAt?: Date,
): Promise<string> {
  return withTierCapacity(
    db as never,
    'project-1',
    'tier-1',
    'monthly',
    reservation(id, expiresAt),
    operation,
  );
}

describe('recurring tier checkout capacity', () => {
  it('serializes cap-one checkouts and persists only one live reservation', async () => {
    const db = new FakeDb();
    let providerStarted!: () => void;
    const providerReady = new Promise<void>((resolve) => {
      providerStarted = resolve;
    });
    const sessions: string[] = [];
    const first = run(db, 'payment-1', async () => {
      sessions.push('payment-1');
      providerStarted();
      await new Promise((resolve) => setTimeout(resolve, 0));
      return 'payment-1';
    });
    await providerReady;
    const second = run(db, 'payment-2', async () => {
      sessions.push('payment-2');
      return 'payment-2';
    });

    await expect(first).resolves.toBe('payment-1');
    await expect(second).rejects.toBeInstanceOf(TierMemberCapReachedError);
    expect(sessions).toEqual(['payment-1']);
    expect(db.intents.size).toBe(1);
  });

  it('ignores expired and settled reservations, while retrying own reservation', async () => {
    const db = new FakeDb();
    db.intents.set('expired', storedIntent(reservation('expired', new Date(Date.now() - 1_000))));
    db.intents.set('settled', storedIntent(reservation('settled')));
    db.payments.set('settled', { id: 'settled', status: 'succeeded' });
    db.tier.member_cap = 2;
    db.subscriptions.push({ project_id: 'project-1', tier_id: 'tier-1', status: 'active' });

    await expect(run(db, 'payment-1', async () => 'first')).resolves.toBe('first');
    await expect(run(db, 'payment-1', async () => 'retry')).resolves.toBe('retry');
    expect(db.intents.size).toBe(3);
  });

  it('counts processing payments against tier capacity', async () => {
    const db = new FakeDb();
    db.intents.set('processing', storedIntent(reservation('processing')));
    db.payments.set('processing', { id: 'processing', status: 'processing' });

    await expect(run(db, 'payment-1', async () => 'blocked')).rejects.toBeInstanceOf(
      TierMemberCapReachedError,
    );
    expect(db.intents.size).toBe(1);
  });

  it('rolls back reservation when provider creation fails', async () => {
    const db = new FakeDb();
    await expect(
      run(db, 'payment-1', async () => {
        throw new Error('provider unavailable');
      }),
    ).rejects.toThrow('provider unavailable');
    expect(db.intents.size).toBe(0);
    await expect(run(db, 'payment-2', async () => 'retry')).resolves.toBe('retry');
  });

  it('rolls back reservation when persistence fails after provider success', async () => {
    const db = new FakeDb();
    const sessions: string[] = [];

    await expect(
      withTierCapacity(
        db as never,
        'project-1',
        'tier-1',
        'monthly',
        reservation('payment-1'),
        async () => {
          sessions.push('payment-1');
          return 'provider-success';
        },
        async () => {
          throw new Error('outer persistence failed');
        },
      ),
    ).rejects.toThrow('outer persistence failed');

    expect(sessions).toEqual(['payment-1']);
    expect(db.intents.size).toBe(0);
    await expect(run(db, 'payment-2', async () => 'retry')).resolves.toBe('retry');
  });
});
