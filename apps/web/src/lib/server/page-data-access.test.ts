import { describe, expect, it } from 'vitest';
import type { Actor } from '@oss-tips/auth';
import { adminNavGroups, projectNavGroups } from '@oss-tips/ui/fixtures/demo.js';
import type { AdminPageData, ProjectPageData } from './page-data';
import {
  projectCapabilityForPath,
  requireAdminPageCapability,
  requireProjectPageCapability,
  scopeAdminPageData,
  scopeProjectPageData,
} from './page-data-access';

function projectActor(
  role: 'owner' | 'editor' | 'community' | 'analyst',
  projectId = 'project-id',
): Actor {
  return {
    kind: 'user',
    userId: `user-${role}`,
    projectRoles: new Map([[projectId, role]]),
    platformRoles: [],
  };
}

function platformActor(role: 'support' | 'moderation' | 'auditor'): Actor {
  return {
    kind: 'user',
    userId: `user-${role}`,
    projectRoles: new Map(),
    platformRoles: [role],
  };
}

const fullProjectData = {
  source: 'db' as const,
  project: {
    ...{
      slug: 'grove',
      name: 'Grove',
      description: 'A project',
      website: 'https://grove.dev',
      repository: 'https://github.com/grove/grove',
      supportEmail: 'private@grove.dev',
      supportEmailVerified: true,
      verified: true,
      currency: 'GBP',
      feeMode: 'standard' as const,
      logoLetter: 'G',
      tags: ['typescript'],
      stats: {
        supporters: 4,
        monthlyRecurringMinor: 3000,
        oneOffThisMonthMinor: 1200,
        totalSupportMinor: 4200,
      },
    },
  },
  goals: [{ id: 'goal-secret' }],
  threads: [{ id: 'thread-secret' }],
  supporters: [{ id: 'supporter-secret' }],
  payments: [{ id: 'payment-secret' }],
  posts: [{ id: 'post-secret', body: 'private draft' }],
  tiers: [{ id: 'tier-secret' }],
  team: [{ email: 'team-secret@grove.dev' }],
  webhooks: [{ id: 'webhook-secret' }],
  apiKeys: [{ id: 'key-secret' }],
  discordMappings: [{ role: 'role-secret' }],
  exports: [
    {
      type: 'payments',
      range: 'May 2026',
      format: 'CSV',
      status: 'ready',
      downloadUrl: '/api/v1/project/exports/job-1/download?project_slug=grove',
      expiresAt: '2026-06-01T00:00:00.000Z',
    },
  ],
  analytics: {
    referrers: [],
    countries: [],
    retention: [],
    netRevenue30dMinor: 4200,
    netRevenue30dLabel: '£42',
    newSupporters30d: 4,
    churnPercent: 0,
    churnLabel: '0%',
    periodLabel: '30 days',
    currency: 'GBP',
  },
  navGroups: projectNavGroups,
  memberships: [{ name: 'Supporter' }],
  metrics: [{ label: 'Total support', value: '£42', compare: '', compareDirection: 'up' as const }],
  inbox: [{ id: 'thread-secret' }],
  rankings: [{ rank: 1, name: 'Supporter' }],
  tools: [],
  chartSeries: [{ id: 'chart-secret', label: 'Support', points: [] }],
  supportSeries: [],
  growthSeries: [],
  breakdown: [{ source: 'secret', gross: '£42', fees: '£2', net: '£40', share: '100%' }],
  steps: [{ step: '1', label: 'Identity', detail: 'private' }],
  initialStep: 2,
  draft: { id: 'post-secret', body: 'private draft' },
  recentPosts: [{ id: 'post-secret', body: 'private draft' }],
  links: [{ label: 'Public page', value: 'https://oss.tips/grove' }],
  capabilities: [{ capability: 'payouts', status: 'active', detail: 'enabled' }],
  stripeAccountId: 'acct-secret',
  chargesEnabled: true,
  payoutsEnabled: true,
  checkoutDisabled: false,
  discordGuild: { id: 'guild-secret', name: 'Secret', botInstalled: true },
  domainRecords: [{ host: 'secret.grove.dev', type: 'TXT', status: 'active', target: 'secret' }],
  webhookDeliveries: [
    { id: 'delivery-secret', event: 'payment', target: 'secret', code: '200', time: 'now' },
  ],
  keys: [{ name: 'secret', scope: 'payments', created: 'now', lastUsed: 'now' }],
  roleRows: [{ tier: 'Secret', role: 'role-secret', members: '1', lastSync: 'now' }],
  records: [{ host: 'secret.grove.dev', type: 'TXT', status: 'active', target: 'secret' }],
  endpoints: [
    { url: 'https://secret.grove.dev', events: 'payment', status: 'Active', last: 'now' },
  ],
  deliveries: [
    { id: 'delivery-secret', event: 'payment', target: 'secret', code: '200', time: 'now' },
  ],
  members: [{ name: 'Owner', email: 'owner@grove.dev', role: 'owner', lastActive: 'now' }],
} as unknown as ProjectPageData;

