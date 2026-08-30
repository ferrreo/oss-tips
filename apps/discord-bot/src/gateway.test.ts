import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectDiscordGateway, DISCORD_GATEWAY_INTENTS } from './gateway.js';

type Event = { data?: unknown; code?: number };

class FakeSocket {
  readyState = 1;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, ((event: Event) => void)[]>();

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code = 1000): void {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    this.emit('close', { code });
  }

  emit(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  message(payload: Record<string, unknown>): void {
    this.emit('message', { data: JSON.stringify(payload) });
  }
}

function payload(socket: FakeSocket, index = 0): Record<string, any> {
  return JSON.parse(socket.sent[index] ?? '{}') as Record<string, any>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Discord Gateway', () => {
  it('identifies with member intents and forwards member events', async () => {
    const sockets: FakeSocket[] = [];
    const events: Array<{ type: string; guildId: string; discordUserId: string }> = [];
    const connection = connectDiscordGateway({
      token: 'bot-token',
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      onMemberEvent: (event) => {
        events.push(event);
      },
    });
    const socket = sockets[0]!;
    socket.message({ op: 10, d: { heartbeat_interval: 60_000 } });

    expect(payload(socket)).toMatchObject({
      op: 2,
      d: { token: 'bot-token', intents: DISCORD_GATEWAY_INTENTS },
    });

    socket.message({
      op: 0,
      s: 1,
      t: 'READY',
      d: { session_id: 'session-1', resume_gateway_url: 'wss://gateway.discord.gg' },
    });
    socket.message({
      op: 0,
      s: 2,
      t: 'GUILD_MEMBER_ADD',
      d: { guild_id: 'guild-1', user: { id: 'discord-user-1' } },
    });
    socket.message({
      op: 0,
      s: 3,
      t: 'GUILD_MEMBER_UPDATE',
      d: { guild_id: 'guild-1', user: { id: 'discord-user-1' } },
    });
    await Promise.resolve();

    expect(events).toEqual([
      { type: 'GUILD_MEMBER_ADD', guildId: 'guild-1', discordUserId: 'discord-user-1' },
      { type: 'GUILD_MEMBER_UPDATE', guildId: 'guild-1', discordUserId: 'discord-user-1' },
    ]);
    connection.stop();
  });

  it('heartbeats on Discord interval and reconnects with resume state', () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    const connection = connectDiscordGateway({
      token: 'bot-token',
      reconnectDelayMs: 50,
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      onMemberEvent: () => undefined,
    });
    const first = sockets[0]!;
    first.message({ op: 10, d: { heartbeat_interval: 10 } });
    first.message({
      op: 0,
      s: 7,
      t: 'READY',
      d: { session_id: 'session-1', resume_gateway_url: 'wss://resume.discord.test' },
    });

    vi.advanceTimersByTime(10);
    expect(payload(first, 1)).toMatchObject({ op: 1, d: 7 });
    first.message({ op: 11, d: null });
    first.close(1006);
    vi.advanceTimersByTime(49);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);

    const second = sockets[1]!;
    second.message({ op: 10, d: { heartbeat_interval: 10 } });
    expect(payload(second)).toMatchObject({
      op: 6,
      d: { token: 'bot-token', session_id: 'session-1', seq: 7 },
    });
    connection.stop();
  });
});
