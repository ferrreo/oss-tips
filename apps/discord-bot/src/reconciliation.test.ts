import { describe, expect, it } from 'vitest';
import { DiscordApiError } from './errors.js';
import { applyRolePlan, planRoleReconciliation, type DiscordRolePlan } from './reconciliation.js';

const roleInfo = [
  { id: 'role-supporter', position: 2, managed: false },
  { id: 'role-maintainer', position: 3, managed: false },
  { id: 'role-bot', position: 10, managed: false },
];
const mappings = [
  { tierId: 'tier-supporter', roleId: 'role-supporter' },
  { tierId: 'tier-maintainer', roleId: 'role-maintainer' },
];

function plan(status: 'active' | 'grace' | 'expired' | 'refunded', actualRoleIds: string[] = []) {
  return planRoleReconciliation({
    guildId: 'guild-1',
    discordUserId: 'discord-1',
    entitlementVersion: 'entitlement-v1',
    entitlements: [{ tierId: 'tier-supporter', status }],
    mappings,
    roleInfo,
    actualRoleIds,
    botTopRolePosition: 10,
  });
}

describe('Discord desired role state', () => {
  it('adds role when an entitled supporter joins', () => {
    const result = plan('active');
    expect(result.operations).toMatchObject([
      { roleId: 'role-supporter', desiredState: 'present' },
    ]);
  });

  it('removes role when entitlement leaves or is refunded', () => {
    expect(plan('expired', ['role-supporter']).operations).toMatchObject([
      { roleId: 'role-supporter', desiredState: 'absent' },
    ]);
    expect(plan('refunded', ['role-supporter']).operations).toMatchObject([
      { roleId: 'role-supporter', desiredState: 'absent' },
    ]);
  });

  it('keeps role during failed renewal grace', () => {
    expect(plan('grace', ['role-supporter']).operations).toHaveLength(0);
  });

  it('renews desired state without duplicating an existing role', () => {
    const renewed = planRoleReconciliation({
      guildId: 'guild-1',
      discordUserId: 'discord-1',
      entitlementVersion: 'entitlement-v2',
      entitlements: [{ tierId: 'tier-supporter', status: 'active' }],
      mappings,
      roleInfo,
      actualRoleIds: ['role-supporter'],
      botTopRolePosition: 10,
    });
    expect(renewed.operations).toHaveLength(0);
  });

  it('blocks roles the bot cannot safely manage', () => {
    const result = planRoleReconciliation({
      ...{
        guildId: 'guild-1',
        discordUserId: 'discord-1',
        entitlementVersion: 'v1',
        entitlements: [{ tierId: 'tier-supporter', status: 'active' as const }],
        mappings,
        roleInfo,
        actualRoleIds: [],
      },
      botTopRolePosition: 2,
    });
    expect(result.operations).toHaveLength(0);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'role_hierarchy', roleId: 'role-supporter' }),
      ]),
    );
  });

  it('reports missing Manage Roles permission before attempting changes', () => {
    const result = planRoleReconciliation({
      guildId: 'guild-1',
      discordUserId: 'discord-1',
      entitlementVersion: 'v1',
      entitlements: [{ tierId: 'tier-supporter', status: 'active' }],
      mappings,
      roleInfo,
      actualRoleIds: [],
      botTopRolePosition: 10,
      manageRolesGranted: false,
    });

    expect(result.operations).toHaveLength(0);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing_permission', roleId: 'role-supporter' }),
      ]),
    );
  });
});

describe('Discord role application', () => {
  it('retries permission failures without reporting success', async () => {
    const rolePlan: DiscordRolePlan = {
      operations: [
        {
          guildId: 'guild-1',
          discordUserId: 'discord-1',
          roleId: 'role-supporter',
          desiredState: 'present',
          entitlementVersion: 'v1',
          idempotencyKey: 'guild-1:discord-1:role-supporter:present:v1',
        },
      ],
      issues: [],
    };
    const result = await applyRolePlan(rolePlan, {
      addRole: async () => {
        throw new DiscordApiError('forbidden', 403);
      },
      removeRole: async () => undefined,
    });
    expect(result[0]).toMatchObject({ status: 'retry', retryable: true });
    expect(result[0]?.nextAttemptAt).toBeInstanceOf(Date);
  });

  it('only reports applied after Discord acknowledges the request', async () => {
    const rolePlan = plan('active');
    const calls: string[] = [];
    const result = await applyRolePlan(rolePlan, {
      addRole: async (_guild, _user, role) => {
        calls.push(`add:${role}`);
      },
      removeRole: async () => undefined,
    });
    expect(calls).toEqual(['add:role-supporter']);
    expect(result).toMatchObject([{ status: 'applied', retryable: false }]);
  });
});
