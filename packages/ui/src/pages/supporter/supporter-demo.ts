import { formatMoney, type Entitlement, type Membership, type Thread } from '../../fixtures/demo.js';

export { formatMoney };

export const supporterName = 'Ada L.';
export const supporterEmail = 'ada@example.com';

export const supporterMemberships: Membership[] = [
  {
    id: 'mem1',
    projectSlug: 'grove',
    projectName: 'Grove',
    tierName: 'Sapling',
    cadence: 'monthly',
    amountMinor: 1000,
    currency: 'GBP',
    status: 'active',
    renewsAt: '2026-09-15',
    renewsLabel: '15 Sep 2026',
  },
  {
    id: 'mem2',
    projectSlug: 'vitest-run',
    projectName: 'vitest-run',
    tierName: 'Maintainer',
    cadence: 'annual',
    amountMinor: 12000,
    currency: 'GBP',
    status: 'active',
    renewsAt: '2027-03-01',
    renewsLabel: '1 Mar 2027',
  },
  {
    id: 'mem3',
    projectSlug: 'ledger-kit',
    projectName: 'ledger-kit',
    tierName: 'Seed',
    cadence: 'monthly',
    amountMinor: 500,
    currency: 'GBP',
    status: 'past_due',
    renewsAt: '2026-08-20',
    renewsLabel: '20 Aug 2026',
  },
  {
    id: 'mem4',
    projectSlug: 'otel-lite',
    projectName: 'otel-lite',
    tierName: 'Canopy',
    cadence: 'monthly',
    amountMinor: 2500,
    currency: 'GBP',
    status: 'active',
    renewsAt: '2026-09-04',
    renewsLabel: '4 Sep 2026',
  },
  {
    id: 'mem5',
    projectSlug: 'tiny-sqlite',
    projectName: 'tiny-sqlite',
    tierName: 'Sapling',
    cadence: 'annual',
    amountMinor: 8000,
    currency: 'GBP',
    status: 'cancelled',
    renewsAt: '2026-08-01',
    renewsLabel: 'Ended 1 Aug 2026',
  },
  {
    id: 'mem6',
    projectSlug: 'paper-ink',
    projectName: 'paper-ink',
    tierName: 'Seed',
    cadence: 'monthly',
    amountMinor: 500,
    currency: 'GBP',
    status: 'active',
    renewsAt: '2026-09-11',
    renewsLabel: '11 Sep 2026',
  },
];

export const supporterEntitlements: Entitlement[] = [
  {
    id: 'e1',
    projectName: 'Grove',
    tierName: 'Sapling',
    reward: 'Early releases and supporter posts',
    status: 'active',
    expiresAt: '2026-09-15',
    expiresLabel: '15 Sep 2026',
  },
  {
    id: 'e2',
    projectName: 'vitest-run',
    tierName: 'Maintainer',
    reward: 'Maintainer Discord role',
    status: 'active',
    expiresAt: '2027-03-01',
    expiresLabel: '1 Mar 2027',
  },
  {
    id: 'e3',
    projectName: 'Grove',
    tierName: 'Seed',
    reward: 'Public thank-you on the wall',
    status: 'permanent',
    expiresAt: 'permanent',
    expiresLabel: 'Permanent',
    permanent: true,
  },
  {
    id: 'e4',
    projectName: 'otel-lite',
    tierName: 'Canopy',
    reward: 'Roadmap office hours',
    status: 'active',
    expiresAt: '2026-09-04',
    expiresLabel: '4 Sep 2026',
  },
  {
    id: 'e5',
    projectName: 'tiny-sqlite',
    tierName: 'Sapling',
    reward: 'Supporter newsletter',
    status: 'expired',
    expiresAt: '2026-08-01',
    expiresLabel: '1 Aug 2026',
  },
  {
    id: 'e6',
    projectName: 'ledger-kit',
    tierName: 'Seed',
    reward: 'Public thank-you on the wall',
    status: 'active',
    expiresAt: '2026-09-03',
    expiresLabel: '3 Sep 2026',
  },
];

export interface LifetimeSupport {
  projectName: string;
  oneOffMinor: number;
  recurringMinor: number;
  currency: string;
}

export const lifetimeSupport: LifetimeSupport[] = [
  { projectName: 'Grove', oneOffMinor: 5000, recurringMinor: 24000, currency: 'GBP' },
  { projectName: 'vitest-run', oneOffMinor: 0, recurringMinor: 12000, currency: 'GBP' },
  { projectName: 'otel-lite', oneOffMinor: 2500, recurringMinor: 7500, currency: 'GBP' },
  { projectName: 'ledger-kit', oneOffMinor: 1000, recurringMinor: 1500, currency: 'GBP' },
  { projectName: 'tiny-sqlite', oneOffMinor: 2000, recurringMinor: 8000, currency: 'GBP' },
  { projectName: 'paper-ink', oneOffMinor: 500, recurringMinor: 1500, currency: 'GBP' },
];

