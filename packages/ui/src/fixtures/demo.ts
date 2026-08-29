export interface Tier {
  id: string;
  name: string;
  description: string;
  monthlyMinor: number;
  annualMinor: number;
  oneOffMinor: number;
  memberLimit?: number;
  popular?: boolean;
  rewards: string[];
}

export interface Goal {
  id: string;
  slug: string;
  title: string;
  description: string;
  targetMinor: number;
  raisedMinor: number;
  basis: string;
  deadline?: string;
  currency: string;
  percentLabel: string;
}

export interface Supporter {
  id: string;
  displayName: string;
  handle: string;
  amountMinor: number;
  cadence: 'one-off' | 'monthly' | 'annual';
  public: boolean;
  message: string;
  relativeTime: string;
  supportedAt: string;
  currency: string;
  tierName: string;
  avatarLetter: string;
}

export interface Payment {
  id: string;
  date: string;
  relativeTime: string;
  supporter: string;
  amountMinor: number;
  currency: string;
  cadence: string;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded';
  method: string;
  feeMinor: number;
  netMinor: number;
  reference: string;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  publishedAt: string;
  publishedLabel: string;
  tierVisibility: string;
  author: string;
}

export interface ThreadMessage {
  id: string;
  author: string;
  body: string;
  timestamp: string;
  relativeTime: string;
  internal?: boolean;
}

export interface Thread {
  id: string;
  subject: string;
  project: string;
  supporter: string;
  amountMinor: number;
  amountLabel: string;
  cadence: string;
  relativeTime: string;
  preview: string;
  status: string;
  messages: ThreadMessage[];
  unread?: boolean;
}

export interface Project {
  slug: string;
  name: string;
  description: string;
  website: string;
  repository: string;
  verified: boolean;
  currency: string;
  feeMode: 'standard' | 'project_5pct';
  logoLetter: string;
  tags: string[];
  stats: {
    supporters: number;
    monthlyRecurringMinor: number;
    oneOffThisMonthMinor: number;
    totalSupportMinor: number;
  };
}

export interface Membership {
  id: string;
  projectSlug: string;
  projectName: string;
  tierName: string;
  cadence: 'monthly' | 'annual';
  amountMinor: number;
  currency: string;
  status: 'active' | 'past_due' | 'cancelled';
  renewsAt: string;
  renewsLabel: string;
}

