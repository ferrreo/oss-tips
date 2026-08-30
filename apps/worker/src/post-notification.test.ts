import { describe, expect, it, vi } from 'vitest';
import type { Db, Job } from '@oss-tips/db';
import { EMAIL_LOCALES, MockEmailSender, renderPostPublishedEmail } from '@oss-tips/email';
import { createJobHandlers, postNotificationDedupeKey } from './job-handlers';

function job(): Job {
  return {
    id: 'job_123',
    queue: 'default',
    kind: 'post.notify_supporters',
    dedupe_key: null,
    payload: { project_id: 'project_123', post_id: 'post_123' },
    status: 'processing',
    attempt_count: 0,
    max_attempts: 5,
    run_at: new Date('2026-08-30T00:00:00.000Z'),
    locked_at: new Date('2026-08-30T00:00:00.000Z'),
    locked_by: 'worker-test',
    last_error: null,
    created_at: new Date('2026-08-30T00:00:00.000Z'),
    updated_at: new Date('2026-08-30T00:00:00.000Z'),
  };
}

function chain<T>(result: T) {
  const value: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of [
    'select',
    'selectAll',
    'innerJoin',
    'where',
    'orderBy',
    'distinct',
    'forUpdate',
    'set',
    'values',
    'returning',
  ]) {
    value[method] = vi.fn(() => value);
  }
  value.executeTakeFirst = vi.fn(async () => result);
  value.executeTakeFirstOrThrow = vi.fn(async () => result);
  value.execute = vi.fn(async () => result);
  return value;
}

type EntitlementFixture = {
  user_id: string;
  email: string;
  locale: (typeof EMAIL_LOCALES)[number];
  kind: 'membership' | 'one_off';
  tier_rank: number;
  tier_id: string | null;
  starts_at: Date;
  ends_at: Date | null;
  revoked_at: Date | null;
};

function notificationDb(
  locale: (typeof EMAIL_LOCALES)[number],
  options: {
    rule?: Record<string, unknown>;
    entitlements?: EntitlementFixture[];
  } = {},
): Db {
  const post = chain({
    status: 'published',
    notify_supporters: true,
    title: 'Release notes',
    slug: 'release-notes',
  });
  const project = chain({ name: 'Grove', slug: 'grove' });
  const supporters = chain(
    options.entitlements ?? [
      {
        user_id: 'user_1',
        email: 'ada@example.com',
        locale,
        kind: 'membership',
        tier_rank: 2,
        tier_id: 'backer',
        starts_at: new Date('2026-01-01T00:00:00.000Z'),
        ends_at: null,
        revoked_at: null,
      },
    ],
  );
  const visibilityRules = chain([
    options.rule ?? { rule_kind: 'public', minimum_tier_rank: null, selected_tier_ids: null },
  ]);
  const delivery = chain({ id: 'delivery_1' });
  delivery.onConflict = vi.fn(() => delivery);
  const update = chain([]);
  const trx = {
    insertInto: vi.fn(() => delivery),
    selectFrom: vi.fn(() => chain(undefined)),
    updateTable: vi.fn(() => update),
    executeQuery: vi.fn(async () => ({ rows: [] })),
    streamQuery: async function* () {
      yield { rows: [] };
    },
    getExecutor: () => ({
      transformQuery: (query: unknown) => query,
      compileQuery: () => ({ sql: 'select 1', parameters: [] }),
      executeQuery: async () => ({ rows: [] }),
    }),
  };
  const dbValue: Record<string, unknown> = {
    selectFrom: vi.fn((table: string) => {
      if (table === 'post') return post;
      if (table === 'project') return project;
      if (table === 'post_visibility_rule') return visibilityRules;
      if (table === 'email_suppression') return chain(undefined);
      return supporters;
    }),
    transaction: vi.fn(() => ({
      execute: async (callback: (transaction: typeof trx) => unknown) => callback(trx),
    })),
    updateTable: vi.fn(() => update),
  };
  const connection = {
    ...dbValue,
    executeQuery: vi.fn(async () => ({ rows: [] })),
    streamQuery: async function* () {
      yield { rows: [] };
    },
    getExecutor: () => ({
      transformQuery: (query: unknown) => query,
      compileQuery: () => ({ sql: 'select 1', parameters: [] }),
      executeQuery: async () => ({ rows: [] }),
    }),
  };
  dbValue.connection = vi.fn(() => ({
    execute: async (callback: (connection: Record<string, unknown>) => unknown) =>
      callback(connection),
  }));
  return dbValue as unknown as Db;
}

