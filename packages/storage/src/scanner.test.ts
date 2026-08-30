import { createServer, type Server, type Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ClamAvScanner,
  createMalwareScannerFromEnv,
  MalwareScannerUnavailableError,
  requireMalwareScannerConfig,
} from './scanner.js';

const servers: Server[] = [];
const sockets: Socket[] = [];

async function listen(response: string): Promise<{ host: string; port: number }> {
  const server = createServer((socket) => {
    sockets.push(socket);
    let received = Buffer.alloc(0);
    let replied = false;
    socket.on('data', (chunk) => {
      received = Buffer.concat([received, chunk]);
      if (!replied && received.length >= 4 && received.subarray(-4).every((value) => value === 0)) {
        replied = true;
        socket.end(`${response}\0`);
      }
    });
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Scanner test server did not bind');
  return { host: '127.0.0.1', port: address.port };
}

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.destroy();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          if (!server.listening) return resolve();
          server.close(() => resolve());
        }),
    ),
  );
});

describe('ClamAV scanner', () => {
  it('uses native INSTREAM protocol and accepts a clean response', async () => {
    const endpoint = await listen('stream: OK');
    const scanner = new ClamAvScanner({ ...endpoint, timeoutMs: 1_000 });

    await expect(
      scanner.scan(new TextEncoder().encode('release notes'), 'text/plain'),
    ).resolves.toEqual({
      clean: true,
    });
  });

  it('returns infected result for a ClamAV FOUND response', async () => {
    const endpoint = await listen('stream: Eicar-Test-Signature FOUND');
    const scanner = new ClamAvScanner({ ...endpoint, timeoutMs: 1_000 });

    await expect(scanner.scan(new TextEncoder().encode('malware'), 'text/plain')).resolves.toEqual({
      clean: false,
      reason: 'Eicar-Test-Signature',
    });
  });

  it('fails closed when daemon cannot be reached', async () => {
    const scanner = new ClamAvScanner({ host: '127.0.0.1', port: 65_534, timeoutMs: 100 });

    await expect(
      scanner.scan(new TextEncoder().encode('release notes'), 'text/plain'),
    ).rejects.toBeInstanceOf(MalwareScannerUnavailableError);
  });
});

describe('malware scanner configuration', () => {
  it('does not configure a scanner without a host and requires one in production', () => {
    expect(createMalwareScannerFromEnv({ NODE_ENV: 'test' })).toBeNull();
    expect(() => requireMalwareScannerConfig({ NODE_ENV: 'production' })).toThrow(
      'MALWARE_SCANNER_HOST is required in production',
    );
  });

  it('validates configured port and timeout', () => {
    expect(() =>
      createMalwareScannerFromEnv({ MALWARE_SCANNER_HOST: 'clamav', MALWARE_SCANNER_PORT: '0' }),
    ).toThrow('MALWARE_SCANNER_PORT');
    expect(() =>
      createMalwareScannerFromEnv({
        MALWARE_SCANNER_HOST: 'clamav',
        MALWARE_SCANNER_TIMEOUT_MS: '-1',
      }),
    ).toThrow('MALWARE_SCANNER_TIMEOUT_MS');
  });
});
