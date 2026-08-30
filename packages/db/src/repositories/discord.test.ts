import { describe, expect, it } from 'vitest';
import type { Db } from '../client.js';
import {
  DISCORD_ROLE_SYNC_KIND,
  DISCORD_ROLE_SYNC_QUEUE,
  DISCORD_RECONCILIATION_INTERVAL_MS,
  discordRoleSyncJob,
  enqueueDiscordRoleSyncForMember,
  enqueuePeriodicDiscordRoleSyncJobs,
  recordDiscordRoleAssignment,
  replaceTierDiscordRoleMappings,
} from './discord.js';

type FakeGuild = {
  id: string;
  project_id: string;
  discord_guild_id: string;
  bot_installed: boolean;
  created_at: Date;
};

type FakeConnection = {
  project_id: string;
  user_id: string | null;
  discord_user_id: string;
};

type FakeMapping = {
  id: string;
  discord_guild_id: string;
  tier_id: string;
  discord_role_id: string;
};

type FakeJob = {
  id: string;
  kind: string;
  dedupe_key: string | null;
  status: string;
  created_at: Date;
  payload: unknown;
};

type FakeAssignment = {
  id: string;
  user_id: string;
  discord_guild_id: string;
  discord_role_id: string;
  entitlement_id: string | null;
  status: string;
  last_synced_at: Date | null;
};

type Filter = [column: string, operator: string, value: unknown];

function fakeDb(input: {
  guilds?: FakeGuild[];
  connections?: FakeConnection[];
  mappings?: FakeMapping[];
  jobs?: FakeJob[];
  assignments?: FakeAssignment[];
}): Db {
  const state = {
    guilds: input.guilds ?? [],
    connections: input.connections ?? [],
    mappings: input.mappings ?? [],
    jobs: input.jobs ?? [],
    assignments: input.assignments ?? [],
  };

  const matches = (row: Record<string, unknown>, filters: Filter[]) =>
    filters.every(([column, operator, value]) => {
      const actual =
        column === 'discord_guild.discord_guild_id'
          ? row.discord_guild_external_id
          : row[column.split('.').at(-1)!];
      if (operator === '=') return actual === value;
      if (operator === '>')
        return actual instanceof Date && value instanceof Date && actual > value;
      if (operator === 'in') return Array.isArray(value) && value.includes(actual);
      if (operator === 'is not') return actual !== null;
      return true;
    });

  const db: any = {
    selectFrom(table: string) {
      const filters: Filter[] = [];
      const query: any = {
        innerJoin: () => query,
        select: () => query,
        selectAll: () => query,
        orderBy: () => query,
        where: (column: string, operator: string, value: unknown) => {
          filters.push([column, operator, value]);
          return query;
        },
        execute: async () => {
          if (table === 'discord_guild') {
            return state.guilds.filter((row) => matches(row, filters));
          }
          if (table === 'discord_connection') {
            return state.connections.flatMap((connection) =>
              state.guilds
                .filter(
                  (guild) => guild.project_id === connection.project_id && guild.bot_installed,
                )
                .map((guild) => ({
                  project_id: connection.project_id,
                  user_id: connection.user_id,
                  discord_user_id: connection.discord_user_id,
                  discord_guild_id: guild.id,
                  discord_guild_external_id: guild.discord_guild_id,
                  bot_installed: guild.bot_installed,
                }))
                .filter((row) => matches(row, filters)),
            );
          }
          if (table === 'job') return state.jobs.filter((row) => matches(row, filters));
          if (table === 'discord_role_assignment')
            return state.assignments.filter((row) => matches(row, filters));
          throw new Error(`unexpected select table: ${table}`);
        },
        executeTakeFirst: async () => {
          const rows = await query.execute();
          return rows[0];
        },
      };
      return query;
    },
    insertInto(table: string) {
      let values: unknown;
      const query: any = {
        values: (inputValues: unknown) => {
          values = inputValues;
          return query;
        },
        execute: async () => {
          if (table === 'job') {
            state.jobs.push(...((Array.isArray(values) ? values : [values]) as FakeJob[]));
            return;
          }
          if (table === 'discord_role_mapping') {
            state.mappings.push(...((Array.isArray(values) ? values : [values]) as FakeMapping[]));
            return;
          }
          if (table === 'discord_role_assignment') {
            state.assignments.push(
              ...((Array.isArray(values) ? values : [values]) as FakeAssignment[]),
            );
            return;
          }
          throw new Error(`unexpected insert table: ${table}`);
        },
      };
      return query;
    },
    updateTable(table: string) {
      const filters: Filter[] = [];
      let values: Record<string, unknown> = {};
      const query: any = {
        set: (inputValues: Record<string, unknown>) => {
          values = inputValues;
          return query;
        },
        where: (column: string, operator: string, value: unknown) => {
          filters.push([column, operator, value]);
          return query;
        },
        execute: async () => {
          if (table !== 'discord_role_assignment')
            throw new Error(`unexpected update table: ${table}`);
          state.assignments = state.assignments.map((row) =>
            matches(row, filters) ? { ...row, ...values } : row,
          );
        },
      };
      return query;
    },
    deleteFrom(table: string) {
      const filters: Filter[] = [];
      const query: any = {
        where: (column: string, operator: string, value: unknown) => {
          filters.push([column, operator, value]);
          return query;
        },
        execute: async () => {
          if (table !== 'discord_role_mapping')
            throw new Error(`unexpected delete table: ${table}`);
          state.mappings = state.mappings.filter((row) => !matches(row, filters));
        },
      };
      return query;
    },
  };

  Object.defineProperty(db, '__state', { value: state });
  return db as Db;
}

