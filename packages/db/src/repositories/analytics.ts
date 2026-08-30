import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import { uuidv7 } from '@oss-tips/domain';
import { currencyExponent } from '@oss-tips/domain/money';
import type { Db } from '../client.js';
import type { Entitlement } from '../types.js';
import { countCurrentEntitlementSupporters, listCurrentForProject } from './entitlements.js';

export const PUBLIC_ANALYTICS_EVENTS = [
  'page_view',
  'support_composer_open',
  'confirmed_conversion',
] as const;

export type PublicAnalyticsEvent = (typeof PUBLIC_ANALYTICS_EVENTS)[number];

export const REFERRER_CATEGORIES = [
  'direct',
  'github',
  'gitlab',
  'bitbucket',
  'discord',
  'reddit',
  'hacker_news',
  'twitter',
  'linkedin',
  'youtube',
  'search',
  'other',
] as const;

export type ReferrerCategory = (typeof REFERRER_CATEGORIES)[number];

export type PublicAnalyticsEventInput = {
  projectId: string;
  event: PublicAnalyticsEvent;
  idempotencyKey?: string | null;
  referrer?: string | null;
  country?: string | null;
  occurredAt?: Date;
};

export type PublicAnalyticsEventResult = {
  accepted: boolean;
  duplicate: boolean;
};

export type AnalyticsMoney = {
  amount: string;
  currency: string;
};

export type AnalyticsCurrencyRow = {
  currency: string;
  grossSettledSupport: string;
  refundsDisputes: string;
  ossTipsFee: string;
  ossTipsTip: string;
  stripeFee: string | null;
  estimatedNet: string;
  oneOff: string;
  recurring: string;
};

export type AnalyticsMembershipLifecycle = {
  new: number;
  active: number;
  grace: number;
  cancelled: number;
  expired: number;
};

export type AnalyticsRetentionRow = {
  cohort: string;
  started: number;
  retained: number;
  retentionPercent: number;
  churnPercent: number;
};

export type AnalyticsTierMixRow = {
  tierId: string;
  tierName: string;
  members: number;
  sharePercent: number;
};

export type AnalyticsCountryRow = {
  country: string;
  supporters: number;
  sharePercent: number;
};

export type AnalyticsReferrerRow = {
  referrer: ReferrerCategory;
  pageViews: number;
  composerOpens: number;
  confirmedConversions: number;
  conversionPercent: number;
  sharePercent: number;
};

export type AnalyticsConversion = {
  pageViews: number;
  composerOpens: number;
  confirmedConversions: number;
  conversionPercent: number;
};

export type AnalyticsGoalProgress = {
  id: string;
  title: string;
  goalType: string;
  currency: string | null;
  target: string | null;
  targetCount: number | null;
  current: string | null;
  currentCount: number | null;
  percent: number;
};

export type AnalyticsSeries = {
  id: string;
  label: string;
  points: Array<{ label: string; value: number }>;
  stroke: 'solid' | 'dashed';
  marker: 'circle' | 'square' | 'diamond';
};

export type AnalyticsBreakdownRow = {
  source: string;
  gross: string;
  fees: string;
  net: string;
  sharePercent: number;
};

export type ProjectAnalytics = {
  periodStart: string;
  periodEnd: string;
  currency: string;
  grossSettledSupport: AnalyticsMoney;
  refundsDisputes: AnalyticsMoney;
  ossTipsFee: AnalyticsMoney;
  ossTipsTip: AnalyticsMoney;
  stripeFee: AnalyticsMoney | null;
  estimatedNet: AnalyticsMoney;
  oneOff: AnalyticsMoney;
  recurring: AnalyticsMoney;
  mrr: AnalyticsMoney;
  arr: AnalyticsMoney;
  activeMembers: number;
  membershipLifecycle: AnalyticsMembershipLifecycle;
  retention: AnalyticsRetentionRow[];
  tierMix: AnalyticsTierMixRow[];
  countries: AnalyticsCountryRow[];
  referrers: AnalyticsReferrerRow[];
  conversion: AnalyticsConversion;
  goals: AnalyticsGoalProgress[];
  supportSeries: AnalyticsSeries[];
  growthSeries: AnalyticsSeries[];
  breakdown: AnalyticsBreakdownRow[];
  currencies: AnalyticsCurrencyRow[];
  stripeFeeAvailable: boolean;
  providerLimitations: string[];
};

type PaymentRow = {
  id: string;
  user_id: string | null;
  currency: string;
  customer_charge_minor: string | number | bigint;
  project_amount_minor: string | number | bigint;
  platform_tip_minor: string | number | bigint;
  oss_project_fee_minor: string | number | bigint;
  stripe_application_fee_minor: string | number | bigint;
  stripe_charge_id: string | null;
  cadence: string;
  status: string;
  created_at: Date;
  settled_at: Date | null;
};

