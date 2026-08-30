import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_CONTENT_TYPES,
  ASSET_LIMITS,
  assertSafeContentType,
  assertBucketName,
  assertSafeObjectKey,
  assertSafeS3Endpoint,
  BOOTSTRAP_BUCKETS,
  BUCKETS,
  contentAddressedKey,
  createQuarantineFlow,
  createStorageClient,
  DEFAULT_MAX_UPLOAD_BYTES,
  isDangerousContentType,
  isSafeObjectKey,
  LocalStorageClient,
  MalwareDetectedError,
  S3StorageClient,
  newUploadId,
  presignPrivateAttachment,
  quarantineKey,
  safeDisplayFilename,
  sniffContentType,
  validateUpload,
} from './index.js';

const ONE_PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ),
);

const tempRoots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('content types and upload validation', () => {
  it('uses a small explicit allowlist', () => {
    expect(ALLOWED_CONTENT_TYPES).toContain('image/png');
    expect(isDangerousContentType('application/x-msdownload')).toBe(true);
    expect(isDangerousContentType('text/html')).toBe(true);
    expect(isDangerousContentType('image/png')).toBe(false);
    expect(() => assertSafeContentType('image/svg+xml')).toThrow();
    expect(() => assertSafeContentType('image/png\r\ntext/html')).toThrow();
  });

  it('sniffs bytes and rejects MIME confusion', () => {
    expect(sniffContentType(ONE_PIXEL_PNG)).toBe('image/png');
    expect(validateUpload(ONE_PIXEL_PNG, 'image/png').ok).toBe(true);
    expect(validateUpload(ONE_PIXEL_PNG, 'image/jpeg')).toEqual({
      ok: false,
      reason: 'Claimed content type does not match file bytes',
    });
    expect(validateUpload(new TextEncoder().encode('hello'), 'text/html').ok).toBe(false);
    expect(validateUpload(new Uint8Array([0xff, 0xd8, 0xff]), 'image/jpeg').ok).toBe(false);
    const corruptPng = new Uint8Array(ONE_PIXEL_PNG);
    corruptPng[corruptPng.length - 1] = (corruptPng[corruptPng.length - 1] ?? 0) ^ 0xff;
    expect(validateUpload(corruptPng, 'image/png').ok).toBe(false);
    expect(
      validateUpload(
        new TextEncoder().encode('%PDF-1.7\n/OpenAction /JavaScript'),
        'application/pdf',
      ),
    ).toEqual({
      ok: false,
      reason: 'PDF contains an executable action',
    });
  });

  it('enforces size and image-pixel limits before promotion', () => {
    expect(validateUpload(new TextEncoder().encode('1234'), 'text/plain', { maxBytes: 3 }).ok).toBe(
      false,
    );
    expect(validateUpload(ONE_PIXEL_PNG, 'image/png', { maxImagePixels: 0 })).toEqual({
      ok: false,
      reason: 'Upload limits must be positive safe integers',
    });
    expect(DEFAULT_MAX_UPLOAD_BYTES).toBeGreaterThan(0);
    expect(ASSET_LIMITS.logo).toBe(2 * 1024 * 1024);
    expect(
      validateUpload(new TextEncoder().encode('1234'), 'text/plain', {
        maxBytes: 3,
        assetKind: 'logo',
      }).ok,
    ).toBe(false);
  });

  it('strips metadata-bearing image chunks', () => {
    const result = validateUpload(ONE_PIXEL_PNG, 'image/png');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body).not.toBe(ONE_PIXEL_PNG);
  });

  it('rejects executable, script, HTML, archive, and encrypted PDF content', () => {
    const cases: Array<[Uint8Array, string, RegExp]> = [
      [new TextEncoder().encode('#!/bin/sh\necho unsafe\n'), 'text/plain', /Scripts/],
      [new TextEncoder().encode('<!doctype html><script>alert(1)</script>'), 'text/plain', /HTML/],
      [Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]), 'text/plain', /Executable/],
      [Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]), 'text/plain', /Package/],
      [
        new TextEncoder().encode('%PDF-1.7\n/Encrypt 4 0 R\n%%EOF'),
        'application/pdf',
        /Password-protected/,
      ],
    ];
    for (const [body, contentType, reason] of cases) {
      expect(validateUpload(body, contentType)).toMatchObject({ ok: false, reason });
    }
  });

  it('allows PDF and plain text only for attachment assets', () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\n%%EOF');
    const text = new TextEncoder().encode('release notes');
    expect(validateUpload(pdf, 'application/pdf', { assetKind: 'attachment' }).ok).toBe(true);
    expect(validateUpload(text, 'text/plain', { assetKind: 'attachment' }).ok).toBe(true);
    expect(validateUpload(pdf, 'application/pdf', { assetKind: 'logo' })).toEqual({
      ok: false,
      reason: 'PDF and plain-text uploads are only allowed as attachments',
    });
  });
});

