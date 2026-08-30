import { describe, expect, it } from 'vitest';
import { DiscordBotConfigurationError, readDiscordBotConfig } from './config.js';

const configured = {
  NODE_ENV: 'test',
  DISCORD_BOT_TOKEN: 'bot-token',
  DATABASE_URL: 'postgres://localhost/oss_tips',
};

describe('Discord bot configuration', () => {
  it('requires live credentials and queue storage', () => {
    expect(() => readDiscordBotConfig({ NODE_ENV: 'production' })).toThrow(
      DiscordBotConfigurationError,
    );
    expect(() => readDiscordBotConfig({ ...configured, DISCORD_BOT_TOKEN: ' ' })).toThrow(
      'DISCORD_BOT_TOKEN is required',
    );
    expect(() => readDiscordBotConfig({ ...configured, DATABASE_URL: '' })).toThrow(
      'DATABASE_URL is required',
    );
  });

  it('parses safe defaults', () => {
    const config = readDiscordBotConfig({ ...configured, DISCORD_GUILD_ID: 'legacy-guild' });
    expect(config).toMatchObject({
      pollMs: 2_000,
      reconcileIntervalMs: 24 * 60 * 60 * 1_000,
      apiBaseUrl: 'https://discord.com/api/v10',
      gatewayUrl: 'wss://gateway.discord.gg/?v=10&encoding=json',
    });
    expect(config).not.toHaveProperty('guildId');
  });

  it('rejects unsafe production API endpoints', () => {
    expect(() =>
      readDiscordBotConfig({
        ...configured,
        NODE_ENV: 'production',
        DISCORD_API_BASE_URL: 'http://discord.internal/api/v10',
      }),
    ).toThrow('must use HTTPS in production');
  });

  it('rejects unsafe production Gateway endpoints', () => {
    expect(() =>
      readDiscordBotConfig({
        ...configured,
        NODE_ENV: 'production',
        DISCORD_GATEWAY_URL: 'ws://discord.internal/?v=10&encoding=json',
      }),
    ).toThrow('must use WSS in production');
  });
});
