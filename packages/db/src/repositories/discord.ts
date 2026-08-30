import { uuidv7 } from '@oss-tips/domain';
import type { Db } from '../client.js';
import type { JsonValue, NewJob } from '../types.js';

export const DISCORD_ROLE_SYNC_KIND = 'discord.role_sync';
export const DISCORD_ROLE_SYNC_QUEUE = 'discord';
export const DISCORD_RECONCILIATION_INTERVAL_MS = 24 * 60 * 60 * 1_000;

/** IDs needed to resolve current Discord state; no entitlement or mapping data is queued. */
export type DiscordRoleSyncTarget = {
  projectId: string;
  userId: string;
  discordGuildId: string;
  discordUserId?: string;
};

export type DiscordRoleSyncJobPayload = {
  project_id: string;
  user_id: string;
  discord_guild_id: string;
  discord_user_id?: string;
};

type DbExecutor = Pick<Db, 'selectFrom' | 'insertInto' | 'updateTable' | 'deleteFrom'>;

export type DiscordRoleAssignmentInput = {
  userId: string;
  discordGuildId: string;
  discordRoleId: string;
  status: string;
  entitlementId?: string | null;
  syncedAt?: Date;
};

/** Record latest role state without requiring a schema change to the legacy table. */
export async function recordDiscordRoleAssignment(
  db: DbExecutor,
  input: DiscordRoleAssignmentInput,
): Promise<void> {
  const existing = await db
    .selectFrom('discord_role_assignment')
    .select('id')
    .where('user_id', '=', input.userId)
    .where('discord_guild_id', '=', input.discordGuildId)
    .where('discord_role_id', '=', input.discordRoleId)
    .executeTakeFirst();
  const syncedAt = input.syncedAt ?? new Date();
  if (existing) {
    await db
      .updateTable('discord_role_assignment')
      .set({
        status: input.status,
        last_synced_at: syncedAt,
        ...(input.entitlementId === undefined ? {} : { entitlement_id: input.entitlementId }),
      })
      .where('id', '=', existing.id)
      .execute();
    return;
  }
  await db
    .insertInto('discord_role_assignment')
    .values({
      id: uuidv7(),
      user_id: input.userId,
      discord_guild_id: input.discordGuildId,
      discord_role_id: input.discordRoleId,
      entitlement_id: input.entitlementId ?? null,
      status: input.status,
      last_synced_at: syncedAt,
    })
    .execute();
}

function dedupeKey(target: DiscordRoleSyncTarget): string {
  return `${target.projectId}:${target.userId}:${target.discordGuildId}`;
}

export function discordRoleSyncJob(target: DiscordRoleSyncTarget, runAt = new Date()): NewJob {
  const payload: DiscordRoleSyncJobPayload = {
    project_id: target.projectId,
    user_id: target.userId,
    discord_guild_id: target.discordGuildId,
    ...(target.discordUserId ? { discord_user_id: target.discordUserId } : {}),
  };
  return {
    id: uuidv7(),
    queue: DISCORD_ROLE_SYNC_QUEUE,
    kind: DISCORD_ROLE_SYNC_KIND,
    payload: payload as JsonValue,
    dedupe_key: dedupeKey(target),
    status: 'pending',
    attempt_count: 0,
    max_attempts: 5,
    run_at: runAt,
    locked_at: null,
    locked_by: null,
    last_error: null,
  };
}

/**
 * Enqueue at most one active job per project/user/guild. A recent completed
 * job also suppresses the periodic pass, while event producers can enqueue
 * immediately after a completed job.
 */
