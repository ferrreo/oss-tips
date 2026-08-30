import { error } from '@sveltejs/kit';
import {
  adminNavGroups,
  demoAnalytics,
  demoApiKeys,
  demoAuditEvents,
  demoCases,
  demoDiscordMappings,
  demoEntitlements,
  demoExports,
  demoGoals,
  demoMemberships,
  demoPayments,
  demoPosts,
  demoProject,
  demoReconciliationDiffs,
  demoReviewQueue,
  demoSupporters,
  demoTeam,
  demoThreads,
  demoTiers,
  demoWebhooks,
  featuredProjects,
  formatPercent,
  projectNavGroups,
  type Analytics,
  type ApiKey,
  type DiscordRoleMapping,
  type Entitlement,
  type Goal,
  type GoalType,
  type Membership,
  type NavGroup,
  type Payment,
  type Post,
  type Project,
  type AdminQueueItem,
  type Supporter,
  type Thread,
  type Tier,
  type WebhookEndpoint,
} from '@oss-tips/ui/fixtures/demo.js';
import { membershipRows as demoProjectMemberships } from '@oss-tips/ui/pages/project/project-demo.js';
import {
  directoryPeople as demoDirectoryPeople,
  directoryProjects as demoDirectoryProjects,
  adminOverviewMetrics as demoAdminOverviewMetrics,
  failedJobs as demoFailedJobs,
  reviewQueue as demoReviewItems,
} from '@oss-tips/ui/pages/admin/admin-demo.js';
import {
  lifetimeSupport as demoLifetimeSupport,
  platformTipMinor as demoPlatformTipMinor,
  supporterEmail as demoSupporterEmail,
  supporterName as demoSupporterName,
} from '@oss-tips/ui/pages/supporter/supporter-demo.js';
import {
  countCurrentEntitlementSupporters,
  getProjectAnalytics,
  listCurrentForProject,
  type Db,
  type Project as DbProject,
  type ProjectAnalytics,
} from '@oss-tips/db';
import { currencyExponent, paymentReadiness, paymentsEnabled } from '@oss-tips/domain';
import type { AdminOverviewMetrics } from '@oss-tips/ui/pages/admin/admin-types.js';
import { publicPostBody, publicPostVisibility } from './public-posts';

type ProjectIdentityRow = Pick<
  DbProject,
  | 'id'
  | 'organisation_id'
  | 'name'
  | 'slug'
  | 'status'
  | 'description'
  | 'default_currency'
  | 'created_at'
  | 'updated_at'
> &
  Partial<
    Pick<
      DbProject,
      | 'website_url'
      | 'logo_asset_id'
      | 'banner_asset_id'
      | 'discovery_ecosystems'
      | 'discovery_languages'
      | 'discovery_tags'
      | 'public_show_supporters'
      | 'public_show_goal'
      | 'public_show_stats'
      | 'public_show_gated_post_metadata'
      | 'min_support_minor'
      | 'max_support_minor'
    >
  >;
import { getDb, hasDatabaseUrl } from './db';

export type DataSource = 'demo' | 'db';

export type ProjectMembershipRow = {
  name: string;
  tier: string;
  cadence: string;
  amount: string;
  status: string;
  renews: string;
  amountMinor?: number;
  currency?: string;
  renewsAt?: string;
};

export type ProjectMetric = {
  label: string;
  value: string;
  compare: string;
  compareDirection: 'up';
  valueMinor?: number;
  valueNumber?: number;
  currency?: string;
};

export type ProjectInboxPreviewRow = {
  id: string;
  initial: string;
  name: string;
  snippet: string;
  amount: string;
  time: string;
  unread: boolean;
  amountMinor?: number;
  currency?: string;
  timeAt?: string;
};

export type ProjectRankedSupporter = {
  rank: number;
  initial: string;
  name: string;
  cadence: string;
  amount: string;
  amountMinor?: number;
  currency?: string;
};

export type ProjectToolCard = {
  title: string;
  blurb: string;
  href: string;
  cta: string;
};

export type ProjectChartSeries = {
  id: string;
  label: string;
  points: Array<{ label: string; value: number }>;
  stroke?: 'solid' | 'dashed';
  marker?: 'circle' | 'square' | 'diamond';
};

export type ProjectBreakdownRow = {
  source: string;
  gross: string;
  fees: string;
  net: string;
  share: string;
  grossMinor?: number;
  feesMinor?: number;
  netMinor?: number;
  currency?: string;
};

export type ProjectOnboardingStep = {
  step: string;
  label: string;
  detail: string;
  status: string;
  detailKey?: 'identity' | 'ownership' | 'stripe' | 'tiers' | 'publish';
  detailValue?: number | string;
};

export type ProjectTeamRow = {
  name: string;
  email: string;
  role: string;
  lastActive: string;
  lastActiveAt?: string;
};

export type ProjectRoleRow = {
  tier: string;
  role: string;
  members: string;
  lastSync: string;
  status?: string;
};

export type ProjectDiscordGuild = {
  id: string;
  name: string;
  botInstalled: boolean;
};

export type ProjectDomainRow = {
  host: string;
  type: string;
  status: string;
  target: string;
};

export type ProjectWebhookRow = {
  url: string;
  events: string;
  status: string;
  last: string;
  lastAt?: string;
};

export type ProjectDeliveryRow = {
  id: string;
  event: string;
  target: string;
  code: string;
  time: string;
  timeAt?: string;
};

export type ProjectExportRow = {
  type: string;
  range: string;
  format: string;
  status: string;
  downloadUrl?: string;
  expiresAt?: string;
};

export type ProjectPageData = {
  source: DataSource;
  project: Project;
  goals: Goal[];
  threads: Thread[];
  supporters: Supporter[];
  payments: Payment[];
  posts: Post[];
  tiers: Tier[];
  team: ProjectTeamRow[];
  webhooks: WebhookEndpoint[];
  apiKeys: ApiKey[];
  discordMappings: DiscordRoleMapping[];
  exports: ProjectExportRow[];
  analytics: Analytics;
  analyticsDetails?: ProjectAnalytics;
  navGroups: NavGroup[];
  memberships?: ProjectMembershipRow[];
  metrics?: ProjectMetric[];
  inbox?: ProjectInboxPreviewRow[];
  rankings?: ProjectRankedSupporter[];
  tools?: ProjectToolCard[];
  chartSeries?: ProjectChartSeries[];
  supportSeries?: ProjectChartSeries[];
  growthSeries?: ProjectChartSeries[];
  breakdown?: ProjectBreakdownRow[];
  steps?: ProjectOnboardingStep[];
  initialStep?: number;
  draft?: Post | undefined;
  recentPosts?: Post[];
  links?: Array<{ label: string; value: string }>;
  capabilities?: Array<{ capability: string; status: string; detail: string }>;
  stripeAccountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  checkoutDisabled?: boolean;
  discordGuild?: ProjectDiscordGuild;
  domainRecords?: Array<{ host: string; type: string; status: string; target: string }>;
  webhookDeliveries?: Array<{
    id: string;
    event: string;
    target: string;
    code: string;
    time: string;
  }>;
  keys?: Array<{
    name: string;
    scope: string;
    created: string;
    lastUsed: string;
    createdAt?: string;
    lastUsedAt?: string;
  }>;
  roleRows?: ProjectRoleRow[];
  records?: ProjectDomainRow[];
  endpoints?: ProjectWebhookRow[];
  deliveries?: ProjectDeliveryRow[];
  members?: ProjectTeamRow[];
};

export type CatalogPageData = {
  source: DataSource;
  projects: Project[];
};

export type TransparencyMoneyTotal = {
  currency: string;
  amountMinor: string;
};

export type TransparencyRate = {
  currency: string;
  percent: number;
};

export type TransparencyAggregate = {
  publishedProjects: number;
  settledSupport: TransparencyMoneyTotal[];
  medianProjectFeePercent: number | null;
  guestOneOffSharePercent: number | null;
  refundedSupport: TransparencyRate[];
  activeMemberships: number;
};

export type TransparencyPageData = {
  source: DataSource;
  state: 'ready' | 'empty' | 'error';
  aggregate?: TransparencyAggregate;
};

export type TransparencyPaymentRow = {
  id: string;
  user_id: string | null;
  currency: string;
  project_amount_minor: string | number | bigint;
  oss_project_fee_minor: string | number | bigint;
  cadence: string;
  status: string;
  settled_at: Date | null;
};

export type TransparencyRefundRow = {
  payment_id: string;
  amount_minor: string | number | bigint;
  application_fee_refund_minor: string | number | bigint;
  status: string;
  created_at: Date;
};

export type TransparencyDisputeRow = {
  payment_id: string;
  amount_minor: string | number | bigint;
  status: string;
  created_at: Date;
};

export type TransparencyAggregateInput = {
  publishedProjects: number;
  activeMemberships: number;
  periodStart: Date;
  periodEnd: Date;
  payments: readonly TransparencyPaymentRow[];
  refunds: readonly TransparencyRefundRow[];
  disputes?: readonly TransparencyDisputeRow[];
};

export type CheckoutPaymentStatus = 'confirmed' | 'processing' | 'failed';

export type CheckoutSuccessPageData = {
  project: Project;
  amountMinor: number;
  tipMinor: number;
  cadence: string;
  tier: string;
  entitlement: string;
  expires: string;
  reference: string;
  receiptEmail: string;
  paymentStatus: CheckoutPaymentStatus;
};

export type LifetimeSupport = {
  projectName: string;
  oneOffMinor: number;
  recurringMinor: number;
  currency: string;
};

export type RenewalCalendarEntry = {
  id: string;
  projectSlug: string;
  projectName: string;
  tierName: string;
  cadence: string;
  status: string;
  renewsAt: string;
};

export type SupporterPageData = {
  source: DataSource;
  supporterName: string;
  supporterEmail: string;
  memberships: Membership[];
  entitlements: Entitlement[];
  threads: Thread[];
  lifetimeSupport: LifetimeSupport[];
  renewalCalendar: RenewalCalendarEntry[];
  platformTipMinor: number;
  platformTipMembershipId: string | null;
};

export type AdminReviewItem = {
  id: string;
  slug: string;
  name: string;
  repository: string;
  reason: string;
  risk: 'high' | 'medium' | 'low';
  submitted: string;
  queueDays: number;
};

export type AdminDirectoryProject = {
  name: string;
  slug: string;
  repository: string;
  verified: string;
  payments: string;
  supporters: number;
  feeMode: string;
};

export type AdminDirectoryPerson = {
  name: string;
  email: string;
  role: string;
  projects: string;
  signedIn: string;
};

export type AdminReconRow = {
  date: string;
  project: string;
  currency: string;
  stripeNetMinor: number;
  ledgerNetMinor: number;
  status: 'aligned' | 'mismatch' | 'pending';
};

export type AdminFailedJob = {
  id: string;
  kind: string;
  target: string;
  retries: number;
  lastError: string;
};

export type AdminCaseRow = {
  id: string;
  type: string;
  project: string;
  status: string;
  assignee: string;
  opened: string;
  summary: string;
};

export type AdminAuditRow = {
  time: string;
  actor: string;
  action: string;
  target: string;
  reason: string;
  correlation: string;
};

export type AdminPageData = {
  source: DataSource;
  navGroups: NavGroup[];
  overviewMetrics: AdminOverviewMetrics;
  reviewQueue: AdminQueueItem[];
  reconciliation: AdminReconRow[];
  auditLog: AdminAuditRow[];
  events: AdminAuditRow[];
  rows: AdminReconRow[];
  cases: AdminCaseRow[];
  reviewItems: AdminReviewItem[];
  failedJobs: AdminFailedJob[];
  directoryProjects: AdminDirectoryProject[];
  directoryPeople: AdminDirectoryPerson[];
  projects: AdminDirectoryProject[];
  people: AdminDirectoryPerson[];
};

