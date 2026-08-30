import type { Goal, Payment, Post, Thread } from '../../fixtures/demo.js';
import type { ChartMarker, ChartSeries, ChartStroke } from '../../components/chartModel.js';
import { demoThreads, formatMoney, formatPercent } from '../../fixtures/demo.js';

export type { ChartSeries } from '../../components/chartModel.js';

export interface InboxPreviewRow {
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
}

export interface RankedSupporter {
  rank: number;
  initial: string;
  name: string;
  cadence: string;
  amount: string;
  amountMinor?: number;
  currency?: string;
}

export interface MembershipPreviewRow {
  name: string;
  tier: string;
  cadence: string;
  amount: string;
  status: string;
  renews: string;
  amountMinor?: number;
  currency?: string;
  renewsAt?: string;
}

export interface TeamPreviewRow {
  name: string;
  email: string;
  role: string;
  lastActive: string;
  lastActiveAt?: string;
}

export interface ApiKeyPreviewRow {
  name: string;
  scope: string;
  created: string;
  lastUsed: string;
  createdAt?: string;
  lastUsedAt?: string;
}

export interface WebhookPreviewRow {
  url: string;
  events: string;
  status: string;
  last: string;
  lastAt?: string;
}

export interface DeliveryPreviewRow {
  id: string;
  event: string;
  target: string;
  code: string;
  time: string;
  timeAt?: string;
}

export interface ToolCard {
  title: string;
  blurb: string;
  href: string;
  cta: string;
}

export const overviewMetrics = [
  { label: 'Total support', value: '$12,841', compare: '+18.2%', compareDirection: 'up' as const },
  { label: 'New supporters', value: '284', compare: '+24.1%', compareDirection: 'up' as const },
  {
    label: 'Monthly recurring',
    value: '$6,421',
    compare: '+22.7%',
    compareDirection: 'up' as const,
  },
];

export const analyticsDemoMetrics = [
  {
    label: 'Total support',
    value: '',
    valueMinor: 1284100,
    currency: 'USD',
    compare: '+18.2%',
    compareDirection: 'up' as const,
  },
  {
    label: 'Supporters',
    value: '',
    valueNumber: 284,
    compare: 'Confirmed accounts',
    compareDirection: 'up' as const,
  },
  {
    label: 'Monthly recurring',
    value: '',
    valueMinor: 642100,
    currency: 'USD',
    compare: '+22.7%',
    compareDirection: 'up' as const,
  },
];

export const supportOverTimeLabels = [
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
];

function projectChartSeries(
  id: string,
  label: string,
  values: number[],
  stroke: ChartStroke = 'solid',
  marker: ChartMarker = 'circle',
): ChartSeries {
  return {
    id,
    label,
    stroke,
    marker,
    points: supportOverTimeLabels.map((pointLabel, index) => ({
      label: pointLabel,
      value: values[index] ?? 0,
    })),
  };
}

export const supportOverTimeSeries: ChartSeries[] = [
  projectChartSeries(
    'one-off',
    'One-off',
    [420, 510, 480, 620, 710, 690, 840, 910, 880, 1040, 1120, 1280],
  ),
  projectChartSeries(
    'monthly',
    'Monthly recurring',
    [2100, 2280, 2410, 2590, 2780, 3010, 3240, 3510, 3780, 4020, 4290, 4580],
    'solid',
    'square',
  ),
  projectChartSeries(
    'annual',
    'Annual',
    [800, 800, 920, 920, 1100, 1100, 1350, 1350, 1620, 1620, 1840, 1841],
    'dashed',
    'diamond',
  ),
];