export interface Entitlement {
  id: string;
  projectName: string;
  tierName: string;
  reward: string;
  status: string;
  expiresAt: string;
  expiresLabel: string;
  permanent?: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  badge?: number;
  active?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface Metrics {
  totalSupportMinor: number;
  totalSupportLabel: string;
  newSupporters: number;
  newSupportersDeltaPercent: number;
  newSupportersDeltaLabel: string;
  mrrMinor: number;
  mrrLabel: string;
  mrrDeltaPercent: number;
  mrrDeltaLabel: string;
  currency: string;
  periodLabel: string;
  unansweredInbox: number;
  unansweredInboxLabel: string;
}

export interface ChartPoint {
  date: string;
  label: string;
  total: number;
  oneOff: number;
  recurring: number;
}

export interface ChartSeries {
  label: string;
  range: string;
  currency: string;
  points: ChartPoint[];
}

export interface ActivityEntry {
  id: string;
  type: string;
  title: string;
  detail: string;
  actor: string;
  relativeTime: string;
  timestamp: string;
  amountLabel: string;
  href: string;
}

export interface TopSupporter {
  rank: number;
  id: string;
  displayName: string;
  handle: string;
  amountMinor: number;
  amountLabel: string;
  currency: string;
  cadence: string;
  supportCount: number;
  since: string;
}

export interface AdminQueueItem {
  id: string;
  project: string;
  projectSlug: string;
  reason: string;
  submitted: string;
  relativeTime: string;
  risk: string;
  action: string;
  reviewer: string;
}

export interface ReconciliationDiff {
  id: string;
  date: string;
  project: string;
  stripeNetMinor: number;
  ledgerNetMinor: number;
  deltaMinor: number;
  stripeLabel: string;
  ledgerLabel: string;
  deltaLabel: string;
  currency: string;
  status: string;
  note: string;
}

export interface AuditEvent {
  id: string;
  time: string;
  relativeTime: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
}

export interface AdminCase {
  id: string;
  type: string;
  project: string;
  status: string;
  assignee: string;
  openedAt: string;
  relativeTime: string;
  severity: string;
}

export interface ReferrerRow {
  source: string;
  sessions: number;
  supporters: number;
  conversionLabel: string;
  sharePercent: number;
}

export interface CountryRow {
  country: string;
  countryCode: string;
  supporters: number;
  amountMinor: number;
  amountLabel: string;
  sharePercent: number;
}

export interface RetentionCohort {
  cohort: string;
  monthLabel: string;
  started: number;
  retained: number;
  retentionPercent: number;
}

export interface Analytics {
  referrers: ReferrerRow[];
  countries: CountryRow[];
  retention: RetentionCohort[];
  netRevenue30dMinor: number;
  netRevenue30dLabel: string;
  newSupporters30d: number;
  churnPercent: number;
  churnLabel: string;
  periodLabel: string;
  currency: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string;
  status: string;
  lastDelivery: string;
}

export interface ApiKey {
  id: string;
  name: string;
  scope: string;
  created: string;
  lastUsed: string;
}

export interface DiscordRoleMapping {
  tier: string;
  role: string;
}

export interface ExportJob {
  type: string;
  range: string;
  action: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function chartLabel(year: number, monthIndex: number, day: number): string {
  const month = MONTHS[monthIndex];
  if (!month) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return `${month} ${day}`;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function buildDemoChartSeries(): ChartSeries {
  const recurringStart = 218400;
  const recurringEnd = 642100;
  const oneOffStart = 186200;
  const oneOffEnd = 642000;
  const points: ChartPoint[] = [];

  for (let i = 0; i < 30; i += 1) {
    const utc = new Date(Date.UTC(2026, 3, 30 + i));
    const year = utc.getUTCFullYear();
    const monthIndex = utc.getUTCMonth();
    const day = utc.getUTCDate();
    const t = smoothstep(i / 29);
    const recWave = Math.sin(i * 0.85) * (1 - t) * 0.03;
    const offWave = Math.sin(i * 1.25 + 0.4) * (1 - t) * 0.045;
    let recurring = Math.round(lerp(recurringStart, recurringEnd, Math.min(1, Math.max(0, t + recWave))));
    let oneOff = Math.round(lerp(oneOffStart, oneOffEnd, Math.min(1, Math.max(0, t + offWave))));
    if (i === 29) {
      recurring = recurringEnd;
      oneOff = oneOffEnd;
    }
    points.push({
      date: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      label: chartLabel(year, monthIndex, day),
      total: recurring + oneOff,
      oneOff,
      recurring,
    });
  }

  return {
    label: 'Support — one-off vs recurring',
    range: 'Apr 30 – May 29 · America/Los_Angeles',
    currency: 'USD',
    points,
  };
}

export const demoProject: Project = {
  slug: 'paperlight',
  name: 'Paperlight',
  description:
    'A warm design system and UI toolkit for open-source project support. Built for clarity, accessibility, and financial transparency.',
  website: 'https://paperlight.dev',
  repository: 'github.com/oss-tips/paperlight',
  verified: true,
  currency: 'USD',
  feeMode: 'standard',
  logoLetter: 'P',
  tags: ['design-system', 'svelte', 'typescript'],
  stats: {
    supporters: 284,
    monthlyRecurringMinor: 642100,
    oneOffThisMonthMinor: 642000,
    totalSupportMinor: 1284100,
  },
};

export const demoTiers: Tier[] = [
  {
    id: 'coffee',
    name: 'Coffee',
    description: 'Buy the maintainers a coffee and get a public thank-you.',
    monthlyMinor: 500,
    annualMinor: 5000,
    oneOffMinor: 500,
    rewards: ['Public thank-you on the wall', 'Supporter newsletter'],
  },
  {
    id: 'supporter',
    name: 'Supporter',
    description: 'Early access to releases and supporter-only posts.',
    monthlyMinor: 1000,
    annualMinor: 10000,
    oneOffMinor: 1000,
    popular: true,
    rewards: ['All Coffee rewards', 'Early releases', 'Supporter-only posts'],
  },
  {
    id: 'backer',
    name: 'Backer',
    description: 'Priority replies and a named credit in the docs.',
    monthlyMinor: 2500,
    annualMinor: 25000,
    oneOffMinor: 2500,
    rewards: ['All Supporter rewards', 'Priority inbox replies', 'Named docs credit'],
  },
  {
    id: 'champion',
    name: 'Champion',
    description: 'Roadmap input and a private working session each quarter.',
    monthlyMinor: 10000,
    annualMinor: 100000,
    oneOffMinor: 10000,
    memberLimit: 25,
    rewards: ['All Backer rewards', 'Quarterly working session', 'Roadmap voting'],
  },
];

export const demoGoals: Goal[] = [
  {
    id: 'g1',
    slug: 'infrastructure-upgrade',
    title: 'Infrastructure upgrade',
    description: 'Move production to dedicated Postgres, object storage, and a second region for supporter checkout.',
    targetMinor: 7500000,
    raisedMinor: 4523000,
    basis: 'before fees',
    deadline: '2026-09-30',
    currency: 'USD',
    percentLabel: '60%',
  },
  {
    id: 'g2',
    slug: 'documentation-overhaul',
    title: 'Documentation overhaul',
    description: 'Rewrite the getting-started guides, add illustrated recipes, and ship a searchable component cookbook.',
    targetMinor: 3000000,
    raisedMinor: 1860000,
    basis: 'active supporters',
    deadline: '2026-11-15',
    currency: 'USD',
    percentLabel: '62%',
  },
];

export const demoSupporters: Supporter[] = [
  {
    id: 's1',
    displayName: 'alex_dev',
    handle: 'alex_dev',
    amountMinor: 10000,
    cadence: 'monthly',
    public: true,
    message: 'Paperlight made our docs feel like a product. Happy to keep this going.',
    relativeTime: '2 hours ago',
    supportedAt: '2026-05-29T16:12:00Z',
    currency: 'USD',
    tierName: 'Champion',
    avatarLetter: 'A',
  },
  {
    id: 's2',
    displayName: 'lara_code',
    handle: 'lara_code',
    amountMinor: 2500,
    cadence: 'monthly',
    public: true,
    message: 'The token docs finally match what ships. Backing the overhaul.',
    relativeTime: '5 hours ago',
    supportedAt: '2026-05-29T13:40:00Z',
    currency: 'USD',
    tierName: 'Backer',
    avatarLetter: 'L',
  },
  {
    id: 's3',
    displayName: 'jane_dev',
    handle: 'jane_dev',
    amountMinor: 1000,
    cadence: 'monthly',
    public: true,
    message: 'Monthly Supporter here — Storybook coverage is the real gift.',
    relativeTime: 'yesterday',
    supportedAt: '2026-05-28T09:18:00Z',
    currency: 'USD',
    tierName: 'Supporter',
    avatarLetter: 'J',
  },
  {
    id: 's4',
    displayName: 'opensourcefan',
    handle: 'opensourcefan',
    amountMinor: 5000,
    cadence: 'one-off',
    public: true,
    message: 'One-off for the infrastructure goal. Ship the second region.',
    relativeTime: 'yesterday',
    supportedAt: '2026-05-28T18:05:00Z',
    currency: 'USD',
    tierName: 'Backer',
    avatarLetter: 'O',
  },
  {
    id: 's5',
    displayName: 'priya_oss',
    handle: 'priya_oss',
    amountMinor: 1000,
    cadence: 'monthly',
    public: true,
    message: 'Clear fees at checkout. That alone is worth $10 a month.',
    relativeTime: '2 days ago',
    supportedAt: '2026-05-27T11:22:00Z',
    currency: 'USD',
    tierName: 'Supporter',
    avatarLetter: 'P',
  },
  {
    id: 's6',
    displayName: 'dylan_builds',
    handle: 'dylan_builds',
    amountMinor: 500,
    cadence: 'monthly',
    public: true,
    message: 'Coffee tier while I evaluate the SvelteKit adapter.',
    relativeTime: '3 days ago',
    supportedAt: '2026-05-26T08:44:00Z',
    currency: 'USD',
    tierName: 'Coffee',
    avatarLetter: 'D',
  },
  {
    id: 's7',
    displayName: 'marina_ux',
    handle: 'marina_ux',
    amountMinor: 2500,
    cadence: 'annual',
    public: true,
    message: 'Annual Backer. The contrast theme work is excellent.',
    relativeTime: '4 days ago',
    supportedAt: '2026-05-25T15:01:00Z',
    currency: 'USD',
    tierName: 'Backer',
    avatarLetter: 'M',
  },
  {
    id: 's8',
    displayName: 'kohei_rust',
    handle: 'kohei_rust',
    amountMinor: 10000,
    cadence: 'one-off',
    public: true,
    message: 'Champion one-off after the webhook retries saved a launch.',
    relativeTime: '5 days ago',
    supportedAt: '2026-05-24T19:33:00Z',
    currency: 'USD',
    tierName: 'Champion',
    avatarLetter: 'K',
  },
  {
    id: 's9',
    displayName: 'nia_docs',
    handle: 'nia_docs',
    amountMinor: 1000,
    cadence: 'monthly',
    public: true,
    message: 'Writing the cookbook with you. Supporter posts are gold.',
    relativeTime: '1 week ago',
    supportedAt: '2026-05-22T10:09:00Z',
    currency: 'USD',
    tierName: 'Supporter',
    avatarLetter: 'N',
  },
  {
    id: 's10',
    displayName: 'Anonymous',
    handle: 'anonymous',
    amountMinor: 500,
    cadence: 'monthly',
    public: false,
    message: 'Chose not to leave a public note.',
    relativeTime: '1 week ago',
    supportedAt: '2026-05-21T21:14:00Z',
    currency: 'USD',
    tierName: 'Coffee',
    avatarLetter: 'A',
  },
];

export const demoPayments: Payment[] = [
  {
    id: 'pay_1',
    date: '2026-05-29',
    relativeTime: '2 hours ago',
    supporter: 'alex_dev',
    amountMinor: 10000,
    currency: 'USD',
    cadence: 'monthly',
    status: 'succeeded',
    method: 'Visa ••4242',
    feeMinor: 590,
    netMinor: 9410,
    reference: 'pi_3PaperlightAlex',
  },
  {
    id: 'pay_2',
    date: '2026-05-29',
    relativeTime: '5 hours ago',
    supporter: 'lara_code',
    amountMinor: 2500,
    currency: 'USD',
    cadence: 'monthly',
    status: 'succeeded',
    method: 'Mastercard ••4444',
    feeMinor: 203,
    netMinor: 2297,
    reference: 'pi_3PaperlightLara',
  },
  {
    id: 'pay_3',
    date: '2026-05-28',
    relativeTime: 'yesterday',
    supporter: 'opensourcefan',
    amountMinor: 5000,
    currency: 'USD',
    cadence: 'one-off',
    status: 'succeeded',
    method: 'Link',
    feeMinor: 275,
    netMinor: 4725,
    reference: 'pi_3PaperlightFan',
  },
  {
    id: 'pay_4',
    date: '2026-05-28',
    relativeTime: 'yesterday',
    supporter: 'jane_dev',
    amountMinor: 1000,
    currency: 'USD',
    cadence: 'monthly',
    status: 'succeeded',
    method: 'Visa ••1881',
    feeMinor: 159,
    netMinor: 841,
    reference: 'pi_3PaperlightJane',
  },
  {
    id: 'pay_5',
    date: '2026-05-27',
    relativeTime: '2 days ago',
    supporter: 'priya_oss',
    amountMinor: 1000,
    currency: 'USD',
    cadence: 'monthly',
    status: 'succeeded',
    method: 'Apple Pay',
    feeMinor: 159,
    netMinor: 841,
    reference: 'pi_3PaperlightPriya',
  },
  {
    id: 'pay_6',
    date: '2026-05-26',
    relativeTime: '3 days ago',
    supporter: 'Guest',
    amountMinor: 2000,
    currency: 'USD',
    cadence: 'one-off',
    status: 'pending',
    method: 'SEPA Debit',
    feeMinor: 80,
    netMinor: 1920,
    reference: 'pi_3PaperlightGuest',
  },
  {
    id: 'pay_7',
    date: '2026-05-25',
    relativeTime: '4 days ago',
    supporter: 'marina_ux',
    amountMinor: 2500,
    currency: 'USD',
    cadence: 'annual',
    status: 'succeeded',
    method: 'Visa ••0018',
    feeMinor: 203,
    netMinor: 2297,
    reference: 'pi_3PaperlightMarina',
  },
  {
    id: 'pay_8',
    date: '2026-05-24',
    relativeTime: '5 days ago',
    supporter: 'kohei_rust',
    amountMinor: 10000,
    currency: 'USD',
    cadence: 'one-off',
    status: 'succeeded',
    method: 'ACH',
    feeMinor: 80,
    netMinor: 9920,
    reference: 'pi_3PaperlightKohei',
  },
  {
    id: 'pay_9',
    date: '2026-05-23',
    relativeTime: '6 days ago',
    supporter: 'dylan_builds',
    amountMinor: 500,
    currency: 'USD',
    cadence: 'monthly',
    status: 'failed',
    method: 'Visa ••9101',
    feeMinor: 0,
    netMinor: 0,
    reference: 'pi_3PaperlightDylan',
  },
  {
    id: 'pay_10',
    date: '2026-05-22',
    relativeTime: '1 week ago',
    supporter: 'nia_docs',
    amountMinor: 1000,
    currency: 'USD',
    cadence: 'monthly',
    status: 'succeeded',
    method: 'Google Pay',
    feeMinor: 159,
    netMinor: 841,
    reference: 'pi_3PaperlightNia',
  },
  {
    id: 'pay_11',
    date: '2026-05-18',
    relativeTime: '11 days ago',
    supporter: 'opensourcefan',
    amountMinor: 500,
    currency: 'USD',
    cadence: 'one-off',
    status: 'refunded',
    method: 'Link',
    feeMinor: 0,
    netMinor: 0,
    reference: 'pi_3PaperlightFanRefund',
  },
];

export const demoPosts: Post[] = [
  {
    id: 'p1',
    slug: 'infrastructure-goal-update',
    title: 'Infrastructure goal: 60% and the second region is scoped',
    excerpt: 'Checkout failover plan, object-storage cutover, and what $45,230 has already bought.',
    body: 'We signed the second-region contract and started the object-storage cutover. The remaining $29,770 funds replica Postgres and a warm checkout failover. Progress is measured before fees so the public number matches the ledger.',
    publishedAt: '2026-05-28',
    publishedLabel: 'May 28, 2026',
    tierVisibility: 'Public',
    author: 'Ada Lovelace',
  },
  {
    id: 'p2',
    slug: 'paperlight-1-0',
    title: 'Paperlight 1.0 design tokens shipped',
    excerpt: 'Semantic colour tokens, typography stacks, and motion defaults are now stable.',
    body: 'Semantic colour tokens, typography stacks, and motion defaults are now stable across light, dark, and contrast themes. Components read `--pl-*` custom properties so Storybook and production stay aligned.',
    publishedAt: '2026-05-20',
    publishedLabel: 'May 20, 2026',
    tierVisibility: 'Public',
    author: 'Marcus Chen',
  },
  {
    id: 'p3',
    slug: 'storybook-preview',
    title: 'Storybook preview for every product route',
    excerpt: 'Every product page now has a Storybook story with realistic fixtures.',
    body: 'Supporters on the Supporter tier and above can preview every dashboard and public route with the branded demo dataset before we cut a release.',
    publishedAt: '2026-05-15',
    publishedLabel: 'May 15, 2026',
    tierVisibility: 'Supporter+',
    author: 'Yuki Sato',
  },
  {
    id: 'p4',
    slug: 'fee-transparency',
    title: 'How we disclose fees before checkout',
    excerpt: 'A walkthrough of the support composer fee disclosure module.',
    body: 'The composer always shows the project amount, the oss.tips project fee, an optional tip, and the payment method before Stripe Checkout opens. No vanity totals.',
    publishedAt: '2026-05-08',
    publishedLabel: 'May 8, 2026',
    tierVisibility: 'Public',
    author: 'Ada Lovelace',
  },
  {
    id: 'p5',
    slug: 'docs-cookbook-wip',
    title: 'Documentation overhaul is at 62%',
    excerpt: 'Illustrated recipes and the searchable cookbook are in review.',
    body: 'The getting-started rewrite is live in draft. Illustrated recipes for Goal, Tier, and Inbox land next. Backer credits appear on the cookbook colophon.',
    publishedAt: '2026-05-02',
    publishedLabel: 'May 2, 2026',
    tierVisibility: 'Backer+',
    author: 'nia_docs',
  },
];

export const demoThreads: Thread[] = [
  {
    id: 't1',
    subject: 'Question about annual billing',
    project: 'Paperlight',
    supporter: 'marina_ux',
    amountMinor: 2500,
    amountLabel: '$25.00',
    cadence: 'annual',
    relativeTime: '2 hours ago',
    preview: 'Does the annual Backer tier include all Supporter rewards?',
    status: 'awaiting reply',
    unread: true,
    messages: [
      {
        id: 'm1',
        author: 'marina_ux',
        body: 'Does the annual Backer tier include all Supporter rewards, or only the extras listed on the card?',
        timestamp: '2026-05-29T14:30:00Z',
        relativeTime: '4 hours ago',
      },
      {
        id: 'm2',
        author: 'Paperlight team',
        body: 'Annual Backer includes every Coffee and Supporter reward, plus priority replies and the docs credit.',
        timestamp: '2026-05-29T16:15:00Z',
        relativeTime: '2 hours ago',
      },
    ],
  },
  {
    id: 't2',
    subject: 'Receipt for one-off support',
    project: 'Paperlight',
    supporter: 'opensourcefan',
    amountMinor: 5000,
    amountLabel: '$50.00',
    cadence: 'one-off',
    relativeTime: 'yesterday',
    preview: 'Could you confirm the entitlement duration for my one-off gift?',
    status: 'open',
    unread: true,
    messages: [
      {
        id: 'm3',
        author: 'opensourcefan',
        body: 'Could you confirm the entitlement duration for my $50 one-off toward the infrastructure goal?',
        timestamp: '2026-05-28T09:00:00Z',
        relativeTime: 'yesterday',
      },
    ],
  },
  {
    id: 't3',
    subject: 'Champion working session dates',
    project: 'Paperlight',
    supporter: 'alex_dev',
    amountMinor: 10000,
    amountLabel: '$100.00',
    cadence: 'monthly',
    relativeTime: '2 days ago',
    preview: 'Can we book the June working session for the second-region cutover?',
    status: 'awaiting reply',
    unread: true,
    messages: [
      {
        id: 'm4',
        author: 'alex_dev',
        body: 'Can we book the June Champion working session around the second-region cutover? I have the 12th or 19th free.',
        timestamp: '2026-05-27T17:40:00Z',
        relativeTime: '2 days ago',
      },
      {
        id: 'm5',
        author: 'Paperlight team',
        body: 'Internal: prefer the 19th so replicas are live first.',
        timestamp: '2026-05-27T18:02:00Z',
        relativeTime: '2 days ago',
        internal: true,
      },
    ],
  },
  {
    id: 't4',
    subject: 'Failed renewal on Coffee',
    project: 'Paperlight',
    supporter: 'dylan_builds',
    amountMinor: 500,
    amountLabel: '$5.00',
    cadence: 'monthly',
    relativeTime: '3 days ago',
    preview: 'My $5 renewal failed — is access paused?',
    status: 'open',
    messages: [
      {
        id: 'm6',
        author: 'dylan_builds',
        body: 'My $5 Coffee renewal failed on the 23rd. Is access paused, or do I have a grace window?',
        timestamp: '2026-05-26T08:50:00Z',
        relativeTime: '3 days ago',
      },
      {
        id: 'm7',
        author: 'Paperlight team',
        body: 'You have a 7-day grace window. Update the card and the retry will restore Coffee rewards automatically.',
        timestamp: '2026-05-26T10:05:00Z',
        relativeTime: '3 days ago',
      },
    ],
  },
  {
    id: 't5',
    subject: 'Named credit spelling',
    project: 'Paperlight',
    supporter: 'lara_code',
    amountMinor: 2500,
    amountLabel: '$25.00',
    cadence: 'monthly',
    relativeTime: '5 days ago',
    preview: 'Please list me as Lara Code, not lara_code, in the cookbook.',
    status: 'resolved',
    messages: [
      {
        id: 'm8',
        author: 'lara_code',
        body: 'Please list me as Lara Code, not lara_code, in the cookbook colophon.',
        timestamp: '2026-05-24T12:18:00Z',
        relativeTime: '5 days ago',
      },
      {
        id: 'm9',
        author: 'Paperlight team',
        body: 'Updated. The next docs deploy will show Lara Code under Backer credits.',
        timestamp: '2026-05-24T13:41:00Z',
        relativeTime: '5 days ago',
      },
    ],
  },
  {
    id: 't6',
    subject: 'Webhook retry after launch',
    project: 'Paperlight',
    supporter: 'kohei_rust',
    amountMinor: 10000,
    amountLabel: '$100.00',
    cadence: 'one-off',
    relativeTime: '1 week ago',
    preview: 'The signed webhook retries unblocked our launch. Thank you.',
    status: 'resolved',
    messages: [
      {
        id: 'm10',
        author: 'kohei_rust',
        body: 'The signed webhook retries unblocked our launch last week. Champion one-off is on me — thank you.',
        timestamp: '2026-05-22T19:33:00Z',
        relativeTime: '1 week ago',
      },
      {
        id: 'm11',
        author: 'Paperlight team',
        body: 'Glad the retries held. Receipt and Champion entitlements are on your wall.',
        timestamp: '2026-05-22T20:10:00Z',
        relativeTime: '1 week ago',
      },
    ],
  },
];

export const demoMemberships: Membership[] = [
  {
    id: 'mem1',
    projectSlug: 'paperlight',
    projectName: 'Paperlight',
    tierName: 'Supporter',
    cadence: 'monthly',
    amountMinor: 1000,
    currency: 'USD',
    status: 'active',
    renewsAt: '2026-06-15',
    renewsLabel: 'Jun 15, 2026',
  },
  {
    id: 'mem2',
    projectSlug: 'vitest-run',
    projectName: 'vitest-run',
    tierName: 'Maintainer',
    cadence: 'annual',
    amountMinor: 12000,
    currency: 'USD',
    status: 'active',
    renewsAt: '2027-03-01',
    renewsLabel: 'Mar 1, 2027',
  },
];

export const demoEntitlements: Entitlement[] = [
  {
    id: 'e1',
    projectName: 'Paperlight',
    tierName: 'Supporter',
    reward: 'Early releases and supporter-only posts',
    status: 'active',
    expiresAt: '2026-06-15',
    expiresLabel: 'Jun 15, 2026',
  },
  {
    id: 'e2',
    projectName: 'vitest-run',
    tierName: 'Maintainer',
    reward: 'Private maintainer Discord and CI credits',
    status: 'active',
    expiresAt: '2027-03-01',
    expiresLabel: 'Mar 1, 2027',
  },
  {
    id: 'e3',
    projectName: 'Paperlight',
    tierName: 'Coffee',
    reward: 'Public thank-you on the wall',
    status: 'permanent',
    expiresAt: 'permanent',
    expiresLabel: 'Permanent',
    permanent: true,
  },
];

export const featuredProjects: Project[] = [
  demoProject,
  {
    slug: 'vitest-run',
    name: 'vitest-run',
    description: 'Fast integration test runner for monorepos.',
    website: 'https://vitest-run.dev',
    repository: 'github.com/oss-tips/vitest-run',
    verified: true,
    currency: 'USD',
    feeMode: 'project_5pct',
    logoLetter: 'V',
    tags: ['testing', 'nodejs'],
    stats: {
      supporters: 412,
      monthlyRecurringMinor: 890000,
      oneOffThisMonthMinor: 120000,
      totalSupportMinor: 1010000,
    },
  },
  {
    slug: 'ledger-kit',
    name: 'ledger-kit',
    description: 'Double-entry ledger primitives for SaaS billing.',
    website: 'https://ledger-kit.dev',
    repository: 'github.com/oss-tips/ledger-kit',
    verified: false,
    currency: 'EUR',
    feeMode: 'standard',
    logoLetter: 'L',
    tags: ['finance', 'typescript'],
    stats: {
      supporters: 98,
      monthlyRecurringMinor: 245000,
      oneOffThisMonthMinor: 45000,
      totalSupportMinor: 290000,
    },
  },
];

export const projectNavGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Overview', href: '/paperlight', active: true }],
  },
  {
    label: 'Support',
    items: [
      { label: 'Inbox', href: '/paperlight/inbox', badge: 3 },
      { label: 'Supporters', href: '/paperlight/supporters' },
      { label: 'Payments', href: '/paperlight/payments' },
      { label: 'Memberships', href: '/paperlight/memberships' },
    ],
  },
  {
    label: 'Engage',
    items: [
      { label: 'Posts', href: '/paperlight/posts' },
      { label: 'Supporter wall', href: '/paperlight/wall' },
      { label: 'Discord', href: '/paperlight/discord' },
    ],
  },
  {
    label: 'Grow',
    items: [
      { label: 'Goals', href: '/paperlight/goals' },
      { label: 'Analytics', href: '/paperlight/analytics' },
    ],
  },
  {
    label: 'Develop',
    items: [
      { label: 'Webhooks', href: '/paperlight/webhooks' },
      { label: 'API keys', href: '/paperlight/api-keys' },
      { label: 'Domains', href: '/paperlight/domains' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { label: 'Team', href: '/paperlight/team' },
      { label: 'Stripe', href: '/paperlight/stripe' },
      { label: 'Settings', href: '/paperlight/settings' },
    ],
  },
];

export const adminNavGroups: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      { label: 'Overview', href: '/admin', active: true },
      { label: 'Review queue', href: '/admin/review', badge: 7 },
      { label: 'Directory', href: '/admin/directory' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Reconciliation', href: '/admin/reconciliation' },
      { label: 'Cases', href: '/admin/cases', badge: 2 },
    ],
  },
  {
    label: 'Audit',
    items: [{ label: 'Audit log', href: '/admin/audit' }],
  },
];