describe('post notification identity', () => {
  it('keeps retries idempotent per post and supporter', () => {
    expect(postNotificationDedupeKey('post-1', 'user-1')).toBe('post:post-1:user:user-1');
    expect(postNotificationDedupeKey('post-1', 'user-1')).toBe(
      postNotificationDedupeKey('post-1', 'user-1'),
    );
    expect(postNotificationDedupeKey('post-1', 'user-1')).not.toBe(
      postNotificationDedupeKey('post-2', 'user-1'),
    );
  });
});

describe('post notification locale propagation', () => {
  it.each(EMAIL_LOCALES)('passes supporter locale to %s email renderer', async (locale) => {
    const sender = new MockEmailSender();
    const dependencies = {
      db: notificationDb(locale),
      storage: { putExport: vi.fn() },
      email: sender,
    };

    await createJobHandlers(dependencies)['post.notify_supporters']?.(job());

    const expected = renderPostPublishedEmail({
      projectName: 'Grove',
      title: 'Release notes',
      postUrl: 'https://oss.tips/grove/posts/release-notes',
      locale,
    });
    expect(sender.sent[0]).toMatchObject({
      subject: expected.subject,
      text: expected.text,
      html: expected.html,
    });
  });
});

const notificationNow = new Date('2026-08-30T12:00:00.000Z');
const entitlementFixture = (
  userId: string,
  overrides: Partial<EntitlementFixture> = {},
): EntitlementFixture => ({
  user_id: userId,
  email: `${userId}@example.com`,
  locale: 'en-GB',
  kind: 'membership',
  tier_rank: 1,
  tier_id: 'supporter',
  starts_at: new Date('2026-01-01T00:00:00.000Z'),
  ends_at: null,
  revoked_at: null,
  ...overrides,
});

describe('post notification visibility', () => {
  it.each([
    {
      name: 'public posts',
      rule: { rule_kind: 'public', minimum_tier_rank: null, selected_tier_ids: null },
      entitlements: [entitlementFixture('low'), entitlementFixture('high', { tier_rank: 2 })],
      recipients: ['low@example.com', 'high@example.com'],
    },
    {
      name: 'signed-in supporter posts',
      rule: { rule_kind: 'signed_in_supporter', minimum_tier_rank: null, selected_tier_ids: null },
      entitlements: [
        entitlementFixture('active'),
        entitlementFixture('expired', { ends_at: new Date('2026-08-29T12:00:00.000Z') }),
      ],
      recipients: ['active@example.com'],
    },
    {
      name: 'minimum-tier posts',
      rule: { rule_kind: 'minimum_tier_rank', minimum_tier_rank: 2, selected_tier_ids: null },
      entitlements: [entitlementFixture('low'), entitlementFixture('high', { tier_rank: 2 })],
      recipients: ['high@example.com'],
    },
    {
      name: 'selected-tier posts',
      rule: {
        rule_kind: 'selected_tier_ids',
        minimum_tier_rank: null,
        selected_tier_ids: ['backer'],
      },
      entitlements: [
        entitlementFixture('low'),
        entitlementFixture('high', { tier_rank: 2, tier_id: 'backer' }),
      ],
      recipients: ['high@example.com'],
    },
  ])('$name only emails authorized supporters', async ({ rule, entitlements, recipients }) => {
    const sender = new MockEmailSender();
    await createJobHandlers({
      db: notificationDb('en-GB', { rule, entitlements }),
      storage: { putExport: vi.fn() },
      email: sender,
      now: () => notificationNow,
      publicAppUrl: 'https://oss.tips',
    })['post.notify_supporters']?.(job());

    expect(sender.sent.map((message) => message.to)).toEqual(recipients);
    expect(sender.sent.every((message) => message.text.includes('Release notes'))).toBe(true);
    expect(
      sender.sent.every((message) =>
        message.text.includes('Read post: https://oss.tips/grove/posts/release-notes'),
      ),
    ).toBe(true);
  });

  it('does not send malformed visibility rules', async () => {
    const sender = new MockEmailSender();
    await createJobHandlers({
      db: notificationDb('en-GB', {
        rule: { rule_kind: 'minimum_tier_rank', minimum_tier_rank: null, selected_tier_ids: null },
      }),
      storage: { putExport: vi.fn() },
      email: sender,
      now: () => notificationNow,
      publicAppUrl: 'https://oss.tips',
    })['post.notify_supporters']?.(job());

    expect(sender.sent).toHaveLength(0);
  });
});
