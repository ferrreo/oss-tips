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
  },
];

export const supporterEntitlements: Entitlement[] = [
  { id: 'e1', projectName: 'Grove', tierName: 'Sapling', expiresAt: '2026-09-15' },
  { id: 'e2', projectName: 'vitest-run', tierName: 'Maintainer', expiresAt: '2027-03-01' },
  { id: 'e3', projectName: 'Grove', tierName: 'Seed', permanent: true },
  { id: 'e4', projectName: 'otel-lite', tierName: 'Canopy', expiresAt: '2026-09-04' },
  { id: 'e5', projectName: 'tiny-sqlite', tierName: 'Sapling', expiresAt: '2026-08-01' },
  { id: 'e6', projectName: 'ledger-kit', tierName: 'Seed', expiresAt: '2026-09-03' },
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
    amountMinor: 10000,
    cadence: 'annual',
    unread: true,
    messages: [
      {
        id: 'm1',
        author: 'Ada L.',
        body: 'Does the annual tier include all Sapling rewards?',
        timestamp: '2026-08-27T10:30:00Z',
      },
      {
        id: 'm2',
        author: 'Grove team',
        body: 'Yes — annual Sapling includes every Seed reward plus early releases.',
        timestamp: '2026-08-27T14:15:00Z',
      },
    ],
  },
  {
    id: 't2',
    subject: 'Receipt for one-off support',
    project: 'Grove',
    amountMinor: 5000,
    cadence: 'one-off',
    messages: [
      {
        id: 'm3',
        author: 'Ada L.',
        body: 'Could you confirm the entitlement duration for my one-off gift?',
        timestamp: '2026-08-26T09:00:00Z',
      },
    ],
  },
  {
    id: 't3',
    subject: 'Discord role not granted',
    project: 'vitest-run',
    amountMinor: 12000,
    cadence: 'annual',
    unread: true,
    messages: [
      {
        id: 'm4',
        author: 'Ada L.',
        body: 'I linked Discord but the Maintainer role has not appeared yet.',
        timestamp: '2026-08-25T16:40:00Z',
      },
      {
        id: 'm5',
        author: 'vitest-run',
        body: 'We are retrying the mapping. Your membership is active through 2027-03-01.',
        timestamp: '2026-08-25T18:02:00Z',
      },
    ],
  },
  {
    id: 't4',
    subject: 'Past-due membership reminder',
    project: 'ledger-kit',
    amountMinor: 500,
    cadence: 'monthly',
    messages: [
      {
        id: 'm6',
        author: 'ledger-kit',
        body: 'Your Seed membership is in the seven-day grace period. Access stays until 2026-08-27.',
        timestamp: '2026-08-21T08:00:00Z',
      },
    ],
  },
  {
    id: 't5',
    subject: 'Thanks for the Canopy support',
    project: 'otel-lite',
    amountMinor: 2500,
    cadence: 'monthly',
    messages: [
      {
        id: 'm7',
        author: 'otel-lite',
        body: 'Roadmap office hours are the first Thursday of each month. Calendar invite attached for members.',
        timestamp: '2026-08-19T11:20:00Z',
      },
    ],
  },
];

export const unreadThreadCount = supporterThreads.filter((t) => t.unread).length;

export function requireThread() {
  const thread = supporterThreads[0];
  if (!thread) throw new Error('supporterThreads is empty');
  return thread;
}

export const platformTipMinor = 100;