type RefundRow = {
  payment_id: string;
  amount_minor: string | number | bigint;
  application_fee_refund_minor: string | number | bigint;
  status: string;
  currency: string;
  created_at: Date;
};

type DisputeRow = {
  payment_id: string;
  amount_minor: string | number | bigint;
  status: string;
  currency: string;
  created_at: Date;
};

type ProviderFeeRow = {
  stripe_balance_transaction_id: string;
  source_id: string | null;
  fee_minor: string | number | bigint;
  currency: string;
  created_at: Date;
};

type SubscriptionRow = {
  id: string;
  user_id: string | null;
  tier_id: string;
  status: string;
  cadence: string | null;
  project_amount_minor: string | number | bigint | null;
  currency: string | null;
  created_at: Date;
  current_period_end: Date | null;
};

type EventRow = {
  metric_name: string;
  value: string | number | bigint;
  dimensions: unknown;
};

type TierRow = { id: string; name: string };
type GoalRow = {
  id: string;
  title: string;
  goal_type: string;
  target_minor: string | number | bigint | null;
  target_count: number | null;
  currency: string | null;
};

export type CurrentEntitlementRow = Pick<Entitlement, 'id' | 'user_id'>;

export type AnalyticsInput = {
  projectId?: string;
  defaultCurrency: string;
  periodStart: Date;
  periodEnd: Date;
  payments: PaymentRow[];
  refunds: RefundRow[];
  disputes: DisputeRow[];
  providerFees: ProviderFeeRow[];
  subscriptions: SubscriptionRow[];
  events: EventRow[];
  tiers: TierRow[];
  goals: GoalRow[];
  currentEntitlements?: CurrentEntitlementRow[];
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Normalize external referrer into a small, non-identifying category. */
export function normalizeReferrerCategory(value: string | null | undefined): ReferrerCategory {
  const raw = value?.trim();
  if (!raw) return 'direct';
  const category = raw.toLowerCase() as ReferrerCategory;
  if (REFERRER_CATEGORIES.includes(category)) return category;
  let hostname: string;
  try {
    hostname = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname
      .toLowerCase()
      .replace(/^www\./, '');
  } catch {
    return 'other';
  }
  if (hostname === 'github.com' || hostname.endsWith('.github.com')) return 'github';
  if (hostname === 'gitlab.com' || hostname.endsWith('.gitlab.com')) return 'gitlab';
  if (hostname === 'bitbucket.org' || hostname.endsWith('.bitbucket.org')) return 'bitbucket';
  if (hostname === 'discord.com' || hostname === 'discord.gg' || hostname.endsWith('.discord.com'))
    return 'discord';
  if (hostname === 'reddit.com' || hostname.endsWith('.reddit.com')) return 'reddit';
  if (hostname === 'news.ycombinator.com' || hostname === 'ycombinator.com') return 'hacker_news';
  if (hostname === 'twitter.com' || hostname === 'x.com' || hostname.endsWith('.twitter.com'))
    return 'twitter';
  if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) return 'linkedin';
  if (hostname === 'youtube.com' || hostname === 'youtu.be' || hostname.endsWith('.youtube.com'))
    return 'youtube';
  if (
    ['google.com', 'bing.com', 'duckduckgo.com', 'search.brave.com', 'yahoo.com'].some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    )
  )
    return 'search';
  return 'other';
}

/** Keep country at ISO-3166 alpha-2 granularity; invalid/unknown values are grouped. */
export function normalizeCountryCode(value: string | null | undefined): string {
  const country = value?.trim().toUpperCase();
  return country && /^[A-Z]{2}$/.test(country) ? country : 'XX';
}

export function analyticsDimensions(
  referrer: string | null | undefined,
  country: string | null | undefined,
): { referrer: ReferrerCategory; country: string } {
  return {
    referrer: normalizeReferrerCategory(referrer),
    country: normalizeCountryCode(country),
  };
}

/** Hash only retry identity; raw keys, IPs, and fingerprints never enter analytics rows. */
export function analyticsEventKeyHash(
  projectId: string,
  event: PublicAnalyticsEvent,
  key: string,
): string {
  return createHash('sha256').update(`${projectId}\n${event}\n${key}`).digest('hex');
}

export function hourStart(value: Date): Date {
  return new Date(Math.floor(value.getTime() / HOUR_MS) * HOUR_MS);
}

