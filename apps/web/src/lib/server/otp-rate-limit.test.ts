import { describe, expect, it } from 'vitest';
import { OTP_SEND_POLICY } from '@oss-tips/auth';
import {
  consumeOtpVerifyRateLimit,
  hashOtpRateLimitKey,
  normalizeOtpEmail,
  otpRateLimitHeaders,
  otpVerifyRateLimitHeaders,
  OTP_VERIFY_POLICY,
  uniformOtpSendResponse,
} from './otp-rate-limit.js';

type ApiRow = {
  id: string;
  key_hash: string;
  route_class: string;
  available_tokens: number;
  last_refill_at: Date;
  created_at: Date;
  updated_at: Date;
};

function fakeApiDb() {
  const rows: ApiRow[] = [];
  let nextId = 0;
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
      let value: ApiRow;
      const builder: any = {
        values: (next: ApiRow) => {
          value = next;
          return builder;
        },
        onConflict: (callback: (input: any) => unknown) => {
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
            rows.push({ ...value, id: value.id || `rate-${nextId++}` });
          }
        },
      };
      return builder;
    },
    selectFrom: () => {
      const filters: Array<[string, unknown]> = [];
      const builder: any = {
        selectAll: () => builder,
        where: (column: string, _operator: string, value: unknown) => {
          filters.push([column, value]);
          return builder;
        },
        forUpdate: () => builder,
        executeTakeFirst: async () =>
          rows.find((row) =>
            filters.every(([column, value]) => row[column as keyof ApiRow] === value),
          ),
      };
      return builder;
    },
    updateTable: () => {
      let values: Partial<ApiRow> = {};
      let id = '';
      const builder: any = {
        set: (next: Partial<ApiRow>) => {
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
  };
  return { db: db as never, rows };
}

describe('OTP send boundary', () => {
  it('normalizes valid emails and rejects malformed input before keying', () => {
    expect(normalizeOtpEmail('  Person@Example.com ')).toBe('person@example.com');
    expect(normalizeOtpEmail('not-an-email')).toBeNull();
    expect(normalizeOtpEmail(undefined)).toBeNull();
  });

  it('uses a secret HMAC key instead of putting email in limiter identifiers', () => {
    const key = hashOtpRateLimitKey('person@example.com', 'test-secret');
    expect(key).toHaveLength(64);
    expect(key).not.toContain('person');
    expect(key).toBe(hashOtpRateLimitKey('person@example.com', 'test-secret'));
    expect(key).not.toBe(hashOtpRateLimitKey('other@example.com', 'test-secret'));
  });

  it('publishes retry and standard headers when throttled', () => {
    const headers = otpRateLimitHeaders({
      allowed: false,
      reason: 'cooldown',
      emailRemaining: 4,
      ipRemaining: 9,
      resetAt: new Date('2026-08-29T12:01:00.000Z'),
      retryAfterSeconds: 60,
    });
    expect(headers.get('retry-after')).toBe('60');
    expect(headers.get('ratelimit-remaining')).toBe('4');
    expect(headers.get('ratelimit-policy')).toBe(
      `${OTP_SEND_POLICY.emailLimit};w=${OTP_SEND_POLICY.windowSeconds}, ${OTP_SEND_POLICY.ipLimit};w=${OTP_SEND_POLICY.windowSeconds}`,
    );
  });

  it('normalizes successful send responses for known and unknown accounts', async () => {
    const decision = {
      allowed: true,
      reason: null,
      emailRemaining: 4,
      ipRemaining: 9,
      resetAt: new Date('2026-08-29T13:00:00.000Z'),
      retryAfterSeconds: 3600,
    } as const;
    const known = uniformOtpSendResponse(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
      decision,
    );
    const unknown = uniformOtpSendResponse(
      new Response(JSON.stringify({ success: true, accountCreated: false }), { status: 200 }),
      decision,
    );
    expect(await known.json()).toEqual(await unknown.json());
    expect(known.headers.get('cache-control')).toBe('no-store');
  });
});

describe('OTP verification boundary', () => {
  it('limits repeated verification attempts for one normalized email', async () => {
    const { db, rows } = fakeApiDb();
    const request = new Request('https://oss.tips/api/auth/sign-in/email-otp', {
      headers: { 'cf-connecting-ip': '203.0.113.10' },
    });
    const secret = 'test-secret';
    const first = new Date('2026-08-29T12:00:00.000Z');
    for (let index = 0; index < OTP_VERIFY_POLICY.email.burst; index += 1) {
      const result = await consumeOtpVerifyRateLimit(db, {
        email: 'person@example.com',
        request,
        secret,
        now: first,
      });
      expect(result.allowed).toBe(true);
    }
    const blocked = await consumeOtpVerifyRateLimit(db, {
      email: ' PERSON@example.com ',
      request,
      secret,
      now: first,
    });
    expect(blocked).toMatchObject({ allowed: false, reason: 'email', emailRemaining: 0 });
    expect(rows.every((row) => !row.key_hash.includes('person@example.com'))).toBe(true);
  });

  it('limits verification attempts for one client IP across email addresses', async () => {
    const { db } = fakeApiDb();
    const request = new Request('https://oss.tips/api/auth/email-otp/verify-email', {
      headers: { 'cf-connecting-ip': '203.0.113.11' },
    });
    const secret = 'test-secret';
    const now = new Date('2026-08-29T12:00:00.000Z');
    for (let index = 0; index < OTP_VERIFY_POLICY.ip.burst; index += 1) {
      const result = await consumeOtpVerifyRateLimit(db, {
        email: `person-${index}@example.com`,
        request,
        secret,
        now,
      });
      expect(result.allowed).toBe(true);
    }
    const blocked = await consumeOtpVerifyRateLimit(db, {
      email: 'last@example.com',
      request,
      secret,
      now,
    });
    expect(blocked).toMatchObject({ allowed: false, reason: 'ip', ipRemaining: 0 });
  });

  it('refills email and IP buckets after the verification window', async () => {
    const { db } = fakeApiDb();
    const request = new Request('https://oss.tips/api/auth/sign-in/email-otp', {
      headers: { 'cf-connecting-ip': '203.0.113.12' },
    });
    const secret = 'test-secret';
    const first = new Date('2026-08-29T12:00:00.000Z');
    for (let index = 0; index < OTP_VERIFY_POLICY.email.burst; index += 1) {
      await consumeOtpVerifyRateLimit(db, {
        email: 'person@example.com',
        request,
        secret,
        now: first,
      });
    }
    const reset = await consumeOtpVerifyRateLimit(db, {
      email: 'person@example.com',
      request,
      secret,
      now: new Date(first.getTime() + OTP_VERIFY_POLICY.email.windowSeconds * 1000),
    });
    expect(reset).toMatchObject({
      allowed: true,
      emailRemaining: OTP_VERIFY_POLICY.email.burst - 1,
    });
  });

  it('publishes generic retry headers when either verification bucket blocks', () => {
    const headers = otpVerifyRateLimitHeaders({
      allowed: false,
      reason: 'email',
      emailRemaining: 0,
      ipRemaining: 29,
      retryAfterSeconds: 3600,
    });
    expect(headers.get('retry-after')).toBe('3600');
    expect(headers.get('ratelimit-policy')).toBe(
      `${OTP_VERIFY_POLICY.email.limit};w=${OTP_VERIFY_POLICY.email.windowSeconds}, ${OTP_VERIFY_POLICY.ip.limit};w=${OTP_VERIFY_POLICY.ip.windowSeconds}`,
    );
  });
});
