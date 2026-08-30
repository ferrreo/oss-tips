import { adminNavGroups, formatMoney, type NavGroup } from '../../fixtures/demo.js';
import { humanizeStatus } from '../../lib/labels.js';
import type { AdminOverviewMetrics } from './admin-types.js';

export { formatMoney, humanizeStatus };

export function requireItem<T>(items: readonly T[], label: string): T {
  const item = items[0];
  if (!item) throw new Error(`${label} is empty`);
  return item;
}

const PROJECT_NAMES: Record<string, string> = {
  grove: 'Grove',
  'vitest-run': 'vitest-run',
  'ledger-kit': 'ledger-kit',
  'tiny-sqlite': 'tiny-sqlite',
  'otel-lite': 'otel-lite',
  'fake-react': 'fake-react',
  'paper-ink': 'paper-ink',
  'new-cli-tool': 'new-cli-tool',
  'forge-mirror': 'forge-mirror',
};

const PERSON_NAMES: Record<string, string> = {
  'ops@oss.tips': 'Nia Okonkwo',
  'finance@oss.tips': 'Priya Shah',
  'support@oss.tips': 'Sam Ortiz',
  'owner@oss.tips': 'Camila Rocha',
  'auditor@oss.tips': 'Ellis Ward',
};

export function displayProject(slug: string): string {
  return PROJECT_NAMES[slug] ?? slug;
}

export function displayPerson(emailOrName: string): string {
  return PERSON_NAMES[emailOrName] ?? emailOrName;
}

export function displayTarget(target: string): string {
  return PROJECT_NAMES[target] ?? target;
}

export function adminNav(activeHref: string): NavGroup[] {
  return adminNavGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      active: item.href === activeHref,
    })),
  }));
}

export interface ReviewItem {
  id: string;
  slug: string;
  name: string;
  repository: string;
  reason: string;
  risk: 'high' | 'medium' | 'low';
  submitted: string;
  queueDays: number;
}

export const reviewQueue: ReviewItem[] = [
  {
    id: 'rev_1047',
    slug: 'ledger-kit',
    name: displayProject('ledger-kit'),
    repository: 'github.com/oss-tips/ledger-kit',
    reason: 'Duplicate repository claim',
    risk: 'high',
    submitted: '2026-08-27',
    queueDays: 2,
  },
  {
    id: 'rev_1046',
    slug: 'fake-react',
    name: displayProject('fake-react'),
    repository: 'github.com/not-meta/fake-react',
    reason: 'Impersonation indicator',
    risk: 'high',
    submitted: '2026-08-26',
    queueDays: 3,
  },
  {
    id: 'rev_1045',
    slug: 'new-cli-tool',
    name: displayProject('new-cli-tool'),
    repository: 'github.com/devon/new-cli-tool',
    reason: 'First payment activation',
    risk: 'low',
    submitted: '2026-08-25',
    queueDays: 4,
  },
  {
    id: 'rev_1044',
    slug: 'tiny-sqlite',
    name: displayProject('tiny-sqlite'),
    repository: 'github.com/yuki/tiny-sqlite',
    reason: 'First payment activation',
    risk: 'low',
    submitted: '2026-08-24',
    queueDays: 5,
  },
  {
    id: 'rev_1043',
    slug: 'forge-mirror',
    name: displayProject('forge-mirror'),
    repository: 'github.com/ops/forge-mirror',
    reason: 'Unverified forge issuer',
    risk: 'medium',
    submitted: '2026-08-23',
    queueDays: 6,
  },
  {
    id: 'rev_1042',
    slug: 'paper-ink',
    name: displayProject('paper-ink'),
    repository: 'github.com/helena/paper-ink',
    reason: 'Duplicate website claim',
    risk: 'medium',
    submitted: '2026-08-22',
    queueDays: 7,
  },
  {
    id: 'rev_1041',
    slug: 'otel-lite',
    name: displayProject('otel-lite'),
    repository: 'github.com/marcus/otel-lite',
    reason: 'New owner plus first charge',
    risk: 'medium',
    submitted: '2026-08-21',
    queueDays: 8,
  },
];