type AdminOverviewPayment = {
  currency: string;
  project_amount_minor: string | number | bigint;
  platform_tip_minor: string | number | bigint;
  oss_project_fee_minor: string | number | bigint;
  status: string;
  created_at: Date;
  settled_at: Date | null;
};

type AdminOverviewTotals = {
  settlementMinor: number;
  feesMinor: number;
  tipsMinor: number;
  dailySettlementMinor: Map<string, number>;
};

/** Build operator overview totals from persisted payment/project rows. */
export function buildAdminOverviewMetrics(args: {
  projects: Array<{ status: string; created_at: Date }>;
  payments: AdminOverviewPayment[];
  now?: Date;
  reconciliationAvailable?: boolean;
}): AdminOverviewMetrics {
  const now = args.now ?? new Date();
  const periodStart = new Date(now.getTime() - 30 * 86_400_000);
  const previousPeriodStart = new Date(now.getTime() - 60 * 86_400_000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const currentTotals = new Map<string, AdminOverviewTotals>();
  const previousTotals = new Map<string, AdminOverviewTotals>();

  const addPayment = (
    target: Map<string, AdminOverviewTotals>,
    payment: AdminOverviewPayment,
    includeDaily: boolean,
  ) => {
    const currency = currencyCode(payment.currency);
    const current = target.get(currency) ?? {
      settlementMinor: 0,
      feesMinor: 0,
      tipsMinor: 0,
      dailySettlementMinor: new Map<string, number>(),
    };
    const settlementMinor = minorNumber(payment.project_amount_minor);
    current.settlementMinor += settlementMinor;
    current.feesMinor += minorNumber(payment.oss_project_fee_minor);
    current.tipsMinor += minorNumber(payment.platform_tip_minor);
    if (includeDaily) {
      const day =
        payment.settled_at?.toISOString().slice(0, 10) ??
        payment.created_at.toISOString().slice(0, 10);
      current.dailySettlementMinor.set(
        day,
        (current.dailySettlementMinor.get(day) ?? 0) + settlementMinor,
      );
    }
    target.set(currency, current);
  };

  for (const payment of args.payments) {
    if (!['succeeded', 'refunded', 'disputed'].includes(payment.status)) continue;
    const paymentDate = payment.settled_at ?? payment.created_at;
    if (paymentDate >= periodStart && paymentDate < now) addPayment(currentTotals, payment, true);
    else if (paymentDate >= previousPeriodStart && paymentDate < periodStart)
      addPayment(previousTotals, payment, false);
  }

  const currencyCodes = [...currentTotals.keys()].sort();
  const singleCurrency = currencyCodes.length === 1 ? currencyCodes[0] : undefined;
  const current = singleCurrency ? currentTotals.get(singleCurrency) : undefined;
  const previous = singleCurrency ? previousTotals.get(singleCurrency) : undefined;
  const amount = (value: number | undefined): { amountMinor: number; currency: string } | null =>
    singleCurrency && value !== undefined ? { amountMinor: value, currency: singleCurrency } : null;
  const settledVolumeSeries = [...currentTotals.entries()].map(([currency, totals], index) => ({
    id: `settled-support-${currency.toLowerCase()}`,
    labelKey: 'admin.overview.series.settledSupport',
    currency,
    stroke: index === 0 ? ('solid' as const) : ('dashed' as const),
    marker: index === 0 ? ('circle' as const) : ('square' as const),
    points: [...totals.dailySettlementMinor.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, value]) => ({ label, value: value / 10 ** currencyExponent(currency) })),
  }));

  return {
    publishedProjects: args.projects.filter((project) => project.status === 'published').length,
    publishedThisMonth: args.projects.filter(
      (project) =>
        project.status === 'published' &&
        project.created_at >= monthStart &&
        project.created_at < now,
    ).length,
    settlementVolume: amount(current?.settlementMinor),
    previousSettlementVolume: amount(previous?.settlementMinor),
    fees: amount(current?.feesMinor),
    tips: amount(current?.tipsMinor),
    currencyCodes,
    settledVolumeSeries,
    reconciliationAvailable: args.reconciliationAvailable ?? false,
  };
}

/** Demo data is available only when explicitly enabled outside production. */
export function isDemoMode(): boolean {
  return (
    process.env.DEMO_MODE === 'true' &&
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
  );
}

function requireDatabase(): Db {
  if (!hasDatabaseUrl()) {
    throw error(503, 'Database unavailable. Set DATABASE_URL or enable non-production DEMO_MODE.');
  }
  return getDb();
}

function minorNumber(value: string | number | bigint | null | undefined): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function minorBigInt(value: string | number | bigint | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  try {
    return BigInt(String(value));
  } catch {
    return 0n;
  }
}

function percentage(numerator: bigint, denominator: bigint): number | null {
  if (denominator <= 0n) return null;
  return Number((numerator * 1000n + denominator / 2n) / denominator) / 10;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? null);
}

function currencyCode(value: string | null | undefined): string {
  return (value || 'GBP').toUpperCase();
}

function publicHttpUrl(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : '';
  } catch {
    return '';
  }
}

function normalizedValues(values: readonly string[] | null | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function publicAppUrl(): string {
  return (process.env.PUBLIC_APP_URL || 'https://oss.tips').replace(/\/$/, '');
}

function dateValue(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value: Date | string | null | undefined): string {
  const date = dateValue(value);
  return date ? date.toISOString() : '—';
}

function isoDate(value: Date | string | null | undefined): string {
  const date = dateValue(value);
  return date ? date.toISOString().slice(0, 10) : '';
}

function relativeLabel(value: Date | string | null | undefined): string {
  return dateLabel(value);
}

function projectForSlug(slug: string): Project {
  return featuredProjects.find((item) => item.slug === slug) ?? { ...demoProject, slug };
}

function demoProjectData(slug: string, publicOnly = false): ProjectPageData {
  const posts = publicOnly
    ? demoPosts.filter((post) => post.tierVisibility === 'Public')
    : demoPosts;
  return {
    source: 'demo',
    project: projectForSlug(slug),
    goals: demoGoals,
    threads: demoThreads,
    supporters: demoSupporters,
    payments: demoPayments,
    posts,
    tiers: demoTiers,
    team: demoTeam.map((member) => ({ ...member, lastActive: '—' })),
    webhooks: demoWebhooks,
    apiKeys: demoApiKeys,
    discordMappings: demoDiscordMappings,
    exports: demoExports.map((item) => ({ ...item, format: 'CSV', status: item.action })),
    analytics: demoAnalytics,
    navGroups: projectNavGroups,
    memberships: demoProjectMemberships,
    draft: demoPosts[0],
    recentPosts: posts,
  };
}

/** Explicit fixture entry point used by local demos and Storybook-facing tests. */
export const demoProjectPageData = demoProjectData;

function projectFromRow(
  row: ProjectIdentityRow,
  stats: {
    supporters: number;
    monthlyRecurringMinor: number;
    oneOffThisMonthMinor: number;
    totalSupportMinor: number;
  },
  repository = '',
  feeMode = 'standard',
  repositoryProvider = '',
): Project {
  const taxonomy = [...(row.discovery_tags ?? []), repositoryProvider];
  return {
    slug: row.slug,
    name: row.name,
    status: row.status,
    description: row.description ?? '',
    website: publicHttpUrl(row.website_url),
    repository: publicHttpUrl(repository) || repository,
    verified: row.status === 'published',
    currency: currencyCode(row.default_currency),
    feeMode: feeMode === 'project_5pct' ? 'project_5pct' : 'standard',
    logoLetter: row.name.slice(0, 1).toUpperCase(),
    logoAssetId: row.logo_asset_id ?? undefined,
    bannerAssetId: row.banner_asset_id ?? undefined,
    ecosystems: normalizedValues(row.discovery_ecosystems),
    languages: normalizedValues(row.discovery_languages),
    updatedAt: row.updated_at.toISOString(),
    showSupporters: row.public_show_supporters ?? true,
    showGoal: row.public_show_goal ?? true,
    showStats: row.public_show_stats ?? false,
    showGatedPostMetadata: row.public_show_gated_post_metadata ?? false,
    minSupportMinor:
      row.min_support_minor === null || row.min_support_minor === undefined
        ? undefined
        : minorNumber(row.min_support_minor),
    maxSupportMinor:
      row.max_support_minor === null || row.max_support_minor === undefined
        ? undefined
        : minorNumber(row.max_support_minor),
    tags: normalizedValues(taxonomy),
    stats,
  };
}

/** Convert persisted project identity into the UI model without fixture data. */
export function mapDbProjectToUi(row: ProjectIdentityRow, repository = ''): Project {
  return projectFromRow(row, emptyStats(), repository);
}

/** Translate persisted payment state without trusting checkout redirect input. */
export function checkoutPaymentStatus(status: string): CheckoutPaymentStatus {
  if (status === 'succeeded') return 'confirmed';
  if (status === 'pending' || status === 'processing') return 'processing';
  return 'failed';
}

function emptyStats(): {
  supporters: number;
  monthlyRecurringMinor: number;
  oneOffThisMonthMinor: number;
  totalSupportMinor: number;
} {
  return { supporters: 0, monthlyRecurringMinor: 0, oneOffThisMonthMinor: 0, totalSupportMinor: 0 };
}

const settledPaymentStatuses = new Set(['succeeded', 'refunded', 'disputed']);

export type ProjectAggregatePaymentRow = {
  id: string;
  user_id: string | null;
  currency: string;
  cadence: string;
  project_amount_minor: string | number | bigint;
  status: string;
  created_at: Date;
  settled_at: Date | null;
};

export type ProjectAggregateRefundRow = {
  payment_id: string;
  amount_minor: string | number | bigint;
  application_fee_refund_minor?: string | number | bigint | null;
  status: string;
};

export type ProjectAggregateDisputeRow = {
  payment_id: string;
  amount_minor: string | number | bigint;
  status: string;
};

function adjustmentTotal(
  paymentId: string,
  refunds: readonly ProjectAggregateRefundRow[],
  disputes: readonly ProjectAggregateDisputeRow[],
): bigint {
  const refunded = refunds.reduce((sum, refund) => {
    if (refund.payment_id !== paymentId || refund.status !== 'succeeded') return sum;
    const amount =
      minorBigInt(refund.amount_minor) - minorBigInt(refund.application_fee_refund_minor);
    return sum + (amount > 0n ? amount : 0n);
  }, 0n);
  const disputed = disputes.reduce((sum, dispute) => {
    if (dispute.payment_id !== paymentId || !['open', 'lost'].includes(dispute.status)) return sum;
    const amount = minorBigInt(dispute.amount_minor);
    return sum + (amount > 0n ? amount : 0n);
  }, 0n);
  return refunded + disputed;
}

/** Return settled project support after known refund and chargeback corrections. */
export function netSettledProjectAmountMinor(
  row: ProjectAggregatePaymentRow,
  refunds: readonly ProjectAggregateRefundRow[] = [],
  disputes: readonly ProjectAggregateDisputeRow[] = [],
): bigint {
  if (!row.settled_at || !settledPaymentStatuses.has(row.status)) return 0n;
  const gross = minorBigInt(row.project_amount_minor);
  if (gross <= 0n) return 0n;
  if (row.status === 'refunded') return 0n;
  const reversed = adjustmentTotal(row.id, refunds, disputes);
  const hasRefund = refunds.some(
    (refund) => refund.payment_id === row.id && refund.status === 'succeeded',
  );
  const hasDispute = disputes.some((dispute) => dispute.payment_id === row.id);
  if (
    reversed === 0n &&
    ((row.status === 'refunded' && !hasRefund) || (row.status === 'disputed' && !hasDispute))
  ) {
    return 0n;
  }
  return gross > reversed ? gross - reversed : 0n;
}

/** Roll up supporter payments by project and currency after settlement corrections. */
export function buildSupporterLifetimeSupport(
  rows: readonly (ProjectAggregatePaymentRow & {
    project_id: string;
    project_name: string;
  })[],
  refunds: readonly ProjectAggregateRefundRow[] = [],
  disputes: readonly ProjectAggregateDisputeRow[] = [],
): LifetimeSupport[] {
  const lifetimeByProject = new Map<string, LifetimeSupport>();
  for (const payment of rows) {
    const amount = minorNumber(netSettledProjectAmountMinor(payment, refunds, disputes));
    if (amount <= 0) continue;
    const currency = currencyCode(payment.currency);
    const key = `${payment.project_id}:${currency}`;
    const current = lifetimeByProject.get(key) ?? {
      projectName: payment.project_name,
      oneOffMinor: 0,
      recurringMinor: 0,
      currency,
    };
    if (payment.cadence === 'one_off') current.oneOffMinor += amount;
    else current.recurringMinor += amount;
    lifetimeByProject.set(key, current);
  }
  return [...lifetimeByProject.values()];
}

/** Roll up only settled Stripe payments into the public transparency view. */
export function buildTransparencyAggregate(
  input: TransparencyAggregateInput,
): TransparencyAggregate | null {
  const settledPayments = input.payments.filter(
    (payment) =>
      payment.settled_at !== null &&
      payment.settled_at >= input.periodStart &&
      payment.settled_at < input.periodEnd &&
      settledPaymentStatuses.has(payment.status),
  );
  if (settledPayments.length === 0) return null;

  const totals = new Map<string, { gross: bigint; refunds: bigint; disputes: bigint }>();
  const feeBasisPoints: number[] = [];
  const oneOffPayments = settledPayments.filter((payment) => payment.cadence === 'one_off');
  const guestOneOffPayments = oneOffPayments.filter((payment) => payment.user_id === null);
  const paymentById = new Map(settledPayments.map((payment) => [payment.id, payment]));
  const ensureTotal = (currency: string) => {
    const code = currencyCode(currency);
    const existing = totals.get(code);
    if (existing) return existing;
    const created = { gross: 0n, refunds: 0n, disputes: 0n };
    totals.set(code, created);
    return created;
  };

  for (const payment of settledPayments) {
    const total = ensureTotal(payment.currency);
    const amount = minorBigInt(payment.project_amount_minor);
    total.gross += amount > 0n ? amount : 0n;
    const fee = minorBigInt(payment.oss_project_fee_minor);
    if (amount > 0n && fee >= 0n) {
      feeBasisPoints.push(Number((fee * 10_000n + amount / 2n) / amount));
    }
  }

  for (const refund of input.refunds) {
    if (
      refund.status !== 'succeeded' ||
      refund.created_at < input.periodStart ||
      refund.created_at >= input.periodEnd
    )
      continue;
    const payment = paymentById.get(refund.payment_id);
    if (!payment) continue;
    const refundAmount =
      minorBigInt(refund.amount_minor) - minorBigInt(refund.application_fee_refund_minor);
    if (refundAmount <= 0n) continue;
    ensureTotal(payment.currency).refunds += refundAmount;
  }

  for (const dispute of input.disputes ?? []) {
    if (!['open', 'lost'].includes(dispute.status)) continue;
    if (dispute.created_at < input.periodStart || dispute.created_at >= input.periodEnd) continue;
    const payment = paymentById.get(dispute.payment_id);
    if (!payment) continue;
    const amount = minorBigInt(dispute.amount_minor);
    if (amount <= 0n) continue;
    ensureTotal(payment.currency).disputes += amount;
  }

  const settledSupport = [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, total]) => ({
      currency,
      amountMinor: (total.gross > total.refunds + total.disputes
        ? total.gross - total.refunds - total.disputes
        : 0n
      ).toString(),
    }));
  const refundedSupport = [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, total]) => ({
      currency,
      percent: percentage(total.refunds, total.gross) ?? 0,
    }));

  return {
    publishedProjects: Math.max(0, Math.trunc(input.publishedProjects)),
    settledSupport,
    medianProjectFeePercent: median(feeBasisPoints.map((basisPoints) => basisPoints / 100)),
    guestOneOffSharePercent: percentage(
      BigInt(guestOneOffPayments.length),
      BigInt(oneOffPayments.length),
    ),
    refundedSupport,
    activeMemberships: Math.max(0, Math.trunc(input.activeMemberships)),
  };
}

