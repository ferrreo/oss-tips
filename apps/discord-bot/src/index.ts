import { createLogger } from '@oss-tips/observability';

const log = createLogger('@oss-tips/discord-bot');

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    log.warn('DISCORD_BOT_TOKEN not set; bot will not connect');
  }

  log.info('ready', {
    mode: token ? 'live-stub' : 'idle-stub',
    guildSync: Boolean(process.env.DISCORD_GUILD_ID),
  });

  const shutdown = () => {
    log.info('shutting down');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  log.error('fatal', { error: String(err) });
  process.exit(1);
});