export interface DirectoryProject {
  name: string;
  slug: string;
  repository: string;
  verified: string;
  payments: string;
  supporters: number;
  feeMode: string;
}

export const directoryProjects: DirectoryProject[] = [
  {
    name: 'Grove',
    slug: 'grove',
    repository: 'github.com/oss-tips/grove',
    verified: 'Verified',
    payments: 'Ready',
    supporters: 284,
    feeMode: 'standard',
  },
  {
    name: 'vitest-run',
    slug: 'vitest-run',
    repository: 'github.com/oss-tips/vitest-run',
    verified: 'Verified',
    payments: 'Ready',
    supporters: 412,
    feeMode: 'project_5pct',
  },
  {
    name: 'ledger-kit',
    slug: 'ledger-kit',
    repository: 'github.com/oss-tips/ledger-kit',
    verified: 'Pending',
    payments: 'Restricted',
    supporters: 98,
    feeMode: 'standard',
  },
  {
    name: 'tiny-sqlite',
    slug: 'tiny-sqlite',
    repository: 'github.com/yuki/tiny-sqlite',
    verified: 'Verified',
    payments: 'Review',
    supporters: 41,
    feeMode: 'standard',
  },
  {
    name: 'otel-lite',
    slug: 'otel-lite',
    repository: 'github.com/marcus/otel-lite',
    verified: 'Verified',
    payments: 'Ready',
    supporters: 76,
    feeMode: 'standard',
  },
  {
    name: 'fake-react',
    slug: 'fake-react',
    repository: 'github.com/not-meta/fake-react',
    verified: 'Blocked',
    payments: 'Restricted',
    supporters: 3,
    feeMode: 'standard',
  },
];

export interface DirectoryPerson {
  name: string;
  email: string;
  role: string;
  projects: string;
  signedIn: string;
}

export const directoryPeople: DirectoryPerson[] = [
  {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    role: 'Supporter',
    projects: `${displayProject('grove')}, ${displayProject('vitest-run')}`,
    signedIn: '2026-08-28',
  },
  {
    name: 'Marcus Chen',
    email: 'marcus@example.com',
    role: 'Project owner',
    projects: displayProject('otel-lite'),
    signedIn: '2026-08-27',
  },
  {
    name: 'Yuki Sato',
    email: 'yuki@example.com',
    role: 'Project owner',
    projects: displayProject('tiny-sqlite'),
    signedIn: '2026-08-26',
  },
  {
    name: 'Helena Ruiz',
    email: 'helena@example.com',
    role: 'Supporter',
    projects: displayProject('grove'),
    signedIn: '2026-08-25',
  },
  {
    name: 'Devon Kane',
    email: 'devon@example.com',
    role: 'Project owner',
    projects: displayProject('new-cli-tool'),
    signedIn: '2026-08-24',
  },
  {
    name: 'Guest 8f2c',
    email: 'claimed after payment',
    role: 'Guest supporter',
    projects: displayProject('vitest-run'),
    signedIn: 'Not signed in',
  },
];

export interface ReconRow {
  date: string;
  project: string;
  currency: string;
  stripeNetMinor: number;
  ledgerNetMinor: number;
  status: 'aligned' | 'mismatch' | 'pending';
}

