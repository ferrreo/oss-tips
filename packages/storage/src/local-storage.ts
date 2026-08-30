import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, writeFile, rm, stat, readdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import {
  assertSafeContentType,
  assertUploadSize,
  DEFAULT_MAX_UPLOAD_BYTES,
  type UploadValidationOptions,
} from './content-types.js';
import {
  assertContentAddressedKey,
  assertExportKey,
  assertFinalBucket,
  assertQuarantineKey,
  assertSafeObjectKey,
} from './keys.js';
import {
  assertBucketName,
  BUCKETS,
  type BucketName,
  type ExportObjectMeta,
  type PresignedUrl,
  type PutObjectMeta,
  type StorageObjectInfo,
  type StorageObjectStream,
  type StorageClient,
} from './types.js';

const DEFAULT_TTL = 900;
const MAX_TTL = 900;

function assertTtl(ttlSeconds: number): void {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_TTL) {
    throw new Error(`Presigned URL TTL must be between 1 and ${MAX_TTL} seconds`);
  }
}

function assertRoot(root: string): string {
  if (!root || root.includes('\u0000')) throw new Error('Invalid local storage root');
  return resolve(root);
}

function localPath(root: string, bucket: BucketName, key: string): string {
  assertBucketName(bucket);
  assertSafeObjectKey(key);
  const rootPath = assertRoot(root);
  const path = resolve(rootPath, bucket, key);
  const relativePath = relative(rootPath, path);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
    throw new Error('Object path escapes storage root');
  }
  return path;
}

function assertPutMeta(meta: PutObjectMeta, options: UploadValidationOptions = {}): void {
  assertSafeContentType(meta.contentType);
  assertUploadSize(meta.contentType, meta.contentLength, {
    ...options,
    ...(meta.assetKind === undefined ? {} : { assetKind: meta.assetKind }),
  });
}

function fileUrl(path: string, operation: 'put' | 'get', expiresAt: string): string {
  const url = new URL(pathToFileURL(path).toString());
  url.searchParams.set(operation, '1');
  url.searchParams.set('expires', expiresAt);
  return url.toString();
}

/** Filesystem client for development when S3_ENDPOINT is unset. */
export class LocalStorageClient implements StorageClient {
  private readonly root: string;
  private readonly limits: UploadValidationOptions;

  constructor(root = './data/storage', limits: UploadValidationOptions = {}) {
    this.root = assertRoot(root);
    this.limits = { maxBytes: limits.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES, ...limits };
  }

  private async ensureDir(path: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
  }

  async presignPut(
    bucket: BucketName,
    key: string,
    meta: PutObjectMeta,
    ttlSeconds = DEFAULT_TTL,
  ): Promise<PresignedUrl> {
    assertBucketName(bucket);
    if (bucket !== BUCKETS.quarantine) throw new Error('Uploads must start in quarantine');
    assertQuarantineKey(key);
    assertPutMeta(meta, this.limits);
    assertTtl(ttlSeconds);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const path = localPath(this.root, bucket, key);
    return { url: fileUrl(path, 'put', expiresAt), expiresAt, key, bucket };
  }

  async presignGet(
    bucket: BucketName,
    key: string,
    ttlSeconds = DEFAULT_TTL,
  ): Promise<PresignedUrl> {
    assertBucketName(bucket);
    if (bucket === BUCKETS.quarantine) throw new Error('Quarantine objects are not downloadable');
    assertSafeObjectKey(key);
    assertTtl(ttlSeconds);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const path = localPath(this.root, bucket, key);
    return { url: fileUrl(path, 'get', expiresAt), expiresAt, key, bucket };
  }