export const demoMetrics: Metrics = {
  totalSupportMinor: 1284100,
  totalSupportLabel: '$12,841',
  newSupporters: 284,
  newSupportersDeltaPercent: 24.1,
  newSupportersDeltaLabel: '+24.1%',
  mrrMinor: 642100,
  mrrLabel: '$6,421',
  mrrDeltaPercent: 22.7,
  mrrDeltaLabel: '+22.7%',
  currency: 'USD',
  periodLabel: 'Last 30 days',
  unansweredInbox: 3,
  unansweredInboxLabel: '3 unanswered',
};

export const demoChartSeries: ChartSeries = buildDemoChartSeries();

export const demoTopSupporters: TopSupporter[] = [
  {
    rank: 1,
    id: 's1',
    displayName: 'alex_dev',
    handle: 'alex_dev',
    amountMinor: 10000,
    amountLabel: '$100.00',
    currency: 'USD',
    cadence: 'monthly',
    supportCount: 14,
    since: 'Apr 2025',
  },
  {
    rank: 2,
    id: 's8',
    displayName: 'kohei_rust',
    handle: 'kohei_rust',
    amountMinor: 10000,
    amountLabel: '$100.00',
    currency: 'USD',
    cadence: 'one-off',
    supportCount: 3,
    since: 'Jan 2026',
  },
  {
    rank: 3,
    id: 's4',
    displayName: 'opensourcefan',
    handle: 'opensourcefan',
    amountMinor: 5000,
    amountLabel: '$50.00',
    currency: 'USD',
    cadence: 'one-off',
    supportCount: 6,
    since: 'Aug 2025',
  },
  {
    rank: 4,
    id: 's2',
    displayName: 'lara_code',
    handle: 'lara_code',
    amountMinor: 2500,
    amountLabel: '$25.00',
    currency: 'USD',
    cadence: 'monthly',
    supportCount: 11,
    since: 'Jun 2025',
  },
  {
    rank: 5,
    id: 's7',
    displayName: 'marina_ux',
    handle: 'marina_ux',
    amountMinor: 2500,
    amountLabel: '$25.00',
    currency: 'USD',
    cadence: 'annual',
    supportCount: 2,
    since: 'May 2025',
  },
];