export const rankedSupporters: RankedSupporter[] = [
  { rank: 1, initial: 'A', name: 'alex_dev', cadence: 'monthly', amount: '$100.00' },
  { rank: 2, initial: 'K', name: 'kohei_rust', cadence: 'one-off', amount: '$100.00' },
  { rank: 3, initial: 'L', name: 'lara_code', cadence: 'monthly', amount: '$25.00' },
  { rank: 4, initial: 'M', name: 'marina_ux', cadence: 'annual', amount: '$25.00' },
  { rank: 5, initial: 'J', name: 'jane_dev', cadence: 'monthly', amount: '$10.00' },
  { rank: 6, initial: 'N', name: 'nia_docs', cadence: 'monthly', amount: '$10.00' },
];

export const toolCards: ToolCard[] = [
  {
    title: 'Discord',
    blurb: 'Grant Discord roles while a Grove membership is active.',
    href: '/grove/discord',
    cta: 'Open Discord',
  },
  {
    title: 'Posts',
    blurb: 'Write updates. Gate some of them by Coffee, Supporter, or Backer.',
    href: '/grove/posts',
    cta: 'Write a post',
  },
  {
    title: 'Webhooks',
    blurb: 'Send signed payment and membership events to Grove servers.',
    href: '/grove/webhooks',
    cta: 'Open webhooks',
  },
  {
    title: 'API',
    blurb: 'Server keys to read payments, members, and Grove project data.',
    href: '/grove/api-keys',
    cta: 'Manage keys',
  },
  {
    title: 'Custom domain',
    blurb: 'Host public Grove pages on grove.dev. Checkout stays on oss.tips.',
    href: '/grove/domains',
    cta: 'Open domains',
  },
];

function goal(partial: Omit<Goal, 'percentLabel'> & { percentLabel?: string }): Goal {
  return {
    ...partial,
    percentLabel:
      partial.percentLabel ?? `${formatPercent(partial.raisedMinor, partial.targetMinor)}%`,
  };
}

export const extraGoals: Goal[] = [
  goal({
    id: 'g3',
    slug: 'a11y-audit',
    title: 'Accessibility audit sprint',
    description: 'Independent WCAG 2.2 AA review of Grove public pages and checkout.',
    targetMinor: 150000,
    raisedMinor: 67000,
    basis: 'before fees',
    deadline: '2026-10-15',
    currency: 'USD',
  }),
  goal({
    id: 'g4',
    slug: 'windows-notes',
    title: 'Windows release-note exporter',
    description: 'Signed Windows installers and notes for the next Grove CLI.',
    targetMinor: 80,
    raisedMinor: 24,
    type: 'active_supporter_count',
    targetCount: 80,
    progressCount: 24,
    basis: 'active supporters',
    currency: 'USD',
  }),
  goal({
    id: 'g5',
    slug: 'i18n-pass',
    title: 'Locale-aware release notes',
    description: 'Dates, money, and changelog copy for English, German, and Japanese.',
    targetMinor: 120000,
    raisedMinor: 18000,
    basis: 'before fees',
    deadline: '2027-01-31',
    currency: 'USD',
  }),
];

export const extraPayments: Payment[] = [
  {
    id: 'pay_12',
    date: '2026-05-17',
    relativeTime: '12 days ago',
    supporter: 'alex_dev',
    amountMinor: 10000,
    currency: 'USD',
    cadence: 'annual',
    status: 'succeeded',
    method: 'Visa ••4242',
    feeMinor: 320,
    netMinor: 9680,
    reference: 'pi_3GroveAlexAnnual',
  },
  {
    id: 'pay_13',
    date: '2026-05-16',
    relativeTime: '13 days ago',
    supporter: 'dylan_builds',
    amountMinor: 500,
    currency: 'USD',
    cadence: 'monthly',
    status: 'succeeded',
    method: 'Visa ••9101',
    feeMinor: 45,
    netMinor: 455,
    reference: 'pi_3GroveDylanRetry',
  },
  {
    id: 'pay_14',
    date: '2026-05-15',
    relativeTime: '14 days ago',
    supporter: 'lara_code',
    amountMinor: 2500,
    currency: 'USD',
    cadence: 'monthly',
    status: 'refunded',
    method: 'Mastercard ••4444',
    feeMinor: 0,
    netMinor: 0,
    reference: 'pi_3GroveLaraRefund',
  },
  {
    id: 'pay_15',
    date: '2026-05-14',
    relativeTime: '15 days ago',
    supporter: 'Guest',
    amountMinor: 2500,
    currency: 'USD',
    cadence: 'one-off',
    status: 'failed',
    method: 'SEPA Debit',
    feeMinor: 0,
    netMinor: 0,
    reference: 'pi_3GroveGuestFail',
  },
];

