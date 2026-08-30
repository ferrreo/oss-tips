import './instrumentation.js';
import { randomUUID } from 'node:crypto';
import {
  createDb,
  createJobsRepository,
  destroyDb,
  enqueueDiscordRoleSyncForMember,
  enqueuePeriodicDiscordRoleSyncJobs,
  JOB_LEASE_TIMEOUT_MS,
  recordDiscordRoleAssignment,
  type Db,
  type Job,
} from '@oss-tips/db';
import { createLogger, shutdownTelemetry } from '@oss-tips/observability';
import { pathToFileURL } from 'node:url';
import { readDiscordBotConfig } from './config.js';
import { DiscordRestClient } from './discord-api.js';
import { DiscordApiError, isRetryableDiscordError, retryAt } from './errors.js';
import { connectDiscordGateway } from './gateway.js';
import {
  applyRolePlan,
  planRoleReconciliation,
  type DiscordEntitlement,
  type DiscordRoleInfo,
  type DiscordRoleMapping,
} from './reconciliation.js';

const log = createLogger('@oss-tips/discord-bot');
const WORKER_ID = `discord-${process.pid}-${randomUUID()}`;

type JsonRecord = Record<string, unknown>;

type RoleSyncJobPayload = {
  projectId: string;
  userId: string;
  discordGuildId: string;
  discordUserId?: string;
};