export const demoActivity: ActivityEntry[] = [
  {
    id: 'act1',
    type: 'payment',
    title: 'Champion renewal from alex_dev',
    detail: 'Monthly Champion membership settled.',
    actor: 'alex_dev',
    relativeTime: '2 hours ago',
    timestamp: '2026-05-29T16:12:00Z',
    amountLabel: '$100.00',
    href: '/paperlight/payments',
  },
  {
    id: 'act2',
    type: 'inbox',
    title: 'New reply in annual billing thread',
    detail: 'marina_ux asked whether annual Backer includes Supporter rewards.',
    actor: 'marina_ux',
    relativeTime: '4 hours ago',
    timestamp: '2026-05-29T14:30:00Z',
    amountLabel: '$25.00',
    href: '/paperlight/inbox',
  },
  {
    id: 'act3',
    type: 'goal',
    title: 'Infrastructure upgrade reached $45,230',
    detail: '60% of the $75,000 target, measured before fees.',
    actor: 'opensourcefan',
    relativeTime: 'yesterday',
    timestamp: '2026-05-28T18:05:00Z',
    amountLabel: '$50.00',
    href: '/paperlight/goals',
  },
  {
    id: 'act4',
    type: 'post',
    title: 'Published infrastructure goal update',
    detail: 'Public post on the second-region cutover.',
    actor: 'Ada Lovelace',
    relativeTime: 'yesterday',
    timestamp: '2026-05-28T11:00:00Z',
    amountLabel: 'Public',
    href: '/paperlight/posts',
  },
  {
    id: 'act5',
    type: 'supporter',
    title: 'jane_dev joined at Supporter',
    detail: 'New monthly membership at $10.',
    actor: 'jane_dev',
    relativeTime: 'yesterday',
    timestamp: '2026-05-28T09:18:00Z',
    amountLabel: '$10.00',
    href: '/paperlight/supporters',
  },
  {
    id: 'act6',
    type: 'payment',
    detail: 'Card declined; 7-day grace window started.',
    title: 'Coffee renewal failed for dylan_builds',
    actor: 'dylan_builds',
    relativeTime: '6 days ago',
    timestamp: '2026-05-23T08:12:00Z',
    amountLabel: '$5.00',
    href: '/paperlight/payments',
  },
];

