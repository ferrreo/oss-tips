export type Decision =
  | { allowed: true }
  | { allowed: false; reason: string };

export type ProjectCapability =
  | 'project.transfer_ownership'
  | 'project.delete'
  | 'project.connect_stripe'
  | 'project.change_fee_mode'
  | 'project.manage_domain'
  | 'project.manage_team'
  | 'project.refund'
  | 'project.export_finance'
  | 'project.manage_tiers'
  | 'project.manage_goals'
  | 'project.publish_posts'
  | 'project.reply_supporters'
  | 'project.discord_mappings'
  | 'project.view_analytics'
  | 'project.manage_webhooks'
  | 'project.manage_api_keys'
  | 'project.view_payments';

export type ProjectRole = 'owner' | 'admin' | 'finance' | 'editor' | 'community' | 'analyst';

const ROLE_CAPS: Record<ProjectRole, ReadonlySet<ProjectCapability>> = {
  owner: new Set([
    'project.transfer_ownership',
    'project.delete',
    'project.connect_stripe',
    'project.change_fee_mode',
    'project.manage_domain',
    'project.manage_team',
    'project.refund',
    'project.export_finance',
    'project.manage_tiers',
    'project.manage_goals',
    'project.publish_posts',
    'project.reply_supporters',
    'project.discord_mappings',
    'project.view_analytics',
    'project.manage_webhooks',
    'project.manage_api_keys',
    'project.view_payments',
  ]),
  admin: new Set([
    'project.change_fee_mode',
    'project.manage_domain',
    'project.manage_team',
    'project.export_finance',
    'project.manage_tiers',
    'project.manage_goals',
    'project.publish_posts',
    'project.reply_supporters',
    'project.discord_mappings',
    'project.view_analytics',
    'project.manage_webhooks',
    'project.manage_api_keys',
    'project.view_payments',
  ]),
  finance: new Set([
    'project.refund',
    'project.export_finance',
    'project.view_analytics',
    'project.view_payments',
  ]),
  editor: new Set([
    'project.publish_posts',
    'project.view_analytics',
  ]),
  community: new Set([
    'project.reply_supporters',
    'project.discord_mappings',
    'project.view_analytics',
  ]),
  analyst: new Set([
    'project.view_analytics',
    'project.view_payments',
  ]),
};

export type PlatformRole =
  | 'owner'
  | 'operations'
  | 'finance'
  | 'moderation'
  | 'support'
  | 'auditor';

export type PlatformCapability =
  | 'platform.review_projects'
  | 'platform.refund'
  | 'platform.view_audit'
  | 'platform.manage_users'
  | 'platform.view_reconciliation'
  | 'platform.view_as_readonly';

const PLATFORM_CAPS: Record<PlatformRole, ReadonlySet<PlatformCapability>> = {
  owner: new Set([
    'platform.review_projects',
    'platform.refund',
    'platform.view_audit',
    'platform.manage_users',
    'platform.view_reconciliation',
    'platform.view_as_readonly',
  ]),
  operations: new Set([
    'platform.review_projects',
    'platform.view_audit',
    'platform.manage_users',
    'platform.view_reconciliation',
    'platform.view_as_readonly',
  ]),
  finance: new Set([
    'platform.refund',
    'platform.view_audit',
    'platform.view_reconciliation',
  ]),
  moderation: new Set([
    'platform.review_projects',
    'platform.view_audit',
    'platform.view_as_readonly',
  ]),
  support: new Set([
    'platform.view_audit',
    'platform.view_as_readonly',
  ]),
  auditor: new Set([
    'platform.view_audit',
    'platform.view_reconciliation',
  ]),
};

export type Actor =
  | { kind: 'user'; userId: string; projectRoles: ReadonlyMap<string, ProjectRole>; platformRoles: readonly PlatformRole[] }
  | { kind: 'api_key'; projectId: string; scopes: ReadonlySet<string> }
  | { kind: 'anonymous' };

export function canProject(
  actor: Actor,
  capability: ProjectCapability,
  projectId: string,
): Decision {
  if (actor.kind === 'anonymous') {
    return { allowed: false, reason: 'unauthenticated' };
  }
  if (actor.kind === 'api_key') {
    if (actor.projectId !== projectId) {
      return { allowed: false, reason: 'wrong_project' };
    }
    // Map capabilities to scopes coarsely
    const scopeMap: Partial<Record<ProjectCapability, string>> = {
      'project.publish_posts': 'posts:write',
      'project.manage_goals': 'goals:write',
      'project.view_analytics': 'analytics:read',
      'project.manage_webhooks': 'webhooks:manage',
      'project.manage_api_keys': 'webhooks:manage',
      'project.view_payments': 'supporters:read',
      'project.manage_tiers': 'tiers:read',
    };
    const needed = scopeMap[capability];
    if (needed && actor.scopes.has(needed)) return { allowed: true };
    if (actor.scopes.has('project:read') && capability === 'project.view_analytics') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'insufficient_scope' };
  }
  const role = actor.projectRoles.get(projectId);
  if (!role) return { allowed: false, reason: 'not_a_member' };
  if (ROLE_CAPS[role].has(capability)) return { allowed: true };
  return { allowed: false, reason: 'missing_capability' };
}

export function canPlatform(actor: Actor, capability: PlatformCapability): Decision {
  if (actor.kind !== 'user') return { allowed: false, reason: 'unauthenticated' };
  for (const role of actor.platformRoles) {
    if (PLATFORM_CAPS[role].has(capability)) return { allowed: true };
  }
  return { allowed: false, reason: 'missing_capability' };
}

export function assertAllowed(decision: Decision): void {
  if (!decision.allowed) {
    throw new Error(`Forbidden: ${decision.reason}`);
  }
}
