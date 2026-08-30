import { error } from '@sveltejs/kit';
import {
  PROJECT_CAPABILITIES,
  checkPlatform,
  checkProject,
  type Actor,
  type PlatformCapability,
  type ProjectCapability,
} from '@oss-tips/auth';
import {
  loadAdminPageData,
  loadProjectPageData,
  type AdminPageData,
  type ProjectPageData,
} from './page-data';

export type ScopedProjectPageData = ProjectPageData & {
  projectCapabilities: ProjectCapability[];
};

export type ScopedAdminPageData = AdminPageData & {
  platformCapabilities: PlatformCapability[];
};

export function projectCapabilityForPath(pathname: string): ProjectCapability | null {
  const requirements = Object.entries(projectNavigationRequirements);
  const match = requirements.find(
    ([suffix]) => pathname.endsWith(suffix) || pathname.includes(`${suffix}/`),
  );
  return match?.[1] ?? null;
}

export function platformCapabilityForPath(pathname: string): PlatformCapability | null {
  const requirements = Object.entries(adminNavigationRequirements);
  const match = requirements.find(
    ([suffix]) => pathname.endsWith(suffix) || pathname.includes(`${suffix}/`),
  );
  return match?.[1] ?? null;
}

export function requireProjectPageCapability(
  actor: Actor,
  projectId: string,
  pathname: string,
): void {
  const capability = projectCapabilityForPath(pathname);
  if (capability && !hasProjectCapability(actor, projectId, capability)) {
    throw error(403, 'You do not have access to this project page.');
  }
}

export function requireAdminPageCapability(actor: Actor, pathname: string): void {
  const capability = platformCapabilityForPath(pathname);
  if (capability && !hasPlatformCapability(actor, capability)) {
    throw error(403, 'You do not have access to this platform page.');
  }
}

const projectNavigationRequirements: Readonly<Record<string, ProjectCapability>> = {
  '/inbox': 'project.reply_supporters',
  '/supporters': 'project.view_payments',
  '/payments': 'project.view_payments',
  '/memberships': 'project.manage_tiers',
  '/posts': 'project.publish_posts',
  '/discord': 'project.discord_mappings',
  '/analytics': 'project.view_analytics',
  '/goals': 'project.manage_goals',
  '/webhooks': 'project.manage_webhooks',
  '/api-keys': 'project.manage_api_keys',
  '/exports': 'project.export_finance',
  '/domains': 'project.manage_domain',
  '/team': 'project.manage_team',
  '/stripe': 'project.connect_stripe',
  '/settings': 'project.change_fee_mode',
  '/onboarding': 'project.publish_project',
};

const adminNavigationRequirements: Readonly<Record<string, PlatformCapability>> = {
  '/review': 'platform.review_projects',
  '/directory': 'platform.manage_users',
  '/reconciliation': 'platform.view_reconciliation',
  '/cases': 'platform.review_projects',
  '/audit': 'platform.view_audit',
};

function hasProjectCapability(
  actor: Actor,
  projectId: string,
  capability: ProjectCapability,
): boolean {
  return checkProject(actor, capability, projectId).allowed;
}

function hasPlatformCapability(actor: Actor, capability: PlatformCapability): boolean {
  return checkPlatform(actor, capability).allowed;
}

function filterNavigation<T extends { label: string; items: Array<{ href: string }> }>(
  groups: T[],
  requirements: Readonly<Record<string, string>>,
  allowed: (capability: string) => boolean,
): T[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const suffix = Object.keys(requirements).find((path) => item.href.endsWith(path));
        return !suffix || allowed(requirements[suffix]!);
      }),
    }))
    .filter((group) => group.items.length > 0) as T[];
}

function emptyAnalytics(currency: string): ProjectPageData['analytics'] {
  return {
    referrers: [],
    countries: [],
    retention: [],
    netRevenue30dMinor: 0,
    netRevenue30dLabel: '',
    newSupporters30d: 0,
    churnPercent: 0,
    churnLabel: '',
    periodLabel: '',
    currency,
  };
}