export const demoAdminQueue: AdminQueueItem[] = [
  {
    id: 'rq1',
    project: 'ledger-kit',
    projectSlug: 'ledger-kit',
    reason: 'Duplicate repository claim',
    submitted: '2026-05-27',
    relativeTime: '2 days ago',
    risk: 'high',
    action: 'Review',
    reviewer: 'Unassigned',
  },
  {
    id: 'rq2',
    project: 'fake-react',
    projectSlug: 'fake-react',
    reason: 'Impersonation indicator',
    submitted: '2026-05-26',
    relativeTime: '3 days ago',
    risk: 'critical',
    action: 'Review',
    reviewer: 'ops@oss.tips',
  },
  {
    id: 'rq3',
    project: 'new-cli-tool',
    projectSlug: 'new-cli-tool',
    reason: 'First payment activation',
    submitted: '2026-05-25',
    relativeTime: '4 days ago',
    risk: 'medium',
    action: 'Review',
    reviewer: 'Unassigned',
  },
  {
    id: 'rq4',
    project: 'quick-charts',
    projectSlug: 'quick-charts',
    reason: 'Website challenge pending',
    submitted: '2026-05-24',
    relativeTime: '5 days ago',
    risk: 'low',
    action: 'Review',
    reviewer: 'ops@oss.tips',
  },
  {
    id: 'rq5',
    project: 'astro-notes',
    projectSlug: 'astro-notes',
    reason: 'Manual email ownership review',
    submitted: '2026-05-23',
    relativeTime: '6 days ago',
    risk: 'medium',
    action: 'Review',
    reviewer: 'Unassigned',
  },
  {
    id: 'rq6',
    project: 'tiny-regexp',
    projectSlug: 'tiny-regexp',
    reason: 'First payment activation',
    submitted: '2026-05-22',
    relativeTime: '1 week ago',
    risk: 'low',
    action: 'Review',
    reviewer: 'finance@oss.tips',
  },
  {
    id: 'rq7',
    project: 'harbor-css',
    projectSlug: 'harbor-css',
    reason: 'Risk flag on payout country',
    submitted: '2026-05-21',
    relativeTime: '8 days ago',
    risk: 'high',
    action: 'Review',
    reviewer: 'Unassigned',
  },
];

