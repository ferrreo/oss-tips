import { describe, expect, it } from 'vitest';
import type { Db } from '@oss-tips/db';
import {
  ANALYTICS_RETENTION_SECONDS,
  cleanupExpiredOtpRateLimits,
  cleanupExpiredVerifications,
  cleanupIdleApiRateLimits,
  cleanupRawAnalytics,
  OTP_RATE_LIMIT_RETENTION_SECONDS,
  scrubOldSecurityIpAddresses,
  SECURITY_IP_RETENTION_SECONDS,
} from './retention-maintenance.js';

type Condition = [field: string, operator: string, value: unknown];
type Call = {
  operation: 'delete' | 'update';
  table: string;
  conditions: Condition[];
  values?: Record<string, unknown>;
};

function fakeDb(
  input: {
    deleted?: Record<string, number>;
    updated?: Record<string, number>;
  } = {},
): { db: Db; calls: Call[] } {
  const calls: Call[] = [];
  const deleteFrom = (table: string) => {
    const conditions: Condition[] = [];
    const query = {
      where(field: string, operator: string, value: unknown) {
        conditions.push([field, operator, value]);
        return query;
      },
      async executeTakeFirst() {
        calls.push({ operation: 'delete', table, conditions: [...conditions] });
        return { numDeletedRows: BigInt(input.deleted?.[table] ?? 0) };
      },
    };
    return query;
  };
  const updateTable = (table: string) => {
    const conditions: Condition[] = [];
    let values: Record<string, unknown> | undefined;
    const query = {
      set(next: Record<string, unknown>) {
        values = next;
        return query;
      },
      where(field: string, operator: string, value: unknown) {
        conditions.push([field, operator, value]);
        return query;
      },
      async executeTakeFirst() {
        calls.push({
          operation: 'update',
          table,
          conditions: [...conditions],
          ...(values === undefined ? {} : { values }),
        });
        return { numUpdatedRows: BigInt(input.updated?.[table] ?? 0) };
      },
    };
    return query;
  };
  return {
    db: { deleteFrom, updateTable } as unknown as Db,
    calls,
  };
}

const now = new Date('2026-08-30T12:00:00.000Z');

describe('retention maintenance', () => {
  it('deletes only expired verification values', async () => {
    const { db, calls } = fakeDb({ deleted: { verification: 2 } });

    await expect(cleanupExpiredVerifications({ db, now: () => now })).resolves.toBe(2);
    expect(calls).toEqual([
      {
        operation: 'delete',
        table: 'verification',
        conditions: [['expires_at', '<=', now]],
      },
    ]);
  });

  it('deletes OTP counters after their transient retention window', async () => {
    const { db, calls } = fakeDb({ deleted: { otp_send_rate_limit: 3 } });
    const expiry = new Date(now.getTime() - OTP_RATE_LIMIT_RETENTION_SECONDS * 1_000);

    await expect(cleanupExpiredOtpRateLimits({ db, now: () => now })).resolves.toBe(3);
    expect(calls[0]).toMatchObject({
      operation: 'delete',
      table: 'otp_send_rate_limit',
      conditions: [['updated_at', '<', expiry]],
    });
  });

  it('deletes raw analytics rows while leaving daily aggregates alone', async () => {
    const { db, calls } = fakeDb({
      deleted: { metric_event_hourly: 2, metric_event_dedupe: 3 },
    });
    const expiry = new Date(now.getTime() - ANALYTICS_RETENTION_SECONDS * 1_000);

    await expect(cleanupRawAnalytics({ db, now: () => now })).resolves.toBe(5);
    expect(calls).toEqual([
      {
        operation: 'delete',
        table: 'metric_event_hourly',
        conditions: [['created_at', '<', expiry]],
      },
      {
        operation: 'delete',
        table: 'metric_event_dedupe',
        conditions: [['created_at', '<', expiry]],
      },
    ]);
  });

  it('scrubs old security IPs without deleting security or session records', async () => {
    const { db, calls } = fakeDb({
      updated: { user_security_event: 2, session: 1 },
    });
    const expiry = new Date(now.getTime() - SECURITY_IP_RETENTION_SECONDS * 1_000);

    await expect(scrubOldSecurityIpAddresses({ db, now: () => now })).resolves.toBe(3);
    expect(calls).toEqual([
      {
        operation: 'update',
        table: 'user_security_event',
        conditions: [
          ['ip_address', 'is not', null],
          ['created_at', '<', expiry],
        ],
        values: { ip_address: null },
      },
      {
        operation: 'update',
        table: 'session',
        conditions: [
          ['ip_address', 'is not', null],
          ['updated_at', '<', expiry],
        ],
        values: { ip_address: null },
      },
    ]);
  });

  it('uses existing API bucket cleanup policy', async () => {
    const { db, calls } = fakeDb({ deleted: { api_rate_limit: 4 } });
    const expiry = new Date(now.getTime() - 24 * 60 * 60 * 1_000);

    await expect(cleanupIdleApiRateLimits({ db, now: () => now })).resolves.toBe(4);
    expect(calls).toEqual([
      {
        operation: 'delete',
        table: 'api_rate_limit',
        conditions: [['updated_at', '<', expiry]],
      },
    ]);
  });
});
