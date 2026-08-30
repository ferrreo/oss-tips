import { describe, expect, it } from 'vitest';
import { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import {
  analyticsDimensions,
  analyticsEventKeyHash,
  buildProjectAnalytics,
  normalizeReferrerCategory,
  recordConfirmedConversion,
  recordPublicAnalyticsEvent,
  type AnalyticsInput,
} from './analytics.js';
import type { Db } from '../client.js';
import type { Database } from '../types.js';

const periodStart = new Date('2026-08-01T00:00:00.000Z');
const periodEnd = new Date('2026-09-01T00:00:00.000Z');

function recordingDb(): { db: Db; aggregateWrites: () => number } {
  let dedupeWrites = 0;
  let aggregateWrites = 0;
  const connection = {
    async executeQuery(query: { sql: string }) {
      if (query.sql.includes('metric_event_dedupe')) {
        dedupeWrites += 1;
        return { rows: dedupeWrites === 1 ? [{ id: 'dedupe-1' }] : [] };
      }
      if (query.sql.includes('metric_event_hourly')) aggregateWrites += 1;
      return { rows: [] };
    },
    async *streamQuery() {
      yield { rows: [] };
    },
  };
  const driver = {
    async init() {},
    async acquireConnection() {
      return connection;
    },
    async beginTransaction() {},
    async commitTransaction() {},
    async rollbackTransaction() {},
    async releaseConnection() {},
    async destroy() {},
  };
  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver as never,
      createIntrospector: (database) => new PostgresIntrospector(database),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  }) as unknown as Db;
  return { db, aggregateWrites: () => aggregateWrites };
}

