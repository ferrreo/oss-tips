import { describe, expect, it } from 'vitest';
import type { Db } from '../client.js';
import {
  API_RATE_LIMITS,
  API_RATE_LIMIT_RETENTION_SECONDS,
  createApiRateLimitsRepository,
  evaluateApiRateLimit,
} from './apiRateLimits.js';

type Row = {
  id: string;
  key_hash: string;
  route_class: string;
  available_tokens: number;
  last_refill_at: Date;
  created_at: Date;
  updated_at: Date;
};

function fakeDb() {
  const rows: Row[] = [];
  let queue = Promise.resolve();
  const db = {
    transaction: () => ({
      execute: async <T>(callback: (trx: typeof db) => Promise<T>): Promise<T> => {
        const result = queue.then(() => callback(db));
        queue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    }),
    insertInto: () => {
      let value: Row;
      const builder = {
        values: (next: Row) => {
          value = next;
          return builder;
        },
        onConflict: (
          callback: (input: { columns: () => unknown; doNothing: () => unknown }) => unknown,
        ) => {
          const conflict = { columns: () => conflict, doNothing: () => conflict };
          callback(conflict);
          return builder;
        },
        execute: async () => {
          if (
            !rows.some(
              (row) => row.key_hash === value.key_hash && row.route_class === value.route_class,
            )
          ) {
            rows.push(value);
          }
        },
      };
      return builder;
    },
    selectFrom: () => {
      const filters: Array<[string, unknown]> = [];
      const builder = {
        selectAll: () => builder,
        where: (column: string, _operator: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        forUpdate: () => builder,
        executeTakeFirst: async () =>
          rows.find((row) =>
            filters.every(([column, value]) => row[column as keyof Row] === value),
          ),
      };
      return builder;
    },
    updateTable: () => {
      let values: Partial<Row> = {};
      let id = '';
      const builder = {
        set: (next: Partial<Row>) => {
          values = next;
          return builder;
        },
        where: (_column: string, _operator: string, value: string) => {
          id = value;
          return builder;
        },
        execute: async () => {
          const row = rows.find((candidate) => candidate.id === id);
          if (row) Object.assign(row, values);
        },
      };
      return builder;
    },
    deleteFrom: () => {
      let cutoff = new Date(0);
      const builder = {
        where: (_column: string, _operator: string, value: Date) => {
          cutoff = value;
          return builder;
        },
        executeTakeFirst: async () => {
          const before = rows.length;
          for (let index = rows.length - 1; index >= 0; index -= 1) {
            const row = rows[index];
            if (row && row.updated_at < cutoff) rows.splice(index, 1);
          }
          return { numDeletedRows: BigInt(before - rows.length) };
        },
      };
      return builder;
    },
  };
  return { db: db as unknown as Db, rows };
}

describe('API rate-limit token buckets', () => {
  it('honours burst capacity, sustained refill, and retry timing', () => {
    const now = new Date('2026-08-29T12:00:00.000Z');
    let state = { available_tokens: 0, last_refill_at: now };
    const policy = API_RATE_LIMITS.apiKey;
    const blocked = evaluateApiRateLimit({ state, now }, policy);
    expect(blocked.decision.allowed).toBe(false);
    expect(blocked.decision.retryAfterSeconds).toBe(1);
    state = blocked.state;
    const recovered = evaluateApiRateLimit(
      { state, now: new Date('2026-08-29T12:00:00.100Z') },
      policy,
    );
    expect(recovered.decision.allowed).toBe(true);
    expect(recovered.decision.remaining).toBe(0);
  });

  it('serializes concurrent consumers and keeps duplicate principals in one bucket', async () => {
    const { db, rows } = fakeDb();
    const repository = createApiRateLimitsRepository(db);
    const now = new Date('2026-08-29T12:00:00.000Z');
    const decisions = await Promise.all(
      Array.from({ length: API_RATE_LIMITS.webhookReplay.burst + 1 }, () =>
        repository.consume({
          keyHash: 'principal-hash',
          routeClass: 'webhook.replay',
          policy: API_RATE_LIMITS.webhookReplay,
          now,
        }),
      ),
    );
    expect(rows).toHaveLength(1);
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(
      API_RATE_LIMITS.webhookReplay.burst,
    );
    expect(decisions.some((decision) => !decision.allowed)).toBe(true);
  });

  it('cleans only idle buckets after the retention period', async () => {
    const { db, rows } = fakeDb();
    const repository = createApiRateLimitsRepository(db);
    const now = new Date('2026-08-29T12:00:00.000Z');
    await repository.consume({
      keyHash: 'active',
      routeClass: 'session.read',
      policy: API_RATE_LIMITS.sessionRead,
      now,
    });
    const active = rows[0];
    if (!active) throw new Error('active bucket missing');
    rows.push({
      ...active,
      id: 'old',
      key_hash: 'old',
      updated_at: new Date(now.getTime() - (API_RATE_LIMIT_RETENTION_SECONDS + 1) * 1000),
    });
    await expect(repository.cleanup({ now })).resolves.toBe(1);
    expect(rows.map((row) => row.key_hash)).toEqual(['active']);
  });
});