function scopedProjectIdentity(
  project: ProjectPageData['project'],
  canViewAnalytics: boolean,
  canManageDomain: boolean,
): ProjectPageData['project'] {
  const next = { ...project };
  if (!canManageDomain) {
    delete next.supportEmail;
    delete next.supportEmailVerified;
  }
  if (!canViewAnalytics) {
    next.stats = {
      supporters: 0,
      monthlyRecurringMinor: 0,
      oneOffThisMonthMinor: 0,
      totalSupportMinor: 0,
    };
  }
  return next;
}

/**
 * Apply project capability policy at the server-load boundary. Keep this explicit so a newly
 * added page-data field cannot accidentally become visible to every project member.
 */
export function scopeProjectPageData(
  data: ProjectPageData,
  actor: Actor,
  projectId: string,
  pathname: string,
): ScopedProjectPageData {
  const can = (capability: ProjectCapability) => hasProjectCapability(actor, projectId, capability);
  const canViewPayments = can('project.view_payments');
  const canManageTiers = can('project.manage_tiers');
  const canManageGoals = can('project.manage_goals');
  const canViewAnalytics = can('project.view_analytics');
  const canViewPosts = can('project.publish_posts');
  const canReply = can('project.reply_supporters');
  const canManageDomain = can('project.manage_domain');
  const canManageTeam = can('project.manage_team');
  const canManageWebhooks = can('project.manage_webhooks');
  const canManageApiKeys = can('project.manage_api_keys');
  const canManageDiscord = can('project.discord_mappings');
  const canExportFinance = can('project.export_finance');
  const canConnectStripe = can('project.connect_stripe');
  const canSeeOnboarding = canManageDomain || canConnectStripe || can('project.publish_project');
  const projectCapabilities = PROJECT_CAPABILITIES.filter(can);
  const dashboardPath = `/dashboard/${projectId}`;
  const navGroups = filterNavigation(data.navGroups, projectNavigationRequirements, (capability) =>
    can(capability as ProjectCapability),
  ).map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const href = item.href.replace(/^\/[^/]+/, dashboardPath);
      return {
        ...item,
        href,
        active: pathname === href || (href !== dashboardPath && pathname.startsWith(`${href}/`)),
      };
    }),
  }));

  return {
    source: data.source,
    project: scopedProjectIdentity(data.project, canViewAnalytics, canManageDomain),
    goals: canManageGoals ? data.goals : [],
    threads: canReply ? data.threads : [],
    supporters: canViewPayments ? data.supporters : [],
    payments: canViewPayments ? data.payments : [],
    posts: canViewPosts ? data.posts : [],
    tiers: canManageTiers ? data.tiers : [],
    team: canManageTeam ? data.team : [],
    webhooks: canManageWebhooks ? data.webhooks : [],
    apiKeys: canManageApiKeys ? data.apiKeys : [],
    discordMappings: canManageDiscord ? data.discordMappings : [],
    exports: canExportFinance ? data.exports : [],
    analytics: canViewAnalytics ? data.analytics : emptyAnalytics(data.project.currency),
    ...(canViewAnalytics && data.analyticsDetails
      ? { analyticsDetails: data.analyticsDetails }
      : {}),
    navGroups,
    memberships: canViewPayments ? (data.memberships ?? []) : [],
    metrics: canViewAnalytics ? (data.metrics ?? []) : [],
    inbox: canReply ? (data.inbox ?? []) : [],
    rankings: canViewPayments ? (data.rankings ?? []) : [],
    tools: canViewAnalytics ? (data.tools ?? []) : [],
    chartSeries: canViewAnalytics ? (data.chartSeries ?? []) : [],
    supportSeries: canViewAnalytics ? (data.supportSeries ?? []) : [],
    growthSeries: canViewAnalytics ? (data.growthSeries ?? []) : [],
    breakdown: canViewAnalytics ? (data.breakdown ?? []) : [],
    ...(canSeeOnboarding && data.steps ? { steps: data.steps } : {}),
    ...(canSeeOnboarding && data.initialStep !== undefined
      ? { initialStep: data.initialStep }
      : {}),
    ...(canViewPosts && data.draft ? { draft: data.draft } : {}),
    recentPosts: canViewPosts ? (data.recentPosts ?? []) : [],
    links: data.links ?? [],
    capabilities: canConnectStripe ? (data.capabilities ?? []) : [],
    ...(canConnectStripe && data.stripeAccountId ? { stripeAccountId: data.stripeAccountId } : {}),
    ...(canConnectStripe && data.chargesEnabled !== undefined
      ? { chargesEnabled: data.chargesEnabled }
      : {}),
    ...(canConnectStripe && data.payoutsEnabled !== undefined
      ? { payoutsEnabled: data.payoutsEnabled }
      : {}),
    ...(canConnectStripe && data.checkoutDisabled !== undefined
      ? { checkoutDisabled: data.checkoutDisabled }
      : {}),
    ...(canManageDiscord && data.discordGuild ? { discordGuild: data.discordGuild } : {}),
    domainRecords: canManageDomain ? (data.domainRecords ?? []) : [],
    webhookDeliveries: canManageWebhooks ? (data.webhookDeliveries ?? []) : [],
    keys: canManageApiKeys ? (data.keys ?? []) : [],
    roleRows: canManageDiscord ? (data.roleRows ?? []) : [],
    records: canManageDomain ? (data.records ?? []) : [],
    endpoints: canManageWebhooks ? (data.endpoints ?? []) : [],
    deliveries: canManageWebhooks ? (data.deliveries ?? []) : [],
    members: canManageTeam ? (data.members ?? []) : [],
    projectCapabilities,
  };
}

