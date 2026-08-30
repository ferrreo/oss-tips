import { createConnection, type Socket } from 'node:net';
import type { MalwareScanResult, MalwareScanner } from './types.js';

export const DEFAULT_MALWARE_SCANNER_PORT = 3310;
export const DEFAULT_MALWARE_SCANNER_TIMEOUT_MS = 15_000;

export type ClamAvScannerConfig = {
  host: string;
  port?: number;
  timeoutMs?: number;
};

export class MalwareScannerUnavailableError extends Error {
  constructor(message = 'Malware scanner unavailable') {
    super(message);
    this.name = 'MalwareScannerUnavailableError';
  }
}

export class MalwareDetectedError extends Error {
  constructor(message = 'Malware detected in upload') {
    super(message);
    this.name = 'MalwareDetectedError';
  }
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return value;
}

function scannerHost(value: string): string {
  const host = value.trim();
  if (!host || host.length > 253 || /[\u0000-\u001f\u007f\s/]/.test(host)) {
    throw new Error('MALWARE_SCANNER_HOST is invalid');
  }
  return host;
}

function scannerPort(value: number | undefined): number {
  const port = value ?? DEFAULT_MALWARE_SCANNER_PORT;
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('MALWARE_SCANNER_PORT must be between 1 and 65535');
  }
  return port;
}

function scannerTimeout(value: number | undefined): number {
  return positiveInteger(value ?? DEFAULT_MALWARE_SCANNER_TIMEOUT_MS, 'MALWARE_SCANNER_TIMEOUT_MS');
}

function scannerFailure(error: unknown): MalwareScannerUnavailableError {
  if (error instanceof MalwareScannerUnavailableError) return error;
  return new MalwareScannerUnavailableError();
}

function parseResponse(response: string): MalwareScanResult {
  const line = response.split('\0', 1)[0]?.trim() ?? '';
  if (/^stream:\s+OK$/i.test(line)) return { clean: true };
  const infected = /^stream:\s+(.+?)\s+FOUND$/i.exec(line);
  if (infected) {
    const signature = infected[1]?.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 128);
    return { clean: false, ...(signature ? { reason: signature } : {}) };
  }
  throw new MalwareScannerUnavailableError();
}

function scanWithClamAv(
  host: string,
  port: number,
  timeoutMs: number,
  body: Uint8Array,
): Promise<MalwareScanResult> {
  return new Promise((resolve, reject) => {
    let socket: Socket | undefined;
    let response = '';
    let settled = false;

    const close = () => {
      if (socket && !socket.destroyed) socket.destroy();
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      close();
      reject(scannerFailure(error));
    };
    const finish = (result: MalwareScanResult) => {
      if (settled) return;
      settled = true;
      close();
      resolve(result);
    };

    try {
      socket = createConnection({ host, port });
      socket.setTimeout(timeoutMs, () => fail(new MalwareScannerUnavailableError()));
      socket.on('error', fail);
      socket.on('close', () => {
        if (!settled) fail(new MalwareScannerUnavailableError());
      });
      socket.on('data', (chunk: Buffer) => {
        response += chunk.toString('utf8');
        if (!response.includes('\0')) return;
        try {
          finish(parseResponse(response));
        } catch (error) {
          fail(error);
        }
      });
      socket.on('connect', () => {
        try {
          socket?.write(Buffer.from('zINSTREAM\0', 'ascii'));
          const chunkSize = 64 * 1024;
          for (let offset = 0; offset < body.length; offset += chunkSize) {
            const chunk = body.subarray(offset, Math.min(offset + chunkSize, body.length));
            const size = Buffer.allocUnsafe(4);
            size.writeUInt32BE(chunk.length, 0);
            socket?.write(size);
            socket?.write(chunk);
          }
          const end = Buffer.allocUnsafe(4);
          end.writeUInt32BE(0, 0);
          socket?.end(end);
        } catch (error) {
          fail(error);
        }
      });
    } catch (error) {
      fail(error);
    }
  });
}

/** Native ClamAV daemon client; no shell or third-party scanner process is involved. */
export class ClamAvScanner implements MalwareScanner {
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;

  constructor(config: ClamAvScannerConfig) {
    this.host = scannerHost(config.host);
    this.port = scannerPort(config.port);
    this.timeoutMs = scannerTimeout(config.timeoutMs);
  }

  scan(body: Uint8Array, _contentType: string): Promise<MalwareScanResult> {
    return scanWithClamAv(this.host, this.port, this.timeoutMs, body);
  }
}

function optionalPositiveInteger(value: string | undefined, name: string): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be a safe integer`);
  return parsed;
}

/** Build scanner from deployment environment; absent host means no scanner is configured. */
export function createMalwareScannerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ClamAvScanner | null {
  const host = env.MALWARE_SCANNER_HOST?.trim();
  const port = optionalPositiveInteger(env.MALWARE_SCANNER_PORT, 'MALWARE_SCANNER_PORT');
  const timeoutMs = optionalPositiveInteger(
    env.MALWARE_SCANNER_TIMEOUT_MS,
    'MALWARE_SCANNER_TIMEOUT_MS',
  );
  if (!host) {
    if (port !== undefined || timeoutMs !== undefined) {
      throw new Error('MALWARE_SCANNER_HOST is required when scanner options are configured');
    }
    return null;
  }
  return new ClamAvScanner({
    host,
    ...(port === undefined ? {} : { port }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
}

/** Validate production scanner configuration without opening a network connection. */
export function requireMalwareScannerConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  if (!env.MALWARE_SCANNER_HOST?.trim()) {
    throw new Error('MALWARE_SCANNER_HOST is required in production');
  }
  createMalwareScannerFromEnv(env);
}