export const reconciliationRows: ReconRow[] = [
  {
    date: '2026-08-27',
    project: 'grove',
    currency: 'USD',
    stripeNetMinor: 124500,
    ledgerNetMinor: 124500,
    status: 'aligned',
  },
  {
    date: '2026-08-26',
    project: 'vitest-run',
    currency: 'USD',
    stripeNetMinor: 89000,
    ledgerNetMinor: 88500,
    status: 'mismatch',
  },
  {
    date: '2026-08-26',
    project: 'otel-lite',
    currency: 'EUR',
    stripeNetMinor: 21400,
    ledgerNetMinor: 21400,
    status: 'aligned',
  },
  {
    date: '2026-08-25',
    project: 'tiny-sqlite',
    currency: 'JPY',
    stripeNetMinor: 6700,
    ledgerNetMinor: 7200,
    status: 'mismatch',
  },
  {
    date: '2026-08-25',
    project: 'ledger-kit',
    currency: 'JPY',
    stripeNetMinor: 15400,
    ledgerNetMinor: 0,
    status: 'pending',
  },
  {
    date: '2026-08-24',
    project: 'grove',
    currency: 'EUR',
    stripeNetMinor: 33200,
    ledgerNetMinor: 33100,
    status: 'mismatch',
  },
  {
    date: '2026-08-23',
    project: 'vitest-run',
    currency: 'USD',
    stripeNetMinor: 44100,
    ledgerNetMinor: 44100,
    status: 'aligned',
  },
];

export interface AdminCase {
  id: string;
  type: string;
  project: string;
  status: string;
  assignee: string;
  opened: string;
  summary: string;
}

export const adminCases: AdminCase[] = [
  {
    id: 'CASE-1042',
    type: 'Abuse report',
    project: 'fake-react',
    status: 'open',
    assignee: 'ops@oss.tips',
    opened: '2026-08-26',
    summary: 'Impersonating a well-known UI library. Payments restricted.',
  },
  {
    id: 'CASE-1038',
    type: 'Payment restriction',
    project: 'ledger-kit',
    status: 'investigating',
    assignee: 'finance@oss.tips',
    opened: '2026-08-24',
    summary: 'Stripe capabilities incomplete after first charge attempt.',
  },
  {
    id: 'CASE-1035',
    type: 'Copyright claim',
    project: 'paper-ink',
    status: 'waiting',
    assignee: 'ops@oss.tips',
    opened: '2026-08-22',
    summary: 'Third-party notice on banner illustration. Project asked for source.',
  },
  {
    id: 'CASE-1031',
    type: 'Account recovery',
    project: 'otel-lite',
    status: 'open',
    assignee: 'support@oss.tips',
    opened: '2026-08-21',
    summary: 'Owner lost OAuth access after forge migration. Email challenge pending.',
  },
  {
    id: 'CASE-1028',
    type: 'Ownership transfer',
    project: 'tiny-sqlite',
    status: 'investigating',
    assignee: 'ops@oss.tips',
    opened: '2026-08-18',
    summary: 'Repository moved organisations. Both claimants verified email.',
  },
  {
    id: 'CASE-1022',
    type: 'Exceptional refund',
    project: 'vitest-run',
    status: 'resolved',
    assignee: 'finance@oss.tips',
    opened: '2026-08-12',
    summary: 'Duplicate annual charge. Refunded with reason on audit log.',
  },
];

export interface AuditEvent {
  time: string;
  actor: string;
  action: string;
  target: string;
  reason: string;
  correlation: string;
}