export function statsFromPayments(
  rows: readonly ProjectAggregatePaymentRow[],
  options: {
    currency?: string;
    refunds?: readonly ProjectAggregateRefundRow[];
    disputes?: readonly ProjectAggregateDisputeRow[];
    now?: Date;
  } = {},
): {
  supporters: number;
  monthlyRecurringMinor: number;
  oneOffThisMonthMinor: number;
  totalSupportMinor: number;
} {
  const expectedCurrency = options.currency?.toLowerCase();
  const refunds = options.refunds ?? [];
  const disputes = options.disputes ?? [];
  const successful = rows.filter(
    (row) =>
      (!expectedCurrency || row.currency.toLowerCase() === expectedCurrency) &&
      netSettledProjectAmountMinor(row, refunds, disputes) > 0n,
  );
  const currentMonth = new Date();
  const now = options.now ?? new Date();
  currentMonth.setTime(now.getTime());
  currentMonth.setUTCDate(1);
  currentMonth.setUTCHours(0, 0, 0, 0);
  return {
    supporters: new Set(successful.map((row) => row.user_id ?? row.id)).size,
    monthlyRecurringMinor: successful
      .filter((row) => row.cadence === 'monthly')
      .reduce((sum, row) => sum + Number(netSettledProjectAmountMinor(row, refunds, disputes)), 0),
    oneOffThisMonthMinor: successful
      .filter(
        (row) => row.cadence === 'one_off' && (row.settled_at ?? row.created_at) >= currentMonth,
      )
      .reduce((sum, row) => sum + Number(netSettledProjectAmountMinor(row, refunds, disputes)), 0),
    totalSupportMinor: successful.reduce(
      (sum, row) => sum + Number(netSettledProjectAmountMinor(row, refunds, disputes)),
      0,
    ),
  };
}

function goalTypeFromRow(value: string): GoalType {
  if (value === 'calendar_month_money') return 'calendar_month_money';
  if (value === 'active_supporter_count') return 'active_supporter_count';
  if (value === 'mrr') return 'mrr';
  if (value === 'recurring_money') return 'recurring_money';
  if (value === 'supporter_count') return 'supporter_count';
  return 'one_time_money';
}

function goalBasisFromRow(goalType: string, basis: string | null | undefined): string {
  if (basis === 'active_supporters') return 'active supporters';
  if (basis === 'settled_project_support') return 'before fees';
  if (basis === 'calendar_month') return 'calendar month';
  if (basis === 'mrr') return 'recurring support';
  if (basis) return basis;
  if (goalType === 'supporter_count' || goalType === 'active_supporter_count')
    return 'active supporters';
  if (goalType === 'mrr' || goalType === 'recurring_money') return 'recurring support';
  return goalType === 'calendar_month_money' ? 'calendar month' : 'before fees';
}

export function goalFromRow(
  row: {
    id: string;
    title: string;
    goal_type: string;
    target_minor: string | number | bigint | null;
    target_count: number | null;
    currency: string | null;
    deadline?: Date | null;
    basis?: string | null;
  },
  raisedMinor: number,
  supporterCount: number,
  fallbackCurrency = 'GBP',
): Goal {
  const type = goalTypeFromRow(row.goal_type);
  const isCount = type === 'supporter_count' || type === 'active_supporter_count';
  const target = isCount ? minorNumber(row.target_count) : minorNumber(row.target_minor);
  const progress = isCount ? supporterCount : raisedMinor;
  return {
    id: row.id,
    slug: row.id,
    title: row.title,
    description: '',
    targetMinor: target,
    raisedMinor: progress,
    type,
    ...(isCount ? { targetCount: target, progressCount: supporterCount } : {}),
    basis: goalBasisFromRow(row.goal_type, row.basis),
    ...(row.deadline ? { deadline: row.deadline.toISOString() } : {}),
    currency: currencyCode(row.currency ?? fallbackCurrency),
    percentLabel: `${formatPercent(progress, target)}%`,
  };
}

function postVisibilityLabel(
  rule: { rule_kind: string; minimum_tier_rank: number | null },
  tiers: Tier[],
): string {
  if (rule.rule_kind === 'public') return 'Public';
  if (rule.minimum_tier_rank !== null) return `Tier ${rule.minimum_tier_rank}+`;
  return tiers.length > 0 ? 'Members' : 'Gated';
}