export const extraPosts: Post[] = [
  {
    id: 'p6',
    slug: 'roadmap-autumn',
    title: 'Autumn roadmap: checks, exports, and Discord sync',
    excerpt: 'What Grove is shipping next for maintainers who live in the dashboard.',
    body: 'Dependency freshness checks get a weekly digest. Release-note exports land as CSV and JSONL. Discord role sync retries failed grants overnight.',
    publishedAt: '2026-05-01',
    publishedLabel: 'May 1, 2026',
    tierVisibility: 'Public',
    author: 'Ada Lovelace',
  },
  {
    id: 'p7',
    slug: 'champion-office-hours',
    title: 'Champion office hours in June',
    excerpt: 'Two live sessions on the Windows exporter and locale-aware notes.',
    body: 'Champion members can book the 12th or the 19th. We will walk through the Windows exporter and the German changelog preview.',
    publishedAt: '2026-04-22',
    publishedLabel: 'Apr 22, 2026',
    tierVisibility: 'Backer+',
    author: 'Marcus Chen',
  },
  {
    id: 'p8',
    slug: 'draft-inbox-notes',
    title: 'Draft: inbox density notes',
    excerpt: 'Internal notes on unread badges, guest replies, and failed renewals.',
    body: 'Keep unread threads at the top. Guest one-off replies should not require an account. Failed Coffee renewals stay in a seven-day grace window.',
    publishedAt: '—',
    publishedLabel: 'Draft',
    tierVisibility: 'Draft',
    author: 'Yuki Sato',
  },
];

export const extraThreads: Thread[] = [
  {
    id: 't7',
    subject: 'Early-release access',
    project: 'Grove',
    supporter: 'priya_oss',
    amountMinor: 1000,
    amountLabel: '$10.00',
    cadence: 'monthly',
    relativeTime: '8 days ago',
    preview: 'Thanks for the early-release access. The CLI notes look great.',
    status: 'resolved',
    messages: [
      {
        id: 'm12',
        author: 'priya_oss',
        body: 'Thanks for the early-release access. The CLI notes look great.',
        timestamp: '2026-05-21T16:10:00Z',
        relativeTime: '8 days ago',
      },
    ],
  },
  {
    id: 't8',
    subject: 'Duplicate May receipt',
    project: 'Grove',
    supporter: 'nia_docs',
    amountMinor: 1000,
    amountLabel: '$10.00',
    cadence: 'monthly',
    relativeTime: '9 days ago',
    preview: 'Receipt for the May renewal landed twice in my inbox.',
    status: 'resolved',
    messages: [
      {
        id: 'm13',
        author: 'nia_docs',
        body: 'Receipt for the May renewal landed twice in my inbox.',
        timestamp: '2026-05-20T11:42:00Z',
        relativeTime: '9 days ago',
      },
      {
        id: 'm14',
        author: 'Grove team',
        body: 'The second mail was a Stripe retry. Only one charge settled.',
        timestamp: '2026-05-20T13:05:00Z',
        relativeTime: '9 days ago',
      },
    ],
  },
  {
    id: 't9',
    subject: 'Switching to annual Backer',
    project: 'Grove',
    supporter: 'jane_dev',
    amountMinor: 1000,
    amountLabel: '$10.00',
    cadence: 'monthly',
    relativeTime: '10 days ago',
    preview: 'Can I switch from monthly Supporter to annual Backer mid-cycle?',
    status: 'awaiting reply',
    unread: true,
    messages: [
      {
        id: 'm15',
        author: 'jane_dev',
        body: 'Can I switch from monthly Supporter to annual Backer mid-cycle?',
        timestamp: '2026-05-19T08:18:00Z',
        relativeTime: '10 days ago',
      },
    ],
  },
  {
    id: 't10',
    subject: 'Thank-you on the wall',
    project: 'Grove',
    supporter: 'opensourcefan',
    amountMinor: 1500,
    amountLabel: '$15.00',
    cadence: 'monthly',
    relativeTime: '11 days ago',
    preview: 'Posted a thank-you on the wall. Keep the release notes coming.',
    status: 'resolved',
    messages: [
      {
        id: 'm16',
        author: 'opensourcefan',
        body: 'Posted a thank-you on the wall. Keep the release notes coming.',
        timestamp: '2026-05-18T19:04:00Z',
        relativeTime: '11 days ago',
      },
    ],
  },
];