describe('public analytics privacy and aggregation', () => {
  it('stores only referrer category and alpha-2 country', () => {
    const dimensions = analyticsDimensions('https://github.com/acme/repo?token=secret', 'gb');
    expect(dimensions).toEqual({ referrer: 'github', country: 'GB' });
    expect(JSON.stringify(dimensions)).not.toContain('acme');
    expect(JSON.stringify(dimensions)).not.toContain('secret');
    expect(normalizeReferrerCategory('not a URL')).toBe('other');
    expect(normalizeReferrerCategory('direct')).toBe('direct');
    expect(normalizeReferrerCategory('hacker_news')).toBe('hacker_news');
  });

  it('deduplicates retries before touching hourly aggregate', async () => {
    const { db, aggregateWrites } = recordingDb();

    await expect(
      recordPublicAnalyticsEvent(db, {
        projectId: 'project-1',
        event: 'page_view',
        idempotencyKey: 'retry-1',
        referrer: 'https://github.com/acme?token=secret',
        country: 'gb',
      }),
    ).resolves.toEqual({ accepted: true, duplicate: false });
    await expect(
      recordPublicAnalyticsEvent(db, {
        projectId: 'project-1',
        event: 'page_view',
        idempotencyKey: 'retry-1',
        referrer: 'https://gitlab.com/acme',
        country: 'us',
      }),
    ).resolves.toEqual({ accepted: false, duplicate: true });
    expect(aggregateWrites()).toBe(1);
    await db.destroy();
  });

  it('keys conversion retries by settled payment, not caller input', async () => {
    const { db, aggregateWrites } = recordingDb();
    await expect(
      recordConfirmedConversion(db, {
        projectId: 'project-1',
        paymentId: 'payment-1',
        idempotencyKey: 'first',
      }),
    ).resolves.toEqual({ accepted: true, duplicate: false });
    await expect(
      recordConfirmedConversion(db, {
        projectId: 'project-1',
        paymentId: 'payment-1',
        idempotencyKey: 'second',
      }),
    ).resolves.toEqual({ accepted: false, duplicate: true });
    expect(aggregateWrites()).toBe(1);
    await db.destroy();
  });

  it('hashes retry identity without retaining raw idempotency input', () => {
    const hash = analyticsEventKeyHash('project-1', 'page_view', 'retry-123');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain('retry-123');
    expect(hash).toBe(analyticsEventKeyHash('project-1', 'page_view', 'retry-123'));
    expect(hash).not.toBe(analyticsEventKeyHash('project-1', 'page_view', 'retry-456'));
  });

  it('separates gross support, fees, reversals, cadence, and provider fee', () => {
    const input: AnalyticsInput = {
      defaultCurrency: 'GBP',
      periodStart,
      periodEnd,
      payments: [
        {
          id: 'payment-1',
          user_id: 'user-1',
          currency: 'gbp',
          customer_charge_minor: 1_100,
          project_amount_minor: 1_000,
          platform_tip_minor: 100,
          oss_project_fee_minor: 50,
          stripe_application_fee_minor: 150,
          stripe_charge_id: 'ch_1',
          cadence: 'one_off',
          status: 'succeeded',
          created_at: new Date('2026-08-02T00:00:00.000Z'),
          settled_at: new Date('2026-08-02T00:00:00.000Z'),
        },
        {
          id: 'payment-2',
          user_id: 'user-2',
          currency: 'gbp',
          customer_charge_minor: 1_000,
          project_amount_minor: 1_000,
          platform_tip_minor: 0,
          oss_project_fee_minor: 20,
          stripe_application_fee_minor: 20,
          stripe_charge_id: 'ch_2',
          cadence: 'monthly',
          status: 'succeeded',
          created_at: new Date('2026-08-03T00:00:00.000Z'),
          settled_at: new Date('2026-08-03T00:00:00.000Z'),
        },
      ],
      refunds: [
        {
          payment_id: 'payment-1',
          amount_minor: 550,
          application_fee_refund_minor: 75,
          status: 'succeeded',
          currency: 'gbp',
          created_at: new Date('2026-08-04T00:00:00.000Z'),
        },
      ],
      disputes: [],
      providerFees: [
        {
          stripe_balance_transaction_id: 'txn_1',
          source_id: 'ch_1',
          fee_minor: 30,
          currency: 'gbp',
          created_at: new Date('2026-08-05T00:00:00.000Z'),
        },
      ],
      subscriptions: [],
      events: [
        { metric_name: 'page_view', value: 10, dimensions: { referrer: 'github', country: 'GB' } },
        {
          metric_name: 'confirmed_conversion',
          value: 2,
          dimensions: { referrer: 'github', country: 'GB' },
        },
      ],
      tiers: [],
      goals: [],
    };
    const result = buildProjectAnalytics(input);
    expect(result.grossSettledSupport.amount).toBe('2000');
    expect(result.refundsDisputes.amount).toBe('475');
    expect(result.ossTipsFee.amount).toBe('70');
    expect(result.ossTipsTip.amount).toBe('100');
    expect(result.stripeFee?.amount).toBe('30');
    expect(result.estimatedNet.amount).toBe('1425');
    expect(result.oneOff.amount).toBe('1000');
    expect(result.recurring.amount).toBe('1000');
    expect(result.conversion.conversionPercent).toBe(20);
    expect(result.countries).toEqual([{ country: 'GB', supporters: 2, sharePercent: 100 }]);
    expect(result.supportSeries.map((series) => series.id)).toEqual(['one-off', 'monthly']);
    expect(
      result.supportSeries[0]?.points.find((point) => point.label === '2026-08-02')?.value,
    ).toBe(10);
    expect(result.growthSeries[1]?.points.at(-1)?.value).toBe(2);
    expect(result.breakdown.map((row) => row.source)).toEqual([
      'One-off support',
      'Recurring support',
    ]);
  });

  it('uses current entitlements for both supporter-count goal types', () => {
    const result = buildProjectAnalytics({
      defaultCurrency: 'GBP',
      periodStart,
      periodEnd,
      payments: [
        {
          id: 'settled-payment-1',
          user_id: 'payment-user-1',
          currency: 'gbp',
          customer_charge_minor: 1000,
          project_amount_minor: 1000,
          platform_tip_minor: 0,
          oss_project_fee_minor: 0,
          stripe_application_fee_minor: 0,
          stripe_charge_id: null,
          cadence: 'one_off',
          status: 'succeeded',
          created_at: new Date('2026-08-02T00:00:00.000Z'),
          settled_at: new Date('2026-08-02T00:00:00.000Z'),
        },
      ],
      refunds: [],
      disputes: [],
      providerFees: [],
      subscriptions: [],
      events: [],
      tiers: [],
      currentEntitlements: [
        { id: 'entitlement-1', user_id: 'current-user-1' },
        { id: 'entitlement-2', user_id: 'current-user-1' },
        { id: 'entitlement-3', user_id: 'current-user-2' },
        { id: 'entitlement-4', user_id: null },
      ],
      goals: [
        {
          id: 'active-count',
          title: 'Active supporters',
          goal_type: 'active_supporter_count',
          target_minor: null,
          target_count: 8,
          currency: null,
        },
        {
          id: 'legacy-count',
          title: 'Supporters',
          goal_type: 'supporter_count',
          target_minor: null,
          target_count: 8,
          currency: null,
        },
      ],
    });

    expect(result.goals).toEqual([
      expect.objectContaining({ id: 'active-count', currentCount: 3, percent: 37.5 }),
      expect.objectContaining({ id: 'legacy-count', currentCount: 3, percent: 37.5 }),
    ]);
  });
});
