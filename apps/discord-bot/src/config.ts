import { DISCORD_GATEWAY_URL } from './gateway.js';

const DEFAULT_DISCORD_API_BASE_URL = 'https://discord.com/api/v10';
const DEFAULT_POLL_MS = 2_000;
const DEFAULT_RECONCILE_INTERVAL_MS = 24 * 60 * 60 * 1_000;

export type DiscordBotConfig = {
  token: string;
  databaseUrl: string;
  pollMs: number;
  reconcileIntervalMs: number;
  apiBaseUrl: string;
  gatewayUrl: string;
};

export class DiscordBotConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscordBotConfigurationError';
  }
}

function parseReconcileIntervalMs(env: NodeJS.ProcessEnv): number {
  const raw = env.DISCORD_RECONCILE_INTERVAL_MS?.trim();
  if (!raw) return DEFAULT_RECONCILE_INTERVAL_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 60_000) {
    throw new DiscordBotConfigurationError(
      'DISCORD_RECONCILE_INTERVAL_MS must be an integer of at least 60000',
    );
  }
  return value;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new DiscordBotConfigurationError(`${name} is required`);
  return value;
}

function parsePollMs(env: NodeJS.ProcessEnv): number {
  const raw = env.DISCORD_POLL_MS?.trim();
  if (!raw) return DEFAULT_POLL_MS;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 100) {
    throw new DiscordBotConfigurationError('DISCORD_POLL_MS must be an integer of at least 100');
  }
  return value;
}

function parseApiBaseUrl(env: NodeJS.ProcessEnv): string {
  const raw = env.DISCORD_API_BASE_URL?.trim() || DEFAULT_DISCORD_API_BASE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new DiscordBotConfigurationError('DISCORD_API_BASE_URL must be a valid URL');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new DiscordBotConfigurationError(
      'DISCORD_API_BASE_URL must not contain credentials, query parameters, or a fragment',
    );
  }
  if (env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new DiscordBotConfigurationError('DISCORD_API_BASE_URL must use HTTPS in production');
  }
  return url.toString().replace(/\/$/, '');
}

function parseGatewayUrl(env: NodeJS.ProcessEnv): string {
  const raw = env.DISCORD_GATEWAY_URL?.trim() || DISCORD_GATEWAY_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new DiscordBotConfigurationError('DISCORD_GATEWAY_URL must be a valid URL');
  }
  if (url.username || url.password || url.hash) {
    throw new DiscordBotConfigurationError(
      'DISCORD_GATEWAY_URL must not contain credentials or a fragment',
    );
  }
  if (env.NODE_ENV === 'production' && url.protocol !== 'wss:') {
    throw new DiscordBotConfigurationError('DISCORD_GATEWAY_URL must use WSS in production');
  }
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new DiscordBotConfigurationError('DISCORD_GATEWAY_URL must use ws or wss');
  }
  return url.toString();
}

/**
 * Read only deployment configuration. A bot without its token or queue
 * database cannot reconcile roles, so startup fails instead of entering a
 * process that only looks healthy.
 */
export function readDiscordBotConfig(env: NodeJS.ProcessEnv = process.env): DiscordBotConfig {
  return {
    token: required(env, 'DISCORD_BOT_TOKEN'),
    databaseUrl: required(env, 'DATABASE_URL'),
    pollMs: parsePollMs(env),
    reconcileIntervalMs: parseReconcileIntervalMs(env),
    apiBaseUrl: parseApiBaseUrl(env),
    gatewayUrl: parseGatewayUrl(env),
  };
}
