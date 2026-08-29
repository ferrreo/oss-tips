import type { Goal, Payment, Post, Thread } from '../../fixtures/demo.js';

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  values: number[];
}

export interface InboxPreviewRow {
  id: string;
  initial: string;
  name: string;
  snippet: string;
  amount: string;
  time: string;
  unread?: boolean;
}

export interface RankedSupporter {
  rank: number;
  initial: string;
  name: string;
  cadence: string;
  amount: string;
}

export interface ToolCard {
  title: string;
  blurb: string;
  href: string;
}

export const overviewMetrics = [
  { label: 'Total support', value: '$12,841', compare: '+18.2%', compareDirection: 'up' as const },
  { label: 'New supporters', value: '284', compare: '+24.1%', compareDirection: 'up' as const },
  { label: 'MRR', value: '$6,421', compare: '+22.7%', compareDirection: 'up' as const },
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

export const supportOverTimeSeries: ChartSeries[] = [
  {
    id: 'one-off',
    label: 'One-off',
    color: 'var(--pl-forest)',
    values: [420, 510, 480, 620, 710, 690, 840, 910, 880, 1040, 1120, 1280],
  },
  {
    id: 'monthly',
    label: 'Monthly recurring',
    color: 'var(--pl-moss)',
    values: [2100, 2280, 2410, 2590, 2780, 3010, 3240, 3510, 3780, 4020, 4290, 4580],
  },
  {
    id: 'annual',
    label: 'Annual',
    color: 'var(--pl-ochre)',
    dashed: true,
    values: [800, 800, 920, 920, 1100, 1100, 1350, 1350, 1620, 1620, 1840, 1841],
  },
];

export const inboxPreviewRows: InboxPreviewRow[] = [
  {
    id: 'in1',
    initial: 'H',
    name: 'Helena R.',
    snippet: 'Does the annual tier include all Sapling rewards?',
    amount: '$100',
    time: '2h',
    unread: true,
  },
  {
    id: 'in2',
    initial: 'Y',
    name: 'Yuki S.',
    snippet: 'Could you confirm the entitlement duration for my one-off gift?',
    amount: '$50',
    time: '1d',
  },
  {
    id: 'in3',
    initial: 'A',
    name: 'Ada L.',
    snippet: 'Thanks for the early-release access — the tokens look great.',
    amount: '$25',
    time: '1d',
    unread: true,
  },
  {
    id: 'in4',
    initial: 'M',
    name: 'Marcus T.',
    snippet: 'Receipt for August renewal landed twice in my inbox.',
    amount: '$10',
    time: '2d',
  },
  {
    id: 'in5',
    initial: 'D',
    name: 'Devon K.',
    snippet: 'Can I switch from monthly Seed to annual Sapling mid-cycle?',
    amount: '$5',
    time: '3d',
    unread: true,
  },
  {
    id: 'in6',
    initial: 'N',
    name: 'Noor A.',
    snippet: 'Posted a thank-you on the wall — keep the docs coming.',
    amount: '$15',
    time: '4d',
  },
];

export const rankedSupporters: RankedSupporter[] = [
  { rank: 1, initial: 'H', name: 'Helena R.', cadence: 'annual', amount: '$100' },
  { rank: 2, initial: 'Y', name: 'Yuki S.', cadence: 'one-off', amount: '$50' },
  { rank: 3, initial: 'A', name: 'Ada L.', cadence: 'monthly', amount: '$25' },
  { rank: 4, initial: 'N', name: 'Noor A.', cadence: 'monthly', amount: '$15' },
  { rank: 5, initial: 'M', name: 'Marcus T.', cadence: 'monthly', amount: '$10' },
  { rank: 6, initial: 'D', name: 'Devon K.', cadence: 'monthly', amount: '$5' },
];

export const toolCards: ToolCard[] = [
  {
    title: 'Discord',
    blurb: 'Give Discord roles when someone is an active member.',
    href: '/grove/discord',
  },
  {
    title: 'Posts',
    blurb: 'Write updates. Gate some of them by tier.',
    href: '/grove/posts',
  },
  {
    title: 'Webhooks',
    blurb: 'Get signed payment and membership events in your own app.',
    href: '/grove/webhooks',
  },
  {
    title: 'API',
    blurb: 'Server keys to read payments, members, and project data.',
    href: '/grove/api-keys',
  },
  {
    title: 'Custom domain',
    blurb: 'Host public pages on your domain. Checkout stays on oss.tips.',
    href: '/grove/domains',
  },
];

export const extraGoals: Goal[] = [
  {
    id: 'g3',
    slug: 'a11y-audit',
    title: 'Accessibility audit sprint',
    description: 'Independent WCAG 2.2 AA review of dashboard and checkout.',
    targetMinor: 150000,
    raisedMinor: 67000,
    basis: 'before fees',
    deadline: '2026-10-15',
    currency: 'GBP',
  },
  {
    id: 'g4',
    slug: 'token-library',
    title: 'Token library expansion',
    description: 'Ship density, motion, and chart tokens for dense operator views.',
    targetMinor: 80000,
    raisedMinor: 24000,
    basis: 'active supporters',
    currency: 'GBP',
  },
  {
    id: 'g5',
    slug: 'i18n-pass',
    title: 'Internationalisation pass',
    description: 'Locale-aware money, dates, and copy for EN, DE, and JA.',
    targetMinor: 120000,
    raisedMinor: 18000,
    basis: 'before fees',
    deadline: '2027-01-31',
    currency: 'GBP',
  },
];

export const extraPayments: Payment[] = [
  {
    id: 'pay_5',
    date: '2026-08-23',
    supporter: 'Helena R.',
    amountMinor: 10000,
    currency: 'GBP',
    cadence: 'annual',
    status: 'succeeded',
  },
  {
    id: 'pay_6',
    date: '2026-08-22',
    supporter: 'Devon K.',
    amountMinor: 500,
    currency: 'GBP',
    cadence: 'monthly',
    status: 'succeeded',
  },
  {
    id: 'pay_7',
    date: '2026-08-21',
    supporter: 'Noor A.',
    amountMinor: 1500,
    currency: 'GBP',
    cadence: 'monthly',
    status: 'refunded',
  },
  {
    id: 'pay_8',
    date: '2026-08-20',
    supporter: 'Guest',
    amountMinor: 2500,
    currency: 'GBP',
    cadence: 'one-off',
    status: 'failed',
  },
];

export const extraPosts: Post[] = [
  {
    id: 'p4',
    slug: 'roadmap-autumn',
    title: 'Autumn roadmap: charts, exports, and Discord sync',
    excerpt: 'What we are shipping next for operators who live in the dashboard.',
    publishedAt: '2026-08-05',
    tierVisibility: 'Public',
  },
  {
    id: 'p5',
    slug: 'canopy-office-hours',
    title: 'Canopy office hours in September',
    excerpt: 'Two live sessions on adapter polish and token contribution.',
    publishedAt: '2026-07-28',
    tierVisibility: 'Canopy',
  },
  {
    id: 'p6',
    slug: 'draft-brand-notes',
    title: 'Draft: brand-board dashboard notes',
    excerpt: 'Internal notes on metric cards, inbox density, and tool tiles.',
    publishedAt: '—',
    tierVisibility: 'Draft',
  },
];

export const extraThreads: Thread[] = [
  {
    id: 't3',
    subject: 'Thanks for early-release access',
    project: 'Grove',
    amountMinor: 2500,
    cadence: 'monthly',
    unread: true,
    messages: [
      {
        id: 'm4',
        author: 'Ada L.',
        body: 'Thanks for the early-release access — the tokens look great.',
        timestamp: '2026-08-26T16:10:00Z',
      },
    ],
  },
  {
    id: 't4',
    subject: 'Duplicate August receipt',
    project: 'Grove',
    amountMinor: 1000,
    cadence: 'monthly',
    messages: [
      {
        id: 'm5',
        author: 'Marcus T.',
        body: 'Receipt for August renewal landed twice in my inbox.',
        timestamp: '2026-08-25T11:42:00Z',
      },
      {
        id: 'm6',
        author: 'Grove team',
        body: 'The second mail was a Stripe retry. Only one charge settled.',
        timestamp: '2026-08-25T13:05:00Z',
      },
    ],
  },
  {
    id: 't5',
    subject: 'Switching to annual Sapling',
    project: 'Grove',
    amountMinor: 500,
    cadence: 'monthly',
    unread: true,
    messages: [
      {
        id: 'm7',
        author: 'Devon K.',
        body: 'Can I switch from monthly Seed to annual Sapling mid-cycle?',
        timestamp: '2026-08-24T08:18:00Z',
      },
    ],
  },
  {
    id: 't6',
    subject: 'Thank-you on the wall',
    project: 'Grove',
    amountMinor: 1500,
    cadence: 'monthly',
    messages: [
      {
        id: 'm8',
        author: 'Noor A.',
        body: 'Posted a thank-you on the wall — keep the docs coming.',
        timestamp: '2026-08-23T19:04:00Z',
      },
    ],
  },
];

export const supporterGrowthSeries: ChartSeries[] = [
  {
    id: 'new',
    label: 'New supporters',
    color: 'var(--pl-forest)',
    values: [12, 18, 15, 22, 28, 24, 31, 36, 33, 41, 44, 48],
  },
  {
    id: 'active',
    label: 'Active supporters',
    color: 'var(--pl-moss)',
    values: [148, 160, 171, 186, 198, 209, 221, 236, 248, 259, 271, 284],
  },
  {
    id: 'churned',
    label: 'Churned',
    color: 'var(--pl-ochre)',
    dashed: true,
    values: [3, 2, 4, 3, 5, 2, 4, 3, 2, 4, 3, 2],
  },
];

export const analyticsBreakdown = [
  { source: 'Monthly Sapling', gross: '$4,210', fees: '$168', net: '$4,042', share: '32.8%' },
  { source: 'Annual Canopy', gross: '$3,180', fees: '$127', net: '$3,053', share: '24.8%' },
  { source: 'One-off gifts', gross: '$2,640', fees: '$106', net: '$2,534', share: '20.6%' },
  { source: 'Monthly Seed', gross: '$1,620', fees: '$65', net: '$1,555', share: '12.6%' },
  { source: 'Annual Sapling', gross: '$1,191', fees: '$48', net: '$1,143', share: '9.3%' },
];

export const apiKeyRows = [
  { name: 'production-read', scope: 'read:payments', created: '2026-06-01', lastUsed: '2026-08-27' },
  { name: 'ci-tests', scope: 'read:project', created: '2026-07-15', lastUsed: '2026-08-20' },
  { name: 'webhooks-replay', scope: 'write:webhooks', created: '2026-05-12', lastUsed: '2026-08-26' },
  { name: 'exports-finance', scope: 'read:exports', created: '2026-04-03', lastUsed: '2026-08-18' },
  { name: 'discord-sync', scope: 'read:memberships', created: '2026-03-22', lastUsed: '2026-08-27' },
  { name: 'staging-sandbox', scope: 'read:project', created: '2026-08-01', lastUsed: '2026-08-25' },
];

export const discordRoleRows = [
  { tier: 'Seed', role: 'supporters', members: '142', lastSync: '2026-08-27 09:14' },
  { tier: 'Sapling', role: 'sapling', members: '88', lastSync: '2026-08-27 09:14' },
  { tier: 'Canopy', role: 'canopy', members: '31', lastSync: '2026-08-27 09:14' },
  { tier: 'Annual bonus', role: 'annual-circle', members: '19', lastSync: '2026-08-26 18:02' },
  { tier: 'Alumni', role: 'past-supporters', members: '54', lastSync: '2026-08-20 11:40' },
];

export const domainRows = [
  { host: 'grove.dev', type: 'Apex', status: 'Active', target: 'cname.oss.tips' },
  { host: 'www.grove.dev', type: 'WWW', status: 'Active', target: 'cname.oss.tips' },
  { host: '_oss-tips.grove.dev', type: 'TXT', status: 'Verified', target: 'oss-tips-verify=pl-9f2c' },
  { host: 'support.grove.dev', type: 'CNAME', status: 'Pending', target: 'pages.oss.tips' },
  { host: 'docs.grove.dev', type: 'CNAME', status: 'Active', target: 'pages.oss.tips' },
];

export const exportRows = [
  { type: 'Payments', range: 'August 2026', format: 'CSV', status: 'Ready' },
  { type: 'Memberships', range: 'All time', format: 'CSV', status: 'Ready' },
  { type: 'Ledger events', range: 'Last 30 days', format: 'JSONL', status: 'Ready' },
  { type: 'Supporters', range: 'All time', format: 'CSV', status: 'Ready' },
  { type: 'Refunds & disputes', range: '2026 YTD', format: 'CSV', status: 'Ready' },
  { type: 'Fee breakdown', range: 'Last 90 days', format: 'CSV', status: 'Queued' },
];

export const membershipRows = [
  { name: 'Helena R.', tier: 'Canopy', cadence: 'annual', amount: '£100.00', status: 'Active', renews: '2027-03-01' },
  { name: 'Ada L.', tier: 'Canopy', cadence: 'monthly', amount: '£25.00', status: 'Active', renews: '2026-09-15' },
  { name: 'Yuki S.', tier: 'Sapling', cadence: 'one-off', amount: '£50.00', status: 'Entitled', renews: '—' },
  { name: 'Noor A.', tier: 'Sapling', cadence: 'monthly', amount: '£15.00', status: 'Active', renews: '2026-09-12' },
  { name: 'Marcus T.', tier: 'Seed', cadence: 'monthly', amount: '£10.00', status: 'Past due', renews: '2026-08-25' },
  { name: 'Devon K.', tier: 'Seed', cadence: 'monthly', amount: '£5.00', status: 'Active', renews: '2026-09-20' },
];

export const onboardingSteps = [
  { step: '1', label: 'Identity', detail: 'Grove · grove.dev', status: 'Complete' },
  { step: '2', label: 'Ownership', detail: 'github.com/oss-tips/grove', status: 'In progress' },
  { step: '3', label: 'Stripe', detail: 'acct_1Grove · charges enabled', status: 'Waiting' },
  { step: '4', label: 'Page & tiers', detail: 'Seed, Sapling, Canopy drafted', status: 'Waiting' },
  { step: '5', label: 'Publish', detail: 'Directory listing after first payment', status: 'Waiting' },
];

export const teamRows = [
  { name: 'Ada Lovelace', email: 'ada@grove.dev', role: 'Owner', lastActive: 'Just now' },
  { name: 'Marcus Chen', email: 'marcus@grove.dev', role: 'Finance', lastActive: '2h ago' },
  { name: 'Yuki Sato', email: 'yuki@grove.dev', role: 'Editor', lastActive: 'Yesterday' },
  { name: 'Noor Aziz', email: 'noor@grove.dev', role: 'Community', lastActive: '2d ago' },
  { name: 'Devon Kole', email: 'devon@grove.dev', role: 'Analyst', lastActive: '5d ago' },
  { name: 'Helena Ruiz', email: 'helena@grove.dev', role: 'Editor', lastActive: '1w ago' },
];

export const webhookRows = [
  { url: 'https://api.grove.dev/hooks', events: 'payment.*, membership.*', status: 'Active', last: '2m ago' },
  { url: 'https://api.grove.dev/discord', events: 'entitlement.*', status: 'Active', last: '14m ago' },
  { url: 'https://hooks.grove.dev/ledger', events: 'ledger.posted', status: 'Failing', last: '1h ago' },
  { url: 'https://ci.grove.dev/oss-tips', events: 'payment.succeeded', status: 'Active', last: '3h ago' },
  { url: 'https://ops.grove.dev/alerts', events: 'domain.*, webhook.failed', status: 'Paused', last: '2d ago' },
];

export const webhookDeliveries = [
  { id: 'del_91', event: 'payment.succeeded', target: 'api.grove.dev/hooks', code: '200', time: '2m ago' },
  { id: 'del_90', event: 'membership.renewed', target: 'api.grove.dev/hooks', code: '200', time: '14m ago' },
  { id: 'del_89', event: 'ledger.posted', target: 'hooks.grove.dev/ledger', code: '502', time: '1h ago' },
  { id: 'del_88', event: 'entitlement.granted', target: 'api.grove.dev/discord', code: '200', time: '3h ago' },
  { id: 'del_87', event: 'payment.refunded', target: 'api.grove.dev/hooks', code: '200', time: '1d ago' },
];

export const stripeCapabilityRows = [
  { capability: 'card_payments', status: 'Active', detail: 'Charges enabled' },
  { capability: 'transfers', status: 'Active', detail: 'Platform application fees' },
  { capability: 'payouts', status: 'Restricted', detail: 'Identity document requested' },
  { capability: 'sepa_debit_payments', status: 'Pending', detail: 'Available after payouts' },
  { capability: 'link_payments', status: 'Active', detail: 'Checkout wallets' },
];

export const settingsLinks = [
  { label: 'Public page', value: 'https://oss.tips/grove' },
  { label: 'Website', value: 'https://grove.dev' },
  { label: 'Repository', value: 'github.com/oss-tips/grove' },
  { label: 'Support email', value: 'hello@grove.dev' },
  { label: 'Currency', value: 'GBP' },
];