describe('keys', () => {
  it('generates content-addressed keys without user path material', () => {
    const body = new Uint8Array([1, 2, 3]);
    const key = contentAddressedKey(body, '../../png');
    expect(key).toMatch(/^[a-f0-9]{32}\/[a-f0-9]{64}\.png$/);
    expect(isSafeObjectKey(key)).toBe(true);
  });

  it('builds opaque quarantine keys and sanitises display names separately', () => {
    expect(quarantineKey('up1', '../../photo.png')).toBe('pending/up1');
    expect(() => quarantineKey('../escape')).toThrow();
    expect(() => assertSafeObjectKey('../escape')).toThrow();
    expect(() => assertSafeObjectKey('pending/up1/..')).toThrow();
    expect(safeDisplayFilename('../../photo\u0000.png')).toBe('.._.._photo.png');
  });
});

describe('local quarantine flow', () => {
  it('validates, sanitises, promotes and removes quarantine bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'oss-tips-storage-'));
    tempRoots.push(root);
    const storage = new LocalStorageClient(root);
    const flow = createQuarantineFlow(storage);
    const key = quarantineKey(newUploadId(), 'photo.png');
    const presigned = await flow.quarantinePut(key, {
      contentType: 'image/png',
      contentLength: ONE_PIXEL_PNG.length,
    });
    expect(presigned.bucket).toBe(BUCKETS.quarantine);
    const promoted = await flow.validateAndPromote(
      key,
      BUCKETS.privateContent,
      ONE_PIXEL_PNG,
      undefined,
      {
        contentType: 'image/png',
        contentLength: ONE_PIXEL_PNG.length,
      },
    );
    expect(promoted.targetKey).toMatch(/\.png$/);
    await expect(storage.getLocal(BUCKETS.quarantine, key)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(
      (await storage.getLocal(BUCKETS.privateContent, promoted.targetKey)).length,
    ).toBeGreaterThan(0);
  });

  it('writes exports under the private exports bucket with bounded keys', async () => {
    const root = await mkdtemp(join(tmpdir(), 'oss-tips-storage-'));
    tempRoots.push(root);
    const storage = new LocalStorageClient(root);
    const expiresAt = new Date('2026-01-02T00:00:00.000Z');
    await storage.putExport(
      'exports/project_1/job_1.json',
      new TextEncoder().encode('{"ok":true}\n'),
      { contentType: 'application/json', expiresAt },
    );
    expect(await storage.getLocal(BUCKETS.exports, 'exports/project_1/job_1.json')).toEqual(
      new TextEncoder().encode('{"ok":true}\n'),
    );
    await expect(
      storage.putExport('../escape', new Uint8Array([1]), {
        contentType: 'application/json',
        expiresAt,
      }),
    ).rejects.toThrow('Unsafe object key');
  });

  it('lists persisted objects with their byte sizes for inventory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'oss-tips-storage-'));
    tempRoots.push(root);
    const storage = new LocalStorageClient(root);
    const expiresAt = new Date('2026-01-02T00:00:00.000Z');
    await storage.putLocal(
      BUCKETS.quarantine,
      quarantineKey('up1'),
      new Uint8Array([1, 2, 3]),
      'text/plain',
    );
    await storage.putExport('exports/project_1/job_1.json', new Uint8Array([4, 5]), {
      contentType: 'application/json',
      expiresAt,
    });

    const quarantineObjects = await storage.listObjects(BUCKETS.quarantine);
    expect(quarantineObjects).toHaveLength(1);
    expect(quarantineObjects[0]).toMatchObject({ key: 'pending/up1', contentLength: 3 });
    expect(quarantineObjects[0]?.lastModified).toBeInstanceOf(Date);
    const exportObjects = await storage.listObjects(BUCKETS.exports);
    expect(exportObjects).toHaveLength(1);
    expect(exportObjects[0]).toMatchObject({
      key: 'exports/project_1/job_1.json',
      contentLength: 2,
    });
    expect(exportObjects[0]?.lastModified).toBeInstanceOf(Date);
    await storage.deleteObject(BUCKETS.exports, 'exports/project_1/job_1.json');
    await expect(storage.listObjects(BUCKETS.exports)).resolves.toEqual([]);
  });

  it('does not allow direct final-bucket uploads or path escapes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'oss-tips-storage-'));
    tempRoots.push(root);
    const storage = new LocalStorageClient(root);
    await expect(
      storage.presignPut(BUCKETS.publicMedia, 'public/file.png', {
        contentType: 'image/png',
        contentLength: ONE_PIXEL_PNG.length,
      }),
    ).rejects.toThrow('Uploads must start in quarantine');
    await expect(
      storage.presignPut(BUCKETS.quarantine, 'pending/up1/../escape', {
        contentType: 'image/png',
        contentLength: ONE_PIXEL_PNG.length,
      }),
    ).rejects.toThrow('Unsafe object key');
    await expect(
      storage.presignPut(BUCKETS.quarantine, quarantineKey('up1'), {
        contentType: 'image/png',
        contentLength: DEFAULT_MAX_UPLOAD_BYTES + 1,
      }),
    ).rejects.toThrow('Upload exceeds');
  });

  it('promotes decoded media variants into the source visibility bucket', async () => {
    const root = await mkdtemp(join(tmpdir(), 'oss-tips-storage-'));
    tempRoots.push(root);
    const storage = new LocalStorageClient(root);
    const flow = createQuarantineFlow(storage);
    const key = quarantineKey(newUploadId());
    const promoted = await flow.validateAndPromote(
      key,
      BUCKETS.publicMedia,
      ONE_PIXEL_PNG,
      undefined,
      { contentType: 'image/png', contentLength: ONE_PIXEL_PNG.length, assetKind: 'avatar' },
    );
    expect(promoted.variants.map(({ name }) => name)).toEqual(['sm', 'md']);
    for (const variant of promoted.variants) {
      expect((await storage.getLocal(BUCKETS.publicMedia, variant.targetKey)).length).toBe(
        variant.contentLength,
      );
    }
  });

  it('streams completed local objects without buffering the file first', async () => {
    const root = await mkdtemp(join(tmpdir(), 'oss-tips-storage-'));
    tempRoots.push(root);
    const storage = new LocalStorageClient(root);
    const flow = createQuarantineFlow(storage);
    const key = quarantineKey(newUploadId());
    const promoted = await flow.validateAndPromote(
      key,
      BUCKETS.publicMedia,
      ONE_PIXEL_PNG,
      undefined,
      { contentType: 'image/png', contentLength: ONE_PIXEL_PNG.length },
    );

    const object = await storage.getObjectStream(BUCKETS.publicMedia, promoted.targetKey);
    expect(object.contentLength).toBe(promoted.contentLength);
    expect(new Uint8Array(await new Response(object.body).arrayBuffer())).toEqual(
      await storage.getLocal(BUCKETS.publicMedia, promoted.targetKey),
    );
  });

  it('scans clean non-image attachments before promotion', async () => {
    const root = await mkdtemp(join(tmpdir(), 'oss-tips-storage-'));
    tempRoots.push(root);
    const storage = new LocalStorageClient(root);
    const scanner = { scan: vi.fn(async () => ({ clean: true as const })) };
    const flow = createQuarantineFlow(storage, { scanner });
    const body = new TextEncoder().encode('%PDF-1.7\n%%EOF');
    const key = quarantineKey(newUploadId());

    const promoted = await flow.validateAndPromote(key, BUCKETS.privateContent, body, undefined, {
      contentType: 'application/pdf',
      contentLength: body.length,
      assetKind: 'attachment',
    });

    expect(promoted.targetKey).toMatch(/\.pdf$/);
    expect(scanner.scan).toHaveBeenCalledWith(body, 'application/pdf');
    expect(await storage.getLocal(BUCKETS.privateContent, promoted.targetKey)).toEqual(body);
  });

  it('does not promote infected attachments or when scanner is unavailable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'oss-tips-storage-'));
    tempRoots.push(root);
    const storage = new LocalStorageClient(root);
    const body = new TextEncoder().encode('release notes');

    const infected = createQuarantineFlow(storage, {
      scanner: { scan: vi.fn(async () => ({ clean: false as const, reason: 'Test.Infected' })) },
    });
    await expect(
      infected.validateAndPromote(
        quarantineKey(newUploadId()),
        BUCKETS.privateContent,
        body,
        undefined,
        { contentType: 'text/plain', contentLength: body.length, assetKind: 'attachment' },
      ),
    ).rejects.toBeInstanceOf(MalwareDetectedError);

    const unavailable = createQuarantineFlow(storage, { scanner: null });
    await expect(
      unavailable.validateAndPromote(
        quarantineKey(newUploadId()),
        BUCKETS.privateContent,
        body,
        undefined,
        { contentType: 'text/plain', contentLength: body.length, assetKind: 'attachment' },
      ),
    ).rejects.toThrow('Malware scanner unavailable');
  });
});

