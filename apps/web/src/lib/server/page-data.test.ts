import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@oss-tips/db';
import {
  buildTransparencyAggregate,
  buildSupporterLifetimeSupport,
  checkoutPaymentStatus,
  buildAdminOverviewMetrics,
  goalFromRow,
  isDemoMode,
  loadCatalogPageData,
  loadCheckoutSuccessPageData,
  loadTransparencyPageData,
  mapDbProjectToUi,
  netSettledProjectAmountMinor,
  statsFromPayments,
} from './page-data';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server page data source policy', () => {
  it('maps goal metadata and count progress without treating counts as money', () => {
    expect(
      goalFromRow(
        {
          id: 'goal-count',
          title: 'Active supporters',
          goal_type: 'active_supporter_count',
          target_minor: null,
          target_count: 12,
          currency: null,
          deadline: new Date('2026-12-01T00:00:00.000Z'),
          basis: 'active_supporters',
        },
        999_00,
        7,
        'GBP',
      ),
    ).toMatchObject({
      type: 'active_supporter_count',
      targetMinor: 12,
      raisedMinor: 7,
      targetCount: 12,
      progressCount: 7,
      basis: 'active supporters',
      deadline: '2026-12-01T00:00:00.000Z',
      currency: 'GBP',
      percentLabel: '58%',
    });
  });

  it('maps money target and progress in minor units while retaining basis and deadline', () => {
    expect(
      goalFromRow(
        {
          id: 'goal-money',
          title: 'Before-fees support',
          goal_type: 'one_time_money',
          target_minor: '12500',
          target_count: null,
          currency: 'gbp',
          deadline: new Date('2026-10-15T00:00:00.000Z'),
          basis: 'before fees',
        },
        2500,
        99,
      ),
    ).toMatchObject({
      type: 'one_time_money',
      targetMinor: 12500,
      raisedMinor: 2500,
      basis: 'before fees',
      deadline: '2026-10-15T00:00:00.000Z',
      currency: 'GBP',
      percentLabel: '20%',
    });
  });

  it('uses fixtures only when demo mode is explicit and non-production', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    vi.stubEnv('NODE_ENV', 'test');

    expect(isDemoMode()).toBe(true);
    expect((await loadCatalogPageData()).source).toBe('demo');
  });

  it('does not enable demo mode in production', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    vi.stubEnv('NODE_ENV', 'production');

    expect(isDemoMode()).toBe(false);
    await expect(loadCatalogPageData()).rejects.toMatchObject({ status: 503 });
    await expect(
      loadCheckoutSuccessPageData('0198d6e8-0000-7000-8000-000000000002'),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('returns an empty transparency state without a production database', async () => {
    vi.stubEnv('DEMO_MODE', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', '');

    await expect(loadTransparencyPageData()).resolves.toEqual({ source: 'db', state: 'empty' });
  });

  it('uses transparency fixtures only in explicit demo mode', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DATABASE_URL', '');

    await expect(loadTransparencyPageData()).resolves.toMatchObject({
      source: 'demo',
      state: 'ready',
      aggregate: { publishedProjects: 1248, activeMemberships: 6412 },
    });
  });

  it('loads transparency aggregates from settled database rows', async () => {
    vi.stubEnv('DEMO_MODE', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    const rows: Record<string, unknown[]> = {
      project: [{ id: 'project-1' }],
      payment: [
        {
          id: 'payment-1',
          user_id: null,
          currency: 'gbp',
          project_amount_minor: '1000',
          oss_project_fee_minor: '50',
          cadence: 'one_off',
          status: 'succeeded',
          settled_at: new Date('2026-08-02T00:00:00.000Z'),
        },
      ],
      refund: [],
      subscription: [{ id: 'membership-1' }],
    };
    const db = {
      selectFrom(table: string) {
        const query = {
          select: () => query,
          where: () => query,
          execute: async () => rows[table] ?? [],
        };
        return query;
      },
    } as unknown as Db;

    await expect(
      loadTransparencyPageData({ db, now: new Date('2026-09-01T00:00:00.000Z') }),
    ).resolves.toEqual({
      source: 'db',
      state: 'ready',
      aggregate: {
        publishedProjects: 1,
        settledSupport: [{ currency: 'GBP', amountMinor: '1000' }],
        medianProjectFeePercent: 5,
        guestOneOffSharePercent: 100,
        refundedSupport: [{ currency: 'GBP', percent: 0 }],
        activeMemberships: 1,
      },
    });
  });

  it('returns an error state when transparency reads fail', async () => {
    const db = {
      selectFrom: () => {
        throw new Error('database unavailable');
      },
    } as unknown as Db;
    await expect(loadTransparencyPageData({ db })).resolves.toEqual({
      source: 'db',
      state: 'error',
    });
  });

  it('rolls up settled payments, refunds, guests, and fees only', () => {
    const result = buildTransparencyAggregate({
      publishedProjects: 2,
      activeMemberships: 3,
      periodStart: new Date('2026-08-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-01T00:00:00.000Z'),
      payments: [
        {
          id: 'payment-1',
          user_id: null,
          currency: 'gbp',
          project_amount_minor: 1_000,
          oss_project_fee_minor: 50,
          cadence: 'one_off',
          status: 'succeeded',
          settled_at: new Date('2026-08-02T00:00:00.000Z'),
        },
        {
          id: 'payment-2',
          user_id: 'user-1',
          currency: 'gbp',
          project_amount_minor: 2_000,
          oss_project_fee_minor: 100,
          cadence: 'monthly',
          status: 'refunded',
          settled_at: new Date('2026-08-03T00:00:00.000Z'),
        },
        {
          id: 'pending',
          user_id: null,
          currency: 'gbp',
          project_amount_minor: 9_000,
          oss_project_fee_minor: 450,
          cadence: 'one_off',
          status: 'pending',
          settled_at: null,
        },
      ],
      refunds: [
        {
          payment_id: 'payment-2',
          amount_minor: 220,
          application_fee_refund_minor: 20,
          status: 'succeeded',
          created_at: new Date('2026-08-04T00:00:00.000Z'),
        },
      ],
    });

    expect(result).toEqual({
      publishedProjects: 2,
      settledSupport: [{ currency: 'GBP', amountMinor: '2800' }],
      medianProjectFeePercent: 5,
      guestOneOffSharePercent: 100,
      refundedSupport: [{ currency: 'GBP', percent: 6.7 }],
      activeMemberships: 3,
    });
  });

  it('removes open and lost disputes from transparency totals without mixing currencies', () => {
    const result = buildTransparencyAggregate({
      publishedProjects: 1,
      activeMemberships: 0,
      periodStart: new Date('2026-08-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-01T00:00:00.000Z'),
      payments: [
        {
          id: 'gbp-payment',
          user_id: 'user-a',
          currency: 'gbp',
          project_amount_minor: 1000,
          oss_project_fee_minor: 50,
          cadence: 'one_off',
          status: 'succeeded',
          settled_at: new Date('2026-08-02T00:00:00.000Z'),
        },
        {
          id: 'usd-payment',
          user_id: 'user-b',
          currency: 'usd',
          project_amount_minor: 5000,
          oss_project_fee_minor: 250,
          cadence: 'one_off',
          status: 'succeeded',
          settled_at: new Date('2026-08-02T00:00:00.000Z'),
        },
      ],
      refunds: [],
      disputes: [
        {
          payment_id: 'gbp-payment',
          amount_minor: 400,
          status: 'open',
          created_at: new Date('2026-08-03T00:00:00.000Z'),
        },
      ],
    });

    expect(result?.settledSupport).toEqual([
      { currency: 'GBP', amountMinor: '600' },
      { currency: 'USD', amountMinor: '5000' },
    ]);
  });

  it('maps checkout project identity without fixture fields', () => {
    const project = mapDbProjectToUi(
      {
        id: 'project-1',
        organisation_id: 'organisation-1',
        name: 'DB project',
        slug: 'db-project',
        status: 'published',
        description: null,
        default_currency: 'gbp',
        website_url: 'https://db-project.dev',
        logo_asset_id: '11111111-1111-7111-8111-111111111111',
        banner_asset_id: '22222222-2222-7222-8222-222222222222',
        discovery_ecosystems: ['TypeScript'],
        discovery_languages: ['typescript'],
        discovery_tags: ['developer-tools'],
        public_show_supporters: true,
        public_show_goal: true,
        public_show_stats: true,
        min_support_minor: '500',
        max_support_minor: '250000',
        created_at: new Date('2026-08-01T00:00:00Z'),
        updated_at: new Date('2026-08-02T00:00:00Z'),
      },
      'https://github.com/example/db-project',
    );

    expect(project).toMatchObject({
      slug: 'db-project',
      name: 'DB project',
      description: '',
      website: 'https://db-project.dev',
      repository: 'https://github.com/example/db-project',
      logoAssetId: '11111111-1111-7111-8111-111111111111',
      bannerAssetId: '22222222-2222-7222-8222-222222222222',
      currency: 'GBP',
      minSupportMinor: 500,
      maxSupportMinor: 250000,
      stats: { supporters: 0, totalSupportMinor: 0 },
    });
    expect(project.ecosystems).toEqual(['typescript']);
    expect(project.languages).toEqual(['typescript']);
    expect(project.tags).toEqual(['developer-tools']);
  });

  it('maps persisted payment states to receipt states', () => {
    expect(checkoutPaymentStatus('succeeded')).toBe('confirmed');
    expect(checkoutPaymentStatus('pending')).toBe('processing');
    expect(checkoutPaymentStatus('failed')).toBe('failed');
    expect(checkoutPaymentStatus('refunded')).toBe('failed');
  });

  it('keeps project aggregates in one currency and subtracts refunds and open disputes', () => {
    const payments = [
      {
        id: 'payment-gbp-one-off',
        user_id: 'user-a',
        currency: 'gbp',
        cadence: 'one_off',
        project_amount_minor: 1000,
        status: 'succeeded',
        created_at: new Date('2026-08-02T00:00:00.000Z'),
        settled_at: new Date('2026-08-02T00:00:00.000Z'),
      },
      {
        id: 'payment-gbp-monthly',
        user_id: 'user-a',
        currency: 'gbp',
        cadence: 'monthly',
        project_amount_minor: 500,
        status: 'succeeded',
        created_at: new Date('2026-08-03T00:00:00.000Z'),
        settled_at: new Date('2026-08-03T00:00:00.000Z'),
      },
      {
        id: 'payment-usd',
        user_id: 'user-b',
        currency: 'usd',
        cadence: 'one_off',
        project_amount_minor: 5000,
        status: 'succeeded',
        created_at: new Date('2026-08-04T00:00:00.000Z'),
        settled_at: new Date('2026-08-04T00:00:00.000Z'),
      },
    ];
    const refunds = [
      {
        payment_id: 'payment-gbp-monthly',
        amount_minor: 100,
        application_fee_refund_minor: 0,
        status: 'succeeded',
      },
    ];
    const disputes = [{ payment_id: 'payment-gbp-one-off', amount_minor: 200, status: 'open' }];

    expect(netSettledProjectAmountMinor(payments[0]!, [], disputes)).toBe(800n);
    expect(
      netSettledProjectAmountMinor(
        { ...payments[0]!, id: 'won-payment', status: 'disputed' },
        [],
        [
          {
            payment_id: 'won-payment',
            amount_minor: 200,
            status: 'won',
          },
        ],
      ),
    ).toBe(1000n);
    expect(
      statsFromPayments(payments, {
        currency: 'GBP',
        refunds,
        disputes,
        now: new Date('2026-08-31T00:00:00.000Z'),
      }),
    ).toEqual({
      supporters: 1,
      monthlyRecurringMinor: 400,
      oneOffThisMonthMinor: 800,
      totalSupportMinor: 1200,
    });
  });

  it('builds supporter lifetime totals from settled net payments only', () => {
    const settledAt = new Date('2026-08-02T00:00:00.000Z');
    const payment = (
      id: string,
      cadence: string,
      amount: number,
      currency = 'gbp',
      status = 'succeeded',
      settled_at: Date | null = settledAt,
    ) => ({
      id,
      project_id: 'project-1',
      project_name: 'Grove',
      user_id: 'user-1',
      currency,
      cadence,
      project_amount_minor: amount,
      status,
      created_at: settledAt,
      settled_at,
    });

    expect(
      buildSupporterLifetimeSupport(
        [
          payment('partial-refund', 'one_off', 1_000),
          payment('open-dispute', 'monthly', 2_000),
          payment('lost-dispute', 'one_off', 3_000),
          payment('won-dispute', 'monthly', 4_000),
          payment('unsettled', 'one_off', 9_000, 'gbp', 'succeeded', null),
          payment('refunded', 'one_off', 5_000, 'gbp', 'refunded'),
          payment('usd-payment', 'one_off', 7_000, 'usd'),
        ],
        [
          {
            payment_id: 'partial-refund',
            amount_minor: 300,
            application_fee_refund_minor: 50,
            status: 'succeeded',
          },
        ],
        [
          { payment_id: 'open-dispute', amount_minor: 400, status: 'open' },
          { payment_id: 'lost-dispute', amount_minor: 500, status: 'lost' },
          { payment_id: 'won-dispute', amount_minor: 600, status: 'won' },
        ],
      ),
    ).toEqual([
      { projectName: 'Grove', oneOffMinor: 3_250, recurringMinor: 5_600, currency: 'GBP' },
      { projectName: 'Grove', oneOffMinor: 7_000, recurringMinor: 0, currency: 'USD' },
    ]);
  });

  it('rejects a checkout receipt without an opaque payment reference', async () => {
    await expect(loadCheckoutSuccessPageData('  ')).rejects.toMatchObject({ status: 400 });
    await expect(loadCheckoutSuccessPageData('not-a-payment-id')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('admin overview metrics', () => {
  it('rolls up only settled payment data for current and prior periods', () => {
    const now = new Date('2026-08-30T00:00:00.000Z');
    const metrics = buildAdminOverviewMetrics({
      now,
      projects: [
        { status: 'published', created_at: new Date('2026-08-29T00:00:00.000Z') },
        { status: 'published', created_at: new Date('2026-07-01T00:00:00.000Z') },
        { status: 'draft', created_at: new Date('2026-08-28T00:00:00.000Z') },
      ],
      payments: [
        {
          currency: 'gbp',
          project_amount_minor: 10_000,
          platform_tip_minor: 500,
          oss_project_fee_minor: 200,
          status: 'succeeded',
          created_at: new Date('2026-08-25T00:00:00.000Z'),
          settled_at: new Date('2026-08-26T00:00:00.000Z'),
        },
        {
          currency: 'gbp',
          project_amount_minor: 5_000,
          platform_tip_minor: 100,
          oss_project_fee_minor: 100,
          status: 'succeeded',
          created_at: new Date('2026-07-25T00:00:00.000Z'),
          settled_at: new Date('2026-07-25T00:00:00.000Z'),
        },
        {
          currency: 'gbp',
          project_amount_minor: 99_000,
          platform_tip_minor: 9_900,
          oss_project_fee_minor: 1_980,
          status: 'pending',
          created_at: new Date('2026-08-27T00:00:00.000Z'),
          settled_at: null,
        },
      ],
    });

    expect(metrics).toMatchObject({
      publishedProjects: 2,
      publishedThisMonth: 1,
      settlementVolume: { amountMinor: 10_000, currency: 'GBP' },
      previousSettlementVolume: { amountMinor: 5_000, currency: 'GBP' },
      fees: { amountMinor: 200, currency: 'GBP' },
      tips: { amountMinor: 500, currency: 'GBP' },
      currencyCodes: ['GBP'],
    });
    expect(metrics.settledVolumeSeries[0]?.points).toEqual([{ label: '2026-08-26', value: 100 }]);
  });

  it('does not combine currencies into a misleading single total', () => {
    const metrics = buildAdminOverviewMetrics({
      now: new Date('2026-08-30T00:00:00.000Z'),
      projects: [],
      payments: [
        {
          currency: 'gbp',
          project_amount_minor: 10_000,
          platform_tip_minor: 0,
          oss_project_fee_minor: 0,
          status: 'succeeded',
          created_at: new Date('2026-08-26T00:00:00.000Z'),
          settled_at: new Date('2026-08-26T00:00:00.000Z'),
        },
        {
          currency: 'usd',
          project_amount_minor: 12_000,
          platform_tip_minor: 0,
          oss_project_fee_minor: 0,
          status: 'succeeded',
          created_at: new Date('2026-08-27T00:00:00.000Z'),
          settled_at: new Date('2026-08-27T00:00:00.000Z'),
        },
      ],
    });

    expect(metrics.currencyCodes).toEqual(['GBP', 'USD']);
    expect(metrics.settlementVolume).toBeNull();
    expect(metrics.fees).toBeNull();
    expect(metrics.settledVolumeSeries).toHaveLength(2);
  });
});