export const demoReconciliationDiffs: ReconciliationDiff[] = [
  {
    id: 'rec1',
    date: '2026-05-29',
    project: 'paperlight',
    stripeNetMinor: 124500,
    ledgerNetMinor: 124500,
    deltaMinor: 0,
    stripeLabel: '$1,245.00',
    ledgerLabel: '$1,245.00',
    deltaLabel: '$0.00',
    currency: 'USD',
    status: 'matched',
    note: 'Settled Champion and Backer renewals.',
  },
  {
    id: 'rec2',
    date: '2026-05-28',
    project: 'vitest-run',
    stripeNetMinor: 89000,
    ledgerNetMinor: 88500,
    deltaMinor: -500,
    stripeLabel: '$890.00',
    ledgerLabel: '$885.00',
    deltaLabel: '−$5.00',
    currency: 'USD',
    status: 'mismatch',
    note: 'Application fee posted a day late on invoice inv_vitest_8821.',
  },
  {
    id: 'rec3',
    date: '2026-05-27',
    project: 'paperlight',
    stripeNetMinor: 4725,
    ledgerNetMinor: 4725,
    deltaMinor: 0,
    stripeLabel: '$47.25',
    ledgerLabel: '$47.25',
    deltaLabel: '$0.00',
    currency: 'USD',
    status: 'matched',
    note: 'One-off from opensourcefan.',
  },
  {
    id: 'rec4',
    date: '2026-05-26',
    project: 'ledger-kit',
    stripeNetMinor: 31200,
    ledgerNetMinor: 30000,
    deltaMinor: -1200,
    stripeLabel: '€312.00',
    ledgerLabel: '€300.00',
    deltaLabel: '−€12.00',
    currency: 'EUR',
    status: 'mismatch',
    note: 'FX presentment vs ledger settlement currency.',
  },
  {
    id: 'rec5',
    date: '2026-05-23',
    project: 'paperlight',
    stripeNetMinor: 0,
    ledgerNetMinor: -500,
    deltaMinor: 500,
    stripeLabel: '$0.00',
    ledgerLabel: '−$5.00',
    deltaLabel: '+$5.00',
    currency: 'USD',
    status: 'mismatch',
    note: 'Failed Coffee renewal still reserved in the ledger pending void.',
  },
];

