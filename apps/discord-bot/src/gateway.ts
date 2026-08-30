export const DISCORD_GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';
export const DISCORD_GATEWAY_INTENTS = (1 << 0) | (1 << 1);

const OPEN = 1;
const RECONNECT_CLOSE_CODE = 4_000;
const FATAL_CLOSE_CODES = new Set([4_004, 4_010, 4_011, 4_013, 4_014]);

type GatewayEvent = { data?: unknown; code?: number };

type GatewaySocket = {
  readyState: number;
  send(data: string): void;
  close(code?: number): void;
  addEventListener(
    type: 'message' | 'close' | 'error',
    listener: (event: GatewayEvent) => void,
  ): void;
};

type GatewaySocketFactory = (url: string) => GatewaySocket;

export type DiscordGatewayOptions = {
  token: string;
  gatewayUrl?: string;
  socketFactory?: GatewaySocketFactory;
  onMemberEvent: (event: {
    type: 'GUILD_MEMBER_ADD' | 'GUILD_MEMBER_UPDATE';
    guildId: string;
    discordUserId: string;
  }) => Promise<void> | void;
  onError?: (error: Error) => void;
  reconnectDelayMs?: number;
};

export type DiscordGatewayConnection = {
  stop(): void;
};

type GatewayPayload = {
  op: number;
  d: unknown;
  s?: number | null;
  t?: string | null;
};

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function gatewayPayload(value: unknown): GatewayPayload | null {
  const record = objectRecord(value);
  return typeof record?.op === 'number' ? (record as GatewayPayload) : null;
}

function defaultSocketFactory(url: string): GatewaySocket {
  const constructor = (
    globalThis as unknown as {
      WebSocket?: new (url: string) => GatewaySocket;
    }
  ).WebSocket;
  if (!constructor) throw new Error('Discord Gateway requires a native WebSocket client');
  return new constructor(url);
}

function gatewayError(message: string): Error {
  return new Error(`Discord Gateway ${message}`);
}

/**
 * Keep one small Gateway connection for member join/update signals. REST jobs
 * remain authoritative; reconnects resume when Discord permits it.
 */