function excerptFromBody(body: string): string {
  const excerpt = body
    .replace(/^#+\s+/gm, '')
    .replace(/[*_`>-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return excerpt.length > 180 ? `${excerpt.slice(0, 177)}…` : excerpt;
}

function payloadProjectId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const projectId = payload.project_id ?? payload.projectId;
  return typeof projectId === 'string' ? projectId : null;
}

function payloadString(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' ? candidate : null;
}

async function readProjectData(row: DbProject, publicOnly: boolean): Promise<ProjectPageData> {
  const db = requireDatabase();
  const [
    paymentRows,
    repositoryRows,
    featureRow,
    goalRows,
    currentEntitlementRows,
    tierRows,
    priceRows,
    rewardRows,
    postRows,
    profileRows,
  ] = await Promise.all([
    db
      .selectFrom('payment')
      .leftJoin('user', 'user.id', 'payment.user_id')
      .select([
        'payment.id',
        'payment.user_id',
        'payment.currency',
        'payment.cadence',
        'payment.status',
        'payment.customer_charge_minor',
        'payment.project_amount_minor',
        'payment.oss_project_fee_minor',
        'payment.stripe_application_fee_minor',
        'payment.public_show_name',
        'payment.public_show_amount',
        'payment.public_show_message',
        'payment.public_display_name',
        'payment.public_message',
        'payment.receipt_email',
        'payment.settled_at',
        'payment.created_at',
        'user.name as user_name',
      ])
      .where('payment.project_id', '=', row.id)
      .orderBy('payment.created_at', 'desc')
      .execute(),
    db
      .selectFrom('project_repository')
      .selectAll()
      .where('project_id', '=', row.id)
      .orderBy('created_at', 'asc')
      .execute(),
    db
      .selectFrom('project_feature_mode')
      .selectAll()
      .where('project_id', '=', row.id)
      .executeTakeFirst(),
    db
      .selectFrom('project_goal')
      .select([
        'id',
        'title',
        'goal_type',
        'target_minor',
        'target_count',
        'currency',
        'deadline',
        'basis',
      ])
      .where('project_id', '=', row.id)
      .where('is_active', '=', true)
      .$if(publicOnly, (query) => query.where('status', '=', 'published'))
      .orderBy('created_at', 'asc')
      .execute(),
    publicOnly && row.public_show_goal === false
      ? Promise.resolve([])
      : listCurrentForProject(db, row.id),
    db
      .selectFrom('tier')
      .selectAll()
      .where('project_id', '=', row.id)
      .where('is_active', '=', true)
      .orderBy('rank', 'asc')
      .execute(),
    db.selectFrom('tier_price').selectAll().where('is_active', '=', true).execute(),
    db.selectFrom('tier_reward').selectAll().execute(),
    db
      .selectFrom('post')
      .innerJoin('user', 'user.id', 'post.author_id')
      .select([
        'post.id',
        'post.slug',
        'post.title',
        'post.status',
        'post.published_at',
        'post.updated_at',
        'user.name as author_name',
      ])
      .where('post.project_id', '=', row.id)
      .$if(publicOnly, (query) => query.where('post.status', '=', 'published'))
      .orderBy('post.published_at', 'desc')
      .execute(),
    db
      .selectFrom('supporter_public_profile')
      .selectAll()
      .where('project_id', '=', row.id)
      .execute(),
  ]);

  const paymentIds = paymentRows.map((payment) => payment.id);
  const [refundRows, disputeRows, checkoutIntentRows] = await Promise.all([
    paymentIds.length
      ? db
          .selectFrom('refund')
          .select(['payment_id', 'amount_minor', 'application_fee_refund_minor', 'status'])
          .where('payment_id', 'in', paymentIds)
          .execute()
      : Promise.resolve([]),
    paymentIds.length
      ? db
          .selectFrom('payment_dispute')
          .select(['payment_id', 'amount_minor', 'status'])
          .where('payment_id', 'in', paymentIds)
          .execute()
      : Promise.resolve([]),
    paymentIds.length
      ? db
          .selectFrom('checkout_intent')
          .leftJoin('tier', 'tier.id', 'checkout_intent.tier_id')
          .select([
            'checkout_intent.id as payment_id',
            'tier.name as tier_name',
            'tier.one_off_duration',
          ])
          .where('checkout_intent.id', 'in', paymentIds)
          .execute()
      : Promise.resolve([]),
  ]);

  const stats = statsFromPayments(paymentRows, {
    currency: row.default_currency,
    refunds: refundRows,
    disputes: disputeRows,
  });
  const repository = repositoryRows[0]?.url ?? '';
  const project = projectFromRow(
    row,
    stats,
    repository,
    featureRow?.mode,
    repositoryRows[0]?.provider ?? '',
  );
  if (!publicOnly) {
    project.supportEmail = row.support_email ?? undefined;
    project.supportEmailVerified = row.support_email_verified_at !== null;
  }
  if (publicOnly && project.showStats === false) project.stats = emptyStats();
  const successfulPayments = paymentRows.filter(
    (payment) =>
      payment.currency.toLowerCase() === row.default_currency.toLowerCase() &&
      netSettledProjectAmountMinor(payment, refundRows, disputeRows) > 0n,
  );
  const netByPaymentId = new Map(
    paymentRows.map((payment) => [
      payment.id,
      netSettledProjectAmountMinor(payment, refundRows, disputeRows),
    ]),
  );
  const checkoutIntentByPayment = new Map(
    checkoutIntentRows.map((intent) => [intent.payment_id, intent]),
  );
  const tiers = tierRows.map((tier) => {
    const prices = priceRows.filter(
      (price) =>
        price.tier_id === tier.id &&
        price.currency.toLowerCase() === row.default_currency.toLowerCase(),
    );
    const priceFor = (cadence: string) =>
      prices.find((price) => price.cadence === cadence)?.amount_minor;
    return {
      id: tier.id,
      name: tier.name,
      description: tier.description ?? '',
      monthlyMinor: minorNumber(priceFor('monthly')),
      annualMinor: minorNumber(priceFor('annual')),
      oneOffMinor: minorNumber(priceFor('one_off')),
      ...(tier.member_cap !== null ? { memberLimit: tier.member_cap } : {}),
      ...(tier.one_off_duration === 'days_30' ||
      tier.one_off_duration === 'days_90' ||
      tier.one_off_duration === 'year' ||
      tier.one_off_duration === 'permanent'
        ? { oneOffDuration: tier.one_off_duration }
        : tier.one_off_duration === 'days_365'
          ? { oneOffDuration: 'year' }
          : {}),
      rewards: rewardRows
        .filter((reward) => reward.tier_id === tier.id)
        .map((reward) => reward.label),
    } satisfies Tier;
  });

  const postIds = postRows.map((post) => post.id);
  const [
    revisionRows,
    visibilityRows,
    memberRows,
    webhookRows,
    apiKeyRows,
    discordRows,
    discordAssignmentRows,
    domainRows,
    exportRows,
    exportAssetRows,
    threadRows,
    subscriptionRows,
    connectedAccount,
    discordGuildRow,
  ] = await Promise.all([
    postIds.length
      ? db
          .selectFrom('post_revision')
          .selectAll()
          .where('post_id', 'in', postIds)
          .orderBy('revision_number', 'desc')
          .execute()
      : Promise.resolve([]),
    postIds.length
      ? db.selectFrom('post_visibility_rule').selectAll().where('post_id', 'in', postIds).execute()
      : Promise.resolve([]),
    publicOnly
      ? Promise.resolve([])
      : db
          .selectFrom('project_member')
          .innerJoin('user', 'user.id', 'project_member.user_id')
          .select(['project_member.id', 'project_member.role', 'user.name', 'user.email'])
          .where('project_member.project_id', '=', row.id)
          .execute(),
    publicOnly
      ? Promise.resolve([])
      : db
          .selectFrom('webhook_endpoint')
          .selectAll()
          .where('project_id', '=', row.id)
          .orderBy('created_at', 'desc')
          .execute(),
    publicOnly
      ? Promise.resolve([])
      : db
          .selectFrom('api_key')
          .selectAll()
          .where('project_id', '=', row.id)
          .where('revoked_at', 'is', null)
          .orderBy('created_at', 'desc')
          .execute(),
    publicOnly
      ? Promise.resolve([])
      : db
          .selectFrom('discord_role_mapping')
          .innerJoin('tier', 'tier.id', 'discord_role_mapping.tier_id')
          .innerJoin('discord_guild', 'discord_guild.id', 'discord_role_mapping.discord_guild_id')
          .select(['tier.name as tier_name', 'discord_role_mapping.discord_role_id as role'])
          .where('tier.project_id', '=', row.id)
          .execute(),
    publicOnly
      ? Promise.resolve([])
      : db
          .selectFrom('discord_role_assignment')
          .innerJoin(
            'discord_guild',
            'discord_guild.id',
            'discord_role_assignment.discord_guild_id',
          )
          .select([
            'discord_role_assignment.discord_role_id as role',
            'discord_role_assignment.status',
            'discord_role_assignment.last_synced_at',
          ])
          .where('discord_guild.project_id', '=', row.id)
          .execute(),
    publicOnly
      ? Promise.resolve([])
      : db
          .selectFrom('custom_domain')
          .selectAll()
          .where('project_id', '=', row.id)
          .orderBy('created_at', 'asc')
          .execute(),
    publicOnly
      ? Promise.resolve([])
      : db
          .selectFrom('job')
          .selectAll()
          .where('queue', '=', 'exports')
          .orderBy('created_at', 'desc')
          .limit(20)
          .execute(),
    publicOnly
      ? Promise.resolve([])
      : db
          .selectFrom('object_asset')
          .select(['id', 'soft_deleted_at', 'expires_at'])
          .where('project_id', '=', row.id)
          .where('purpose', '=', 'export')
          .where('visibility', '=', 'private')
          .execute(),
    publicOnly
      ? Promise.resolve([])
      : db
          .selectFrom('supporter_message_thread')
          .leftJoin('user', 'user.id', 'supporter_message_thread.supporter_user_id')
          .select([
            'supporter_message_thread.id',
            'supporter_message_thread.project_id',
            'supporter_message_thread.supporter_user_id',
            'supporter_message_thread.payment_id',
            'supporter_message_thread.status',
            'supporter_message_thread.created_at',
            'supporter_message_thread.updated_at',
            'user.name as supporter_name',
          ])
          .where('supporter_message_thread.project_id', '=', row.id)
          .orderBy('supporter_message_thread.created_at', 'desc')
          .limit(50)
          .execute(),
    publicOnly
      ? Promise.resolve([])
      : db
          .selectFrom('subscription')
          .innerJoin('tier', 'tier.id', 'subscription.tier_id')
          .leftJoin('user', 'user.id', 'subscription.user_id')
          .select([
            'subscription.id',
            'subscription.status',
            'subscription.current_period_end',
            'subscription.cadence as subscription_cadence',
            'subscription.project_amount_minor',
            'subscription.currency as subscription_currency',
            'tier.name as tier_name',
            'user.name as user_name',
          ])
          .where('subscription.project_id', '=', row.id)
          .orderBy('subscription.created_at', 'desc')
          .execute(),
    db
      .selectFrom('stripe_connected_account')
      .selectAll()
      .where('project_id', '=', row.id)
      .executeTakeFirst(),
    publicOnly
      ? Promise.resolve(undefined)
      : db
          .selectFrom('discord_guild')
          .select(['discord_guild_id', 'guild_name', 'bot_installed'])
          .where('project_id', '=', row.id)
          .orderBy('created_at', 'asc')
          .executeTakeFirst(),
  ]);
  const webhookIds = webhookRows.map((endpoint) => endpoint.id);
  const deliveryRows =
    !publicOnly && webhookIds.length > 0
      ? await db
          .selectFrom('webhook_delivery')
          .selectAll()
          .where('webhook_endpoint_id', 'in', webhookIds)
          .orderBy('created_at', 'desc')
          .limit(50)
          .execute()
      : [];

  const revisions = new Map<string, (typeof revisionRows)[number]>();
  for (const revision of revisionRows)
    if (!revisions.has(revision.post_id)) revisions.set(revision.post_id, revision);
  const visibility = new Map<string, (typeof visibilityRows)[number]>();
  for (const rule of visibilityRows)
    if (!visibility.has(rule.post_id)) visibility.set(rule.post_id, rule);
  const allPosts: Post[] = postRows.flatMap((post) => {
    const rule = visibility.get(post.id);
    const gated = Boolean(rule && rule.rule_kind !== 'public');
    const visibilityMode = publicOnly
      ? publicPostVisibility(gated, row.public_show_gated_post_metadata === true)
      : 'full';
    if (visibilityMode === 'hidden') return [];
    const body = publicPostBody(revisions.get(post.id)?.body_markdown ?? '', visibilityMode);
    return [
      {
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: body ? excerptFromBody(body) : '',
        body,
        publishedAt: isoDate(post.published_at),
        publishedLabel: post.status === 'published' ? dateLabel(post.published_at) : 'Draft',
        tierVisibility: rule
          ? postVisibilityLabel(rule, tiers)
          : post.status === 'published'
            ? 'Public'
            : 'Draft',
        author: post.author_name,
        version: `"${post.updated_at.toISOString()}"`,
      },
    ];
  });
  const posts = allPosts;
  const currentSupporterCount = countCurrentEntitlementSupporters(currentEntitlementRows);

  const goals =
    publicOnly && project.showGoal === false
      ? []
      : goalRows.map((goal) => {
          const isCountGoal =
            goal.goal_type === 'supporter_count' || goal.goal_type === 'active_supporter_count';
          const goalCurrency = currencyCode(goal.currency ?? project.currency).toLowerCase();
          const goalPayments = isCountGoal
            ? []
            : paymentRows.filter((payment) => payment.currency.toLowerCase() === goalCurrency);
          const goalSupport = isCountGoal
            ? 0
            : goalPayments.reduce(
                (sum, payment) => sum + Number(netByPaymentId.get(payment.id) ?? 0n),
                0,
              );
          const goalSupporters = isCountGoal
            ? currentSupporterCount
            : new Set(
                goalPayments
                  .filter((payment) => (netByPaymentId.get(payment.id) ?? 0n) > 0n)
                  .map((payment) => payment.user_id ?? payment.id),
              ).size;
          return goalFromRow(goal, goalSupport, goalSupporters, project.currency);
        });
  const profileByUser = new Map(profileRows.map((profile) => [profile.user_id, profile]));
  const supporters: Supporter[] =
    publicOnly && project.showSupporters === false
      ? []
      : successfulPayments.map((payment) => {
          const profile = payment.user_id ? profileByUser.get(payment.user_id) : undefined;
          const showName = payment.public_show_name && (profile?.show_name ?? true);
          const showAmount = payment.public_show_amount && (profile?.show_amount ?? true);
          const showMessage = payment.public_show_message && (profile?.show_message ?? true);
          const displayName = showName
            ? (profile?.display_name ??
              payment.public_display_name ??
              payment.user_name ??
              'Anonymous')
            : 'Anonymous';
          const checkoutIntent = checkoutIntentByPayment.get(payment.id);
          return {
            id: payment.id,
            displayName,
            handle: displayName,
            amountMinor: showAmount ? Number(netByPaymentId.get(payment.id) ?? 0n) : 0,
            cadence:
              payment.cadence === 'annual'
                ? 'annual'
                : payment.cadence === 'monthly'
                  ? 'monthly'
                  : 'one-off',
            public: showName,
            message: showMessage ? (payment.public_message ?? '') : '',
            relativeTime: relativeLabel(payment.created_at),
            supportedAt: payment.created_at.toISOString(),
            currency: currencyCode(payment.currency),
            tierName: checkoutIntent?.tier_name ?? '',
            ...(checkoutIntent?.one_off_duration
              ? {
                  duration:
                    checkoutIntent.one_off_duration === 'days_365'
                      ? 'year'
                      : checkoutIntent.one_off_duration,
                }
              : {}),
            avatarLetter: displayName.slice(0, 1).toUpperCase(),
          };
        });

  const paymentById = new Map(paymentRows.map((payment) => [payment.id, payment]));
  const messageRows = threadRows.length
    ? await db
        .selectFrom('supporter_message')
        .selectAll()
        .where(
          'thread_id',
          'in',
          threadRows.map((thread) => thread.id),
        )
        .orderBy('created_at', 'asc')
        .execute()
    : [];
  const messagesByThread = new Map<string, typeof messageRows>();
  for (const message of messageRows)
    messagesByThread.set(message.thread_id, [
      ...(messagesByThread.get(message.thread_id) ?? []),
      message,
    ]);
  const threads: Thread[] = threadRows.map((thread) => {
    const messages = messagesByThread.get(thread.id) ?? [];
    const payment = thread.payment_id ? paymentById.get(thread.payment_id) : undefined;
    const firstMessage = messages[0];
    const preview = firstMessage?.body ?? 'No message text';
    return {
      id: thread.id,
      subject: preview.length > 72 ? `${preview.slice(0, 69)}…` : preview,
      project: project.name,
      supporter: firstMessage?.author_name ?? thread.supporter_name ?? 'Supporter',
      amountMinor: minorNumber(payment?.customer_charge_minor),
      ...(payment ? { currency: currencyCode(payment.currency) } : {}),
      amountLabel: payment ? '' : '—',
      createdAt: thread.created_at.toISOString(),
      cadence:
        payment?.cadence === 'annual'
          ? 'annual'
          : payment?.cadence === 'monthly'
            ? 'monthly'
            : 'one-off',
      relativeTime: relativeLabel(thread.created_at),
      preview,
      status: thread.status,
      unread: false,
      messages: messages.map((message) => ({
        id: message.id,
        author: message.author_name ?? 'Supporter',
        body: message.body,
        timestamp: message.created_at.toISOString(),
        relativeTime: relativeLabel(message.created_at),
      })),
    };
  });

  const projectPayments: Payment[] = publicOnly
    ? []
    : paymentRows.map((payment) => {
        const amountMinor = minorNumber(payment.customer_charge_minor);
        const projectAmount = minorNumber(payment.project_amount_minor);
        const feeMinor =
          minorNumber(payment.oss_project_fee_minor) +
          minorNumber(payment.stripe_application_fee_minor);
        return {
          id: payment.id,
          date: isoDate(payment.created_at),
          relativeTime: relativeLabel(payment.created_at),
          supporter: payment.user_name ?? 'Guest',
          amountMinor,
          currency: currencyCode(payment.currency),
          cadence: payment.cadence,
          status:
            payment.status === 'succeeded' ||
            payment.status === 'pending' ||
            payment.status === 'failed' ||
            payment.status === 'refunded'
              ? payment.status
              : 'pending',
          method: 'Stripe',
          feeMinor,
          netMinor: projectAmount,
          reference: payment.id,
        };
      });

  const memberships: ProjectMembershipRow[] = subscriptionRows.map((subscription) => ({
    name: subscription.user_name ?? 'Guest',
    tier: subscription.tier_name,
    cadence: subscription.subscription_cadence === 'annual' ? 'annual' : 'monthly',
    amount: subscription.project_amount_minor === null ? '—' : '',
    ...(subscription.project_amount_minor === null
      ? {}
      : {
          amountMinor: minorNumber(subscription.project_amount_minor),
          currency: currencyCode(subscription.subscription_currency ?? project.currency),
        }),
    status: subscription.status,
    renews: dateLabel(subscription.current_period_end),
    ...(subscription.current_period_end
      ? { renewsAt: subscription.current_period_end.toISOString() }
      : {}),
  }));
  const rankings: ProjectRankedSupporter[] = [
    ...supporters
      .filter((supporter) => supporter.public && supporter.amountMinor > 0)
      .reduce<Map<string, { name: string; cadence: string; amount: number }>>(
        (result, supporter) => {
          const current = result.get(supporter.displayName) ?? {
            name: supporter.displayName,
            cadence: supporter.cadence,
            amount: 0,
          };
          current.amount += supporter.amountMinor;
          result.set(supporter.displayName, current);
          return result;
        },
        new Map(),
      )
      .values(),
  ]
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 10)
    .map((supporter, index) => ({
      rank: index + 1,
      initial: supporter.name.slice(0, 1).toUpperCase(),
      name: supporter.name,
      cadence: supporter.cadence,
      amount: '',
      amountMinor: supporter.amount,
      currency: project.currency,
    }));
  const inbox = threads.map((thread) => ({
    id: thread.id,
    initial: thread.supporter.slice(0, 1).toUpperCase(),
    name: thread.supporter,
    snippet: thread.preview,
    amount: thread.amountLabel || '—',
    time: thread.relativeTime,
    unread: thread.unread ?? false,
    ...(thread.amountMinor > 0
      ? { amountMinor: thread.amountMinor, currency: thread.currency ?? project.currency }
      : {}),
    timeAt: thread.createdAt,
  }));
  const legacyMetrics: ProjectMetric[] = [
    {
      label: 'Total support',
      value: '',
      valueMinor: stats.totalSupportMinor,
      currency: project.currency,
      compare: `${successfulPayments.length} settled payments`,
      compareDirection: 'up',
    },
    {
      label: 'Supporters',
      value: '',
      valueNumber: stats.supporters,
      compare: 'Confirmed accounts',
      compareDirection: 'up',
    },
    {
      label: 'Monthly recurring',
      value: '',
      valueMinor: stats.monthlyRecurringMinor,
      currency: project.currency,
      compare: 'Settled recurring support',
      compareDirection: 'up',
    },
  ];
  const team: ProjectTeamRow[] = memberRows.map((member) => ({
    name: member.name,
    email: member.email,
    role: member.role,
    lastActive: '—',
  }));
  const webhooks: WebhookEndpoint[] = webhookRows.map((endpoint) => ({
    id: endpoint.id,
    url: endpoint.url,
    events: endpoint.events.join(', '),
    status: endpoint.is_active ? 'Active' : 'Paused',
    lastDelivery: '—',
  }));
  const apiKeys: ApiKey[] = apiKeyRows.map((key) => ({
    id: key.id,
    name: key.name,
    scope: key.scopes.join(', '),
    created: isoDate(key.created_at),
    lastUsed: dateLabel(key.last_used_at),
    createdAt: key.created_at.toISOString(),
    ...(key.last_used_at ? { lastUsedAt: key.last_used_at.toISOString() } : {}),
  }));
  const discordMappings: DiscordRoleMapping[] = discordRows.map((mapping) => ({
    tier: mapping.tier_name,
    role: mapping.role,
  }));
  const assignmentSummaryByRole = new Map<
    string,
    {
      members: number;
      latest: (typeof discordAssignmentRows)[number] | null;
      issue: (typeof discordAssignmentRows)[number] | null;
    }
  >();
  for (const assignment of discordAssignmentRows) {
    const summary = assignmentSummaryByRole.get(assignment.role) ?? {
      members: 0,
      latest: null,
      issue: null,
    };
    if (assignment.status === 'active') summary.members += 1;
    if (
      assignment.last_synced_at &&
      (!summary.latest?.last_synced_at || assignment.last_synced_at > summary.latest.last_synced_at)
    ) {
      summary.latest = assignment;
    }
    if (
      !['active', 'removed'].includes(assignment.status) &&
      assignment.last_synced_at &&
      (!summary.issue?.last_synced_at || assignment.last_synced_at > summary.issue.last_synced_at)
    ) {
      summary.issue = assignment;
    }
    assignmentSummaryByRole.set(assignment.role, summary);
  }
  const roleRows: ProjectRoleRow[] = discordRows.map((mapping) => {
    const summary = assignmentSummaryByRole.get(mapping.role);
    const status = summary?.issue?.status ?? summary?.latest?.status;
    return {
      tier: mapping.tier_name,
      role: mapping.role,
      members: String(summary?.members ?? 0),
      lastSync: dateLabel(summary?.latest?.last_synced_at),
      ...(status ? { status } : {}),
    };
  });
  const exportAssets = new Map(exportAssetRows.map((asset) => [asset.id, asset]));
  const now = new Date();
  const exports: ProjectExportRow[] = exportRows
    .filter((job) => payloadProjectId(job.payload) === row.id)
    .map((job) => {
      const assetId = payloadString(job.payload, 'asset_id');
      const asset = assetId ? exportAssets.get(assetId) : undefined;
      const payloadExpiry = dateValue(payloadString(job.payload, 'expires_at'));
      const expiresAt = dateValue(asset?.expires_at) ?? payloadExpiry;
      const expired = Boolean(expiresAt && expiresAt <= now);
      const ready =
        job.status === 'completed' &&
        Boolean(asset && !asset.soft_deleted_at && expiresAt && expiresAt > now);
      const kind = payloadString(job.payload, 'kind') ?? job.kind;
      const format = (payloadString(job.payload, 'format') ?? 'csv').toUpperCase();
      return {
        type: kind,
        range: '—',
        format,
        status:
          ready || expired
            ? ready
              ? 'ready'
              : 'expired'
            : job.status === 'failed' || job.status === 'completed'
              ? 'failed'
              : 'pending',
        ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
        ...(ready
          ? {
              downloadUrl: `/api/v1/project/exports/${encodeURIComponent(job.id)}/download?project_slug=${encodeURIComponent(row.slug)}`,
            }
          : {}),
      };
    });
  const capabilities = connectedAccount
    ? Object.entries(connectedAccount.capabilities as Record<string, unknown>).map(
        ([capability, status]) => ({
          capability,
          status: String(status),
          detail: connectedAccount.payouts_enabled ? 'Enabled' : 'Restricted',
        }),
      )
    : [];
  const readiness = paymentReadiness({
    connectedAccountId: connectedAccount?.stripe_account_id,
    chargesEnabled: connectedAccount?.charges_enabled,
    payoutsEnabled: connectedAccount?.payouts_enabled,
    capabilities: connectedAccount?.capabilities,
  });
  const identityComplete = Boolean(
    row.name &&
    row.description &&
    row.website_url &&
    row.open_source_declared &&
    row.support_email &&
    row.support_email_verified_at,
  );
  const ownershipComplete = repositoryRows[0]?.verification_status === 'verified';
  const stripeComplete = paymentsEnabled(readiness);
  const pageComplete = tiers.length > 0;
  const publishComplete = row.status === 'published';
  const onboardingSteps: ProjectOnboardingStep[] = [
    {
      step: '1',
      label: 'Identity',
      detail: '',
      detailKey: 'identity',
      detailValue: row.name,
      status: identityComplete ? 'Complete' : 'In progress',
    },
    {
      step: '2',
      label: 'Ownership',
      detail: repository,
      detailKey: 'ownership',
      status: ownershipComplete ? 'Complete' : 'In progress',
    },
    {
      step: '3',
      label: 'Stripe',
      detail: '',
      detailKey: 'stripe',
      detailValue: connectedAccount ? 'connected' : 'not-connected',
      status: stripeComplete ? 'Complete' : connectedAccount ? 'In progress' : 'Waiting',
    },
    {
      step: '4',
      label: 'Page & tiers',
      detail: '',
      detailKey: 'tiers',
      detailValue: tiers.length,
      status: pageComplete ? 'Complete' : 'Waiting',
    },
    {
      step: '5',
      label: 'Publish',
      detail: '',
      detailKey: 'publish',
      detailValue: publishComplete ? 'published' : 'draft',
      status: publishComplete ? 'Complete' : 'Waiting',
    },
  ];
  const initialStep = !identityComplete
    ? 1
    : !ownershipComplete
      ? 2
      : !stripeComplete
        ? 3
        : !pageComplete
          ? 4
          : 5;
  const domainRecords: ProjectDomainRow[] = domainRows.map((domain) => ({
    host: domain.hostname,
    type: 'Custom domain',
    status: domain.status,
    target: domain.ssl_status ?? '—',
  }));
  const endpointById = new Map(webhookRows.map((endpoint) => [endpoint.id, endpoint]));
  const latestDeliveryByEndpoint = new Map<string, (typeof deliveryRows)[number]>();
  for (const delivery of deliveryRows) {
    if (!latestDeliveryByEndpoint.has(delivery.webhook_endpoint_id))
      latestDeliveryByEndpoint.set(delivery.webhook_endpoint_id, delivery);
  }
  const endpoints: ProjectWebhookRow[] = webhookRows.map((endpoint) => {
    const latestDelivery = latestDeliveryByEndpoint.get(endpoint.id);
    return {
      url: endpoint.url,
      events: endpoint.events.join(', '),
      status: endpoint.is_active ? 'Active' : 'Paused',
      last: latestDelivery ? dateLabel(latestDelivery.updated_at) : '—',
      ...(latestDelivery ? { lastAt: latestDelivery.updated_at.toISOString() } : {}),
    };
  });
  const deliveries: ProjectDeliveryRow[] = deliveryRows.map((delivery) => ({
    id: delivery.id,
    event: delivery.event_type,
    target: endpointById.get(delivery.webhook_endpoint_id)?.url ?? '—',
    code: delivery.last_response_status ? String(delivery.last_response_status) : delivery.status,
    time: dateLabel(delivery.updated_at),
    timeAt: delivery.updated_at.toISOString(),
  }));
  const analyticsDetails = publicOnly
    ? undefined
    : await getProjectAnalytics(db, row.id, { days: 30 });
  const analytics: Analytics = analyticsDetails
    ? {
        referrers: analyticsDetails.referrers.map((referrer) => ({
          source: referrer.referrer,
          sessions: referrer.pageViews,
          supporters: referrer.confirmedConversions,
          conversionLabel: `${referrer.conversionPercent}%`,
          sharePercent: referrer.sharePercent,
        })),
        countries: analyticsDetails.countries.map((country) => ({
          country: country.country,
          countryCode: country.country,
          supporters: country.supporters,
          amountMinor: 0,
          amountLabel: '—',
          sharePercent: country.sharePercent,
        })),
        retention: analyticsDetails.retention.map((cohort) => ({
          cohort: cohort.cohort,
          monthLabel: cohort.cohort,
          started: cohort.started,
          retained: cohort.retained,
          retentionPercent: cohort.retentionPercent,
        })),
        netRevenue30dMinor: minorNumber(analyticsDetails.estimatedNet.amount),
        netRevenue30dLabel: '',
        newSupporters30d: analyticsDetails.conversion.confirmedConversions,
        churnPercent:
          analyticsDetails.membershipLifecycle.new > 0
            ? ((analyticsDetails.membershipLifecycle.cancelled +
                analyticsDetails.membershipLifecycle.expired) /
                analyticsDetails.membershipLifecycle.new) *
              100
            : 0,
        churnLabel: `${
          analyticsDetails.membershipLifecycle.new > 0
            ? ((analyticsDetails.membershipLifecycle.cancelled +
                analyticsDetails.membershipLifecycle.expired) /
                analyticsDetails.membershipLifecycle.new) *
              100
            : 0
        }%`,
        periodLabel: 'Last 30 days',
        currency: project.currency,
      }
    : {
        referrers: [],
        countries: [],
        retention: [],
        netRevenue30dMinor: stats.totalSupportMinor,
        netRevenue30dLabel: '',
        newSupporters30d: stats.supporters,
        churnPercent: 0,
        churnLabel: '—',
        periodLabel: 'Available settled data',
        currency: project.currency,
      };
  const metrics: ProjectMetric[] = analyticsDetails
    ? [
        {
          label: 'Total support',
          value: '',
          valueMinor: minorNumber(analyticsDetails.grossSettledSupport.amount),
          currency: project.currency,
          compare: `${analyticsDetails.periodStart.slice(0, 10)} – ${analyticsDetails.periodEnd.slice(0, 10)}`,
          compareDirection: 'up',
        },
        {
          label: 'Supporters',
          value: '',
          valueNumber: stats.supporters,
          compare: `${analyticsDetails.conversion.confirmedConversions} confirmed conversions`,
          compareDirection: 'up',
        },
        {
          label: 'Monthly recurring',
          value: '',
          valueMinor: minorNumber(analyticsDetails.mrr.amount),
          currency: project.currency,
          compare: 'Current MRR',
          compareDirection: 'up',
        },
      ]
    : legacyMetrics;
  const supportSeries = analyticsDetails?.supportSeries ?? [];
  const growthSeries = analyticsDetails?.growthSeries ?? [];
  const breakdown =
    analyticsDetails?.breakdown.map((row) => ({
      source: row.source,
      gross: '',
      fees: '',
      net: '',
      share: `${row.sharePercent}%`,
      grossMinor: minorNumber(row.gross),
      feesMinor: minorNumber(row.fees),
      netMinor: minorNumber(row.net),
      currency: project.currency,
    })) ?? [];
  const keys = apiKeys.map(({ name, scope, created, lastUsed, createdAt, lastUsedAt }) => ({
    name,
    scope,
    created,
    lastUsed,
    ...(createdAt ? { createdAt } : {}),
    ...(lastUsedAt ? { lastUsedAt } : {}),
  }));
  const links = [
    { label: 'Public page', value: `${publicAppUrl()}/${project.slug}` },
    ...(project.website ? [{ label: 'Website', value: project.website }] : []),
    ...(project.repository ? [{ label: 'Repository', value: project.repository }] : []),
    { label: 'Currency', value: project.currency },
  ];
  return {
    source: 'db',
    project,
    goals,
    threads,
    supporters,
    payments: projectPayments,
    posts,
    tiers,
    team,
    webhooks,
    apiKeys,
    discordMappings,
    exports,
    analytics,
    ...(analyticsDetails ? { analyticsDetails } : {}),
    navGroups: projectNavGroups,
    memberships,
    metrics,
    inbox,
    rankings,
    tools: [],
    chartSeries: supportSeries,
    supportSeries,
    growthSeries,
    breakdown,
    steps: publicOnly ? [] : onboardingSteps,
    ...(publicOnly ? {} : { initialStep }),
    recentPosts: posts,
    links,
    capabilities: publicOnly ? [] : capabilities,
    ...(!publicOnly && connectedAccount
      ? { stripeAccountId: connectedAccount.stripe_account_id }
      : {}),
    ...(!publicOnly && connectedAccount
      ? { chargesEnabled: connectedAccount.charges_enabled }
      : {}),
    ...(!publicOnly && connectedAccount
      ? { payoutsEnabled: connectedAccount.payouts_enabled }
      : {}),
    checkoutDisabled: !paymentsEnabled(readiness),
    ...(discordGuildRow
      ? {
          discordGuild: {
            id: discordGuildRow.discord_guild_id,
            name: discordGuildRow.guild_name ?? '',
            botInstalled: discordGuildRow.bot_installed,
          },
        }
      : {}),
    domainRecords,
    webhookDeliveries: deliveries,
    keys,
    roleRows,
    records: domainRecords,
    endpoints,
    deliveries,
    members: team,
  };
}

export async function loadProjectPageData(
  slug: string,
  options: { publicOnly?: boolean } = { publicOnly: true },
): Promise<ProjectPageData> {
  if (isDemoMode()) return demoProjectData(slug, options.publicOnly !== false);
  const db = requireDatabase();
  const row = await db
    .selectFrom('project')
    .selectAll()
    .where('slug', '=', slug)
    .executeTakeFirst();
  if (!row || (options.publicOnly !== false && row.status !== 'published')) {
    throw error(404, 'Project not found');
  }
  return readProjectData(row, options.publicOnly !== false);
}

const demoTransparencyAggregate: TransparencyAggregate = {
  publishedProjects: 1248,
  settledSupport: [{ currency: 'USD', amountMinor: '240000000' }],
  medianProjectFeePercent: 5,
  guestOneOffSharePercent: 38,
  refundedSupport: [{ currency: 'USD', percent: 0.4 }],
  activeMemberships: 6412,
};

async function readTransparencyAggregate(db: Db, now: Date): Promise<TransparencyAggregate | null> {
  const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [publishedProjects, payments, refunds, disputes, activeMemberships] = await Promise.all([
    db.selectFrom('project').select('id').where('status', '=', 'published').execute(),
    db
      .selectFrom('payment')
      .select([
        'id',
        'user_id',
        'currency',
        'project_amount_minor',
        'oss_project_fee_minor',
        'cadence',
        'status',
        'settled_at',
      ])
      .where('settled_at', 'is not', null)
      .where('settled_at', '>=', periodStart)
      .where('settled_at', '<', now)
      .execute() as Promise<TransparencyPaymentRow[]>,
    db
      .selectFrom('refund')
      .select([
        'payment_id',
        'amount_minor',
        'application_fee_refund_minor',
        'status',
        'created_at',
      ])
      .where('status', '=', 'succeeded')
      .where('created_at', '>=', periodStart)
      .where('created_at', '<', now)
      .execute() as Promise<TransparencyRefundRow[]>,
    db
      .selectFrom('payment_dispute')
      .select(['payment_id', 'amount_minor', 'status', 'created_at'])
      .where('status', 'in', ['open', 'lost'])
      .where('created_at', '>=', periodStart)
      .where('created_at', '<', now)
      .execute() as Promise<TransparencyDisputeRow[]>,
    db.selectFrom('subscription').select('id').where('status', 'in', ['active', 'grace']).execute(),
  ]);
  return buildTransparencyAggregate({
    publishedProjects: publishedProjects.length,
    activeMemberships: activeMemberships.length,
    periodStart,
    periodEnd: now,
    payments,
    refunds,
    disputes,
  });
}

export async function loadTransparencyPageData(
  options: { db?: Db; now?: Date } = {},
): Promise<TransparencyPageData> {
  if (isDemoMode()) return { source: 'demo', state: 'ready', aggregate: demoTransparencyAggregate };
  if (!options.db && !hasDatabaseUrl()) return { source: 'db', state: 'empty' };
  try {
    const aggregate = await readTransparencyAggregate(
      options.db ?? getDb(),
      options.now ?? new Date(),
    );
    return aggregate
      ? { source: 'db', state: 'ready', aggregate }
      : { source: 'db', state: 'empty' };
  } catch {
    return { source: 'db', state: 'error' };
  }
}

/**
 * Load the safe receipt view for an opaque payment id. No user or email data is
 * returned; payment state and entitlement state always come from persisted rows.
 */
export async function loadCheckoutSuccessPageData(
  paymentId: string | null | undefined,
): Promise<CheckoutSuccessPageData> {
  const id = paymentId?.trim();
  if (!id) throw error(400, 'Payment reference is required');

  if (isDemoMode()) {
    return {
      project: demoProject,
      amountMinor: 2500,
      tipMinor: 100,
      cadence: 'monthly',
      tier: 'Supporter',
      entitlement: 'Supporter rewards for 30 days',
      expires: '27 Sep 2026',
      reference: id,
      receiptEmail: '',
      paymentStatus: 'processing',
    };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw error(404, 'Payment not found');
  }

  const db = requireDatabase();
  const payment = await db
    .selectFrom('payment')
    .select([
      'id',
      'project_id',
      'currency',
      'project_amount_minor',
      'platform_tip_minor',
      'cadence',
      'status',
    ])
    .where('id', '=', id)
    .executeTakeFirst();
  if (!payment) throw error(404, 'Payment not found');

  const [projectRow, checkoutIntent, entitlement] = await Promise.all([
    db.selectFrom('project').selectAll().where('id', '=', payment.project_id).executeTakeFirst(),
    db
      .selectFrom('checkout_intent')
      .select(['tier_id'])
      .where('id', '=', payment.id)
      .where('project_id', '=', payment.project_id)
      .executeTakeFirst(),
    db
      .selectFrom('entitlement')
      .select(['tier_id', 'kind', 'ends_at', 'revoked_at'])
      .where('payment_id', '=', payment.id)
      .where('project_id', '=', payment.project_id)
      .orderBy('created_at', 'desc')
      .executeTakeFirst(),
  ]);
  if (!projectRow) throw error(404, 'Payment not found');

  const tierId = entitlement?.tier_id ?? checkoutIntent?.tier_id;
  const tier = tierId
    ? await db
        .selectFrom('tier')
        .select('name')
        .where('id', '=', tierId)
        .where('project_id', '=', payment.project_id)
        .executeTakeFirst()
    : undefined;
  const entitlementLabel = !entitlement
    ? 'No entitlement'
    : entitlement.revoked_at
      ? 'Access revoked'
      : entitlement.kind === 'membership'
        ? 'Membership access'
        : entitlement.kind === 'one_off'
          ? 'One-off access'
          : entitlement.kind || 'Access granted';
  const expires = !entitlement
    ? '—'
    : entitlement.revoked_at
      ? 'Revoked'
      : entitlement.ends_at
        ? dateLabel(entitlement.ends_at)
        : 'Permanent';

  return {
    project: mapDbProjectToUi(projectRow),
    amountMinor: minorNumber(payment.project_amount_minor),
    tipMinor: minorNumber(payment.platform_tip_minor),
    cadence: payment.cadence,
    tier: tier?.name ?? '',
    entitlement: entitlementLabel,
    expires,
    // Keep receipt reference opaque and stable. Do not expose Stripe or user identifiers.
    reference: payment.id,
    receiptEmail: '',
    paymentStatus: checkoutPaymentStatus(payment.status),
  };
}

export async function loadCatalogPageData(): Promise<CatalogPageData> {
  if (isDemoMode()) return { source: 'demo', projects: featuredProjects };
  const db = requireDatabase();
  const rows = await db
    .selectFrom('project')
    .selectAll()
    .where('status', '=', 'published')
    .orderBy('updated_at', 'desc')
    .execute();
  if (rows.length === 0) return { source: 'db', projects: [] };
  const ids = rows.map((row) => row.id);
  const [paymentRows, repositoryRows, featureRows, goalRows, recurringRows] = await Promise.all([
    db
      .selectFrom('payment')
      .select([
        'id',
        'project_id',
        'user_id',
        'currency',
        'cadence',
        'project_amount_minor',
        'status',
        'created_at',
        'settled_at',
      ])
      .where('project_id', 'in', ids)
      .execute(),
    db
      .selectFrom('project_repository')
      .select(['project_id', 'provider', 'url'])
      .where('project_id', 'in', ids)
      .orderBy('created_at', 'asc')
      .execute(),
    db
      .selectFrom('project_feature_mode')
      .select(['project_id', 'mode'])
      .where('project_id', 'in', ids)
      .execute(),
    db
      .selectFrom('project_goal')
      .select('project_id')
      .where('project_id', 'in', ids)
      .where('is_active', '=', true)
      .execute(),
    db
      .selectFrom('tier_price')
      .innerJoin('tier', 'tier.id', 'tier_price.tier_id')
      .select('tier.project_id')
      .where('tier.project_id', 'in', ids)
      .where('tier_price.is_active', '=', true)
      .where('tier_price.cadence', 'in', ['monthly', 'annual'])
      .execute(),
  ]);
  const paymentIds = paymentRows.map((payment) => payment.id);
  const [refundRows, disputeRows] = await Promise.all([
    paymentIds.length
      ? db
          .selectFrom('refund')
          .select(['payment_id', 'amount_minor', 'application_fee_refund_minor', 'status'])
          .where('payment_id', 'in', paymentIds)
          .execute()
      : Promise.resolve([]),
    paymentIds.length
      ? db
          .selectFrom('payment_dispute')
          .select(['payment_id', 'amount_minor', 'status'])
          .where('payment_id', 'in', paymentIds)
          .execute()
      : Promise.resolve([]),
  ]);
  const projectsWithGoals = new Set(goalRows.map((goal) => goal.project_id));
  const projectsWithRecurring = new Set(recurringRows.map((price) => price.project_id));
  return {
    source: 'db',
    projects: rows.map((row) => {
      const repository = repositoryRows.find((item) => item.project_id === row.id);
      const project = projectFromRow(
        row,
        statsFromPayments(
          paymentRows.filter((payment) => payment.project_id === row.id),
          {
            currency: row.default_currency,
            refunds: refundRows,
            disputes: disputeRows,
          },
        ),
        repository?.url ?? '',
        featureRows.find((feature) => feature.project_id === row.id)?.mode,
        repository?.provider ?? '',
      );
      project.hasActiveGoal = projectsWithGoals.has(row.id);
      project.acceptsRecurringSupport = projectsWithRecurring.has(row.id);
      return project;
    }),
  };
}

async function loadSupporterDbData(userId: string): Promise<SupporterPageData> {
  const db = requireDatabase();
  const [user, membershipRows, entitlementRows, paymentRows, threadRows] = await Promise.all([
    db
      .selectFrom('user')
      .select(['name', 'email'])
      .where('id', '=', userId)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('subscription')
      .innerJoin('project', 'project.id', 'subscription.project_id')
      .innerJoin('tier', 'tier.id', 'subscription.tier_id')
      .leftJoin('tier_price', (join) =>
        join
          .onRef('tier_price.tier_id', '=', 'subscription.tier_id')
          .onRef('tier_price.cadence', '=', 'subscription.cadence')
          .on('tier_price.is_active', '=', true),
      )
      .select([
        'subscription.id',
        'subscription.status',
        'subscription.current_period_end',
        'subscription.cadence as subscription_cadence',
        'subscription.project_amount_minor',
        'subscription.platform_tip_minor',
        'subscription.currency as subscription_currency',
        'tier.name as tier_name',
        'tier_price.amount_minor as tier_price_amount_minor',
        'tier_price.currency as tier_price_currency',
        'project.slug as project_slug',
        'project.name as project_name',
      ])
      .where('subscription.user_id', '=', userId)
      .orderBy('subscription.created_at', 'desc')
      .execute(),
    db
      .selectFrom('entitlement')
      .innerJoin('project', 'project.id', 'entitlement.project_id')
      .leftJoin('tier', 'tier.id', 'entitlement.tier_id')
      .select([
        'entitlement.id',
        'entitlement.kind',
        'entitlement.starts_at',
        'entitlement.ends_at',
        'entitlement.revoked_at',
        'tier.name as tier_name',
        'project.name as project_name',
      ])
      .where('entitlement.user_id', '=', userId)
      .orderBy('entitlement.created_at', 'desc')
      .execute(),
    db
      .selectFrom('payment')
      .innerJoin('project', 'project.id', 'payment.project_id')
      .select([
        'payment.id',
        'payment.project_id',
        'payment.user_id',
        'payment.cadence',
        'payment.customer_charge_minor',
        'payment.project_amount_minor',
        'payment.currency',
        'payment.status',
        'payment.created_at',
        'payment.settled_at',
        'project.name as project_name',
      ])
      .where('payment.user_id', '=', userId)
      .execute(),
    db
      .selectFrom('supporter_message_thread')
      .innerJoin('project', 'project.id', 'supporter_message_thread.project_id')
      .select([
        'supporter_message_thread.id',
        'supporter_message_thread.project_id',
        'supporter_message_thread.supporter_user_id',
        'supporter_message_thread.payment_id',
        'supporter_message_thread.status',
        'supporter_message_thread.created_at',
        'supporter_message_thread.updated_at',
        'project.name as project_name',
      ])
      .where('supporter_message_thread.supporter_user_id', '=', userId)
      .orderBy('supporter_message_thread.created_at', 'desc')
      .limit(50)
      .execute(),
  ]);
  const paymentIds = paymentRows.map((payment) => payment.id);
  const [refundRows, disputeRows] = await Promise.all([
    paymentIds.length
      ? db
          .selectFrom('refund')
          .select(['payment_id', 'amount_minor', 'application_fee_refund_minor', 'status'])
          .where('payment_id', 'in', paymentIds)
          .execute()
      : Promise.resolve([]),
    paymentIds.length
      ? db
          .selectFrom('payment_dispute')
          .select(['payment_id', 'amount_minor', 'status'])
          .where('payment_id', 'in', paymentIds)
          .execute()
      : Promise.resolve([]),
  ]);
  const memberships: Membership[] = membershipRows.map((membership) => ({
    id: membership.id,
    projectSlug: membership.project_slug,
    projectName: membership.project_name,
    tierName: membership.tier_name,
    cadence: membership.subscription_cadence === 'annual' ? 'annual' : 'monthly',
    amountMinor: minorNumber(membership.project_amount_minor ?? membership.tier_price_amount_minor),
    currency: currencyCode(membership.subscription_currency ?? membership.tier_price_currency),
    status:
      membership.status === 'active' ||
      membership.status === 'past_due' ||
      membership.status === 'cancelled'
        ? membership.status
        : 'cancelled',
    renewsAt: isoDate(membership.current_period_end),
  }));
  const entitlements: Entitlement[] = entitlementRows.map((entitlement) => {
    const permanent =
      !entitlement.revoked_at && entitlement.ends_at === null && entitlement.kind !== 'membership';
    return {
      id: entitlement.id,
      projectName: entitlement.project_name,
      tierName: entitlement.tier_name ?? 'Supporter',
      reward: entitlement.kind,
      status: entitlement.revoked_at ? 'revoked' : permanent ? 'permanent' : 'active',
      expiresAt: permanent ? 'permanent' : isoDate(entitlement.ends_at),
      permanent,
    };
  });
  const lifetimeSupport = buildSupporterLifetimeSupport(paymentRows, refundRows, disputeRows);
  const messageRows = threadRows.length
    ? await db
        .selectFrom('supporter_message')
        .selectAll()
        .where(
          'thread_id',
          'in',
          threadRows.map((thread) => thread.id),
        )
        .orderBy('created_at', 'asc')
        .execute()
    : [];
  const messagesByThread = new Map<string, typeof messageRows>();
  for (const message of messageRows)
    messagesByThread.set(message.thread_id, [
      ...(messagesByThread.get(message.thread_id) ?? []),
      message,
    ]);
  const paymentById = new Map(paymentRows.map((payment) => [payment.id, payment]));
  const threads: Thread[] = threadRows.map((thread) => {
    const messages = messagesByThread.get(thread.id) ?? [];
    const first = messages[0];
    const preview = first?.body ?? 'No message text';
    const payment = thread.payment_id ? paymentById.get(thread.payment_id) : undefined;
    return {
      id: thread.id,
      subject: preview.length > 72 ? `${preview.slice(0, 69)}…` : preview,
      project: thread.project_name,
      supporter: first?.author_name ?? user.name,
      amountMinor: minorNumber(payment?.customer_charge_minor),
      ...(payment ? { currency: currencyCode(payment.currency) } : {}),
      createdAt: thread.created_at.toISOString(),
      amountLabel: '—',
      cadence:
        payment?.cadence === 'annual'
          ? 'annual'
          : payment?.cadence === 'monthly'
            ? 'monthly'
            : 'one-off',
      relativeTime: '—',
      preview,
      status: thread.status,
      unread: false,
      messages: messages.map((message) => ({
        id: message.id,
        author: message.author_name ?? user.name,
        body: message.body,
        timestamp: message.created_at.toISOString(),
        relativeTime: '—',
      })),
    };
  });
  const platformTipMembership = [...membershipRows]
    .reverse()
    .find(
      (membership) =>
        membership.status === 'active' &&
        (membership.subscription_cadence === 'monthly' ||
          membership.subscription_cadence === 'annual'),
    );
  const platformTipMinor = minorNumber(platformTipMembership?.platform_tip_minor);
  const renewalCalendar: RenewalCalendarEntry[] = membershipRows
    .filter((membership) => membership.current_period_end !== null)
    .map((membership) => ({
      id: membership.id,
      projectSlug: membership.project_slug,
      projectName: membership.project_name,
      tierName: membership.tier_name,
      cadence: membership.subscription_cadence === 'annual' ? 'annual' : 'monthly',
      status: membership.status,
      renewsAt: isoDate(membership.current_period_end),
    }))
    .sort((left, right) => left.renewsAt.localeCompare(right.renewsAt));
  return {
    source: 'db',
    supporterName: user.name,
    supporterEmail: user.email,
    memberships,
    entitlements,
    threads,
    lifetimeSupport,
    renewalCalendar,
    platformTipMinor,
    platformTipMembershipId: platformTipMembership?.id ?? null,
  };
}

export async function loadSupporterPageData(userId?: string): Promise<SupporterPageData> {
  if (isDemoMode()) {
    return {
      source: 'demo',
      supporterName: demoSupporterName,
      supporterEmail: demoSupporterEmail,
      memberships: demoMemberships,
      entitlements: demoEntitlements,
      threads: demoThreads,
      lifetimeSupport: demoLifetimeSupport,
      renewalCalendar: demoMemberships.map((membership) => ({
        id: membership.id,
        projectSlug: membership.projectSlug,
        projectName: membership.projectName,
        tierName: membership.tierName,
        cadence: membership.cadence,
        status: membership.status,
        renewsAt: membership.renewsAt,
      })),
      platformTipMinor: demoPlatformTipMinor,
      platformTipMembershipId:
        demoMemberships.find(
          (membership) =>
            membership.status === 'active' &&
            (membership.cadence === 'monthly' || membership.cadence === 'annual'),
        )?.id ?? null,
    };
  }
  if (!userId) throw error(401, 'Authentication required');
  return loadSupporterDbData(userId);
}

async function loadAdminDbData(): Promise<AdminPageData> {
  const db = requireDatabase();
  const [
    reviewRows,
    caseRows,
    auditRows,
    jobs,
    projects,
    users,
    projectMembers,
    repositories,
    featureRows,
    payments,
    reconciliationRuns,
    reconciliationDifferences,
  ] = await Promise.all([
    db
      .selectFrom('project_review')
      .innerJoin('project', 'project.id', 'project_review.project_id')
      .select([
        'project_review.id',
        'project_review.project_id',
        'project_review.status',
        'project_review.notes',
        'project_review.created_at',
        'project.slug',
        'project.name',
      ])
      .orderBy('project_review.created_at', 'asc')
      .execute(),
    db.selectFrom('admin_case').selectAll().orderBy('created_at', 'desc').execute(),
    db.selectFrom('audit_event').selectAll().orderBy('occurred_at', 'desc').limit(200).execute(),
    db
      .selectFrom('job')
      .selectAll()
      .where('status', '=', 'failed')
      .orderBy('updated_at', 'desc')
      .limit(100)
      .execute(),
    db.selectFrom('project').selectAll().orderBy('updated_at', 'desc').execute(),
    db.selectFrom('user').selectAll().orderBy('created_at', 'asc').execute(),
    db
      .selectFrom('project_member')
      .innerJoin('project', 'project.id', 'project_member.project_id')
      .select(['project_member.user_id', 'project_member.role', 'project.name as project_name'])
      .execute(),
    db.selectFrom('project_repository').selectAll().orderBy('created_at', 'asc').execute(),
    db.selectFrom('project_feature_mode').select(['project_id', 'mode']).execute(),
    db
      .selectFrom('payment')
      .select([
        'id',
        'project_id',
        'user_id',
        'status',
        'currency',
        'project_amount_minor',
        'platform_tip_minor',
        'oss_project_fee_minor',
        'created_at',
        'settled_at',
      ])
      .execute(),
    db
      .selectFrom('reconciliation_run')
      .leftJoin(
        'stripe_connected_account',
        'stripe_connected_account.stripe_account_id',
        'reconciliation_run.stripe_account_id',
      )
      .leftJoin('project', 'project.id', 'stripe_connected_account.project_id')
      .select([
        'reconciliation_run.id',
        'reconciliation_run.stripe_account_id',
        'reconciliation_run.currency',
        'reconciliation_run.period_start',
        'reconciliation_run.status',
        'reconciliation_run.provider_net_minor',
        'reconciliation_run.ledger_net_minor',
        'project.name as project_name',
      ])
      .orderBy('reconciliation_run.period_start', 'desc')
      .orderBy('reconciliation_run.created_at', 'desc')
      .limit(200)
      .execute(),
    db.selectFrom('reconciliation_difference').selectAll().orderBy('created_at', 'asc').execute(),
  ]);
  const queueDays = (created: Date) =>
    Math.max(0, Math.floor((Date.now() - created.getTime()) / 86_400_000));
  const reviewItems: AdminReviewItem[] = reviewRows
    .filter((review) => review.status !== 'approved')
    .map((review) => ({
      id: review.id,
      slug: review.slug,
      name: review.name,
      repository:
        repositories.find((repository) => repository.project_id === review.project_id)?.url ?? '',
      reason: review.notes ?? review.status,
      risk:
        review.status === 'blocked' || review.status === 'rejected'
          ? 'high'
          : review.status === 'pending'
            ? 'medium'
            : 'low',
      submitted: isoDate(review.created_at),
      queueDays: queueDays(review.created_at),
    }));
  const cases: AdminCaseRow[] = caseRows.map((item) => ({
    id: item.id,
    type: item.kind,
    project: item.subject_id,
    status: item.status,
    assignee: item.assigned_to ?? 'Unassigned',
    opened: isoDate(item.created_at),
    summary: item.notes ?? item.kind,
  }));
  const usersById = new Map(users.map((user) => [user.id, user]));
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const auditLog: AdminAuditRow[] = auditRows.map((item) => ({
    time: item.occurred_at.toISOString(),
    actor: item.actor_id ? (usersById.get(item.actor_id)?.email ?? item.actor_id) : item.actor_type,
    action: item.action,
    target:
      item.resource_id && item.resource_type === 'project'
        ? (projectsById.get(item.resource_id)?.slug ?? item.resource_id)
        : (item.resource_id ?? item.resource_type),
    reason: item.reason ?? item.resource_type,
    correlation: item.correlation_id,
  }));
  const directoryProjects: AdminDirectoryProject[] = projects.map((project) => {
    const rows = payments.filter(
      (payment) => payment.project_id === project.id && payment.status === 'succeeded',
    );
    return {
      name: project.name,
      slug: project.slug,
      repository:
        repositories.find((repository) => repository.project_id === project.id)?.url ?? '',
      verified: project.status,
      payments: rows.length > 0 ? 'Ready' : 'No payments',
      supporters: new Set(rows.map((payment) => payment.user_id ?? payment.id)).size,
      feeMode: featureRows.find((feature) => feature.project_id === project.id)?.mode ?? 'unknown',
    };
  });
  const projectsByUser = new Map<string, string[]>();
  for (const member of projectMembers)
    projectsByUser.set(member.user_id, [
      ...(projectsByUser.get(member.user_id) ?? []),
      member.project_name,
    ]);
  const directoryPeople: AdminDirectoryPerson[] = users.map((user) => ({
    name: user.name,
    email: user.email,
    role: projectMembers.find((member) => member.user_id === user.id)?.role ?? 'User',
    projects: projectsByUser.get(user.id)?.join(', ') ?? '',
    signedIn: dateLabel(user.updated_at),
  }));
  const failedJobs: AdminFailedJob[] = jobs.map((job) => ({
    id: job.id,
    kind: job.kind,
    target:
      payloadString(job.payload, 'project_slug') ??
      payloadString(job.payload, 'project_id') ??
      job.queue,
    retries: job.attempt_count,
    lastError: job.last_error ?? 'Unknown failure',
  }));
  const differencesByRun = new Map<string, typeof reconciliationDifferences>();
  for (const difference of reconciliationDifferences) {
    const rows = differencesByRun.get(difference.reconciliation_run_id) ?? [];
    rows.push(difference);
    differencesByRun.set(difference.reconciliation_run_id, rows);
  }
  const reconciliation: AdminReconRow[] = reconciliationRuns.map((run) => {
    const difference = differencesByRun.get(run.id)?.[0];
    const details =
      difference?.details &&
      typeof difference.details === 'object' &&
      !Array.isArray(difference.details)
        ? difference.details
        : null;
    const detailMinor = (key: string, fallback: string | number | bigint | null): number => {
      const value = details?.[key];
      return typeof value === 'string' || typeof value === 'number'
        ? minorNumber(value)
        : minorNumber(fallback);
    };
    const stripeNetMinor = detailMinor(
      'provider_net_minor',
      difference?.actual_minor ?? run.provider_net_minor,
    );
    const ledgerNetMinor = detailMinor(
      'ledger_net_minor',
      difference?.expected_minor ?? run.ledger_net_minor,
    );
    const status: AdminReconRow['status'] =
      run.status === 'matched'
        ? 'aligned'
        : run.status === 'difference' &&
            difference &&
            !['ledger_failure', 'missing_event', 'timing'].includes(difference.classification)
          ? 'mismatch'
          : 'pending';
    return {
      date: run.period_start,
      project: run.project_name ?? run.stripe_account_id,
      currency: run.currency,
      stripeNetMinor,
      ledgerNetMinor,
      status,
    };
  });
  const overviewMetrics = buildAdminOverviewMetrics({
    projects,
    payments,
    reconciliationAvailable: reconciliationRuns.length > 0,
  });
  return {
    source: 'db',
    navGroups: adminNavGroups,
    overviewMetrics,
    reviewQueue: [],
    reconciliation,
    auditLog,
    events: auditLog,
    rows: reconciliation,
    cases,
    reviewItems,
    failedJobs,
    directoryProjects,
    directoryPeople,
    projects: directoryProjects,
    people: directoryPeople,
  };
}

export async function loadAdminPageData(): Promise<AdminPageData> {
  if (isDemoMode()) {
    const cases: AdminCaseRow[] = demoCases.map((item) => ({
      id: item.id,
      type: item.type,
      project: item.project,
      status: item.status,
      assignee: item.assignee,
      opened: item.openedAt,
      summary: item.severity,
    }));
    const auditLog: AdminAuditRow[] = demoAuditEvents.map((item) => ({
      time: item.time,
      actor: item.actor,
      action: item.action,
      target: item.target,
      reason: item.detail,
      correlation: item.id,
    }));
    const reconciliation: AdminReconRow[] = demoReconciliationDiffs.map((item) => ({
      date: item.date,
      project: item.project,
      currency: item.currency,
      stripeNetMinor: item.stripeNetMinor,
      ledgerNetMinor: item.ledgerNetMinor,
      status:
        item.status === 'matched' ? 'aligned' : item.status === 'mismatch' ? 'mismatch' : 'pending',
    }));
    return {
      source: 'demo',
      navGroups: adminNavGroups,
      overviewMetrics: demoAdminOverviewMetrics,
      reviewQueue: demoReviewQueue,
      reconciliation,
      auditLog,
      events: auditLog,
      rows: reconciliation,
      cases,
      reviewItems: demoReviewItems,
      failedJobs: demoFailedJobs,
      directoryProjects: demoDirectoryProjects,
      directoryPeople: demoDirectoryPeople,
      projects: demoDirectoryProjects,
      people: demoDirectoryPeople,
    };
  }
  return loadAdminDbData();
}