export async function enqueueDiscordRoleSyncJob(
  db: DbExecutor,
  target: DiscordRoleSyncTarget,
  options: { now?: Date; minimumIntervalMs?: number } = {},
): Promise<boolean> {
  const now = options.now ?? new Date();
  const key = dedupeKey(target);
  const active = await db
    .selectFrom('job')
    .select('id')
    .where('kind', '=', DISCORD_ROLE_SYNC_KIND)
    .where('dedupe_key', '=', key)
    .where('status', 'in', ['pending', 'processing'])
    .executeTakeFirst();
  if (active) return false;

  if (options.minimumIntervalMs !== undefined) {
    const cutoff = new Date(now.getTime() - options.minimumIntervalMs);
    const recent = await db
      .selectFrom('job')
      .select('created_at')
      .where('kind', '=', DISCORD_ROLE_SYNC_KIND)
      .where('dedupe_key', '=', key)
      .where('status', '=', 'completed')
      .where('created_at', '>', cutoff)
      .executeTakeFirst();
    if (recent) return false;
  }

  try {
    await db.insertInto('job').values(discordRoleSyncJob(target, now)).execute();
    return true;
  } catch (error) {
    // Partial unique index closes the check/insert race between producers.
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

async function listTargets(
  db: DbExecutor,
  filter: { projectId?: string; userId?: string; discordGuildId?: string } = {},
): Promise<DiscordRoleSyncTarget[]> {
  let query = db
    .selectFrom('discord_connection')
    .innerJoin('discord_guild', 'discord_guild.project_id', 'discord_connection.project_id')
    .select([
      'discord_connection.project_id as project_id',
      'discord_connection.user_id as user_id',
      'discord_connection.discord_user_id as discord_user_id',
      'discord_guild.id as discord_guild_id',
    ])
    .where('discord_connection.user_id', 'is not', null)
    .where('discord_guild.bot_installed', '=', true);
  if (filter.projectId) query = query.where('discord_connection.project_id', '=', filter.projectId);
  if (filter.userId) query = query.where('discord_connection.user_id', '=', filter.userId);
  if (filter.discordGuildId)
    query = query.where('discord_guild.discord_guild_id', '=', filter.discordGuildId);
  const rows = await query.execute();
  return rows.flatMap((row) =>
    row.user_id
      ? [
          {
            projectId: row.project_id,
            userId: row.user_id,
            discordGuildId: row.discord_guild_id,
            discordUserId: row.discord_user_id,
          },
        ]
      : [],
  );
}

export async function enqueueDiscordRoleSyncForUser(
  db: DbExecutor,
  input: { projectId: string; userId: string },
  options: { now?: Date } = {},
): Promise<number> {
  const targets = await listTargets(db, input);
  let enqueued = 0;
  for (const target of targets) {
    if (await enqueueDiscordRoleSyncJob(db, target, options)) enqueued += 1;
  }
  return enqueued;
}

/** Enqueue only linked supporters who belong to a gateway event's guild/member. */
export async function enqueueDiscordRoleSyncForMember(
  db: DbExecutor,
  input: { discordGuildId: string; discordUserId: string },
  options: { now?: Date } = {},
): Promise<number> {
  const rows = await db
    .selectFrom('discord_connection')
    .innerJoin('discord_guild', 'discord_guild.project_id', 'discord_connection.project_id')
    .select([
      'discord_connection.project_id as project_id',
      'discord_connection.user_id as user_id',
      'discord_guild.id as discord_guild_id',
    ])
    .where('discord_connection.discord_user_id', '=', input.discordUserId)
    .where('discord_connection.user_id', 'is not', null)
    .where('discord_guild.discord_guild_id', '=', input.discordGuildId)
    .where('discord_guild.bot_installed', '=', true)
    .execute();
  let enqueued = 0;
  for (const row of rows) {
    if (
      row.user_id &&
      (await enqueueDiscordRoleSyncJob(
        db,
        {
          projectId: row.project_id,
          userId: row.user_id,
          discordGuildId: row.discord_guild_id,
          discordUserId: input.discordUserId,
        },
        options,
      ))
    ) {
      enqueued += 1;
    }
  }
  return enqueued;
}

export async function enqueueDiscordRoleSyncForProject(
  db: DbExecutor,
  projectId: string,
  options: { now?: Date } = {},
): Promise<number> {
  const targets = await listTargets(db, { projectId });
  let enqueued = 0;
  for (const target of targets) {
    if (await enqueueDiscordRoleSyncJob(db, target, options)) enqueued += 1;
  }
  return enqueued;
}

/** Queue one desired-state pass per linked supporter/guild, at most once per interval. */
export async function enqueuePeriodicDiscordRoleSyncJobs(
  db: DbExecutor,
  options: {
    now?: Date;
    minimumIntervalMs?: number;
    discordGuildId?: string;
  } = {},
): Promise<number> {
  const targets = await listTargets(
    db,
    options.discordGuildId ? { discordGuildId: options.discordGuildId } : {},
  );
  let enqueued = 0;
  for (const target of targets) {
    if (
      await enqueueDiscordRoleSyncJob(db, target, {
        ...(options.now ? { now: options.now } : {}),
        minimumIntervalMs: options.minimumIntervalMs ?? DISCORD_RECONCILIATION_INTERVAL_MS,
      })
    ) {
      enqueued += 1;
    }
  }
  return enqueued;
}

export async function replaceTierDiscordRoleMappings(
  db: DbExecutor,
  input: {
    projectId: string;
    tierId: string;
    roleIds: readonly string[];
    discordGuildId?: string | null;
  },
): Promise<void> {
  const roleIds = [...new Set(input.roleIds.map((roleId) => roleId.trim()).filter(Boolean))];
  let guildQuery = db
    .selectFrom('discord_guild')
    .select(['id', 'discord_guild_id'])
    .where('project_id', '=', input.projectId);
  if (input.discordGuildId) {
    guildQuery = guildQuery.where('discord_guild_id', '=', input.discordGuildId);
  }
  const guilds = await guildQuery.orderBy('created_at', 'asc').execute();
  if (roleIds.length > 0 && guilds.length === 0) {
    throw new DiscordGuildRequiredError();
  }
  if (roleIds.length > 0 && guilds.length > 1 && !input.discordGuildId) {
    throw new DiscordGuildRequiredError('Specify Discord guild before mapping roles');
  }

  if (guilds.length > 0) {
    const guildIds = input.discordGuildId ? [guilds[0]!.id] : guilds.map((guild) => guild.id);
    await db
      .deleteFrom('discord_role_mapping')
      .where('tier_id', '=', input.tierId)
      .where('discord_guild_id', 'in', guildIds)
      .execute();
    if (roleIds.length > 0) {
      await db
        .insertInto('discord_role_mapping')
        .values(
          roleIds.map((roleId) => ({
            id: uuidv7(),
            discord_guild_id: guildIds[0]!,
            tier_id: input.tierId,
            discord_role_id: roleId,
          })),
        )
        .execute();
    }
  }
}

export class DiscordGuildRequiredError extends Error {
  constructor(message = 'Connect a Discord guild before mapping roles') {
    super(message);
    this.name = 'DiscordGuildRequiredError';
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === '23505'
  );
}