export const inboxThreads: Thread[] = [...demoThreads, ...extraThreads];

export function inboxPreviewFromThread(thread: Thread): InboxPreviewRow {
  return {
    id: thread.id,
    initial: thread.supporter.slice(0, 1).toUpperCase(),
    name: thread.supporter,
    snippet: thread.preview,
    amount: thread.amountLabel,
    time: thread.relativeTime,
    unread: thread.unread ?? false,
    ...(thread.amountMinor > 0
      ? { amountMinor: thread.amountMinor, currency: thread.currency ?? 'USD' }
      : {}),
    ...(thread.createdAt ? { timeAt: thread.createdAt } : {}),
  };
}

export const inboxPreviewRows: InboxPreviewRow[] = inboxThreads.map(inboxPreviewFromThread);

export const supporterGrowthSeries: ChartSeries[] = [
  projectChartSeries('new', 'New supporters', [12, 18, 15, 22, 28, 24, 31, 36, 33, 41, 44, 48]),
  projectChartSeries(
    'active',
    'Active supporters',
    [148, 160, 171, 186, 198, 209, 221, 236, 248, 259, 271, 284],
    'solid',
    'square',
  ),
  projectChartSeries(
    'churned',
    'Churned',
    [3, 2, 4, 3, 5, 2, 4, 3, 2, 4, 3, 2],
    'dashed',
    'diamond',
  ),
];

export const analyticsBreakdown = [
  { source: 'Monthly Backer', gross: '$4,210', fees: '$168', net: '$4,042', share: '32.8%' },
  { source: 'Annual Champion', gross: '$3,180', fees: '$127', net: '$3,053', share: '24.8%' },
  { source: 'One-off gifts', gross: '$2,640', fees: '$106', net: '$2,534', share: '20.6%' },
  { source: 'Monthly Coffee', gross: '$1,620', fees: '$65', net: '$1,555', share: '12.6%' },
  { source: 'Annual Supporter', gross: '$1,191', fees: '$48', net: '$1,143', share: '9.3%' },
];

export const apiKeyRows: ApiKeyPreviewRow[] = [
  {
    name: 'production-read',
    scope: 'read:payments',
    created: '2026-03-01',
    lastUsed: '2026-05-29',
  },
  { name: 'ci-tests', scope: 'read:project', created: '2026-04-15', lastUsed: '2026-05-20' },
  {
    name: 'webhooks-replay',
    scope: 'write:webhooks',
    created: '2026-02-12',
    lastUsed: '2026-05-28',
  },
  { name: 'exports-finance', scope: 'read:exports', created: '2026-01-03', lastUsed: '2026-05-18' },
  {
    name: 'discord-sync',
    scope: 'read:memberships',
    created: '2026-01-22',
    lastUsed: '2026-05-29',
  },
  { name: 'staging-sandbox', scope: 'read:project', created: '2026-05-01', lastUsed: '2026-05-25' },
];