export const lifetimeTotalMinor = lifetimeSupport.reduce(
  (sum, row) => sum + row.oneOffMinor + row.recurringMinor,
  0,
);

export const monthlyActiveMinor = supporterMemberships
  .filter((m) => m.status === 'active')
  .reduce((sum, m) => sum + (m.cadence === 'annual' ? Math.round(m.amountMinor / 12) : m.amountMinor), 0);

export const supporterThreads: Thread[] = [
  {
    id: 't1',
    subject: 'Question about annual billing',
    project: 'Grove',
    supporter: 'Ada L.',
    amountMinor: 10000,
    amountLabel: '£100.00',
    cadence: 'annual',
    relativeTime: '2 days ago',
    preview: 'Does the annual tier include all Sapling rewards?',
    status: 'awaiting reply',
    unread: true,
    messages: [
      {
        id: 'm1',
        author: 'Ada L.',
        body: 'Does the annual tier include all Sapling rewards?',
        timestamp: '2026-08-27T10:30:00Z',
        relativeTime: '2 days ago',
      },
      {
        id: 'm2',
        author: 'Grove team',
        body: 'Yes. Annual Sapling includes every Seed reward plus early releases.',
        timestamp: '2026-08-27T14:15:00Z',
        relativeTime: '2 days ago',
      },
    ],
  },
  {
    id: 't2',
    subject: 'Receipt for one-off support',
    project: 'Grove',
    supporter: 'Ada L.',
    amountMinor: 5000,
    amountLabel: '£50.00',
    cadence: 'one-off',
    relativeTime: '3 days ago',
    preview: 'Could you confirm the entitlement duration for my one-off payment?',
    status: 'open',
    messages: [
      {
        id: 'm3',
        author: 'Ada L.',
        body: 'Could you confirm the entitlement duration for my one-off payment?',
        timestamp: '2026-08-26T09:00:00Z',
        relativeTime: '3 days ago',
      },
    ],
  },
  {
    id: 't3',
    subject: 'Discord role not granted',
    project: 'vitest-run',
    supporter: 'Ada L.',
    amountMinor: 12000,
    amountLabel: '£120.00',
    cadence: 'annual',
    relativeTime: '4 days ago',
    preview: 'I linked Discord but the Maintainer role has not appeared yet.',
    status: 'awaiting reply',
    unread: true,
    messages: [
      {
        id: 'm4',
        author: 'Ada L.',
        body: 'I linked Discord but the Maintainer role has not appeared yet.',
        timestamp: '2026-08-25T16:40:00Z',
        relativeTime: '4 days ago',
      },
      {
        id: 'm5',
        author: 'vitest-run',
        body: 'We are retrying the mapping. Your membership is active through 1 Mar 2027.',
        timestamp: '2026-08-25T18:02:00Z',
        relativeTime: '4 days ago',
      },
    ],
  },
  {
    id: 't4',
    subject: 'Past-due membership reminder',
    project: 'ledger-kit',
    supporter: 'Ada L.',
    amountMinor: 500,
    amountLabel: '£5.00',
    cadence: 'monthly',
    relativeTime: '8 days ago',
    preview: 'Your Seed membership is in the seven-day grace period.',
    status: 'open',
    messages: [
      {
        id: 'm6',
        author: 'ledger-kit',
        body: 'Your Seed membership is in the seven-day grace period. Access stays until 27 Aug 2026.',
        timestamp: '2026-08-21T08:00:00Z',
        relativeTime: '8 days ago',
      },
    ],
  },
  {
    id: 't5',
    subject: 'Thanks for the Canopy support',
    project: 'otel-lite',
    supporter: 'Ada L.',
    amountMinor: 2500,
    amountLabel: '£25.00',
    cadence: 'monthly',
    relativeTime: '10 days ago',
    preview: 'Roadmap office hours are the first Thursday of each month.',
    status: 'open',
    messages: [
      {
        id: 'm7',
        author: 'otel-lite',
        body: 'Roadmap office hours are the first Thursday of each month. Calendar invite attached for members.',
        timestamp: '2026-08-19T11:20:00Z',
        relativeTime: '10 days ago',
      },
    ],
  },
];

export const unreadThreadCount = supporterThreads.filter((t) => t.unread).length;

export function requireThread() {
  const thread = supporterThreads[0];
  if (!thread) throw new Error('Grove supporterThreads is empty');
  return thread;
}

export const platformTipMinor = 100;