export async function recordPublicAnalyticsEvent(
  db: Db,
  input: PublicAnalyticsEventInput,
): Promise<PublicAnalyticsEventResult> {
  const key = input.idempotencyKey?.trim() || null;
  if (key && (key.length > 255 || /[\r\n]/.test(key))) {
    throw new Error('Analytics idempotency key is invalid');
  }
  const occurredAt = input.occurredAt ?? new Date();
  if (Number.isNaN(occurredAt.getTime())) throw new Error('Analytics event timestamp is invalid');
  const dimensions = analyticsDimensions(input.referrer, input.country);
  const bucket = hourStart(occurredAt);

  return db.transaction().execute(async (trx) => {
    if (key) {
      const dedupe = await trx
        .insertInto('metric_event_dedupe')
        .values({
          id: uuidv7(),
          project_id: input.projectId,
          event_key_hash: analyticsEventKeyHash(input.projectId, input.event, key),
        })
        .onConflict((oc) => oc.columns(['project_id', 'event_key_hash']).doNothing())
        .returning('id')
        .executeTakeFirst();
      if (!dedupe) return { accepted: false, duplicate: true };
    }

    await sql`
      INSERT INTO metric_event_hourly
        (id, project_id, metric_name, hour_start, value, dimensions)
      VALUES
        (${uuidv7()}, ${input.projectId}, ${input.event}, ${bucket}, 1, ${JSON.stringify(dimensions)}::jsonb)
      ON CONFLICT (project_id, metric_name, hour_start, dimensions)
      WHERE project_id IS NOT NULL
      DO UPDATE SET value = metric_event_hourly.value + 1
    `.execute(trx);
    return { accepted: true, duplicate: false };
  });
}

export async function recordConfirmedConversion(
  db: Db,
  input: Omit<PublicAnalyticsEventInput, 'event'> & { paymentId: string },
): Promise<PublicAnalyticsEventResult> {
  return recordPublicAnalyticsEvent(db, {
    ...input,
    event: 'confirmed_conversion',
    idempotencyKey: input.paymentId,
  });
}

function bigintValue(value: string | number | bigint | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  try {
    return BigInt(String(value));
  } catch {
    return 0n;
  }
}

function lowerCurrency(value: string | null | undefined, fallback: string): string {
  return (value || fallback).toLowerCase();
}