export const auditEvents: AuditEvent[] = [
  {
    time: '2026-08-28T09:14Z',
    actor: 'ops@oss.tips',
    action: 'project.review.hold',
    target: 'ledger-kit',
    reason: 'Duplicate repository claim pending both owners',
    correlation: 'corr_8f21',
  },
  {
    time: '2026-08-27T15:02Z',
    actor: 'ops@oss.tips',
    action: 'project.review.approve',
    target: 'new-cli-tool',
    reason: 'First-payment activation; ownership file present',
    correlation: 'corr_7c10',
  },
  {
    time: '2026-08-27T14:30Z',
    actor: 'finance@oss.tips',
    action: 'refund.exceptional',
    target: 'pay_abc123',
    reason: 'Duplicate annual invoice on vitest-run',
    correlation: 'corr_7b88',
  },
  {
    time: '2026-08-27T11:15Z',
    actor: 'ops@oss.tips',
    action: 'project.restrict.payments',
    target: 'fake-react',
    reason: 'Impersonation case CASE-1042',
    correlation: 'corr_7a02',
  },
  {
    time: '2026-08-26T18:41Z',
    actor: 'ops@oss.tips',
    action: 'case.open',
    target: 'CASE-1042',
    reason: 'Public report of trademark impersonation',
    correlation: 'corr_6911',
  },
  {
    time: '2026-08-26T16:05Z',
    actor: 'support@oss.tips',
    action: 'account.recovery.start',
    target: 'otel-lite',
    reason: 'Owner email challenge after forge move',
    correlation: 'corr_68c0',
  },
  {
    time: '2026-08-25T12:22Z',
    actor: 'finance@oss.tips',
    action: 'reconciliation.flag',
    target: 'vitest-run',
    reason: 'Stripe net £890.00 vs ledger £885.00',
    correlation: 'corr_55e4',
  },
  {
    time: '2026-08-24T09:08Z',
    actor: 'owner@oss.tips',
    action: 'project.fee_mode.change',
    target: 'vitest-run',
    reason: 'Project requested 5% mode after domain attach',
    correlation: 'corr_44aa',
  },
  {
    time: '2026-08-23T17:33Z',
    actor: 'ops@oss.tips',
    action: 'api_key.revoke',
    target: 'key_live_9k2',
    reason: 'Leaked in public gist; rotated by owner',
    correlation: 'corr_3390',
  },
  {
    time: '2026-08-22T08:55Z',
    actor: 'auditor@oss.tips',
    action: 'view_as.start',
    target: 'grove',
    reason: 'Read-only investigation of webhook retries',
    correlation: 'corr_2201',
  },
];

export const failedJobs = [
  { id: 'job_441', kind: 'webhook.deliver', target: 'grove', retries: 3, lastError: '410 Gone' },
  {
    id: 'job_438',
    kind: 'discord.role_sync',
    target: 'vitest-run',
    retries: 2,
    lastError: 'Missing Manage Roles',
  },
  {
    id: 'job_430',
    kind: 'domain.challenge',
    target: 'vitest-run',
    retries: 1,
    lastError: 'TXT not found',
  },
  {
    id: 'job_419',
    kind: 'stripe.capability',
    target: 'ledger-kit',
    retries: 4,
    lastError: 'charges_enabled=false',
  },
  {
    id: 'job_401',
    kind: 'webhook.deliver',
    target: 'otel-lite',
    retries: 2,
    lastError: 'Timeout 15s',
  },
];

/** Overview numbers are deliberately fixture-owned; production loads persisted values. */
export const adminOverviewMetrics: AdminOverviewMetrics = {
  publishedProjects: 1248,
  publishedThisMonth: 12,
  settlementVolume: { amountMinor: 24_000_000, currency: 'GBP' },
  previousSettlementVolume: { amountMinor: 23_076_923, currency: 'GBP' },
  fees: { amountMinor: 4_207_000, currency: 'GBP' },
  tips: { amountMinor: 614_000, currency: 'GBP' },
  currencyCodes: ['GBP'],
  settledVolumeSeries: [
    {
      id: 'settled-support-gbp',
      labelKey: 'admin.overview.series.settledSupport',
      currency: 'GBP',
      stroke: 'solid',
      marker: 'circle',
      points: [
        { label: '2026-08-04', value: 4200 },
        { label: '2026-08-08', value: 6800 },
        { label: '2026-08-12', value: 5100 },
        { label: '2026-08-16', value: 8900 },
        { label: '2026-08-20', value: 7600 },
        { label: '2026-08-24', value: 11200 },
        { label: '2026-08-28', value: 9400 },
      ],
    },
  ],
  reconciliationAvailable: true,
};