describe('Discord role sync producer', () => {
  it('builds an ID-only role sync job', () => {
    const job = discordRoleSyncJob({
      projectId: 'project_1',
      userId: 'user_1',
      discordGuildId: 'guild_1',
      discordUserId: 'discord_user_1',
    });

    expect(job).toMatchObject({
      queue: DISCORD_ROLE_SYNC_QUEUE,
      kind: DISCORD_ROLE_SYNC_KIND,
      dedupe_key: 'project_1:user_1:guild_1',
      payload: {
        project_id: 'project_1',
        user_id: 'user_1',
        discord_guild_id: 'guild_1',
        discord_user_id: 'discord_user_1',
      },
    });
    expect(job.payload).not.toHaveProperty('entitlements');
    expect(job.payload).not.toHaveProperty('mappings');
  });

  it('records latest assignment state for success, removal, and retry', async () => {
    const db = fakeDb({
      assignments: [
        {
          id: 'assignment_1',
          user_id: 'user_1',
          discord_guild_id: 'guild_1',
          discord_role_id: 'role_1',
          entitlement_id: 'entitlement_1',
          status: 'active',
          last_synced_at: new Date('2026-08-29T00:00:00.000Z'),
        },
      ],
    });
    const syncedAt = new Date('2026-08-30T00:00:00.000Z');

    await recordDiscordRoleAssignment(db, {
      userId: 'user_1',
      discordGuildId: 'guild_1',
      discordRoleId: 'role_1',
      status: 'retrying',
      syncedAt,
    });
    await recordDiscordRoleAssignment(db, {
      userId: 'user_1',
      discordGuildId: 'guild_1',
      discordRoleId: 'role_1',
      status: 'removed',
      entitlementId: null,
      syncedAt,
    });
    await recordDiscordRoleAssignment(db, {
      userId: 'user_2',
      discordGuildId: 'guild_1',
      discordRoleId: 'role_1',
      status: 'missing_permission',
      syncedAt,
    });
    await recordDiscordRoleAssignment(db, {
      userId: 'user_3',
      discordGuildId: 'guild_1',
      discordRoleId: 'role_1',
      status: 'active',
      syncedAt,
    });

    const state = (db as any).__state as { assignments: FakeAssignment[] };
    expect(state.assignments).toEqual([
      {
        id: 'assignment_1',
        user_id: 'user_1',
        discord_guild_id: 'guild_1',
        discord_role_id: 'role_1',
        entitlement_id: null,
        status: 'removed',
        last_synced_at: syncedAt,
      },
      expect.objectContaining({
        user_id: 'user_2',
        discord_guild_id: 'guild_1',
        discord_role_id: 'role_1',
        status: 'missing_permission',
        last_synced_at: syncedAt,
      }),
      expect.objectContaining({
        user_id: 'user_3',
        discord_guild_id: 'guild_1',
        discord_role_id: 'role_1',
        status: 'active',
        last_synced_at: syncedAt,
      }),
    ]);
  });

  it('replaces all mapped roles for a tier and deduplicates role ids', async () => {
    const db = fakeDb({
      guilds: [
        {
          id: 'guild_row_1',
          project_id: 'project_1',
          discord_guild_id: 'guild_external_1',
          bot_installed: true,
          created_at: new Date('2026-08-30T00:00:00.000Z'),
        },
      ],
      mappings: [
        {
          id: 'old_mapping',
          discord_guild_id: 'guild_row_1',
          tier_id: 'tier_1',
          discord_role_id: 'role_old',
        },
      ],
    });

    await replaceTierDiscordRoleMappings(db, {
      projectId: 'project_1',
      tierId: 'tier_1',
      discordGuildId: 'guild_external_1',
      roleIds: [' role_a ', 'role_b', 'role_a'],
    });

    const state = (db as any).__state as { mappings: FakeMapping[] };
    expect(state.mappings.map((mapping) => mapping.discord_role_id)).toEqual(['role_a', 'role_b']);
    expect(state.mappings.every((mapping) => mapping.discord_guild_id === 'guild_row_1')).toBe(
      true,
    );
  });

  it('does not enqueue duplicate periodic jobs within reconciliation interval', async () => {
    const db = fakeDb({
      guilds: [
        {
          id: 'guild_row_1',
          project_id: 'project_1',
          discord_guild_id: 'guild_external_1',
          bot_installed: true,
          created_at: new Date('2026-08-30T00:00:00.000Z'),
        },
      ],
      connections: [
        { project_id: 'project_1', user_id: 'user_1', discord_user_id: 'discord_user_1' },
      ],
    });
    const now = new Date('2026-08-30T00:00:00.000Z');

    await expect(
      enqueuePeriodicDiscordRoleSyncJobs(db, {
        now,
        minimumIntervalMs: DISCORD_RECONCILIATION_INTERVAL_MS,
        discordGuildId: 'guild_external_1',
      }),
    ).resolves.toBe(1);
    await expect(
      enqueuePeriodicDiscordRoleSyncJobs(db, {
        now: new Date(now.getTime() + 60 * 60 * 1_000),
        minimumIntervalMs: DISCORD_RECONCILIATION_INTERVAL_MS,
        discordGuildId: 'guild_external_1',
      }),
    ).resolves.toBe(0);

    const state = (db as any).__state as { jobs: FakeJob[] };
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]?.payload).toMatchObject({
      project_id: 'project_1',
      user_id: 'user_1',
      discord_guild_id: 'guild_row_1',
    });
  });

  it('queues only the linked member and guild from a gateway event', async () => {
    const db = fakeDb({
      guilds: [
        {
          id: 'guild_row_1',
          project_id: 'project_1',
          discord_guild_id: 'guild_external_1',
          bot_installed: true,
          created_at: new Date('2026-08-30T00:00:00.000Z'),
        },
        {
          id: 'guild_row_2',
          project_id: 'project_1',
          discord_guild_id: 'guild_external_2',
          bot_installed: true,
          created_at: new Date('2026-08-30T00:00:00.000Z'),
        },
      ],
      connections: [
        { project_id: 'project_1', user_id: 'user_1', discord_user_id: 'discord_user_1' },
        { project_id: 'project_1', user_id: 'user_2', discord_user_id: 'discord_user_2' },
      ],
    });

    await expect(
      enqueueDiscordRoleSyncForMember(db, {
        discordGuildId: 'guild_external_1',
        discordUserId: 'discord_user_1',
      }),
    ).resolves.toBe(1);
    await expect(
      enqueueDiscordRoleSyncForMember(db, {
        discordGuildId: 'guild_external_1',
        discordUserId: 'discord_user_1',
      }),
    ).resolves.toBe(0);

    const state = (db as any).__state as { jobs: FakeJob[] };
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]?.payload).toMatchObject({
      project_id: 'project_1',
      user_id: 'user_1',
      discord_guild_id: 'guild_row_1',
      discord_user_id: 'discord_user_1',
    });
  });

  it('reconciles linked supporters across every installed project guild', async () => {
    const db = fakeDb({
      guilds: [
        {
          id: 'guild_row_1',
          project_id: 'project_1',
          discord_guild_id: 'guild_external_1',
          bot_installed: true,
          created_at: new Date('2026-08-30T00:00:00.000Z'),
        },
        {
          id: 'guild_row_2',
          project_id: 'project_2',
          discord_guild_id: 'guild_external_2',
          bot_installed: true,
          created_at: new Date('2026-08-30T00:00:00.000Z'),
        },
      ],
      connections: [
        { project_id: 'project_1', user_id: 'user_1', discord_user_id: 'discord_user_1' },
        { project_id: 'project_2', user_id: 'user_2', discord_user_id: 'discord_user_2' },
      ],
    });

    await expect(
      enqueuePeriodicDiscordRoleSyncJobs(db, {
        now: new Date('2026-08-30T00:00:00.000Z'),
      }),
    ).resolves.toBe(2);

    const state = (db as any).__state as { jobs: FakeJob[] };
    expect(
      state.jobs
        .map((job) => job.payload as Record<string, string>)
        .sort((left, right) => (left.project_id ?? '').localeCompare(right.project_id ?? '')),
    ).toEqual([
      expect.objectContaining({
        project_id: 'project_1',
        user_id: 'user_1',
        discord_guild_id: 'guild_row_1',
      }),
      expect.objectContaining({
        project_id: 'project_2',
        user_id: 'user_2',
        discord_guild_id: 'guild_row_2',
      }),
    ]);
  });
});