function money(amount: bigint, currency: string): AnalyticsMoney {
  return { amount: (amount < 0n ? 0n : amount).toString(), currency: currency.toLowerCase() };
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function settledPayment(payment: PaymentRow): boolean {
  return (
    payment.status === 'succeeded' || payment.status === 'refunded' || payment.status === 'disputed'
  );
}

function paymentDate(payment: PaymentRow): Date {
  return payment.settled_at ?? payment.created_at;
}

function inPeriod(value: Date, start: Date, end: Date): boolean {
  return value >= start && value < end;
}

function dimension(row: EventRow, key: string): string | null {
  if (!row.dimensions || typeof row.dimensions !== 'object' || Array.isArray(row.dimensions))
    return null;
  const value = (row.dimensions as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function chartAmount(amount: bigint, currency: string): number {
  const value = Number(amount) / 10 ** currencyExponent(currency);
  if (Number.isFinite(value)) return value;
  return amount < 0n ? -Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
}

function dayStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function dayLabel(value: Date): string {
  return value.toISOString().slice(0, 10);
}

type DailyAnalyticsPoint = {
  date: Date;
  oneOff: bigint;
  monthly: bigint;
  annual: bigint;
  newSupporters: number;
  activeSupporters: number;
};

function buildDailySeries(
  periodPayments: PaymentRow[],
  allPayments: PaymentRow[],
  defaultCurrency: string,
  periodStart: Date,
  periodEnd: Date,
): {
  supportSeries: AnalyticsSeries[];
  growthSeries: AnalyticsSeries[];
} {
  const firstDay = dayStart(periodStart);
  const lastDay = dayStart(new Date(periodEnd.getTime() - 1));
  const points = new Map<string, DailyAnalyticsPoint>();
  for (let date = firstDay; date <= lastDay; date = new Date(date.getTime() + DAY_MS)) {
    points.set(dayLabel(date), {
      date,
      oneOff: 0n,
      monthly: 0n,
      annual: 0n,
      newSupporters: 0,
      activeSupporters: 0,
    });
  }
  const currency = defaultCurrency.toLowerCase();
  const existingSupporters = new Set(
    allPayments
      .filter(
        (payment) =>
          payment.currency.toLowerCase() === currency && paymentDate(payment) < periodStart,
      )
      .map((payment) => payment.user_id ?? `payment:${payment.id}`),
  );
  const supporters = new Set(existingSupporters);
  const orderedPayments = periodPayments
    .filter((payment) => payment.currency.toLowerCase() === currency)
    .sort((left, right) => paymentDate(left).getTime() - paymentDate(right).getTime());
  for (const payment of orderedPayments) {
    const date = dayStart(paymentDate(payment));
    const point = points.get(dayLabel(date));
    if (!point) continue;
    const amount = bigintValue(payment.project_amount_minor);
    if (payment.cadence === 'one_off') point.oneOff += amount;
    else if (payment.cadence === 'annual') point.annual += amount;
    else point.monthly += amount;
    const supporterKey = payment.user_id ?? `payment:${payment.id}`;
    if (!supporters.has(supporterKey)) {
      supporters.add(supporterKey);
      point.newSupporters += 1;
    }
  }
  let activeSupporters = existingSupporters.size;
  for (const point of points.values()) {
    activeSupporters += point.newSupporters;
    point.activeSupporters = activeSupporters;
  }
  const values = [...points.values()];
  const hasSupport = values.some(
    (point) => point.oneOff > 0n || point.monthly > 0n || point.annual > 0n,
  );
  const series = (
    id: string,
    label: string,
    value: (point: DailyAnalyticsPoint) => bigint,
    stroke: AnalyticsSeries['stroke'],
    marker: AnalyticsSeries['marker'],
  ): AnalyticsSeries => ({
    id,
    label,
    stroke,
    marker,
    points: values.map((point) => ({
      label: dayLabel(point.date),
      value: chartAmount(value(point), currency),
    })),
  });
  const supportSeries = hasSupport
    ? [
        series('one-off', 'One-off', (point) => point.oneOff, 'solid', 'circle'),
        series('monthly', 'Monthly recurring', (point) => point.monthly, 'solid', 'square'),
        series('annual', 'Annual', (point) => point.annual, 'dashed', 'diamond'),
      ].filter((item) => item.points.some((point) => point.value !== 0))
    : [];
  const growthSeries =
    activeSupporters > 0
      ? [
          {
            id: 'new',
            label: 'New supporters',
            stroke: 'solid' as const,
            marker: 'circle' as const,
            points: values.map((point) => ({
              label: dayLabel(point.date),
              value: point.newSupporters,
            })),
          },
          {
            id: 'active',
            label: 'Active supporters',
            stroke: 'solid' as const,
            marker: 'square' as const,
            points: values.map((point) => ({
              label: dayLabel(point.date),
              value: point.activeSupporters,
            })),
          },
        ]
      : [];
  return { supportSeries, growthSeries };
}

/** Pure rollup used by API/page-data and unit tests; amounts stay integer minor units. */
export function buildProjectAnalytics(input: AnalyticsInput): ProjectAnalytics {
  const defaultCurrency = input.defaultCurrency.toLowerCase();
  const periodPayments = input.payments.filter(
    (payment) =>
      settledPayment(payment) && inPeriod(paymentDate(payment), input.periodStart, input.periodEnd),
  );
  const allPayments = input.payments.filter(
    (payment) => settledPayment(payment) && paymentDate(payment) < input.periodEnd,
  );
  const paymentById = new Map(input.payments.map((payment) => [payment.id, payment]));
  const totals = new Map<string, AnalyticsCurrencyRow>();
  const ensure = (currency: string): AnalyticsCurrencyRow => {
    const code = currency.toLowerCase();
    const row = totals.get(code);
    if (row) return row;
    const created: AnalyticsCurrencyRow = {
      currency: code,
      grossSettledSupport: '0',
      refundsDisputes: '0',
      ossTipsFee: '0',
      ossTipsTip: '0',
      stripeFee: null,
      estimatedNet: '0',
      oneOff: '0',
      recurring: '0',
    };
    totals.set(code, created);
    return created;
  };
  const add = (
    row: AnalyticsCurrencyRow,
    key: keyof Omit<AnalyticsCurrencyRow, 'currency' | 'stripeFee'>,
    amount: bigint,
  ) => {
    row[key] = (bigintValue(row[key]) + amount).toString();
  };
  for (const payment of periodPayments) {
    const row = ensure(payment.currency);
    const gross = bigintValue(payment.project_amount_minor);
    add(row, 'grossSettledSupport', gross);
    add(row, 'ossTipsFee', bigintValue(payment.oss_project_fee_minor));
    add(row, 'ossTipsTip', bigintValue(payment.platform_tip_minor));
    add(row, payment.cadence === 'one_off' ? 'oneOff' : 'recurring', gross);
  }

  const reversalTotals = (start?: Date, end?: Date): Map<string, bigint> => {
    const result = new Map<string, bigint>();
    const inRange = (value: Date) => (!start || value >= start) && (!end || value < end);
    for (const refund of input.refunds) {
      if (refund.status !== 'succeeded' || !inRange(refund.created_at)) continue;
      const payment = paymentById.get(refund.payment_id);
      if (!payment || !settledPayment(payment)) continue;
      const support =
        bigintValue(refund.amount_minor) - bigintValue(refund.application_fee_refund_minor);
      if (support > 0n) {
        result.set(refund.payment_id, (result.get(refund.payment_id) ?? 0n) + support);
      }
    }
    for (const dispute of input.disputes) {
      if (
        !['needs_response', 'warning_needs_response', 'under_review', 'open', 'lost'].includes(
          dispute.status,
        ) ||
        !inRange(dispute.created_at)
      )
        continue;
      const payment = paymentById.get(dispute.payment_id);
      if (!payment || !settledPayment(payment)) continue;
      const charge = bigintValue(payment.customer_charge_minor);
      const fee = bigintValue(payment.stripe_application_fee_minor);
      const disputed = bigintValue(dispute.amount_minor);
      const support = disputed - (charge > 0n ? (fee * disputed + charge / 2n) / charge : 0n);
      if (support > 0n) {
        result.set(dispute.payment_id, (result.get(dispute.payment_id) ?? 0n) + support);
      }
    }
    for (const [paymentId, amount] of result) {
      const payment = paymentById.get(paymentId);
      if (!payment) continue;
      const gross = bigintValue(payment.project_amount_minor);
      if (amount > gross) result.set(paymentId, gross);
    }
    return result;
  };
  const reversalByPayment = reversalTotals(input.periodStart, input.periodEnd);
  const allReversalByPayment = reversalTotals(undefined, input.periodEnd);
  for (const [paymentId, reversal] of reversalByPayment) {
    const payment = paymentById.get(paymentId);
    if (!payment) continue;
    add(ensure(payment.currency), 'refundsDisputes', reversal);
  }

  const providerFees = new Map<string, bigint>();
  const seenProviderFees = new Set<string>();
  for (const fee of input.providerFees) {
    if (!inPeriod(fee.created_at, input.periodStart, input.periodEnd)) continue;
    if (seenProviderFees.has(fee.stripe_balance_transaction_id)) continue;
    seenProviderFees.add(fee.stripe_balance_transaction_id);
    const key = fee.currency.toLowerCase();
    providerFees.set(key, (providerFees.get(key) ?? 0n) + bigintValue(fee.fee_minor));
  }
  for (const [currency, row] of totals) {
    const stripeFee = providerFees.get(currency);
    row.stripeFee = stripeFee === undefined ? null : stripeFee.toString();
    const estimated =
      bigintValue(row.grossSettledSupport) -
      bigintValue(row.ossTipsFee) -
      bigintValue(row.refundsDisputes) -
      (stripeFee ?? 0n);
    row.estimatedNet = (estimated < 0n ? 0n : estimated).toString();
  }

  const defaultTotals = totals.get(defaultCurrency) ?? ensure(defaultCurrency);
  const activeSubscriptions = input.subscriptions.filter(
    (subscription) =>
      subscription.created_at < input.periodEnd &&
      (subscription.status === 'active' || subscription.status === 'grace'),
  );
  const mrrByCurrency = new Map<string, bigint>();
  for (const subscription of activeSubscriptions) {
    const currency = lowerCurrency(subscription.currency, defaultCurrency);
    const amount = bigintValue(subscription.project_amount_minor);
    mrrByCurrency.set(
      currency,
      (mrrByCurrency.get(currency) ?? 0n) +
        (subscription.cadence === 'annual' ? amount / 12n : amount),
    );
  }
  const mrr = mrrByCurrency.get(defaultCurrency) ?? 0n;

  const lifecycle: AnalyticsMembershipLifecycle = {
    new: 0,
    active: 0,
    grace: 0,
    cancelled: 0,
    expired: 0,
  };
  for (const subscription of input.subscriptions.filter(
    (item) => item.created_at < input.periodEnd,
  )) {
    if (inPeriod(subscription.created_at, input.periodStart, input.periodEnd)) lifecycle.new += 1;
    if (subscription.status in lifecycle)
      lifecycle[subscription.status as keyof AnalyticsMembershipLifecycle] += 1;
  }

  const cohortMap = new Map<string, { started: number; retained: number }>();
  for (const subscription of input.subscriptions.filter(
    (item) => item.created_at < input.periodEnd,
  )) {
    const date = subscription.created_at;
    const cohort = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const row = cohortMap.get(cohort) ?? { started: 0, retained: 0 };
    row.started += 1;
    if (subscription.status === 'active' || subscription.status === 'grace') row.retained += 1;
    cohortMap.set(cohort, row);
  }
  const retention = [...cohortMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cohort, row]) => ({
      cohort,
      started: row.started,
      retained: row.retained,
      retentionPercent: percent(row.retained, row.started),
      churnPercent: percent(row.started - row.retained, row.started),
    }));

  const tierNames = new Map(input.tiers.map((tier) => [tier.id, tier.name]));
  const tierCounts = new Map<string, number>();
  for (const subscription of activeSubscriptions)
    tierCounts.set(subscription.tier_id, (tierCounts.get(subscription.tier_id) ?? 0) + 1);
  const tierMix = [...tierCounts.entries()]
    .sort(([, left], [, right]) => right - left)
    .map(([tierId, members]) => ({
      tierId,
      tierName: tierNames.get(tierId) ?? 'Unknown tier',
      members,
      sharePercent: percent(members, activeSubscriptions.length),
    }));

  const eventCounts = { pageViews: 0, composerOpens: 0, confirmedConversions: 0 };
  const referrerMap = new Map<
    ReferrerCategory,
    { pageViews: number; composerOpens: number; confirmedConversions: number }
  >();
  const countryCounts = new Map<string, number>();
  for (const event of input.events) {
    const value = Number(bigintValue(event.value));
    if (!Number.isSafeInteger(value) || value <= 0) continue;
    const metric = event.metric_name === 'conversion' ? 'confirmed_conversion' : event.metric_name;
    const referrer = normalizeReferrerCategory(dimension(event, 'referrer'));
    const country = normalizeCountryCode(dimension(event, 'country'));
    const referrerRow = referrerMap.get(referrer) ?? {
      pageViews: 0,
      composerOpens: 0,
      confirmedConversions: 0,
    };
    if (metric === 'page_view') {
      eventCounts.pageViews += value;
      referrerRow.pageViews += value;
    } else if (metric === 'support_composer_open') {
      eventCounts.composerOpens += value;
      referrerRow.composerOpens += value;
    } else if (metric === 'confirmed_conversion') {
      eventCounts.confirmedConversions += value;
      referrerRow.confirmedConversions += value;
      countryCounts.set(country, (countryCounts.get(country) ?? 0) + value);
    }
    referrerMap.set(referrer, referrerRow);
  }
  const referrers = [...referrerMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([referrer, row]) => ({
      referrer,
      pageViews: row.pageViews,
      composerOpens: row.composerOpens,
      confirmedConversions: row.confirmedConversions,
      conversionPercent: percent(row.confirmedConversions, row.pageViews),
      sharePercent: percent(row.pageViews, eventCounts.pageViews),
    }));
  const countries = [...countryCounts.entries()]
    .sort(([, left], [, right]) => right - left)
    .map(([country, supporters]) => ({
      country,
      supporters,
      sharePercent: percent(supporters, eventCounts.confirmedConversions),
    }));

  const currentSupporterCount = countCurrentEntitlementSupporters(input.currentEntitlements ?? []);
  const allTimeGrossByCurrency = new Map<string, bigint>();
  for (const payment of allPayments) {
    const currency = payment.currency.toLowerCase();
    allTimeGrossByCurrency.set(
      currency,
      (allTimeGrossByCurrency.get(currency) ?? 0n) + bigintValue(payment.project_amount_minor),
    );
  }
  const allTimeReversalByCurrency = new Map<string, bigint>();
  for (const [paymentId, reversal] of allReversalByPayment) {
    const payment = paymentById.get(paymentId);
    if (!payment) continue;
    const currency = payment.currency.toLowerCase();
    allTimeReversalByCurrency.set(
      currency,
      (allTimeReversalByCurrency.get(currency) ?? 0n) + reversal,
    );
  }
  const allTimeGoalSource = (currency: string): bigint => {
    const gross = allTimeGrossByCurrency.get(currency) ?? 0n;
    const reversals = allTimeReversalByCurrency.get(currency) ?? 0n;
    return gross > reversals ? gross - reversals : 0n;
  };
  const currentMonthStart = new Date(
    Date.UTC(input.periodEnd.getUTCFullYear(), input.periodEnd.getUTCMonth(), 1),
  );
  const monthGross = allPayments
    .filter((payment) => inPeriod(paymentDate(payment), currentMonthStart, input.periodEnd))
    .reduce(
      (total, payment) =>
        total +
        (payment.currency.toLowerCase() === defaultCurrency
          ? bigintValue(payment.project_amount_minor)
          : 0n),
      0n,
    );
  const monthReversal = [...reversalTotals(currentMonthStart, input.periodEnd)].reduce(
    (total, [paymentId, reversal]) => {
      const payment = paymentById.get(paymentId);
      return payment?.currency.toLowerCase() === defaultCurrency ? total + reversal : total;
    },
    0n,
  );
  const calendarMonthGoalSource = monthGross > monthReversal ? monthGross - monthReversal : 0n;
  const goals = input.goals.map((goal) => {
    const currency = goal.currency?.toLowerCase() ?? defaultCurrency;
    const countGoal =
      goal.goal_type === 'supporter_count' || goal.goal_type === 'active_supporter_count';
    const current = countGoal
      ? null
      : goal.goal_type === 'calendar_month_money'
        ? currency === defaultCurrency
          ? calendarMonthGoalSource
          : 0n
        : goal.goal_type === 'mrr' || goal.goal_type === 'recurring_money'
          ? currency === defaultCurrency
            ? mrr
            : 0n
          : allTimeGoalSource(currency);
    const currentCount = countGoal ? currentSupporterCount : null;
    const target = goal.target_minor === null ? null : bigintValue(goal.target_minor);
    const percentValue = Math.min(
      100,
      countGoal
        ? percent(currentCount ?? 0, goal.target_count ?? 0)
        : percent(Number(current ?? 0n), Number(target ?? 0n)),
    );
    return {
      id: goal.id,
      title: goal.title,
      goalType: goal.goal_type,
      currency: countGoal ? null : currency,
      target: countGoal ? null : (target?.toString() ?? null),
      targetCount: countGoal ? goal.target_count : null,
      current: countGoal ? null : (current?.toString() ?? null),
      currentCount,
      percent: percentValue,
    };
  });

  const currencies = [...totals.values()].sort((left, right) =>
    left.currency.localeCompare(right.currency),
  );
  const providerFeeSources = new Set(
    input.providerFees
      .filter((fee) => inPeriod(fee.created_at, input.periodStart, input.periodEnd))
      .map((fee) => fee.source_id)
      .filter((source): source is string => source !== null),
  );
  const stripeFeeIncomplete = periodPayments.some(
    (payment) =>
      bigintValue(payment.project_amount_minor) > 0n &&
      (!payment.stripe_charge_id || !providerFeeSources.has(payment.stripe_charge_id)),
  );
  const providerLimitations =
    stripeFeeIncomplete ||
    currencies.some((row) => bigintValue(row.grossSettledSupport) > 0n && row.stripeFee === null)
      ? ['stripe_processing_fee_unavailable_for_some_periods']
      : [];
  const stripeFee =
    defaultTotals.stripeFee === null
      ? null
      : money(bigintValue(defaultTotals.stripeFee), defaultCurrency);
  const { supportSeries, growthSeries } = buildDailySeries(
    periodPayments,
    allPayments,
    defaultCurrency,
    input.periodStart,
    input.periodEnd,
  );
  const gross = bigintValue(defaultTotals.grossSettledSupport);
  const deductions =
    bigintValue(defaultTotals.ossTipsFee) +
    bigintValue(defaultTotals.refundsDisputes) +
    (defaultTotals.stripeFee === null ? 0n : bigintValue(defaultTotals.stripeFee));
  const allocateDeductions = (amount: bigint): bigint =>
    gross <= 0n ? 0n : (deductions * amount + gross / 2n) / gross;
  const breakdown: AnalyticsBreakdownRow[] = [];
  for (const [source, amount] of [
    ['One-off support', bigintValue(defaultTotals.oneOff)],
    ['Recurring support', bigintValue(defaultTotals.recurring)],
  ] as const) {
    if (amount <= 0n) continue;
    const fees = allocateDeductions(amount);
    breakdown.push({
      source,
      gross: amount.toString(),
      fees: fees.toString(),
      net: (amount - fees).toString(),
      sharePercent: percent(Number(amount), Number(gross)),
    });
  }
  return {
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    currency: defaultCurrency,
    grossSettledSupport: money(bigintValue(defaultTotals.grossSettledSupport), defaultCurrency),
    refundsDisputes: money(bigintValue(defaultTotals.refundsDisputes), defaultCurrency),
    ossTipsFee: money(bigintValue(defaultTotals.ossTipsFee), defaultCurrency),
    ossTipsTip: money(bigintValue(defaultTotals.ossTipsTip), defaultCurrency),
    stripeFee,
    estimatedNet: money(bigintValue(defaultTotals.estimatedNet), defaultCurrency),
    oneOff: money(bigintValue(defaultTotals.oneOff), defaultCurrency),
    recurring: money(bigintValue(defaultTotals.recurring), defaultCurrency),
    mrr: money(mrr, defaultCurrency),
    arr: money(mrr * 12n, defaultCurrency),
    activeMembers: activeSubscriptions.length,
    membershipLifecycle: lifecycle,
    retention,
    tierMix,
    countries,
    referrers,
    conversion: {
      ...eventCounts,
      conversionPercent: percent(eventCounts.confirmedConversions, eventCounts.pageViews),
    },
    goals,
    supportSeries,
    growthSeries,
    breakdown,
    currencies,
    stripeFeeAvailable: stripeFee !== null,
    providerLimitations,
  };
}

export async function getProjectAnalytics(
  db: Db,
  projectId: string,
  options: { days?: number; now?: Date } = {},
): Promise<ProjectAnalytics> {
  const periodEnd = options.now ?? new Date();
  const days = Math.min(365, Math.max(1, Math.floor(options.days ?? 30)));
  const periodStart = new Date(periodEnd.getTime() - days * DAY_MS);
  const project = await db
    .selectFrom('project')
    .select('default_currency')
    .where('id', '=', projectId)
    .executeTakeFirst();
  const defaultCurrency = project?.default_currency ?? 'gbp';
  const [
    payments,
    refunds,
    disputes,
    providerFees,
    subscriptions,
    events,
    tiers,
    goals,
    currentEntitlements,
  ] = await Promise.all([
    db
      .selectFrom('payment')
      .select([
        'id',
        'user_id',
        'currency',
        'customer_charge_minor',
        'project_amount_minor',
        'platform_tip_minor',
        'oss_project_fee_minor',
        'stripe_application_fee_minor',
        'stripe_charge_id',
        'cadence',
        'status',
        'created_at',
        'settled_at',
      ])
      .where('project_id', '=', projectId)
      .execute() as Promise<PaymentRow[]>,
    db
      .selectFrom('refund')
      .innerJoin('payment', 'payment.id', 'refund.payment_id')
      .select([
        'refund.payment_id',
        'refund.amount_minor',
        'refund.application_fee_refund_minor',
        'refund.status',
        'refund.currency',
        'refund.created_at',
      ])
      .where('payment.project_id', '=', projectId)
      .execute() as Promise<RefundRow[]>,
    db
      .selectFrom('payment_dispute')
      .innerJoin('payment', 'payment.id', 'payment_dispute.payment_id')
      .select([
        'payment_dispute.payment_id',
        'payment_dispute.amount_minor',
        'payment_dispute.status',
        'payment_dispute.currency',
        'payment_dispute.created_at',
      ])
      .where('payment.project_id', '=', projectId)
      .execute() as Promise<DisputeRow[]>,
    db
      .selectFrom('provider_balance_transaction')
      .innerJoin('payment', 'payment.stripe_charge_id', 'provider_balance_transaction.source_id')
      .select([
        'provider_balance_transaction.stripe_balance_transaction_id',
        'provider_balance_transaction.source_id',
        'provider_balance_transaction.fee_minor',
        'provider_balance_transaction.currency',
        'provider_balance_transaction.created_at',
      ])
      .where('payment.project_id', '=', projectId)
      .execute() as Promise<ProviderFeeRow[]>,
    db
      .selectFrom('subscription')
      .select([
        'id',
        'user_id',
        'tier_id',
        'status',
        'cadence',
        'project_amount_minor',
        'currency',
        'created_at',
        'current_period_end',
      ])
      .where('project_id', '=', projectId)
      .execute() as Promise<SubscriptionRow[]>,
    db
      .selectFrom('metric_event_hourly')
      .select(['metric_name', 'value', 'dimensions'])
      .where('project_id', '=', projectId)
      .where('hour_start', '>=', periodStart)
      .where('hour_start', '<', periodEnd)
      .where('metric_name', 'in', [...PUBLIC_ANALYTICS_EVENTS])
      .execute() as Promise<EventRow[]>,
    db
      .selectFrom('tier')
      .select(['id', 'name'])
      .where('project_id', '=', projectId)
      .execute() as Promise<TierRow[]>,
    db
      .selectFrom('project_goal')
      .select(['id', 'title', 'goal_type', 'target_minor', 'target_count', 'currency'])
      .where('project_id', '=', projectId)
      .where('is_active', '=', true)
      .execute() as Promise<GoalRow[]>,
    listCurrentForProject(db, projectId, periodEnd),
  ]);
  return buildProjectAnalytics({
    projectId,
    defaultCurrency,
    periodStart,
    periodEnd,
    payments,
    refunds,
    disputes,
    providerFees,
    subscriptions,
    events,
    tiers,
    goals,
    currentEntitlements,
  });
}
