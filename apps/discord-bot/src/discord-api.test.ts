import { describe, expect, it, vi } from 'vitest';
import { DiscordRestClient } from './discord-api.js';

describe('Discord member permissions', () => {
  it('keeps resolved permissions for worker safety checks', async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            user: { id: 'discord-user' },
            roles: ['role-member'],
            permissions: '268435456',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    const client = new DiscordRestClient('token', {
      baseUrl: 'https://discord.test/api/v10',
      fetcher,
    });

    await expect(client.getGuildMember('guild-1', 'discord-user')).resolves.toEqual({
      userId: 'discord-user',
      roleIds: ['role-member'],
      permissions: '268435456',
    });
  });
});