const fullAdminData = {
  source: 'db' as const,
  navGroups: adminNavGroups,
  overviewMetrics: {
    publishedProjects: 3,
    publishedThisMonth: 1,
    settlementVolume: { amountMinor: 4200, currency: 'GBP' },
    previousSettlementVolume: { amountMinor: 3000, currency: 'GBP' },
    fees: { amountMinor: 200, currency: 'GBP' },
    tips: { amountMinor: 50, currency: 'GBP' },
    currencyCodes: ['GBP'],
    settledVolumeSeries: [],
    reconciliationAvailable: true,
  },
  reviewQueue: [{ id: 'review-secret' }],
  reconciliation: [
    { project: 'secret', date: 'today', stripeNetMinor: 1, ledgerNetMinor: 0, status: 'mismatch' },
  ],
  auditLog: [
    {
      actor: 'secret@example.com',
      action: 'secret',
      target: 'secret',
      time: 'now',
      reason: 'secret',
      correlation: 'secret',
    },
  ],
  events: [
    {
      actor: 'secret@example.com',
      action: 'secret',
      target: 'secret',
      time: 'now',
      reason: 'secret',
      correlation: 'secret',
    },
  ],
  rows: [
    { project: 'secret', date: 'today', stripeNetMinor: 1, ledgerNetMinor: 0, status: 'mismatch' },
  ],
  cases: [{ id: 'case-secret' }],
  reviewItems: [{ id: 'review-secret' }],
  failedJobs: [{ id: 'job-secret' }],
  directoryProjects: [{ slug: 'secret' }],
  directoryPeople: [{ email: 'secret@example.com' }],
  projects: [{ slug: 'secret' }],
  people: [{ email: 'secret@example.com' }],
} as unknown as AdminPageData;