export const demoAuditEvents: AuditEvent[] = [
  {
    id: 'aud1',
    time: '2026-05-29T15:02:00Z',
    relativeTime: '3 hours ago',
    actor: 'ops@oss.tips',
    action: 'project.review.approve',
    target: 'new-cli-tool',
    detail: 'First-payment activation approved after repository OAuth match.',
    ip: '198.51.100.14',
  },
  {
    id: 'aud2',
    time: '2026-05-29T14:30:00Z',
    relativeTime: '4 hours ago',
    actor: 'finance@oss.tips',
    action: 'refund.exceptional',
    target: 'pay_11',
    detail: 'Duplicate one-off from opensourcefan refunded with immutable reason.',
    ip: '198.51.100.22',
  },
  {
    id: 'aud3',
    time: '2026-05-29T11:15:00Z',
    relativeTime: '7 hours ago',
    actor: 'ops@oss.tips',
    action: 'project.restrict.payments',
    target: 'fake-react',
    detail: 'Payments restricted after impersonation indicator.',
    ip: '198.51.100.14',
  },
  {
    id: 'aud4',
    time: '2026-05-28T16:44:00Z',
    relativeTime: 'yesterday',
    actor: 'ada@paperlight.dev',
    action: 'project.settings.update',
    target: 'paperlight',
    detail: 'Updated public description and fee-mode disclosure copy.',
    ip: '203.0.113.8',
  },
  {
    id: 'aud5',
    time: '2026-05-27T09:12:00Z',
    relativeTime: '2 days ago',
    actor: 'finance@oss.tips',
    action: 'reconciliation.note',
    target: 'rec2',
    detail: 'Flagged vitest-run application-fee lag for next settlement.',
    ip: '198.51.100.22',
  },
  {
    id: 'aud6',
    time: '2026-05-26T18:03:00Z',
    relativeTime: '3 days ago',
    actor: 'ops@oss.tips',
    action: 'case.open',
    target: 'CASE-1042',
    detail: 'Opened abuse case for fake-react impersonation.',
    ip: '198.51.100.14',
  },
];

