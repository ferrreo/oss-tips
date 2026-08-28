import { describe, expect, it } from 'vitest';
import {
  assertSafeContentType,
  isDangerousContentType,
  contentAddressedKey,
  createStorageClient,
  createQuarantineFlow,
  newUploadId,
  quarantineKey,
  BUCKETS,
} from './index.js';

describe('content types', () => {
  it('rejects executables and html', () => {
    expect(isDangerousContentType('application/x-msdownload')).toBe(true);
    expect(isDangerousContentType('text/html')).toBe(true);
    expect(isDangerousContentType('image/png')).toBe(false);
    expect(() => assertSafeContentType('text/html')).toThrow();
  });
});

describe('keys', () => {
  it('generates content-addressed keys', () => {
    const body = new Uint8Array([1, 2, 3]);
    const key = contentAddressedKey(body, 'png');
    expect(key).toMatch(/\.png$/);
    expect(key).toContain('/');
  });

  it('builds quarantine keys', () => {
    const key = quarantineKey('up1', 'photo.png');
    expect(key).toBe('pending/up1/photo.png');
  });
});

describe('local storage', () => {
  it('presigns put for safe types', async () => {
    const storage = createStorageClient({});
    const flow = createQuarantineFlow(storage);
    const uploadId = newUploadId();
    const key = quarantineKey(uploadId, 'file.bin');
    const presigned = await flow.quarantinePut(key, {
      contentType: 'image/png',
      contentLength: 100,
    });
    expect(presigned.bucket).toBe(BUCKETS.quarantine);
    expect(presigned.url).toContain('file://');
  });
});