describe('capability-scoped page data', () => {
  const projectCases: Array<{
    role: 'community' | 'editor' | 'analyst';
    allowed: string[];
  }> = [
    { role: 'community', allowed: ['threads', 'discordMappings'] },
    { role: 'editor', allowed: ['posts'] },
    { role: 'analyst', allowed: ['payments', 'memberships'] },
  ];

  it.each(projectCases)('$role receives only permitted project data', ({ role, allowed }) => {
    const data = scopeProjectPageData(
      fullProjectData,
      projectActor(role),
      'project-id',
      '/dashboard/project-id',
    );

    expect(data.project.supportEmail).toBeUndefined();
    expect(data.team).toEqual([]);
    expect(data.webhooks).toEqual([]);
    expect(data.apiKeys).toEqual([]);
    expect(data.exports).toEqual([]);
    expect(data.goals).toEqual([]);
    expect(data.tiers).toEqual([]);
    expect(data.stripeAccountId).toBeUndefined();
    expect(data.projectCapabilities.length).toBeGreaterThan(0);
    expect(data.threads).toEqual(allowed.includes('threads') ? fullProjectData.threads : []);
    expect(data.discordMappings).toEqual(
      allowed.includes('discordMappings') ? fullProjectData.discordMappings : [],
    );
    expect(data.posts).toEqual(allowed.includes('posts') ? fullProjectData.posts : []);
    expect(data.payments).toEqual(allowed.includes('payments') ? fullProjectData.payments : []);
    expect(data.memberships).toEqual(
      allowed.includes('memberships') ? fullProjectData.memberships : [],
    );
  });

  it('denies direct restricted project pages before loading data', () => {
    const actor = projectActor('community');
    expect(projectCapabilityForPath('/dashboard/grove/payments')).toBe('project.view_payments');
    expect(() =>
      requireProjectPageCapability(actor, 'project-id', '/dashboard/grove/payments'),
    ).toThrow();
    expect(projectCapabilityForPath('/dashboard/grove/goals')).toBe('project.manage_goals');
    expect(() =>
      requireProjectPageCapability(projectActor('analyst'), 'project-id', '/dashboard/grove/goals'),
    ).toThrow();
    expect(projectCapabilityForPath('/dashboard/grove/memberships')).toBe('project.manage_tiers');
    expect(() =>
      requireProjectPageCapability(
        projectActor('analyst'),
        'project-id',
        '/dashboard/grove/memberships',
      ),
    ).toThrow();
    expect(() =>
      requireProjectPageCapability(actor, 'project-id', '/dashboard/grove/inbox'),
    ).not.toThrow();
  });

  it('keeps management payload for an owner', () => {
    const data = scopeProjectPageData(
      fullProjectData,
      projectActor('owner'),
      'project-id',
      '/dashboard/project-id',
    );

    expect(data.goals).toEqual(fullProjectData.goals);
    expect(data.tiers).toEqual(fullProjectData.tiers);
    expect(data.project.supportEmail).toBe(fullProjectData.project.supportEmail);
    expect(data.team).toEqual(fullProjectData.team);
    expect(data.exports).toEqual(fullProjectData.exports);
    expect(JSON.stringify(data.exports)).not.toContain('storage_key');
  });

  it('rewrites project navigation and marks only current page active', () => {
    const data = scopeProjectPageData(
      fullProjectData,
      projectActor('owner', 'grove'),
      'grove',
      '/dashboard/grove/memberships',
    );
    const items = data.navGroups.flatMap((group) => group.items);

    expect(items.find((item) => item.label === 'Memberships')).toMatchObject({
      href: '/dashboard/grove/memberships',
      active: true,
    });
    expect(items.every((item) => item.href.startsWith('/dashboard/grove'))).toBe(true);
    expect(items.filter((item) => item.active).map((item) => item.label)).toEqual(['Memberships']);
  });

  const platformCases: Array<{
    role: 'support' | 'moderation' | 'auditor';
    review?: boolean;
    cases?: boolean;
    audit?: boolean;
    reconciliation?: boolean;
  }> = [
    { role: 'support', audit: true },
    { role: 'moderation', review: true, cases: true, audit: true },
    { role: 'auditor', audit: true, reconciliation: true },
  ];

  it.each(platformCases)('$role receives only permitted admin data', ({ role, ...expected }) => {
    const data = scopeAdminPageData(fullAdminData, platformActor(role));

    expect(data.overviewMetrics.settlementVolume).toBeNull();
    expect(data.overviewMetrics.previousSettlementVolume).toBeNull();
    expect(data.overviewMetrics.fees).toBeNull();
    expect(data.overviewMetrics.tips).toBeNull();
    expect(data.overviewMetrics.currencyCodes).toEqual([]);
    expect(data.overviewMetrics.settledVolumeSeries).toEqual([]);
    expect(data.directoryPeople).toEqual([]);
    expect(data.directoryProjects).toEqual([]);
    expect(data.failedJobs).toEqual([]);
    expect(data.reviewItems).toEqual(expected.review ? fullAdminData.reviewItems : []);
    expect(data.cases).toEqual(expected.cases ? fullAdminData.cases : []);
    expect(data.auditLog).toEqual(expected.audit ? fullAdminData.auditLog : []);
    expect(data.reconciliation).toEqual(
      expected.reconciliation ? fullAdminData.reconciliation : [],
    );
  });

  it('denies direct restricted admin pages before loading data', () => {
    expect(() =>
      requireAdminPageCapability(platformActor('support'), '/admin/reconciliation'),
    ).toThrow();
    expect(() =>
      requireAdminPageCapability(platformActor('auditor'), '/admin/reconciliation'),
    ).not.toThrow();
  });
});
