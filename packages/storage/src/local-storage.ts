import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { assertSafeContentType } from './content-types.js';
import { BUCKETS, type BucketName, type PresignedUrl, type PutObjectMeta, type StorageClient } from './types.js';

const DEFAULT_TTL = 900;

function localPath(root: string, bucket: BucketName, key: string): string {
  return join(root, bucket, key);
}

/** Filesystem mock when S3_ENDPOINT is unset. Stores under ./data/storage. */
export class LocalStorageClient implements StorageClient {
  constructor(private readonly root = './data/storage') {}

  private async ensureDir(path: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
  }

  async presignPut(
    bucket: BucketName,
    key: string,
    meta: PutObjectMeta,
    ttlSeconds = DEFAULT_TTL,
  ): Promise<PresignedUrl> {
    assertSafeContentType(meta.contentType);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const path = localPath(this.root, bucket, key);
    const url = `file://${path}?put=1&expires=${expiresAt}`;
    return { url, expiresAt, key, bucket };
  }

  async presignGet(bucket: BucketName, key: string, ttlSeconds = DEFAULT_TTL): Promise<PresignedUrl> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const path = localPath(this.root, bucket, key);
    const url = `file://${path}?get=1&expires=${expiresAt}`;
    return { url, expiresAt, key, bucket };
  }

  async putLocal(bucket: BucketName, key: string, body: Uint8Array): Promise<void> {
    const path = localPath(this.root, bucket, key);
    await this.ensureDir(path);
    await writeFile(path, body);
  }

  async getLocal(bucket: BucketName, key: string): Promise<Uint8Array> {
    const path = localPath(this.root, bucket, key);
    const buf = await readFile(path);
    return new Uint8Array(buf);
  }

  async promoteFromQuarantine(key: string, targetBucket: BucketName, targetKey: string): Promise<void> {
    const src = localPath(this.root, BUCKETS.quarantine, key);
    const body = await readFile(src);
    const dest = localPath(this.root, targetBucket, targetKey);
    await this.ensureDir(dest);
    await writeFile(dest, body);
    await rm(src, { force: true });
  }

  async deleteObject(bucket: BucketName, key: string): Promise<void> {
    const path = localPath(this.root, bucket, key);
    await rm(path, { force: true });
  }
}