describe('private attachment access', () => {
  it('checks entitlement before signing and caps URL lifetime', async () => {
    const calls: Array<{ bucket: string; key: string; ttl: number }> = [];
    const storage = {
      presignGet: async (
        bucket: (typeof BUCKETS)[keyof typeof BUCKETS],
        key: string,
        ttl: number,
      ) => {
        calls.push({ bucket, key, ttl });
        return {
          url: 'https://rustfs.test/signed',
          expiresAt: new Date().toISOString(),
          key,
          bucket,
        };
      },
    };
    await expect(presignPrivateAttachment(storage, 'asset/hash.png', () => false)).rejects.toThrow(
      'Private attachment access denied',
    );
    expect(calls).toHaveLength(0);
    const signed = await presignPrivateAttachment(storage, 'asset/hash.png', () => true, 3_600);
    expect(signed.bucket).toBe(BUCKETS.privateContent);
    expect(calls[0]?.ttl).toBe(300);
    await expect(presignPrivateAttachment(storage, 'pending/up1', () => true)).rejects.toThrow(
      'Quarantine objects are not attachments',
    );
  });
});

describe('S3 endpoint guard', () => {
  it('rejects schemes, credentials, paths and metadata-service targets', () => {
    expect(() => assertSafeS3Endpoint('file:///tmp/storage')).toThrow();
    expect(() => assertSafeS3Endpoint('https://user:secret@rustfs.test')).toThrow();
    expect(() => assertSafeS3Endpoint('https://rustfs.test/prefix')).toThrow();
    expect(() => assertSafeS3Endpoint('http://169.254.169.254')).toThrow();
    expect(() => assertSafeS3Endpoint('http://localhost:9000')).not.toThrow();
  });

  it('requires credentials when using configured S3/RustFS', () => {
    expect(() =>
      createStorageClient({
        s3Endpoint: 'http://localhost:9000',
        s3Region: 'local',
      }),
    ).toThrow('S3 credentials are required');
    expect(BOOTSTRAP_BUCKETS).toContain('oss-backups');
    expect(() => assertBucketName('oss-backups')).toThrow('Unknown storage bucket');
  });

  it('rejects local storage in production', () => {
    expect(() => createStorageClient({ nodeEnv: 'production' })).toThrow(
      'S3_ENDPOINT is required in production',
    );
    expect(createStorageClient({ nodeEnv: 'test' })).toBeInstanceOf(LocalStorageClient);
  });

  it('presigns only exact quarantine keys with bounded metadata', async () => {
    const storage = new S3StorageClient({
      endpoint: 'http://localhost:9000',
      region: 'local',
      accessKeyId: 'test',
      secretAccessKey: 'test',
    });
    const signed = await storage.presignPut(BUCKETS.quarantine, quarantineKey('up1'), {
      contentType: 'image/png',
      contentLength: ONE_PIXEL_PNG.length,
      assetKind: 'post_image',
    });
    expect(new URL(signed.url).searchParams.get('X-Amz-Expires')).toBe('900');
    await expect(
      storage.presignPut(BUCKETS.quarantine, 'pending/up1/evil', {
        contentType: 'image/png',
        contentLength: ONE_PIXEL_PNG.length,
      }),
    ).rejects.toThrow('Object is not in quarantine');
  });

  it('replaces copy metadata while preserving quarantined content type', async () => {
    const storage = new S3StorageClient({
      endpoint: 'http://localhost:9000',
      region: 'local',
      accessKeyId: 'test',
      secretAccessKey: 'test',
    });
    const send = vi.spyOn(S3Client.prototype, 'send');
    send
      .mockResolvedValueOnce({
        ContentLength: ONE_PIXEL_PNG.length,
        ContentType: 'image/png',
        Metadata: { source: 'quarantine' },
      } as never)
      .mockResolvedValue({} as never);
    const targetKey = contentAddressedKey(ONE_PIXEL_PNG, 'png');

    await storage.promoteFromQuarantine('pending/up1', BUCKETS.publicMedia, targetKey);

    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
    expect(
      (send.mock.calls[1]?.[0] as unknown as { input: Record<string, unknown> }).input,
    ).toMatchObject({
      Bucket: BUCKETS.publicMedia,
      Key: targetKey,
      MetadataDirective: 'REPLACE',
      ContentType: 'image/png',
      Metadata: { source: 'quarantine' },
      CacheControl: 'public,max-age=31536000,immutable',
    });
  });

  it('bootstraps all named buckets without replacing existing objects', async () => {
    const storage = new S3StorageClient({
      endpoint: 'http://localhost:9000',
      region: 'local',
      accessKeyId: 'test',
      secretAccessKey: 'test',
    });
    const send = vi.spyOn(S3Client.prototype, 'send');
    send.mockImplementation(async (command) => {
      if (command.constructor.name === 'HeadBucketCommand') {
        const bucket = (command as unknown as { input: { Bucket: string } }).input.Bucket;
        if (bucket === 'oss-public-media') return {} as never;
        const error = Object.assign(new Error('bucket missing'), {
          $metadata: { httpStatusCode: 404 },
        });
        throw error;
      }
      return {} as never;
    });

    await storage.ensureBuckets();

    const created = send.mock.calls
      .filter(([command]) => command.constructor.name === 'CreateBucketCommand')
      .map(([command]) => (command as unknown as { input: { Bucket: string } }).input.Bucket);
    expect(created).toEqual([
      'oss-private-content',
      'oss-quarantine',
      'oss-exports',
      'oss-backups',
    ]);
  });
});
