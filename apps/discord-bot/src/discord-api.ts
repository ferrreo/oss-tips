import { DiscordApiError } from './errors.js';

type JsonRecord = Record<string, unknown>;

export type DiscordUser = {
  id: string;
  username: string;
};

export type DiscordGuild = {
  id: string;
  name: string;
};

export type DiscordGuildMember = {
  userId: string;
  roleIds: string[];
  permissions?: string;
};

export type DiscordRole = {
  id: string;
  position: number;
  managed: boolean;
};

export type Fetcher = typeof fetch;

function record(value: unknown, context: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DiscordApiError(`Discord returned an invalid ${context}`, 502);
  }
  return value as JsonRecord;
}

function stringField(value: unknown, field: string, context: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DiscordApiError(`Discord returned an invalid ${field} for ${context}`, 502);
  }
  return value;
}

export class DiscordRestClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;

  constructor(token: string, options: { baseUrl?: string; fetcher?: Fetcher } = {}) {
    this.token = token;
    this.baseUrl = (options.baseUrl ?? 'https://discord.com/api/v10').replace(/\/$/, '');
    this.fetcher = options.fetcher ?? fetch;
  }

  async getCurrentUser(): Promise<DiscordUser> {
    const body = await this.request('/users/@me', 'GET');
    const data = record(body, 'current-user response');
    return {
      id: stringField(data.id, 'id', 'current-user response'),
      username: stringField(data.username, 'username', 'current-user response'),
    };
  }

  async getGuild(guildId: string): Promise<DiscordGuild> {
    const body = await this.request(`/guilds/${encodeURIComponent(guildId)}`, 'GET');
    const data = record(body, 'guild response');
    return {
      id: stringField(data.id, 'id', 'guild response'),
      name: stringField(data.name, 'name', 'guild response'),
    };
  }

  async getGuildRoles(guildId: string): Promise<DiscordRole[]> {
    const body = await this.request(`/guilds/${encodeURIComponent(guildId)}/roles`, 'GET');
    if (!Array.isArray(body))
      throw new DiscordApiError('Discord returned an invalid roles response', 502);
    return body.map((value) => {
      const data = record(value, 'role response');
      if (typeof data.position !== 'number' || typeof data.managed !== 'boolean') {
        throw new DiscordApiError('Discord returned an invalid role response', 502);
      }
      return {
        id: stringField(data.id, 'id', 'role response'),
        position: data.position,
        managed: data.managed,
      };
    });
  }

  async getGuildMember(guildId: string, userId: string): Promise<DiscordGuildMember | null> {
    let body: unknown;
    try {
      body = await this.request(
        `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`,
        'GET',
      );
    } catch (error) {
      if (error instanceof DiscordApiError && error.status === 404) return null;
      throw error;
    }
    const data = record(body, 'member response');
    const roles = data.roles;
    if (!Array.isArray(roles) || !roles.every((role): role is string => typeof role === 'string')) {
      throw new DiscordApiError('Discord returned an invalid member response', 502);
    }
    const user = record(data.user, 'member user response');
    const permissions = data.permissions;
    if (permissions !== undefined && typeof permissions !== 'string') {
      throw new DiscordApiError('Discord returned an invalid member permissions field', 502);
    }
    return {
      userId: stringField(user.id, 'user.id', 'member response'),
      roleIds: roles,
      ...(permissions === undefined ? {} : { permissions }),
    };
  }

  async addRole(guildId: string, userId: string, roleId: string): Promise<void> {
    await this.request(
      `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
      'PUT',
    );
  }

  async removeRole(guildId: string, userId: string, roleId: string): Promise<void> {
    await this.request(
      `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
      'DELETE',
    );
  }

  private async request(path: string, method: 'GET' | 'PUT' | 'DELETE'): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bot ${this.token}`,
          Accept: 'application/json',
        },
      });
    } catch {
      throw new DiscordApiError('Discord request could not be sent', 503);
    }

    if (!response.ok) {
      let retryAfterMs: number | null = null;
      const retryAfterHeader = response.headers.get('retry-after');
      if (retryAfterHeader) {
        const seconds = Number(retryAfterHeader);
        if (Number.isFinite(seconds) && seconds >= 0) retryAfterMs = seconds * 1_000;
      }
      if (response.status === 429) {
        try {
          const body = record(await response.json(), 'rate-limit response');
          if (typeof body.retry_after === 'number' && body.retry_after >= 0) {
            retryAfterMs = body.retry_after * 1_000;
          }
        } catch {
          // Header is sufficient. Keep response details out of logs and errors.
        }
      }
      throw new DiscordApiError(
        `Discord request failed with status ${response.status}`,
        response.status,
        retryAfterMs,
      );
    }

    if (response.status === 204) return undefined;
    try {
      return await response.json();
    } catch {
      throw new DiscordApiError('Discord returned an invalid JSON response', 502);
    }
  }
}