/** Apply platform capability policy before admin layout data is serialized. */
export function scopeAdminPageData(data: AdminPageData, actor: Actor): ScopedAdminPageData {
  const can = (capability: PlatformCapability) => hasPlatformCapability(actor, capability);
  const canReview = can('platform.review_projects');
  const canManageUsers = can('platform.manage_users');
  const canReconcile = can('platform.view_reconciliation');
  const canAudit = can('platform.view_audit');
  const canFinance = can('platform.refund');
  const platformCapabilities = (
    [
      'platform.review_projects',
      'platform.refund',
      'platform.view_audit',
      'platform.manage_users',
      'platform.view_reconciliation',
      'platform.view_as_readonly',
    ] as const
  ).filter(can);
  const adminData = {
    source: data.source,
    navGroups: filterNavigation(data.navGroups, adminNavigationRequirements, (capability) =>
      can(capability as PlatformCapability),
    ),
    overviewMetrics: canFinance
      ? data.overviewMetrics
      : {
          ...data.overviewMetrics,
          settlementVolume: null,
          previousSettlementVolume: null,
          fees: null,
          tips: null,
          currencyCodes: [],
          settledVolumeSeries: [],
          reconciliationAvailable: false,
        },
    reviewQueue: canReview ? data.reviewQueue : [],
    reconciliation: canReconcile ? data.reconciliation : [],
    auditLog: canAudit ? data.auditLog : [],
    events: canAudit ? data.events : [],
    rows: canReconcile ? data.rows : [],
    cases: canReview ? data.cases : [],
    reviewItems: canReview ? data.reviewItems : [],
    failedJobs: canManageUsers ? data.failedJobs : [],
    directoryProjects: canManageUsers ? data.directoryProjects : [],
    directoryPeople: canManageUsers ? data.directoryPeople : [],
    projects: canManageUsers ? data.projects : [],
    people: canManageUsers ? data.people : [],
    platformCapabilities,
  } satisfies ScopedAdminPageData;
  return adminData;
}

export async function loadProjectDashboardPageData(
  slug: string,
  actor: Actor,
  pathname: string,
): Promise<ScopedProjectPageData> {
  return scopeProjectPageData(
    await loadProjectPageData(slug, { publicOnly: false }),
    actor,
    slug,
    pathname,
  );
}

export async function loadAdminDashboardPageData(actor: Actor): Promise<ScopedAdminPageData> {
  return scopeAdminPageData(await loadAdminPageData(), actor);
}