export const discordRoleRows = [
  { tier: 'Coffee', role: 'supporters', members: '142', lastSync: '2026-05-29 09:14' },
  { tier: 'Supporter', role: 'supporter', members: '88', lastSync: '2026-05-29 09:14' },
  { tier: 'Backer', role: 'backer', members: '31', lastSync: '2026-05-29 09:14' },
  { tier: 'Champion', role: 'champion', members: '19', lastSync: '2026-05-28 18:02' },
  { tier: 'Alumni', role: 'past-supporters', members: '54', lastSync: '2026-05-20 11:40' },
];

export const domainRows = [
  { host: 'grove.dev', type: 'Apex', status: 'Active', target: 'cname.oss.tips' },
  { host: 'www.grove.dev', type: 'WWW', status: 'Active', target: 'cname.oss.tips' },
  {
    host: '_oss-tips.grove.dev',
    type: 'TXT',
    status: 'Verified',
    target: 'oss-tips-verify=pl-9f2c',
  },
  { host: 'support.grove.dev', type: 'CNAME', status: 'Pending', target: 'pages.oss.tips' },
  { host: 'docs.grove.dev', type: 'CNAME', status: 'Active', target: 'pages.oss.tips' },
];

export interface ExportPreviewRow {
  type: string;
  range: string;
  format: string;
  status: string;
  downloadUrl?: string;
  expiresAt?: string;
}

export const exportRows: ExportPreviewRow[] = [
  {
    type: 'payments',
    range: 'May 2026',
    format: 'CSV',
    status: 'ready',
    downloadUrl: '/api/v1/project/exports/demo-payments/download?project_slug=grove',
    expiresAt: '2026-09-30T00:00:00.000Z',
  },
  {
    type: 'memberships',
    range: 'All time',
    format: 'CSV',
    status: 'ready',
    downloadUrl: '/api/v1/project/exports/demo-memberships/download?project_slug=grove',
    expiresAt: '2026-09-30T00:00:00.000Z',
  },
  {
    type: 'supporters',
    range: 'Last 30 days',
    format: 'JSON',
    status: 'ready',
    downloadUrl: '/api/v1/project/exports/demo-supporters-json/download?project_slug=grove',
    expiresAt: '2026-09-30T00:00:00.000Z',
  },
  {
    type: 'payments',
    range: '2026 YTD',
    format: 'CSV',
    status: 'expired',
    expiresAt: '2026-08-01T00:00:00.000Z',
  },
  { type: 'memberships', range: 'Last 90 days', format: 'CSV', status: 'pending' },
  { type: 'supporters', range: '2026 YTD', format: 'CSV', status: 'failed' },
];

export const membershipRows: MembershipPreviewRow[] = [
  {
    name: 'alex_dev',
    tier: 'Champion',
    cadence: 'monthly',
    amount: formatMoney(10000),
    status: 'active',
    renews: '2026-06-29',
  },
  {
    name: 'marina_ux',
    tier: 'Backer',
    cadence: 'annual',
    amount: formatMoney(25000),
    status: 'active',
    renews: '2027-03-01',
  },
  {
    name: 'kohei_rust',
    tier: 'Champion',
    cadence: 'one-off',
    amount: formatMoney(10000),
    status: 'entitled',
    renews: '—',
  },
  {
    name: 'lara_code',
    tier: 'Backer',
    cadence: 'monthly',
    amount: formatMoney(2500),
    status: 'active',
    renews: '2026-06-15',
  },
  {
    name: 'dylan_builds',
    tier: 'Coffee',
    cadence: 'monthly',
    amount: formatMoney(500),
    status: 'past_due',
    renews: '2026-05-23',
  },
  {
    name: 'jane_dev',
    tier: 'Supporter',
    cadence: 'monthly',
    amount: formatMoney(1000),
    status: 'active',
    renews: '2026-06-20',
  },
];

