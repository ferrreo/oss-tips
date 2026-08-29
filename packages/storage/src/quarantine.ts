import { randomBytes } from 'node:crypto';
import { contentAddressedKey, quarantineKey } from './keys.js';
import { LocalStorageClient } from './local-storage.js';
import { S3StorageClient, type S3Config } from './s3-storage.js';
import { BUCKETS, type BucketName, type QuarantineFlow, type QuarantineValidator } from './types.js';

export class QuarantineStorageFlow implements QuarantineFlow {
  constructor(private readonly storage: LocalStorageClient | S3StorageClient) {}

  async quarantinePut(key: string, meta: import('./types.js').PutObjectMeta) {
    return this.storage.presignPut(BUCKETS.quarantine, key, meta);
  }

  async validateAndPromote(
    key: string,
    targetBucket: BucketName,
    body: Uint8Array,
    validator: QuarantineValidator,
  ): Promise<{ targetKey: string }> {
    const contentType = 'application/octet-stream';
    const result = await validator.validate(key, contentType, body);
    if (!result.ok) {
      throw new Error(result.reason);
    }
    const targetKey = contentAddressedKey(body, 'dat');
    if (this.storage instanceof LocalStorageClient) {
      await this.storage.putLocal(BUCKETS.quarantine, key, body);
      await this.storage.promoteFromQuarantine(key, targetBucket, targetKey);
    } else {
      await this.storage.promoteFromQuarantine(key, targetBucket, targetKey);
    }
    return { targetKey };
  }
}

export function createStorageClient(env: {
  s3Endpoint?: string | undefined;
  s3Region?: string | undefined;
  s3AccessKeyId?: string | undefined;
  s3SecretAccessKey?: string | undefined;
  localRoot?: string | undefined;
}): LocalStorageClient | S3StorageClient {
  if (!env.s3Endpoint) {
    return new LocalStorageClient(env.localRoot ?? './data/storage');
  }
  const config: S3Config = {
    endpoint: env.s3Endpoint,
    region: env.s3Region ?? 'auto',
    accessKeyId: env.s3AccessKeyId ?? 'local',
    secretAccessKey: env.s3SecretAccessKey ?? 'local',
    forcePathStyle: true,
  };
  return new S3StorageClient(config);
}

export function newUploadId(): string {
  return randomBytes(16).toString('hex');
}

export function createQuarantineFlow(storage: LocalStorageClient | S3StorageClient): QuarantineStorageFlow {
  return new QuarantineStorageFlow(storage);
}

export { quarantineKey };
