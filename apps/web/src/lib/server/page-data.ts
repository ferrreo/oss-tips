import { createDb, createProjectsRepository } from '@oss-tips/db';
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
  projectNavGroups,
  type Analytics,
  type ApiKey,
  type AuditEvent,
  type AdminCase,
  type DiscordRoleMapping,
  type Entitlement,
  type ExportJob,
  type Goal,
  type Membership,
  type NavGroup,
  type Payment,
  type Post,
  type Project,
  type ReconciliationDiff,
  type AdminQueueItem,
  type Supporter,
  type TeamMember,
  type Thread,
  type Tier,
  type WebhookEndpoint,
} from '@oss-tips/ui';

export type DataSource = 'demo' | 'db';

export type ProjectPageData = {
  source: DataSource;
  project: Project;
  goals: Goal[];
  threads: Thread[];
  supporters: Supporter[];
  payments: Payment[];
  posts: Post[];
  tiers: Tier[];
  team: TeamMember[];
  webhooks: WebhookEndpoint[];
  apiKeys: ApiKey[];
  discordMappings: DiscordRoleMapping[];
  exports: ExportJob[];
  analytics: Analytics;
  navGroups: NavGroup[];
};

export type CatalogPageData = {
  source: DataSource;
  projects: Project[];
};

export type SupporterPageData = {
  source: DataSource;
  memberships: Membership[];
  entitlements: Entitlement[];
  threads: Thread[];
};

export type AdminPageData = {
  source: DataSource;
  navGroups: NavGroup[];
  reviewQueue: AdminQueueItem[];
  reconciliation: ReconciliationDiff[];
  auditLog: AuditEvent[];
  cases: AdminCase[];
};

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function projectForSlug(slug: string): Project {
  return featuredProjects.find((item) => item.slug === slug) ?? { ...demoProject, slug };
}

function overlayProject(
  base: Project,
  row: { slug: string; name: string; description: string | null; default_currency: string },
): Project {
  return {
    ...base,
    slug: row.slug,
    name: row.name,
    description: row.description ?? base.description,
    currency: row.default_currency || base.currency,
    logoLetter: row.name.slice(0, 1).toUpperCase() || base.logoLetter,
  };
}

export function demoProjectPageData(slug: string): ProjectPageData {
  return {
    source: 'demo',
    project: projectForSlug(slug),
    goals: demoGoals,
    threads: demoThreads,
    supporters: demoSupporters,
    payments: demoPayments,
    posts: demoPosts,
    tiers: demoTiers,
    team: demoTeam,
    webhooks: demoWebhooks,
    apiKeys: demoApiKeys,
    discordMappings: demoDiscordMappings,
    exports: demoExports,
    analytics: demoAnalytics,
    navGroups: projectNavGroups,
  };
}

export async function loadProjectPageData(slug: string): Promise<ProjectPageData> {
  const demo = demoProjectPageData(slug);
  if (!hasDatabaseUrl()) {
    return demo;
  }

  try {
    const db = createDb(process.env.DATABASE_URL as string);
    const row = await createProjectsRepository(db).findBySlug(slug);
    if (!row) {
      return demo;
    }
    return {
      ...demo,
      source: 'db',
      project: overlayProject(demo.project, row),
    };
  } catch {
    return demo;
  }
}

export async function loadCatalogPageData(): Promise<CatalogPageData> {
  if (!hasDatabaseUrl()) {
    return { source: 'demo', projects: featuredProjects };
  }

  try {
    const db = createDb(process.env.DATABASE_URL as string);
    const rows = await createProjectsRepository(db).listPublished();
    if (rows.length === 0) {
      return { source: 'demo', projects: featuredProjects };
    }
    return {
      source: 'db',
      projects: rows.map((row) => overlayProject(demoProject, row)),
    };
  } catch {
    return { source: 'demo', projects: featuredProjects };
  }
}

export function loadSupporterPageData(): SupporterPageData {
  return {
    source: 'demo',
    memberships: demoMemberships,
    entitlements: demoEntitlements,
    threads: demoThreads,
  };
}

export function loadAdminPageData(): AdminPageData {
  return {
    source: 'demo',
    navGroups: adminNavGroups,
    reviewQueue: demoReviewQueue,
    reconciliation: demoReconciliationDiffs,
    auditLog: demoAuditEvents,
    cases: demoCases,
  };
}
