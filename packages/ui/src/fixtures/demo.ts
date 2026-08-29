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
}

export interface Supporter {
  id: string;
  displayName: string;
  amountMinor?: number;
  cadence?: 'one-off' | 'monthly' | 'annual';
  public: boolean;
}

export interface Payment {
  id: string;
  date: string;
  supporter: string;
  amountMinor: number;
  currency: string;
  cadence: string;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded';
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  tierVisibility: string;
}

export interface ThreadMessage {
  id: string;
  author: string;
  body: string;
  timestamp: string;
  internal?: boolean;
}

export interface Thread {
  id: string;
  subject: string;
  project: string;
  amountMinor: number;
  cadence: string;
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
  renewsAt?: string;
}

export interface Entitlement {
  id: string;
  projectName: string;
  tierName: string;
  expiresAt?: string;
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

export const demoProject: Project = {
  slug: 'paperlight',
  name: 'Paperlight',
  description:
    'A warm design system and UI toolkit for open-source project support. Built for clarity, accessibility, and financial transparency.',
  website: 'https://paperlight.dev',
  repository: 'github.com/oss-tips/paperlight',
  verified: true,
  currency: 'GBP',
  feeMode: 'standard',
  logoLetter: 'P',
  tags: ['design-system', 'svelte', 'typescript'],
  stats: {
    supporters: 284,
    monthlyRecurringMinor: 1245000,
    oneOffThisMonthMinor: 342000,
  },
};

export const demoTiers: Tier[] = [
  {
    id: 'seed',
    name: 'Seed supporter',
    description: 'Thank-you updates and community access.',
    monthlyMinor: 500,
    annualMinor: 5000,
    oneOffMinor: 500,
    rewards: ['Public thank-you', 'Community Discord'],
  },
  {
    id: 'sapling',
    name: 'Sapling',
    description: 'Early access to releases and supporter-only posts.',
    monthlyMinor: 1000,
    annualMinor: 10000,
    oneOffMinor: 1000,
    popular: true,
    rewards: ['Seed rewards', 'Early releases', 'Supporter posts'],
  },
  {
    id: 'canopy',
    name: 'Canopy',
    description: 'Priority support and roadmap input for maintainers.',
    monthlyMinor: 2500,
    annualMinor: 25000,
    oneOffMinor: 2500,
    memberLimit: 50,
    rewards: ['Sapling rewards', 'Priority support', 'Roadmap input'],
  },
];

export const demoGoals: Goal[] = [
  {
    id: 'g1',
    slug: 'design-docs',
    title: 'Complete design documentation',
    description: 'Fund illustration assets and accessibility audits for the Paperlight docs.',
    targetMinor: 500000,
    raisedMinor: 312000,
    basis: 'before fees',
    deadline: '2026-12-01',
    currency: 'GBP',
  },
  {
    id: 'g2',
    slug: 'svelte-kit',
    title: 'SvelteKit adapter polish',
    description: 'Ship a production-ready adapter with Storybook examples.',
    targetMinor: 200000,
    raisedMinor: 89000,
    basis: 'active supporters',
    currency: 'GBP',
  },
];

export const demoSupporters: Supporter[] = [
  { id: 's1', displayName: 'Ada L.', amountMinor: 2500, cadence: 'monthly', public: true },
  { id: 's2', displayName: 'Marcus T.', amountMinor: 1000, cadence: 'monthly', public: true },
  { id: 's3', displayName: 'Yuki S.', amountMinor: 5000, cadence: 'one-off', public: true },
  { id: 's4', displayName: 'Anonymous', public: false },
  { id: 's5', displayName: 'Helena R.', amountMinor: 10000, cadence: 'annual', public: true },
  { id: 's6', displayName: 'Devon K.', amountMinor: 500, cadence: 'monthly', public: true },
];

export const demoPayments: Payment[] = [
  {
    id: 'pay_1',
    date: '2026-08-27',
    supporter: 'Ada L.',
    amountMinor: 2500,
    currency: 'GBP',
    cadence: 'monthly',
    status: 'succeeded',
  },
  {
    id: 'pay_2',
    date: '2026-08-26',
    supporter: 'Yuki S.',
    amountMinor: 5000,
    currency: 'GBP',
    cadence: 'one-off',
    status: 'succeeded',
  },
  {
    id: 'pay_3',
    date: '2026-08-25',
    supporter: 'Marcus T.',
    amountMinor: 1000,
    currency: 'GBP',
    cadence: 'monthly',
    status: 'succeeded',
  },
  {
    id: 'pay_4',
    date: '2026-08-24',
    supporter: 'Guest',
    amountMinor: 2000,
    currency: 'GBP',
    cadence: 'one-off',
    status: 'pending',
  },
];

export const demoPosts: Post[] = [
  {
    id: 'p1',
    slug: 'paperlight-1-0',
    title: 'Paperlight 1.0 design tokens shipped',
    excerpt: 'Semantic colour tokens, typography stacks, and motion defaults are now stable.',
    publishedAt: '2026-08-15',
    tierVisibility: 'Public',
  },
  {
    id: 'p2',
    slug: 'storybook-preview',
    title: 'Storybook preview for all routes',
    excerpt: 'Every product page now has a Storybook story with realistic fixtures.',
    publishedAt: '2026-08-20',
    tierVisibility: 'Sapling+',
  },
  {
    id: 'p3',
    slug: 'fee-transparency',
    title: 'How we disclose fees before checkout',
    excerpt: 'A walkthrough of the support composer fee disclosure module.',
    publishedAt: '2026-08-10',
    tierVisibility: 'Public',
  },
];

export const demoThreads: Thread[] = [
  {
    id: 't1',
    subject: 'Question about annual billing',
    project: 'Paperlight',
    amountMinor: 10000,
    cadence: 'annual',
    unread: true,
    messages: [
      {
        id: 'm1',
        author: 'Helena R.',
        body: 'Does the annual tier include all Sapling rewards?',
        timestamp: '2026-08-27T10:30:00Z',
      },
      {
        id: 'm2',
        author: 'Paperlight team',
        body: 'Yes — annual Sapling includes every Seed reward plus early releases.',
        timestamp: '2026-08-27T14:15:00Z',
      },
    ],
  },
  {
    id: 't2',
    subject: 'Receipt for one-off support',
    project: 'Paperlight',
    amountMinor: 5000,
    cadence: 'one-off',
    messages: [
      {
        id: 'm3',
        author: 'Yuki S.',
        body: 'Could you confirm the entitlement duration for my one-off gift?',
        timestamp: '2026-08-26T09:00:00Z',
      },
    ],
  },
];

export const demoMemberships: Membership[] = [
  {
    id: 'mem1',
    projectSlug: 'paperlight',
    projectName: 'Paperlight',
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
];

export const demoEntitlements: Entitlement[] = [
  {
    id: 'e1',
    projectName: 'Paperlight',
    tierName: 'Sapling',
    expiresAt: '2026-09-15',
  },
  {
    id: 'e2',
    projectName: 'vitest-run',
    tierName: 'Maintainer',
    expiresAt: '2027-03-01',
  },
  {
    id: 'e3',
    projectName: 'Paperlight',
    tierName: 'Seed',
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
    currency: 'GBP',
    feeMode: 'project_5pct',
    logoLetter: 'V',
    tags: ['testing', 'nodejs'],
    stats: { supporters: 412, monthlyRecurringMinor: 890000, oneOffThisMonthMinor: 120000 },
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
    stats: { supporters: 98, monthlyRecurringMinor: 245000, oneOffThisMonthMinor: 45000 },
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

export function formatMoney(minor: number, currency = 'GBP'): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

export function formatPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}