function record(value: unknown, context: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${context}`);
  }
  return value as JsonRecord;
}

function stringField(value: unknown, field: string, context: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`Invalid ${field} in ${context}`);
  return value;
}

function parseRoleSyncPayload(value: unknown): RoleSyncJobPayload {
  const data = record(value, 'Discord role sync job payload');
  return {
    projectId: stringField(data.project_id, 'project_id', 'role sync payload'),
    userId: stringField(data.user_id, 'user_id', 'role sync payload'),
    discordGuildId: stringField(data.discord_guild_id, 'discord_guild_id', 'role sync payload'),
    ...(data.discord_user_id === undefined
      ? {}
      : {
          discordUserId: stringField(data.discord_user_id, 'discord_user_id', 'role sync payload'),
        }),
  };
}

type RoleSyncState = {
  userId: string;
  databaseGuildId: string;
  guildId: string;
  discordUserId: string;
  entitlementVersion: string;
  entitlements: DiscordEntitlement[];
  mappings: DiscordRoleMapping[];
};

function entitlementStatus(
  row: { starts_at: Date; ends_at: Date | null; revoked_at: Date | null },
  now: Date,
): DiscordEntitlement['status'] {
  if (row.revoked_at) return 'revoked';
  if (now < row.starts_at) return 'incomplete';
  if (row.ends_at && now > row.ends_at) return 'expired';
  return 'active';
}

function roleStateVersion(
  entitlements: Array<{
    id: string;
    tier_id: string | null;
    status: DiscordEntitlement['status'];
    updated_at: Date;
  }>,
  mappings: Array<{ tier_id: string; discord_role_id: string; created_at: Date }>,
): string {
  return (
    [
      ...entitlements
        .map(
          (row) => `${row.id}:${row.tier_id ?? ''}:${row.status}:${row.updated_at.toISOString()}`,
        )
        .sort(),
      ...mappings
        .map((row) => `${row.tier_id}:${row.discord_role_id}:${row.created_at.toISOString()}`)
        .sort(),
    ].join('|') || 'empty'
  );
}

async function loadRoleSyncState(
  db: Db,
  payload: RoleSyncJobPayload,
  now = new Date(),
): Promise<RoleSyncState | null> {
  const guild = await db
    .selectFrom('discord_guild')
    .select(['id', 'project_id', 'discord_guild_id'])
    .where('id', '=', payload.discordGuildId)
    .where('project_id', '=', payload.projectId)
    .executeTakeFirst();
  if (!guild) throw new Error('Discord role sync guild was not found');

  const connection = await db
    .selectFrom('discord_connection')
    .select('discord_user_id')
    .where('project_id', '=', payload.projectId)
    .where('user_id', '=', payload.userId)
    .orderBy('updated_at', 'desc')
    .executeTakeFirst();
  const discordUserId = connection?.discord_user_id ?? payload.discordUserId;
  if (!discordUserId) return null;

  const [entitlementRows, mappingRows] = await Promise.all([
    connection
      ? db
          .selectFrom('entitlement')
          .select(['id', 'tier_id', 'starts_at', 'ends_at', 'revoked_at', 'updated_at'])
          .where('project_id', '=', payload.projectId)
          .where('user_id', '=', payload.userId)
          .execute()
      : Promise.resolve([]),
    db
      .selectFrom('discord_role_mapping')
      .select(['tier_id', 'discord_role_id', 'created_at'])
      .where('discord_guild_id', '=', guild.id)
      .execute(),
  ]);
  const entitlements = entitlementRows.map((row) => ({
    tierId: row.tier_id,
    status: entitlementStatus(row, now),
  }));
  return {
    userId: payload.userId,
    databaseGuildId: guild.id,
    guildId: guild.discord_guild_id,
    discordUserId,
    entitlementVersion: roleStateVersion(
      entitlementRows.map((row) => ({ ...row, status: entitlementStatus(row, now) })),
      mappingRows,
    ),
    entitlements,
    mappings: mappingRows.map((row) => ({ tierId: row.tier_id, roleId: row.discord_role_id })),
  };
}

const MANAGE_ROLES_PERMISSION = 1n << 28n;
const ADMINISTRATOR_PERMISSION = 1n << 3n;

function manageRolesGranted(permissions: string | undefined): boolean | undefined {
  if (permissions === undefined) return undefined;
  try {
    return (BigInt(permissions) & (MANAGE_ROLES_PERMISSION | ADMINISTRATOR_PERMISSION)) !== 0n;
  } catch {
    return false;
  }
}

async function persistRolePlanIssues(
  db: Db,
  state: RoleSyncState,
  issues: readonly { roleId: string; code: string }[],
  syncedAt: Date,
): Promise<void> {
  for (const issue of issues) {
    await recordDiscordRoleAssignment(db, {
      userId: state.userId,
      discordGuildId: state.databaseGuildId,
      discordRoleId: issue.roleId,
      status: issue.code,
      syncedAt,
    });
  }
}

async function persistRoleResults(
  db: Db,
  state: RoleSyncState,
  results: readonly Awaited<ReturnType<typeof applyRolePlan>>[number][],
  syncedAt: Date,
  terminalRetry = false,
): Promise<void> {
  for (const result of results) {
    const status =
      result.status === 'applied'
        ? result.operation.desiredState === 'present'
          ? 'active'
          : 'removed'
        : result.status === 'retry'
          ? terminalRetry
            ? 'failed'
            : 'retrying'
          : 'failed';
    await recordDiscordRoleAssignment(db, {
      userId: state.userId,
      discordGuildId: state.databaseGuildId,
      discordRoleId: result.operation.roleId,
      status,
      ...(result.operation.desiredState === 'absent' ? { entitlementId: null } : {}),
      syncedAt,
    });
  }
}

async function persistUnchangedRoleAssignments(
  db: Db,
  state: RoleSyncState,
  results: readonly Awaited<ReturnType<typeof applyRolePlan>>[number][],
  syncedAt: Date,
): Promise<void> {
  const changedRoles = new Set(results.map((result) => result.operation.roleId));
  const activeTiers = new Set(
    state.entitlements
      .filter((entitlement) => entitlement.status === 'active' || entitlement.status === 'grace')
      .flatMap((entitlement) => (entitlement.tierId ? [entitlement.tierId] : [])),
  );
  const seenRoles = new Set<string>();
  for (const mapping of state.mappings) {
    if (changedRoles.has(mapping.roleId) || seenRoles.has(mapping.roleId)) continue;
    seenRoles.add(mapping.roleId);
    await recordDiscordRoleAssignment(db, {
      userId: state.userId,
      discordGuildId: state.databaseGuildId,
      discordRoleId: mapping.roleId,
      status: activeTiers.has(mapping.tierId) ? 'active' : 'removed',
      syncedAt,
    });
  }
}

function topRolePosition(roleIds: readonly string[], roles: readonly DiscordRoleInfo[]): number {
  const positions = new Map(roles.map((role) => [role.id, role.position]));
  return Math.max(0, ...roleIds.map((roleId) => positions.get(roleId) ?? 0));
}

async function failRoleSyncJob(
  jobs: ReturnType<typeof createJobsRepository>,
  job: Job,
  error: unknown,
  workerId: string,
  nextAttemptAt = retryAt(error),
): Promise<void> {
  const message = error instanceof Error ? error.message : 'Discord role operation failed';
  await jobs.fail(job.id, message, nextAttemptAt, workerId);
}

async function processRoleSyncJob(
  jobs: ReturnType<typeof createJobsRepository>,
  db: Db,
  client: DiscordRestClient,
  botUserId: string,
  job: Job,
  workerId: string,
): Promise<void> {
  let leaseLost = false;
  const heartbeat = setInterval(
    () => {
      void jobs
        .renewLease(job.id, workerId)
        .then((renewed) => {
          if (renewed) return;
          leaseLost = true;
          clearInterval(heartbeat);
          log.warn('Discord job lease lost during handling', { jobId: job.id });
        })
        .catch((error: unknown) => {
          log.warn('Discord job lease heartbeat failed', {
            jobId: job.id,
            error: String(error),
          });
        });
    },
    Math.max(1_000, Math.floor(JOB_LEASE_TIMEOUT_MS / 2)),
  );
  try {
    const payload = parseRoleSyncPayload(job.payload);
    const state = await loadRoleSyncState(db, payload);
    if (!state) {
      if (!leaseLost) await jobs.complete(job.id, workerId);
      return;
    }
    const member = await client.getGuildMember(state.guildId, state.discordUserId);
    if (!member) {
      // Discord removes roles when a member leaves. The next periodic pass
      // sees the member after they rejoin and applies desired roles again.
      if (!leaseLost) await jobs.complete(job.id, workerId);
      return;
    }

    const [roles, botMember] = await Promise.all([
      client.getGuildRoles(state.guildId),
      client.getGuildMember(state.guildId, botUserId),
    ]);
    if (!botMember) throw new DiscordApiError('Discord bot is not a member of target guild', 503);
    const manageRoles = manageRolesGranted(botMember.permissions);

    const plan = planRoleReconciliation({
      guildId: state.guildId,
      discordUserId: state.discordUserId,
      entitlementVersion: state.entitlementVersion,
      entitlements: state.entitlements,
      mappings: state.mappings,
      roleInfo: roles,
      actualRoleIds: member.roleIds,
      botTopRolePosition: topRolePosition(botMember.roleIds, roles),
      ...(manageRoles === undefined ? {} : { manageRolesGranted: manageRoles }),
    });

    if (plan.issues.length > 0) {
      await persistRolePlanIssues(db, state, plan.issues, new Date());
      const issue = plan.issues[0];
      throw new Error(issue?.message ?? 'Discord role mapping cannot be reconciled');
    }

    const results = await applyRolePlan(plan, client);
    const retry = results.find((result) => result.retryable);
    const failure = results.find((result) => !result.retryable);
    const syncedAt = new Date();
    await persistRoleResults(
      db,
      state,
      results,
      syncedAt,
      Boolean(retry && job.attempt_count + 1 >= job.max_attempts),
    );
    await persistUnchangedRoleAssignments(db, state, results, syncedAt);
    if (retry || failure) {
      const result = retry ?? failure;
      const error = result?.error ?? 'Discord role operation failed';
      await failRoleSyncJob(jobs, job, new Error(error), workerId, result?.nextAttemptAt);
      return;
    }
    if (!leaseLost) await jobs.complete(job.id, workerId);
  } catch (error) {
    await failRoleSyncJob(jobs, job, error, workerId);
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = readDiscordBotConfig(env);
  const db = createDb(config.databaseUrl);
  const jobs = createJobsRepository(db);
  const client = new DiscordRestClient(config.token, { baseUrl: config.apiBaseUrl });

  try {
    const recovered = await jobs.recoverStaleLeases({ queue: 'discord' });
    if (recovered.requeued || recovered.failed) {
      log.info('stale Discord jobs recovered', recovered);
    }
    let nextLeaseRecoveryAt = Date.now() + JOB_LEASE_TIMEOUT_MS;
    let nextReconciliationAt = 0;
    const bot = await client.getCurrentUser();
    log.info('connected', { botId: bot.id, workerId: WORKER_ID });
    const gateway = connectDiscordGateway({
      token: config.token,
      gatewayUrl: config.gatewayUrl,
      onMemberEvent: async ({ guildId, discordUserId }) => {
        await enqueueDiscordRoleSyncForMember(db, { discordGuildId: guildId, discordUserId });
      },
      onError: (error) => log.warn('Discord Gateway connection failed', { error: error.message }),
    });

    let stopping = false;
    const shutdown = async () => {
      if (stopping) return;
      stopping = true;
      log.info('shutting down');
      gateway.stop();
      await destroyDb(db);
      await shutdownTelemetry();
      process.exit(0);
    };
    process.on('SIGINT', () => void shutdown());
    process.on('SIGTERM', () => void shutdown());

    const loop = async (): Promise<void> => {
      if (stopping) return;
      try {
        if (Date.now() >= nextLeaseRecoveryAt) {
          nextLeaseRecoveryAt = Date.now() + JOB_LEASE_TIMEOUT_MS;
          const recovered = await jobs.recoverStaleLeases({ queue: 'discord' });
          if (recovered.requeued || recovered.failed) {
            log.info('stale Discord jobs recovered', recovered);
          }
        }
        if (Date.now() >= nextReconciliationAt) {
          const enqueued = await enqueuePeriodicDiscordRoleSyncJobs(db);
          if (enqueued) log.info('periodic Discord role jobs enqueued', { enqueued });
          nextReconciliationAt = Date.now() + config.reconcileIntervalMs;
        }
        const job = await jobs.claimNext('discord', WORKER_ID);
        if (job) {
          if (job.kind !== 'discord.role_sync') {
            await failRoleSyncJob(
              jobs,
              job,
              new Error(`Unsupported Discord job kind: ${job.kind}`),
              WORKER_ID,
            );
          } else {
            await processRoleSyncJob(jobs, db, client, bot.id, job, WORKER_ID);
          }
        }
      } catch (error) {
        log.error('role sync failed', {
          retryable: isRetryableDiscordError(error),
          error: error instanceof Error ? error.message : 'Unknown Discord worker error',
        });
      } finally {
        if (!stopping) setTimeout(() => void loop(), config.pollMs);
      }
    };

    await loop();
    await new Promise<void>(() => undefined);
  } catch (error) {
    await destroyDb(db);
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    log.error('fatal', { error: error instanceof Error ? error.message : 'Unknown startup error' });
    process.exit(1);
  });
}

export { parseRoleSyncPayload };
