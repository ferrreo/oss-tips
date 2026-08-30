import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { hashGuestEmail, type Db, type Job } from '@oss-tips/db';
import { hashAuthOtp } from '@oss-tips/domain/auth-otp';
import {
  createSupportEmailVerificationValue,
  EMAIL_LOCALES,
  MockEmailSender,
  renderOtpEmail,
  renderProjectReviewEmail,
  supportEmailIdentifier,
} from '@oss-tips/email';
import { sendEmailNotificationJob } from './email-notifications.js';

function chain<T>(result: T) {
  const value: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of [
    'select',
    'selectAll',
    'innerJoin',
    'leftJoin',
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
  value.onConflict = vi.fn(() => value);
  value.executeTakeFirst = vi.fn(async () => result);
  value.executeTakeFirstOrThrow = vi.fn(async () => result);
  value.execute = vi.fn(async () => result);
  return value;
}

function reviewJob(): Job {
  return {
    id: 'job-review',
    queue: 'default',
    kind: 'email.notification',
    dedupe_key: null,
    payload: {
      notification: 'project-review',
      project_id: 'project_123',
      review_id: 'review_123',
      status: 'approved',
    },
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

type NotificationRows = Record<string, unknown>;

function notificationDb(
  rows: NotificationRows,
  options: {
    inserted?: boolean;
    existingStatus?: string;
    existingJobId?: string;
    existingProviderId?: string;
    existingUpdatedAt?: Date;
    verificationLatest?: unknown;
    verificationRows?: Array<Record<string, unknown>>;
    suppressed?: boolean;
    validationProject?: unknown;
  } = {},
): { db: Db; delivery: ReturnType<typeof chain>; update: ReturnType<typeof chain> } {
  const delivery = chain(options.inserted === false ? undefined : { id: 'delivery_123' });
  const existing = chain(
    options.inserted === false
      ? {
          id: 'delivery_existing',
          status: options.existingStatus ?? 'sent',
          provider_id: options.existingProviderId ?? null,
          metadata: options.existingJobId ? { job_id: options.existingJobId } : {},
          updated_at: options.existingUpdatedAt ?? new Date(),
        }
      : undefined,
  );
  const reconciledDelivery = chain({
    id: 'delivery_123',
    status: 'sent',
    sent_at: new Date('2026-08-30T00:00:00.000Z'),
  });
  const guestToken = chain(undefined);
  const update = chain({ id: 'delivery_existing' });
  let locked = false;
  const trx = {
    insertInto: vi.fn(() => delivery),
    selectFrom: vi.fn((table: string) => {
      if (table === 'email_delivery')
        return options.inserted === false ? existing : reconciledDelivery;
      if (table === 'email_delivery_event') return chain([]);
      if (table === 'email_suppression')
        return chain(options.suppressed ? { email_address: 'owner@example.com' } : undefined);
      if (locked && table === 'project') return chain(options.validationProject);
      return chain(rows[table]);
    }),
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
  let verificationLookup = 0;
  const dbValue: Record<string, unknown> = {
    selectFrom: vi.fn((table: string) => {
      if (table === 'email_suppression') return chain(undefined);
      if (table === 'verification') {
        if (verificationLookup++ === 0 || !options.verificationRows) {
          return chain(verificationLookup === 1 ? rows[table] : options.verificationLatest);
        }
        let candidates = [...options.verificationRows];
        const query = chain<unknown>(undefined);
        query.where = vi.fn((column: unknown, operator: unknown, value: unknown) => {
          if (column === 'identifier' && operator === '=') {
            candidates = candidates.filter((row) => row.identifier === value);
          }
          if (column === 'expires_at' && operator === '>') {
            candidates = candidates.filter(
              (row) =>
                row.expires_at instanceof Date && value instanceof Date && row.expires_at > value,
            );
          }
          return query;
        });
        query.orderBy = vi.fn((column: unknown, direction: unknown) => {
          if (direction !== 'desc') return query;
          candidates.sort((left, right) => {
            if (column === 'created_at') {
              return (
                (right.created_at instanceof Date ? right.created_at.getTime() : 0) -
                (left.created_at instanceof Date ? left.created_at.getTime() : 0)
              );
            }
            if (column === 'id') {
              const createdAtDifference =
                (right.created_at instanceof Date ? right.created_at.getTime() : 0) -
                (left.created_at instanceof Date ? left.created_at.getTime() : 0);
              return createdAtDifference || String(right.id).localeCompare(String(left.id));
            }
            return 0;
          });
          return query;
        });
        query.executeTakeFirst = vi.fn(async () => candidates[0]);
        return query;
      }
      return chain(rows[table]);
    }),
    transaction: vi.fn(() => ({
      execute: async (callback: (transaction: typeof trx) => unknown) => {
        locked = options.validationProject !== undefined;
        try {
          return await callback(trx);
        } finally {
          locked = false;
        }
      },
    })),
    insertInto: vi.fn((table: string) => (table === 'guest_access_token' ? guestToken : delivery)),
    updateTable: vi.fn(() => update),
  };
  const connection: Record<string, unknown> = {
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
  if (options.validationProject !== undefined) {
    const selectFrom = dbValue.selectFrom as (table: string) => unknown;
    dbValue.selectFrom = vi.fn((table: string) => {
      if (locked && table === 'project') return chain(options.validationProject);
      return selectFrom(table);
    });
    connection.selectFrom = dbValue.selectFrom as typeof connection.selectFrom;
    dbValue.connection = vi.fn(() => ({
      execute: async (callback: (connection: Record<string, unknown>) => unknown) => {
        locked = true;
        try {
          return await callback(connection);
        } finally {
          locked = false;
        }
      },
    }));
  } else {
    dbValue.connection = vi.fn(() => ({
      execute: async (callback: (connection: Record<string, unknown>) => unknown) =>
        callback(connection),
    }));
  }
  return {
    db: dbValue as unknown as Db,
    delivery,
    update,
  };
}

function reviewDb(locale: string): Db {
  const review = chain({ id: 'review_123', notes: null });
  const project = chain({ id: 'project_123', name: 'Grove' });
  const members = chain([
    {
      user_id: 'user_123',
      role: 'owner',
      capabilities: [
        'project.publish_project',
        'project.manage_api_keys',
        'project.manage_webhooks',
        'project.connect_stripe',
        'project.manage_domain',
      ],
      email: 'owner@example.com',
      locale,
    },
  ]);
  const delivery = chain({ id: 'delivery_123' });
  const update = chain([]);
  const trx = {
    insertInto: vi.fn(() => delivery),
    selectFrom: vi.fn((table: string) =>
      table === 'email_suppression' ? chain(undefined) : chain(undefined),
    ),
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
      if (table === 'project_review') return review;
      if (table === 'project') return project;
      if (table === 'email_suppression') return chain(undefined);
      return members;
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

function projectRows(overrides: NotificationRows = {}): NotificationRows {
  return {
    project: { id: 'project_123', name: 'Grove' },
    project_member: [
      {
        user_id: 'owner_123',
        role: 'owner',
        capabilities: [
          'project.publish_project',
          'project.manage_api_keys',
          'project.manage_webhooks',
          'project.connect_stripe',
          'project.manage_domain',
        ],
        email: 'owner@example.com',
        locale: 'de',
      },
      {
        user_id: 'finance_123',
        role: 'finance',
        capabilities: ['project.view_payments'],
        email: 'finance@example.com',
        locale: 'fr',
      },
    ],
    ...overrides,
  };
}

function notificationJob(payload: Record<string, string>): Job {
  return {
    ...reviewJob(),
    id: `job-${payload.notification}`,
    payload,
  };
}

describe('durable email notification jobs', () => {
  it.each(EMAIL_LOCALES)('renders project review notifications in %s', async (locale) => {
    const sender = new MockEmailSender();
    await sendEmailNotificationJob({ db: reviewDb(locale), email: sender }, reviewJob());

    const expected = renderProjectReviewEmail({
      projectName: 'Grove',
      status: 'approved',
      locale,
    });
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]).toMatchObject({
      subject: expected.subject,
      text: expected.text,
      html: expected.html,
    });
  });

  it('claims new deliveries as sending before calling provider', async () => {
    const sender = new MockEmailSender();
    const fake = notificationDb(projectRows({ api_key: { id: 'key_123', name: 'Deploy key' } }));
    await sendEmailNotificationJob(
      { db: fake.db, email: sender },
      notificationJob({
        notification: 'api-key-change',
        project_id: 'project_123',
        api_key_id: 'key_123',
        action: 'created',
      }),
    );
    expect(fake.delivery.values).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sending',
        dedupe_key: 'email:api-key:key_123:created:user:owner_123',
      }),
    );
  });

  it('does not send when suppression lands before the atomic claim', async () => {
    const sender = new MockEmailSender();
    const fake = notificationDb(projectRows({ api_key: { id: 'key_123', name: 'Deploy key' } }), {
      suppressed: true,
    });
    await sendEmailNotificationJob(
      { db: fake.db, email: sender },
      notificationJob({
        notification: 'api-key-change',
        project_id: 'project_123',
        api_key_id: 'key_123',
        action: 'created',
      }),
    );
    expect(sender.sent).toHaveLength(0);
    expect(fake.delivery.values).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'suppressed' }),
    );
  });

  it('does not send duplicate jobs already claimed by another worker', async () => {
    const sender = new MockEmailSender();
    const fake = notificationDb(projectRows({ api_key: { id: 'key_123', name: 'Deploy key' } }), {
      inserted: false,
      existingStatus: 'sending',
    });
    await sendEmailNotificationJob(
      { db: fake.db, email: sender },
      notificationJob({
        notification: 'api-key-change',
        project_id: 'project_123',
        api_key_id: 'key_123',
        action: 'created',
      }),
    );
    expect(sender.sent).toHaveLength(0);
  });

  it('retries a sending delivery for the same job with a stable provider key', async () => {
    const sender = new MockEmailSender();
    const fake = notificationDb(projectRows({ api_key: { id: 'key_123', name: 'Deploy key' } }), {
      inserted: false,
      existingStatus: 'sending',
      existingJobId: 'job-api-key-change',
    });
    await sendEmailNotificationJob(
      { db: fake.db, email: sender },
      notificationJob({
        notification: 'api-key-change',
        project_id: 'project_123',
        api_key_id: 'key_123',
        action: 'created',
      }),
    );
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.idempotencyKey).toMatch(/^oss-tips-email-[a-f0-9]{64}$/);
  });

  it('takes over an abandoned sending delivery after its lease expires', async () => {
    const sender = new MockEmailSender();
    const now = new Date('2026-08-30T00:00:00.000Z');
    const fake = notificationDb(projectRows({ api_key: { id: 'key_123', name: 'Deploy key' } }), {
      inserted: false,
      existingStatus: 'sending',
      existingJobId: 'job-old',
      existingUpdatedAt: new Date('2026-08-29T23:00:00.000Z'),
    });
    await sendEmailNotificationJob(
      { db: fake.db, email: sender, now: () => now },
      notificationJob({
        notification: 'api-key-change',
        project_id: 'project_123',
        api_key_id: 'key_123',
        action: 'created',
      }),
    );
    expect(sender.sent).toHaveLength(1);
    expect(fake.update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sending',
        metadata: expect.objectContaining({ job_id: 'job-api-key-change' }),
      }),
    );
  });

  it('records provider failures without persisting provider error text', async () => {
    const sender = {
      send: vi.fn(async () => {
        throw new Error('provider secret: do not persist');
      }),
    };
    const fake = notificationDb(projectRows({ api_key: { id: 'key_123', name: 'Deploy key' } }));
    await expect(
      sendEmailNotificationJob(
        { db: fake.db, email: sender },
        notificationJob({
          notification: 'api-key-change',
          project_id: 'project_123',
          api_key_id: 'key_123',
          action: 'created',
        }),
      ),
    ).rejects.toThrow('Email delivery failed');
    expect(fake.update.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('keeps provider-accepted deliveries sent when event reconciliation needs a retry', async () => {
    const sender = new MockEmailSender();
    let reconcileAttempts = 0;
    const reconcileProviderEvents = vi.fn(async () => {
      reconcileAttempts += 1;
      if (reconcileAttempts === 1) throw new Error('temporary reconciliation failure');
      return 0;
    });
    const rows = projectRows({ api_key: { id: 'key_123', name: 'Deploy key' } });
    const fake = notificationDb(rows);
    await expect(
      sendEmailNotificationJob(
        {
          db: fake.db,
          email: sender,
          emailDeliveries: { reconcileProviderEvents },
        },
        notificationJob({
          notification: 'api-key-change',
          project_id: 'project_123',
          api_key_id: 'key_123',
          action: 'created',
        }),
      ),
    ).rejects.toThrow('Email delivery reconciliation failed');
    expect(sender.sent).toHaveLength(1);
    expect(reconcileProviderEvents).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: 'delivery_existing', providerEmailId: 'mock_1' }),
    );
    expect(fake.update.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
    expect(fake.update.set).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));

    const retry = notificationDb(rows, {
      inserted: false,
      existingStatus: 'sent',
      existingProviderId: 'mock_1',
    });
    await sendEmailNotificationJob(
      {
        db: retry.db,
        email: sender,
        emailDeliveries: { reconcileProviderEvents },
      },
      notificationJob({
        notification: 'api-key-change',
        project_id: 'project_123',
        api_key_id: 'key_123',
        action: 'created',
      }),
    );
    expect(sender.sent).toHaveLength(1);
    expect(reconcileProviderEvents).toHaveBeenCalledTimes(2);
  });

  it('transfers a failed delivery to a new job before retrying', async () => {
    const sender = new MockEmailSender();
    const fake = notificationDb(projectRows({ api_key: { id: 'key_123', name: 'Deploy key' } }), {
      inserted: false,
      existingStatus: 'failed',
      existingJobId: 'job-old',
    });
    await sendEmailNotificationJob(
      { db: fake.db, email: sender },
      notificationJob({
        notification: 'api-key-change',
        project_id: 'project_123',
        api_key_id: 'key_123',
        action: 'created',
      }),
    );
    expect(sender.sent).toHaveLength(1);
    expect(fake.update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sending',
        metadata: expect.objectContaining({ job_id: 'job-api-key-change' }),
      }),
    );
  });

  it('limits API key and webhook notifications to capable members', async () => {
    const apiSender = new MockEmailSender();
    const api = notificationDb(projectRows({ api_key: { id: 'key_123', name: 'Deploy key' } }));
    await sendEmailNotificationJob(
      { db: api.db, email: apiSender },
      notificationJob({
        notification: 'api-key-change',
        project_id: 'project_123',
        api_key_id: 'key_123',
        action: 'created',
      }),
    );
    expect(apiSender.sent).toHaveLength(1);
    expect(apiSender.sent[0]?.to).toBe('owner@example.com');

    const webhookSender = new MockEmailSender();
    const webhook = notificationDb(
      projectRows({ webhook_endpoint: { id: 'endpoint_123', url: 'https://hooks.example.test' } }),
    );
    await sendEmailNotificationJob(
      { db: webhook.db, email: webhookSender },
      notificationJob({
        notification: 'webhook-change',
        project_id: 'project_123',
        webhook_endpoint_id: 'endpoint_123',
        action: 'disabled',
        event_id: 'audit_disabled_1',
      }),
    );
    expect(webhookSender.sent).toHaveLength(1);
    expect(webhookSender.sent[0]?.to).toBe('owner@example.com');
  });

  it('keeps webhook transition occurrences distinct while retrying the same occurrence', async () => {
    const sender = new MockEmailSender();
    const fake = notificationDb(
      projectRows({ webhook_endpoint: { id: 'endpoint_123', url: 'https://hooks.example.test' } }),
    );
    const dispatch = (eventId: string, action: 'enabled' | 'disabled') =>
      sendEmailNotificationJob(
        { db: fake.db, email: sender },
        notificationJob({
          notification: 'webhook-change',
          project_id: 'project_123',
          webhook_endpoint_id: 'endpoint_123',
          action,
          event_id: eventId,
        }),
      );

    await dispatch('audit-disable-1', 'disabled');
    await dispatch('audit-disable-1', 'disabled');
    await dispatch('audit-enable-1', 'enabled');
    await dispatch('audit-disable-2', 'disabled');

    const dedupeCalls = (
      fake.delivery.values as unknown as {
        mock: { calls: Array<[{ dedupe_key: string }]> };
      }
    ).mock.calls;
    const dedupeKeys = dedupeCalls.map(([value]) => value.dedupe_key);
    expect(dedupeKeys[0]).toBe(dedupeKeys[1]);
    expect(new Set(dedupeKeys).size).toBe(3);
    expect(dedupeKeys[3]).not.toBe(dedupeKeys[0]);
  });

  it.each([
    [
      'project review',
      {
        notification: 'project-review',
        project_id: 'project_123',
        review_id: 'review_123',
        status: 'rejected',
      },
      { project_review: { id: 'review_123', notes: null } },
    ],
    [
      'Stripe restriction',
      {
        notification: 'stripe-restriction',
        project_id: 'project_123',
        event_id: 'evt_stripe',
        restriction: 'Payouts unavailable.',
      },
      {},
    ],
    [
      'domain failure',
      {
        notification: 'domain-failure',
        project_id: 'project_123',
        domain_id: 'domain_123',
        event_id: 'evt_domain',
        failure: 'Verification needs attention.',
      },
      { custom_domain: { id: 'domain_123', hostname: 'docs.example.test' } },
    ],
  ] as const)('dispatches %s notification', async (_name, payload, extraRows) => {
    const sender = new MockEmailSender();
    const fake = notificationDb(projectRows(extraRows));
    await sendEmailNotificationJob({ db: fake.db, email: sender }, notificationJob(payload));
    expect(sender.sent).toHaveLength(1);
  });

  it('keeps domain failure incidents distinct across recovery', async () => {
    const sender = new MockEmailSender();
    const fake = notificationDb(
      projectRows({ custom_domain: { id: 'domain_123', hostname: 'docs.example.test' } }),
    );
    const dispatch = (eventId: string) =>
      sendEmailNotificationJob(
        { db: fake.db, email: sender },
        notificationJob({
          notification: 'domain-failure',
          project_id: 'project_123',
          domain_id: 'domain_123',
          event_id: eventId,
          failure: 'Verification needs attention.',
        }),
      );

    await dispatch('job-domain-failure-1');
    await dispatch('job-domain-failure-1');
    await dispatch('job-domain-failure-2');

    const dedupeCalls = (
      fake.delivery.values as unknown as {
        mock: { calls: Array<[{ dedupe_key: string }]> };
      }
    ).mock.calls;
    const dedupeKeys = dedupeCalls.map(([value]) => value.dedupe_key);
    expect(dedupeKeys[0]).toBe(dedupeKeys[1]);
    expect(dedupeKeys[2]).not.toBe(dedupeKeys[0]);
  });

  it('dispatches membership, refund, and dispute notifications to their recipient locale', async () => {
    const membershipSender = new MockEmailSender();
    const membership = notificationDb({
      subscription: {
        id: 'subscription_123',
        project_id: 'project_123',
        user_id: 'member_123',
        project_amount_minor: 1000,
        platform_tip_minor: 0,
        currency: 'gbp',
        feature_mode: 'standard',
        cadence: 'monthly',
        project_name: 'Grove',
        tier_name: 'Supporter',
        email: 'member@example.com',
        locale: 'pt-BR',
      },
    });
    await sendEmailNotificationJob(
      { db: membership.db, email: membershipSender },
      notificationJob({
        notification: 'membership',
        subscription_id: 'subscription_123',
        event_id: 'evt_membership',
        event: 'renewed',
      }),
    );
    expect(membershipSender.sent).toHaveLength(1);
    expect(membershipSender.sent[0]?.text).toContain('Grove');

    const refundSender = new MockEmailSender();
    const refund = notificationDb({
      refund: {
        id: 'refund_123',
        amount_minor: 500,
        application_fee_refund_minor: 25,
        currency: 'gbp',
        reason: null,
        status: 'succeeded',
        user_id: 'member_123',
        receipt_email: null,
        project_name: 'Grove',
        user_email: 'member@example.com',
        user_locale: 'fr',
      },
    });
    await sendEmailNotificationJob(
      { db: refund.db, email: refundSender },
      notificationJob({
        notification: 'refund',
        refund_id: 'refund_123',
        event_id: 'evt_refund',
      }),
    );
    expect(refundSender.sent).toHaveLength(1);
    expect(refund.delivery.values).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupe_key: 'email:refund:refund_123:user:member_123',
      }),
    );

    const disputeSender = new MockEmailSender();
    const dispute = notificationDb({
      payment_dispute: {
        id: 'dispute_123',
        status: 'warning_needs_response',
        amount_minor: 500,
        currency: 'gbp',
        user_id: 'member_123',
        receipt_email: null,
        project_name: 'Grove',
        user_email: 'member@example.com',
        user_locale: 'es',
      },
    });
    await sendEmailNotificationJob(
      { db: dispute.db, email: disputeSender },
      notificationJob({
        notification: 'dispute',
        dispute_id: 'dispute_123',
        event_id: 'evt_dispute',
      }),
    );
    expect(disputeSender.sent).toHaveLength(1);
  });

  it('keeps separate refunds from one provider event distinct and retry-stable', async () => {
    const eventId = 'evt_refunds_batch';
    const row = {
      amount_minor: 500,
      application_fee_refund_minor: 25,
      currency: 'gbp',
      reason: null,
      status: 'succeeded',
      user_id: 'member_123',
      receipt_email: null,
      project_name: 'Grove',
      user_email: 'member@example.com',
      user_locale: 'fr',
    };
    const first = notificationDb({ refund: { id: 'refund_1', ...row } });
    const second = notificationDb({ refund: { id: 'refund_2', ...row } });
    const firstSender = new MockEmailSender();
    const secondSender = new MockEmailSender();

    await sendEmailNotificationJob(
      { db: first.db, email: firstSender },
      notificationJob({ notification: 'refund', refund_id: 'refund_1', event_id: eventId }),
    );
    await sendEmailNotificationJob(
      { db: second.db, email: secondSender },
      notificationJob({ notification: 'refund', refund_id: 'refund_2', event_id: eventId }),
    );

    const firstDelivery = (first.delivery.values as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0]?.[0] as { dedupe_key: string };
    const secondDelivery = (second.delivery.values as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0]?.[0] as { dedupe_key: string };
    expect(firstDelivery.dedupe_key).not.toBe(secondDelivery.dedupe_key);
    expect(firstSender.sent).toHaveLength(1);
    expect(secondSender.sent).toHaveLength(1);

    const retry = notificationDb(
      { refund: { id: 'refund_1', ...row } },
      { inserted: false, existingStatus: 'sent', existingProviderId: 'mock_1' },
    );
    const reconcileProviderEvents = vi.fn(async () => 0);
    await sendEmailNotificationJob(
      { db: retry.db, email: firstSender, emailDeliveries: { reconcileProviderEvents } },
      notificationJob({
        notification: 'refund',
        refund_id: 'refund_1',
        event_id: 'evt_refund_manual_retry',
      }),
    );
    const retryDelivery = (retry.delivery.values as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0]?.[0] as { dedupe_key: string };
    expect(retryDelivery.dedupe_key).toBe(firstDelivery.dedupe_key);
    expect(firstSender.sent).toHaveLength(1);
    expect(reconcileProviderEvents).toHaveBeenCalledWith(
      expect.objectContaining({ providerEmailId: 'mock_1' }),
    );
  });

  it('dispatches account security changes without secret material', async () => {
    const sender = new MockEmailSender();
    const fake = notificationDb({
      user: { id: 'user_123', email: 'user@example.com', locale: 'de' },
    });
    await sendEmailNotificationJob(
      { db: fake.db, email: sender },
      notificationJob({
        notification: 'security-change',
        user_id: 'user_123',
        event_id: 'evt_security',
        action: 'passkey_removed',
      }),
    );
    expect(sender.sent).toHaveLength(1);
    expect(JSON.stringify(sender.sent)).not.toMatch(/secret|token|api[_ -]?key/i);
  });

  it('dispatches a new sign-in event from its durable security record', async () => {
    const sender = new MockEmailSender();
    const fake = notificationDb({
      user_security_event: {
        id: 'event_123',
        user_id: 'user_123',
        ip_address: '203.0.113.4',
        user_agent: 'Example browser',
        email: 'user@example.com',
        locale: 'pt-BR',
      },
      user: { id: 'user_123', email: 'user@example.com', locale: 'pt-BR' },
    });
    await sendEmailNotificationJob(
      { db: fake.db, email: sender },
      notificationJob({
        notification: 'security-event',
        user_id: 'user_123',
        event_id: 'event_123',
        event: 'sign-in',
      }),
    );
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.text).toContain('203.0.113.4');
  });

  it('dispatches team invitations with a localized role and public invite link', async () => {
    const sender = new MockEmailSender();
    const fake = notificationDb({
      project_team_invite: {
        id: 'invite_123',
        email: 'new-admin@example.com',
        role: 'admin',
        status: 'pending',
        expires_at: new Date('2026-09-06T00:00:00.000Z'),
        project_name: 'Grove',
        recipient_locale: 'de',
      },
    });
    await sendEmailNotificationJob(
      { db: fake.db, email: sender, publicAppUrl: 'https://oss.tips' },
      notificationJob({
        notification: 'team-invite',
        project_id: 'project_123',
        invite_id: 'invite_123',
      }),
    );
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.text).toContain('Administrator');
    expect(sender.sent[0]?.text).toContain('https://oss.tips/invite/invite_123');
  });

  it('dispatches guest receipts with a retry-stable claim link', async () => {
    const secret = 'test-secret';
    const email = 'guest@example.com';
    const token = `gat_${createHmac('sha256', secret)
      .update('guest-claim:payment_123', 'utf8')
      .digest('base64url')}`;
    const sender = new MockEmailSender();
    const fake = notificationDb({
      payment: {
        id: 'payment_123',
        user_id: null,
        receipt_email: email,
        cadence: 'one_off',
        status: 'succeeded',
        project_amount_minor: 1000,
        oss_project_fee_minor: 25,
        currency: 'gbp',
        project_name: 'Grove',
        recipient_locale: 'fr',
      },
      guest_access_token: {
        kind: 'claim',
        payment_id: 'payment_123',
        thread_id: null,
        email_hash: hashGuestEmail(email),
        expires_at: new Date('2026-09-06T00:00:00.000Z'),
        used_at: null,
      },
    });
    await sendEmailNotificationJob(
      {
        db: fake.db,
        email: sender,
        authSecret: secret,
        now: () => new Date('2026-08-30T00:00:00.000Z'),
      },
      notificationJob({
        notification: 'guest-receipt',
        payment_id: 'payment_123',
        event_id: 'event_123',
      }),
    );
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.text).toContain(`/claim/${token}`);
  });

  it('reconciles a guest receipt after its claim token was consumed', async () => {
    const secret = 'test-secret';
    const email = 'guest@example.com';
    const sender = new MockEmailSender();
    const reconcileProviderEvents = vi.fn(async () => 1);
    const fake = notificationDb(
      {
        payment: {
          id: 'payment_123',
          user_id: null,
          receipt_email: email,
          cadence: 'one_off',
          status: 'succeeded',
          project_amount_minor: 1000,
          oss_project_fee_minor: 25,
          currency: 'gbp',
          project_name: 'Grove',
          recipient_locale: 'fr',
        },
        guest_access_token: {
          kind: 'claim',
          payment_id: 'payment_123',
          thread_id: null,
          email_hash: hashGuestEmail(email),
          expires_at: new Date('2026-09-06T00:00:00.000Z'),
          used_at: new Date('2026-08-30T00:05:00.000Z'),
        },
      },
      { inserted: false, existingStatus: 'sent', existingProviderId: 'provider_guest' },
    );

    await sendEmailNotificationJob(
      {
        db: fake.db,
        email: sender,
        authSecret: secret,
        emailDeliveries: { reconcileProviderEvents },
      },
      notificationJob({
        notification: 'guest-receipt',
        payment_id: 'payment_123',
        event_id: 'event_123',
      }),
    );

    expect(sender.sent).toHaveLength(0);
    expect(reconcileProviderEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: 'delivery_existing',
        providerEmailId: 'provider_guest',
      }),
    );
  });

  it('recovers a guest receipt whose accepted send lacks a provider id', async () => {
    const secret = 'test-secret';
    const email = 'guest@example.com';
    const token = `gat_${createHmac('sha256', secret)
      .update('guest-claim:payment_123', 'utf8')
      .digest('base64url')}`;
    const sender = new MockEmailSender();
    const fake = notificationDb(
      {
        payment: {
          id: 'payment_123',
          user_id: null,
          receipt_email: email,
          cadence: 'one_off',
          status: 'succeeded',
          project_amount_minor: 1000,
          oss_project_fee_minor: 25,
          currency: 'gbp',
          project_name: 'Grove',
          recipient_locale: 'fr',
        },
        guest_access_token: {
          kind: 'claim',
          payment_id: 'payment_123',
          thread_id: null,
          email_hash: hashGuestEmail(email),
          expires_at: new Date('2026-09-06T00:00:00.000Z'),
          used_at: new Date('2026-08-30T00:05:00.000Z'),
        },
      },
      {
        inserted: false,
        existingStatus: 'sending',
        existingJobId: 'job-guest-receipt',
      },
    );

    await sendEmailNotificationJob(
      { db: fake.db, email: sender, authSecret: secret },
      notificationJob({
        notification: 'guest-receipt',
        payment_id: 'payment_123',
        event_id: 'event_123',
      }),
    );

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.text).toContain(`/claim/${token}`);
    expect(sender.sent[0]?.idempotencyKey).toMatch(/^oss-tips-email-[a-f0-9]{64}$/);
  });

  it('dispatches guest replies with a retry-stable reply link', async () => {
    const secret = 'test-secret';
    const email = 'guest@example.com';
    const token = `gat_${createHmac('sha256', secret)
      .update('guest-reply:message_123', 'utf8')
      .digest('base64url')}`;
    const sender = new MockEmailSender();
    const fake = notificationDb({
      'supporter_message as message': {
        id: 'message_123',
        body: 'Thanks for the update.',
        author_user_id: 'owner_123',
        thread_id: 'thread_123',
        project_id: 'project_123',
        supporter_user_id: null,
        payment_status: 'succeeded',
        receipt_email: email,
        project_name: 'Grove',
        recipient_locale: 'es',
      },
      guest_access_token: {
        kind: 'reply',
        payment_id: null,
        thread_id: 'thread_123',
        email_hash: hashGuestEmail(email),
        expires_at: new Date('2026-09-06T00:00:00.000Z'),
        used_at: null,
      },
    });
    await sendEmailNotificationJob(
      { db: fake.db, email: sender, authSecret: secret },
      notificationJob({
        notification: 'guest-reply',
        project_id: 'project_123',
        thread_id: 'thread_123',
        message_id: 'message_123',
      }),
    );
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.text).toContain(`/reply/${token}`);
  });

  it('dispatches support-email verification with its purpose-specific copy', async () => {
    const secret = 'test-secret';
    const projectId = 'project_123';
    const email = 'support@example.com';
    const identifier = supportEmailIdentifier(projectId, email, secret);
    const verification = createSupportEmailVerificationValue(identifier, secret);
    const sender = new MockEmailSender();
    const fake = notificationDb(
      {
        verification: {
          id: 'verification_123',
          identifier,
          value: verification.value,
          expires_at: new Date('2026-09-06T00:00:00.000Z'),
        },
        project: { id: projectId, name: 'Grove', support_email: email },
        user: { email, locale: 'pt-BR' },
      },
      {
        verificationLatest: {
          id: 'verification_123',
          value: verification.value,
          expires_at: new Date('2026-09-06T00:00:00.000Z'),
        },
      },
    );
    await sendEmailNotificationJob(
      { db: fake.db, email: sender, authSecret: secret },
      notificationJob({
        notification: 'support-email-verification',
        project_id: projectId,
        verification_id: 'verification_123',
      }),
    );
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.subject).toBe(
      renderOtpEmail({
        code: verification.code,
        expiresMinutes: 10,
        purpose: 'support-email',
        locale: 'pt-BR',
      }).subject,
    );
    expect(sender.sent[0]?.subject).not.toBe(
      renderOtpEmail({ code: verification.code, expiresMinutes: 10, locale: 'pt-BR' }).subject,
    );
  });

  it('skips a support verification job after its project email rotates', async () => {
    const secret = 'test-secret';
    const projectId = 'project_123';
    const oldEmail = 'old-support@example.com';
    const identifier = supportEmailIdentifier(projectId, oldEmail, secret);
    const verification = createSupportEmailVerificationValue(identifier, secret);
    const sender = new MockEmailSender();
    const fake = notificationDb(
      {
        verification: {
          id: 'verification_old',
          identifier,
          value: verification.value,
          expires_at: new Date('2026-09-06T00:00:00.000Z'),
        },
        project: { id: projectId, support_email: oldEmail },
        user: { email: oldEmail, locale: 'en-GB' },
      },
      {
        verificationLatest: {
          id: 'verification_old',
          value: verification.value,
          expires_at: new Date('2026-09-06T00:00:00.000Z'),
        },
        validationProject: {
          id: projectId,
          support_email: 'new-support@example.com',
          support_email_verified_at: null,
        },
      },
    );

    await sendEmailNotificationJob(
      { db: fake.db, email: sender, authSecret: secret },
      notificationJob({
        notification: 'support-email-verification',
        project_id: projectId,
        verification_id: 'verification_old',
      }),
    );

    expect(sender.sent).toHaveLength(0);
    expect(fake.delivery.values).not.toHaveBeenCalled();
  });

  it('dispatches sign-in OTP from the newest active attempt-zero verification row', async () => {
    const secret = 'test-auth-secret';
    const now = new Date('2026-08-30T00:00:00.000Z');
    const verification = {
      id: 'verification_otp',
      identifier: 'sign-in-otp-user@example.com',
      value: `${hashAuthOtp('042069', secret)}:0`,
      expires_at: new Date('2026-08-30T00:05:00.000Z'),
      created_at: new Date('2026-08-30T00:00:00.000Z'),
    };
    const sender = new MockEmailSender();
    const fake = notificationDb(
      {
        verification,
        user: { id: 'user_otp', email: 'user@example.com', locale: 'de' },
      },
      { verificationLatest: verification },
    );

    await sendEmailNotificationJob(
      { db: fake.db, email: sender, authSecret: secret, now: () => now },
      notificationJob({
        notification: 'auth-otp',
        verification_id: verification.id,
      }),
    );

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe('user@example.com');
    expect(sender.sent[0]?.text).toContain('042069');
    expect(sender.sent[0]?.text).toContain('5');
    expect(sender.sent[0]?.idempotencyKey).toMatch(/^oss-tips-email-[a-f0-9]{64}$/);
    expect(fake.delivery.values).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupe_key: 'email:auth-otp:verification_otp:user:user_otp',
        metadata: expect.not.objectContaining({ code: '042069' }),
      }),
    );

    const retrySender = new MockEmailSender();
    const retryFake = notificationDb(
      {
        verification,
        user: { id: 'user_otp', email: 'user@example.com', locale: 'de' },
      },
      { verificationLatest: verification },
    );
    const retryJob = {
      ...notificationJob({ notification: 'auth-otp', verification_id: verification.id }),
      id: 'job-auth-otp-retry',
    };
    await sendEmailNotificationJob(
      { db: retryFake.db, email: retrySender, authSecret: secret, now: () => now },
      retryJob,
    );
    expect(retrySender.sent[0]?.idempotencyKey).toBe(sender.sent[0]?.idempotencyKey);
  });

  it('dispatches sign-in OTP to an email before its account exists', async () => {
    const secret = 'test-auth-secret';
    const verification = {
      id: 'verification_new_user_otp',
      identifier: 'sign-in-otp-new-user@example.com',
      value: `${hashAuthOtp('042069', secret)}:0`,
      expires_at: new Date('2026-08-30T00:05:00.000Z'),
    };
    const sender = new MockEmailSender();
    const fake = notificationDb({ verification }, { verificationLatest: verification });

    await sendEmailNotificationJob(
      {
        db: fake.db,
        email: sender,
        authSecret: secret,
        now: () => new Date('2026-08-30T00:00:00.000Z'),
      },
      notificationJob({
        notification: 'auth-otp',
        verification_id: verification.id,
      }),
    );

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe('new-user@example.com');
    expect(sender.sent[0]?.text).toContain('042069');
    expect(fake.delivery.values).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupe_key: expect.stringMatching(/^email:auth-otp:verification_new_user_otp:email:/),
      }),
    );
  });

  it.each([
    ['a newer active verification exists', { id: 'verification_newer', value: 'unused:0' }],
    [
      'the requested verification has been attempted',
      { id: 'verification_otp', value: `${hashAuthOtp('042069', 'test-auth-secret')}:1` },
    ],
    [
      'the requested verification is expired',
      { id: 'verification_otp', expires_at: new Date('2026-08-29T23:59:00.000Z') },
    ],
    [
      'a newer verification is expired',
      {
        id: 'verification_newer',
        expires_at: new Date('2026-08-29T23:59:00.000Z'),
      },
    ],
  ])('does not send auth OTP when %s', async (_reason, latest) => {
    const secret = 'test-auth-secret';
    const requested = {
      id: 'verification_otp',
      identifier: 'sign-in-otp-user@example.com',
      value: `${hashAuthOtp('042069', secret)}:0`,
      expires_at: new Date('2026-08-30T00:05:00.000Z'),
      created_at: new Date('2026-08-30T00:00:00.000Z'),
    };
    const sender = new MockEmailSender();
    const fake = notificationDb(
      {
        verification: requested,
        user: { id: 'user_otp', email: 'user@example.com', locale: 'de' },
      },
      {
        verificationLatest: { ...requested, ...latest },
        ...(latest.id === 'verification_newer'
          ? {
              verificationRows: [
                requested,
                {
                  ...requested,
                  ...latest,
                  created_at: new Date('2026-08-30T00:01:00.000Z'),
                },
              ],
            }
          : {}),
      },
    );

    await sendEmailNotificationJob(
      {
        db: fake.db,
        email: sender,
        authSecret: secret,
        now: () => new Date('2026-08-30T00:00:00.000Z'),
      },
      notificationJob({ notification: 'auth-otp', verification_id: requested.id }),
    );

    expect(sender.sent).toHaveLength(0);
  });
});