  async getObjectStream(bucket: BucketName, key: string): Promise<StorageObjectStream> {
    assertBucketName(bucket);
    if (bucket === BUCKETS.quarantine) throw new Error('Quarantine objects are not downloadable');
    const path = localPath(this.root, bucket, key);
    const metadata = await stat(path);
    if (!metadata.isFile() || !Number.isSafeInteger(metadata.size) || metadata.size < 1) {
      throw new Error('Stored object has invalid content length');
    }
    if (metadata.size > (this.limits.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES)) {
      throw new Error('Stored object exceeds configured size limit');
    }
    return {
      body: Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>,
      contentLength: metadata.size,
    };
  }

  async listObjects(bucket: BucketName): Promise<StorageObjectInfo[]> {
    assertBucketName(bucket);
    const objects: StorageObjectInfo[] = [];
    const visit = async (directory: string, prefix: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
        throw error;
      }
      for (const entry of entries) {
        const key = prefix ? `${prefix}/${entry.name}` : entry.name;
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
          await visit(path, key);
        } else if (entry.isFile()) {
          const metadata = await stat(path);
          if (Number.isSafeInteger(metadata.size) && metadata.size >= 0) {
            objects.push({ key, contentLength: metadata.size, lastModified: metadata.mtime });
          }
        }
      }
    };
    await visit(resolve(this.root, bucket), '');
    return objects;
  }

  async putExport(key: string, body: Uint8Array, meta: ExportObjectMeta): Promise<void> {
    assertExportKey(key);
    if (body.length < 1 || body.length > DEFAULT_MAX_UPLOAD_BYTES) {
      throw new Error('Export exceeds configured size limit');
    }
    if (meta.contentType !== 'text/csv' && meta.contentType !== 'application/json') {
      throw new Error('Export content type is invalid');
    }
    if (!(meta.expiresAt instanceof Date) || !Number.isFinite(meta.expiresAt.getTime())) {
      throw new Error('Export expiry is invalid');
    }
    const path = localPath(this.root, BUCKETS.exports, key);
    await this.ensureDir(path);
    await writeFile(path, body);
  }

  /** Internal completion/fixture helper; browser uploads still use presigned quarantine URLs. */
  async putLocal(
    bucket: BucketName,
    key: string,
    body: Uint8Array,
    contentType = 'application/octet-stream',
  ): Promise<void> {
    assertBucketName(bucket);
    if (bucket !== BUCKETS.quarantine) throw new Error('Direct writes must use quarantine');
    assertSafeObjectKey(key);
    if (body.length > (this.limits.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES)) {
      throw new Error('Upload exceeds configured size limit');
    }
    if (contentType === 'application/octet-stream')
      throw new Error('Stored objects require an allowlisted content type');
    assertPutMeta({ contentType, contentLength: body.length }, this.limits);
    const path = localPath(this.root, bucket, key);
    await this.ensureDir(path);
    await writeFile(path, body);
  }

  async getLocal(bucket: BucketName, key: string): Promise<Uint8Array> {
    const path = localPath(this.root, bucket, key);
    const buf = await readFile(path);
    if (buf.length > (this.limits.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES)) {
      throw new Error('Stored object exceeds configured size limit');
    }
    return new Uint8Array(buf);
  }

  async promoteFromQuarantine(
    key: string,
    targetBucket: BucketName,
    targetKey: string,
  ): Promise<void> {
    assertQuarantineKey(key);
    assertFinalBucket(targetBucket);
    assertContentAddressedKey(targetKey);
    const src = localPath(this.root, BUCKETS.quarantine, key);
    const dest = localPath(this.root, targetBucket, targetKey);
    await this.ensureDir(dest);
    try {
      await readFile(dest);
      const [sourceBody, targetBody] = await Promise.all([readFile(src), readFile(dest)]);
      if (!sourceBody.equals(targetBody))
        throw new Error('Target object already contains different bytes');
      await rm(src, { force: true });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        await rename(src, dest);
        return;
      }
      throw error;
    }
  }

  async deleteObject(bucket: BucketName, key: string): Promise<void> {
    assertBucketName(bucket);
    assertSafeObjectKey(key);
    await rm(localPath(this.root, bucket, key), { force: true });
  }
}