export const onboardingSteps = [
  {
    step: '1',
    label: 'Identity',
    detail: '',
    detailKey: 'identity' as const,
    detailValue: 'Grove',
    status: 'Complete',
  },
  {
    step: '2',
    label: 'Ownership',
    detail: 'github.com/oss-tips/grove',
    detailKey: 'ownership' as const,
    status: 'In progress',
  },
  {
    step: '3',
    label: 'Stripe',
    detail: '',
    detailKey: 'stripe' as const,
    detailValue: 'connected',
    status: 'Waiting',
  },
  {
    step: '4',
    label: 'Page & tiers',
    detail: '',
    detailKey: 'tiers' as const,
    detailValue: 4,
    status: 'Waiting',
  },
  {
    step: '5',
    label: 'Publish',
    detail: '',
    detailKey: 'publish' as const,
    detailValue: 'draft',
    status: 'Waiting',
  },
];

export const teamRows: TeamPreviewRow[] = [
  { name: 'Ada Lovelace', email: 'ada@grove.dev', role: 'Owner', lastActive: 'Just now' },
  { name: 'Marcus Chen', email: 'marcus@grove.dev', role: 'Finance', lastActive: '2h ago' },
  { name: 'Yuki Sato', email: 'yuki@grove.dev', role: 'Editor', lastActive: 'Yesterday' },
  { name: 'Noor Aziz', email: 'noor@grove.dev', role: 'Community', lastActive: '2d ago' },
  { name: 'Devon Kole', email: 'devon@grove.dev', role: 'Analyst', lastActive: '5d ago' },
  { name: 'Helena Ruiz', email: 'helena@grove.dev', role: 'Editor', lastActive: '1w ago' },
];

export const webhookRows: WebhookPreviewRow[] = [
  {
    url: 'https://api.grove.dev/hooks',
    events: 'payment.*, membership.*',
    status: 'Active',
    last: '2m ago',
  },
  {
    url: 'https://api.grove.dev/discord',
    events: 'entitlement.*',
    status: 'Active',
    last: '14m ago',
  },
  {
    url: 'https://hooks.grove.dev/ledger',
    events: 'ledger.posted',
    status: 'Failing',
    last: '1h ago',
  },
  {
    url: 'https://ci.grove.dev/oss-tips',
    events: 'payment.succeeded',
    status: 'Active',
    last: '3h ago',
  },
  {
    url: 'https://ops.grove.dev/alerts',
    events: 'domain.*, webhook.failed',
    status: 'Paused',
    last: '2d ago',
  },
];

export const webhookDeliveries: DeliveryPreviewRow[] = [
  {
    id: 'del_91',
    event: 'payment.succeeded',
    target: 'api.grove.dev/hooks',
    code: '200',
    time: '2m ago',
  },
  {
    id: 'del_90',
    event: 'membership.renewed',
    target: 'api.grove.dev/hooks',
    code: '200',
    time: '14m ago',
  },
  {
    id: 'del_89',
    event: 'ledger.posted',
    target: 'hooks.grove.dev/ledger',
    code: '502',
    time: '1h ago',
  },
  {
    id: 'del_88',
    event: 'entitlement.granted',
    target: 'api.grove.dev/discord',
    code: '200',
    time: '3h ago',
  },
  {
    id: 'del_87',
    event: 'payment.refunded',
    target: 'api.grove.dev/hooks',
    code: '200',
    time: '1d ago',
  },
];

export const stripeCapabilityRows = [
  { capability: 'card_payments', status: 'Active', detail: 'Restricted' },
  { capability: 'transfers', status: 'Active', detail: 'Restricted' },
  { capability: 'payouts', status: 'Restricted', detail: 'Restricted' },
  { capability: 'sepa_debit_payments', status: 'Pending', detail: 'Restricted' },
  { capability: 'link_payments', status: 'Active', detail: 'Restricted' },
];

export const settingsLinks = [
  { label: 'Public page', value: 'https://oss.tips/grove' },
  { label: 'Website', value: 'https://grove.dev' },
  { label: 'Repository', value: 'github.com/oss-tips/grove' },
  { label: 'Support email', value: 'hello@grove.dev' },
  { label: 'Currency', value: 'USD' },
];