export const demoCases: AdminCase[] = [
  {
    id: 'CASE-1042',
    type: 'Abuse report',
    project: 'fake-react',
    status: 'open',
    assignee: 'ops@oss.tips',
    openedAt: '2026-05-26',
    relativeTime: '3 days ago',
    severity: 'critical',
  },
  {
    id: 'CASE-1038',
    type: 'Payment restriction',
    project: 'ledger-kit',
    status: 'investigating',
    assignee: 'finance@oss.tips',
    openedAt: '2026-05-24',
    relativeTime: '5 days ago',
    severity: 'high',
  },
];

export const demoReferrers: ReferrerRow[] = [
  { source: 'github.com', sessions: 1842, supporters: 96, conversionLabel: '5.2%', sharePercent: 41 },
  { source: 'paperlight.dev', sessions: 980, supporters: 71, conversionLabel: '7.2%', sharePercent: 22 },
  { source: 'Direct', sessions: 640, supporters: 48, conversionLabel: '7.5%', sharePercent: 14 },
  { source: 'news.ycombinator.com', sessions: 510, supporters: 32, conversionLabel: '6.3%', sharePercent: 11 },
  { source: 'discord.com', sessions: 288, supporters: 19, conversionLabel: '6.6%', sharePercent: 7 },
  { source: 'Other', sessions: 210, supporters: 18, conversionLabel: '8.6%', sharePercent: 5 },
];

export const demoCountries: CountryRow[] = [
  { country: 'United States', countryCode: 'US', supporters: 112, amountMinor: 512400, amountLabel: '$5,124', sharePercent: 39 },
  { country: 'United Kingdom', countryCode: 'GB', supporters: 54, amountMinor: 248200, amountLabel: '$2,482', sharePercent: 19 },
  { country: 'Germany', countryCode: 'DE', supporters: 38, amountMinor: 176800, amountLabel: '$1,768', sharePercent: 13 },
  { country: 'Canada', countryCode: 'CA', supporters: 27, amountMinor: 121500, amountLabel: '$1,215', sharePercent: 10 },
  { country: 'Japan', countryCode: 'JP', supporters: 22, amountMinor: 98600, amountLabel: '$986', sharePercent: 8 },
  { country: 'Other', countryCode: 'XX', supporters: 31, amountMinor: 126600, amountLabel: '$1,266', sharePercent: 11 },
];

export const demoRetention: RetentionCohort[] = [
  { cohort: '2026-02', monthLabel: 'Feb 2026', started: 48, retained: 36, retentionPercent: 75 },
  { cohort: '2026-03', monthLabel: 'Mar 2026', started: 61, retained: 49, retentionPercent: 80 },
  { cohort: '2026-04', monthLabel: 'Apr 2026', started: 73, retained: 62, retentionPercent: 85 },
  { cohort: '2026-05', monthLabel: 'May 2026', started: 84, retained: 84, retentionPercent: 100 },
];

export const demoAnalytics: Analytics = {
  referrers: demoReferrers,
  countries: demoCountries,
  retention: demoRetention,
  netRevenue30dMinor: 1284100,
  netRevenue30dLabel: '$12,841',
  newSupporters30d: 284,
  churnPercent: 2.1,
  churnLabel: '2.1%',
  periodLabel: 'Last 30 days',
  currency: 'USD',
};

export const demoTeam: TeamMember[] = [
  { id: 'tm1', name: 'Ada Lovelace', email: 'ada@paperlight.dev', role: 'Owner' },
  { id: 'tm2', name: 'Marcus Chen', email: 'marcus@paperlight.dev', role: 'Finance' },
  { id: 'tm3', name: 'Yuki Sato', email: 'yuki@paperlight.dev', role: 'Editor' },
];

export const demoWebhooks: WebhookEndpoint[] = [
  {
    id: 'wh1',
    url: 'https://api.paperlight.dev/hooks',
    events: 'payment.*, membership.*',
    status: 'active',
    lastDelivery: '2026-05-29 16:12 UTC',
  },
  {
    id: 'wh2',
    url: 'https://api.paperlight.dev/hooks/staging',
    events: 'payment.succeeded',
    status: 'failing',
    lastDelivery: '2026-05-29 09:04 UTC',
  },
];

export const demoApiKeys: ApiKey[] = [
  {
    id: 'key1',
    name: 'production-read',
    scope: 'read:payments',
    created: '2026-03-01',
    lastUsed: '2026-05-29',
  },
  {
    id: 'key2',
    name: 'ci-tests',
    scope: 'read:project',
    created: '2026-04-15',
    lastUsed: '2026-05-20',
  },
];

export const demoDiscordMappings: DiscordRoleMapping[] = [
  { tier: 'Coffee', role: 'coffee' },
  { tier: 'Supporter', role: 'supporters' },
  { tier: 'Backer', role: 'backers' },
  { tier: 'Champion', role: 'champions' },
];

export const demoExports: ExportJob[] = [
  { type: 'Payments', range: 'May 2026', action: 'Download' },
  { type: 'Memberships', range: 'All time', action: 'Download' },
  { type: 'Ledger events', range: 'Last 30 days', action: 'Download' },
];

export const demoReviewQueue = demoAdminQueue;
export const demoReconciliation = demoReconciliationDiffs;
export const demoAuditLog = demoAuditEvents;

export function formatMoney(minor: number, currency = 'USD'): string {
  const major = minor / 100;
  const locale = currency === 'USD' ? 'en-US' : 'en-GB';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

export function formatPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}
