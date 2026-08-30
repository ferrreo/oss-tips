import { createHash, randomBytes } from 'node:crypto';
import { BUCKETS, assertBucketName, type BucketName } from './types.js';

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/;
const EXPORT_KEY = /^exports\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\.(?:csv|json)$/;

/** Object keys are server-generated paths, not user-controlled filesystem paths. */
export function isSafeObjectKey(key: string): boolean {
  if (!SAFE_KEY.test(key) || key.includes('\\') || key.includes('//') || key.endsWith('/'))
    return false;
  return key.split('/').every((segment) => segment !== '.' && segment !== '..');
}

export function assertSafeObjectKey(key: string): asserts key is string {
  if (!isSafeObjectKey(key)) {
    throw new Error('Unsafe object key');
  }
}

/** Export keys are generated server-side and remain scoped below the exports prefix. */
export function assertExportKey(key: string): asserts key is string {
  assertSafeObjectKey(key);
  if (!EXPORT_KEY.test(key)) throw new Error('Object is not a project export');
}

export function isContentAddressedKey(key: string): boolean {
  return /^[a-f0-9]{32}\/[a-f0-9]{64}\.[a-z0-9]{1,12}$/.test(key);
}

export function assertContentAddressedKey(key: string): void {
  assertSafeObjectKey(key);
  if (!isContentAddressedKey(key)) throw new Error('Final object key must be content addressed');
}

export function assertQuarantineKey(key: string): void {
  assertSafeObjectKey(key);
  if (!key.startsWith('pending/') || key.split('/').length !== 2) {
    throw new Error('Object is not in quarantine');
  }
}

export function assertFinalBucket(bucket: BucketName): void {
  assertBucketName(bucket);
  if (bucket !== BUCKETS.publicMedia && bucket !== BUCKETS.privateContent) {
    throw new Error('Quarantine objects can only be promoted to public or private content');
  }
}

/** Content-addressed storage key: SHA-256 prefix + safe extension hint. */
export function contentAddressedKey(body: Uint8Array, extension = 'bin'): string {
  const hash = createHash('sha256').update(body).digest('hex');
  const safeExt =
    extension
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 12) || 'bin';
  return `${hash.slice(0, 32)}/${hash}.${safeExt}`;
}

/** Return display metadata only; this value is intentionally not used in storage keys. */
export function safeDisplayFilename(filename: string): string {
  if (typeof filename !== 'string') return 'upload';
  const safeName = filename
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()
    .slice(0, 128);
  return safeName || 'upload';
}

/** Quarantine key contains only a server-generated upload id; filename remains metadata. */
export function quarantineKey(uploadId: string, _filename?: string): string {
  if (!SAFE_SEGMENT.test(uploadId)) {
    throw new Error('Invalid upload id');
  }
  return `pending/${uploadId}`;
}

export function newUploadId(): string {
  return randomBytes(16).toString('hex');
}
