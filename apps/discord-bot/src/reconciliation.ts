import { isRetryableDiscordError, retryAt } from './errors.js';

export type EntitlementStatus =
  | 'active'
  | 'grace'
  | 'incomplete'
  | 'past_due'
  | 'cancelled'
  | 'expired'
  | 'refunded'
  | 'chargeback'
  | 'revoked';

export type DiscordEntitlement = {
  tierId: string | null;
  status: EntitlementStatus;
};

export type DiscordRoleMapping = {
  tierId: string;
  roleId: string;
};

export type DiscordRoleInfo = {
  id: string;
  position: number;
  managed: boolean;
};

export type DiscordRoleOperation = {
  guildId: string;
  discordUserId: string;
  roleId: string;
  desiredState: 'present' | 'absent';
  entitlementVersion: string;
  idempotencyKey: string;
};

export type RolePlanIssue = {
  roleId: string;
  code: 'missing_permission' | 'role_hierarchy' | 'managed_role' | 'role_not_found';
  message: string;
};

export type DiscordRolePlan = {
  operations: DiscordRoleOperation[];
  issues: RolePlanIssue[];
};

export type PlanRoleReconciliationArgs = {
  guildId: string;
  discordUserId: string;
  entitlementVersion: string;
  entitlements: readonly DiscordEntitlement[];
  mappings: readonly DiscordRoleMapping[];
  roleInfo: readonly DiscordRoleInfo[];
  actualRoleIds: readonly string[];
  botTopRolePosition: number;
  manageRolesGranted?: boolean;
};

const ACTIVE_STATUSES = new Set<EntitlementStatus>(['active', 'grace']);

function roleKey(args: {
  guildId: string;
  discordUserId: string;
  roleId: string;
  desiredState: 'present' | 'absent';
  entitlementVersion: string;
}): string {
  return [
    args.guildId,
    args.discordUserId,
    args.roleId,
    args.desiredState,
    args.entitlementVersion,
  ].join(':');
}

/**
 * Compute desired role membership without calling Discord. Mapping status and
 * hierarchy are checked here so a project cannot escalate the bot.
 */
export function planRoleReconciliation(args: PlanRoleReconciliationArgs): DiscordRolePlan {
  const roleInfo = new Map(args.roleInfo.map((role) => [role.id, role]));
  const mappedRoleIds = new Set(args.mappings.map((mapping) => mapping.roleId));
  const desiredRoleIds = new Set(
    args.entitlements
      .filter(
        (entitlement) => ACTIVE_STATUSES.has(entitlement.status) && entitlement.tierId != null,
      )
      .flatMap((entitlement) =>
        args.mappings
          .filter((mapping) => mapping.tierId === entitlement.tierId)
          .map((mapping) => mapping.roleId),
      ),
  );
  const issues: RolePlanIssue[] = [];
  const eligibleRoleIds = new Set<string>();

  for (const roleId of mappedRoleIds) {
    const role = roleInfo.get(roleId);
    if (!role) {
      issues.push({
        roleId,
        code: 'role_not_found',
        message: `Discord role ${roleId} was not found in guild`,
      });
      continue;
    }
    if (role.managed) {
      issues.push({
        roleId,
        code: 'managed_role',
        message: `Discord role ${roleId} is managed and cannot be assigned`,
      });
      continue;
    }
    if (role.position >= args.botTopRolePosition) {
      issues.push({
        roleId,
        code: 'role_hierarchy',
        message: `Discord role ${roleId} is at or above the bot's highest role`,
      });
      continue;
    }
    if (args.manageRolesGranted === false) {
      issues.push({
        roleId,
        code: 'missing_permission',
        message: 'Discord bot is missing Manage Roles permission',
      });
      continue;
    }
    eligibleRoleIds.add(roleId);
  }

  const actualRoleIds = new Set(args.actualRoleIds);
  const operations: DiscordRoleOperation[] = [];
  for (const roleId of eligibleRoleIds) {
    const desiredState = desiredRoleIds.has(roleId) ? 'present' : 'absent';
    const isPresent = actualRoleIds.has(roleId);
    if ((desiredState === 'present') === isPresent) continue;
    const operation = {
      guildId: args.guildId,
      discordUserId: args.discordUserId,
      roleId,
      desiredState,
      entitlementVersion: args.entitlementVersion,
    } satisfies Omit<DiscordRoleOperation, 'idempotencyKey'>;
    operations.push({ ...operation, idempotencyKey: roleKey(operation) });
  }

  return { operations, issues };
}

export type DiscordRoleActions = {
  addRole(guildId: string, discordUserId: string, roleId: string): Promise<void>;
  removeRole(guildId: string, discordUserId: string, roleId: string): Promise<void>;
};

export type RoleOperationResult = {
  operation: DiscordRoleOperation;
  status: 'applied' | 'retry' | 'failed';
  retryable: boolean;
  error?: string;
  nextAttemptAt?: Date;
};

export async function applyRolePlan(
  plan: DiscordRolePlan,
  actions: DiscordRoleActions,
  now = new Date(),
): Promise<RoleOperationResult[]> {
  const seen = new Set<string>();
  const results: RoleOperationResult[] = [];
  for (const operation of plan.operations) {
    if (seen.has(operation.idempotencyKey)) continue;
    seen.add(operation.idempotencyKey);
    try {
      if (operation.desiredState === 'present') {
        await actions.addRole(operation.guildId, operation.discordUserId, operation.roleId);
      } else {
        await actions.removeRole(operation.guildId, operation.discordUserId, operation.roleId);
      }
      results.push({ operation, status: 'applied', retryable: false });
    } catch (error) {
      const retryable = isRetryableDiscordError(error);
      results.push({
        operation,
        status: retryable ? 'retry' : 'failed',
        retryable,
        error: error instanceof Error ? error.message : 'Discord role operation failed',
        ...(retryable ? { nextAttemptAt: retryAt(error, now) } : {}),
      });
    }
  }
  return results;
}