export function connectDiscordGateway(options: DiscordGatewayOptions): DiscordGatewayConnection {
  const gatewayUrl = options.gatewayUrl ?? DISCORD_GATEWAY_URL;
  const socketFactory = options.socketFactory ?? defaultSocketFactory;
  const reconnectDelayMs = Math.max(0, options.reconnectDelayMs ?? 1_000);
  let socket: GatewaySocket | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let sequence: number | null = null;
  let sessionId: string | null = null;
  let resumeGatewayUrl = gatewayUrl;
  let heartbeatAcked = true;
  let reconnectAttempt = 0;
  let stopped = false;

  const report = (error: unknown) => {
    options.onError?.(error instanceof Error ? error : new Error(String(error)));
  };

  const clearHeartbeat = () => {
    if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  };

  const send = (op: number, data: unknown) => {
    if (!socket || socket.readyState !== OPEN) return false;
    try {
      socket.send(JSON.stringify({ op, d: data }));
      return true;
    } catch (error) {
      report(error);
      return false;
    }
  };

  const heartbeat = (force = false) => {
    if (!socket || socket.readyState !== OPEN) return;
    if (!force && !heartbeatAcked) {
      socket.close(RECONNECT_CLOSE_CODE);
      return;
    }
    heartbeatAcked = false;
    send(1, sequence);
  };

  const startHeartbeat = (intervalMs: number) => {
    clearHeartbeat();
    heartbeatAcked = true;
    heartbeatTimer = setInterval(heartbeat, intervalMs);
  };

  const scheduleReconnect = (immediate = false) => {
    if (stopped || reconnectTimer !== undefined) return;
    const delay = immediate
      ? 0
      : Math.min(30_000, reconnectDelayMs * 2 ** Math.min(reconnectAttempt, 5));
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, delay);
  };

  const handleClose = (closedSocket: GatewaySocket, code: number | undefined) => {
    if (socket !== closedSocket) return;
    clearHeartbeat();
    socket = null;
    if (stopped) return;
    if (code === 4_007 || code === 4_009) {
      sessionId = null;
      sequence = null;
      resumeGatewayUrl = gatewayUrl;
    }
    if (code !== undefined && FATAL_CLOSE_CODES.has(code)) {
      report(gatewayError(`closed permanently with code ${code}`));
      return;
    }
    scheduleReconnect();
  };

  const handleDispatch = (type: string | null | undefined, data: unknown) => {
    const payload = objectRecord(data);
    if (type === 'READY' && payload) {
      sessionId = stringField(payload.session_id);
      const resumeUrl = stringField(payload.resume_gateway_url);
      if (resumeUrl) resumeGatewayUrl = resumeUrl;
      reconnectAttempt = 0;
    } else if (type === 'RESUMED') {
      reconnectAttempt = 0;
    }
    if (type !== 'GUILD_MEMBER_ADD' && type !== 'GUILD_MEMBER_UPDATE') return;
    const guildId = stringField(payload?.guild_id);
    const user = objectRecord(payload?.user);
    const discordUserId = stringField(user?.id);
    if (!guildId || !discordUserId) return;
    void Promise.resolve()
      .then(() => options.onMemberEvent({ type, guildId, discordUserId }))
      .catch(report);
  };

  const handleMessage = (data: unknown) => {
    if (typeof data !== 'string') {
      report(gatewayError('returned a non-text frame'));
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      report(gatewayError('returned invalid JSON'));
      return;
    }
    const payload = gatewayPayload(parsed);
    if (!payload) {
      report(gatewayError('returned an invalid payload'));
      return;
    }
    if (typeof payload.s === 'number') sequence = payload.s;
    switch (payload.op) {
      case 0:
        handleDispatch(payload.t, payload.d);
        break;
      case 1:
        heartbeat(true);
        break;
      case 7:
        socket?.close(RECONNECT_CLOSE_CODE);
        break;
      case 9:
        if (payload.d !== true) {
          sessionId = null;
          sequence = null;
          resumeGatewayUrl = gatewayUrl;
        }
        socket?.close(RECONNECT_CLOSE_CODE);
        break;
      case 10: {
        const hello = objectRecord(payload.d);
        const interval = hello?.heartbeat_interval;
        if (typeof interval !== 'number' || interval < 1) {
          report(gatewayError('returned an invalid heartbeat interval'));
          socket?.close(RECONNECT_CLOSE_CODE);
          break;
        }
        startHeartbeat(interval);
        if (sessionId && sequence !== null) {
          send(6, { token: options.token, session_id: sessionId, seq: sequence });
        } else {
          send(2, {
            token: options.token,
            intents: DISCORD_GATEWAY_INTENTS,
            properties: { os: 'linux', browser: 'oss-tips', device: 'oss-tips' },
          });
        }
        break;
      }
      case 11:
        heartbeatAcked = true;
        break;
      default:
        break;
    }
  };

  const connect = () => {
    if (stopped) return;
    try {
      const nextSocket = socketFactory(
        sessionId && sequence !== null ? resumeGatewayUrl : gatewayUrl,
      );
      socket = nextSocket;
      nextSocket.addEventListener('message', (event) => handleMessage(event.data));
      nextSocket.addEventListener('close', (event) => handleClose(nextSocket, event.code));
      nextSocket.addEventListener('error', (event) => {
        report(gatewayError('socket error'));
        if (nextSocket.readyState === OPEN) nextSocket.close(RECONNECT_CLOSE_CODE);
        else handleClose(nextSocket, event.code);
      });
    } catch (error) {
      report(error);
      scheduleReconnect();
    }
  };

  connect();
  return {
    stop() {
      stopped = true;
      clearHeartbeat();
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      const current = socket;
      socket = null;
      current?.close(1000);
    },
  };
}
