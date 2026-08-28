import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { assertSafeContentType } from './content-types.js';
import type { BucketName, PresignedUrl, PutObjectMeta, StorageClient } from './types.js';

const DEFAULT_TTL = 900;

export type S3Config = {
  endpoint?: string | undefined;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean | undefined;
};

export class S3StorageClient implements StorageClient {
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region: config.region,
      forcePathStyle: config.forcePathStyle ?? true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
    }
    this.client = new S3Client(clientConfig);
  }

  async presignPut(
    bucket: BucketName,
    key: string,
    meta: PutObjectMeta,
    ttlSeconds = DEFAULT_TTL,
  ): Promise<PresignedUrl> {
    assertSafeContentType(meta.contentType);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: meta.contentType,
      ContentLength: meta.contentLength,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    return { url, expiresAt, key, bucket };
  }

  async presignGet(bucket: BucketName, key: string, ttlSeconds = DEFAULT_TTL): Promise<PresignedUrl> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    return { url, expiresAt, key, bucket };
  }

  async promoteFromQuarantine(key: string, targetBucket: BucketName, targetKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: targetBucket,
        Key: targetKey,
        CopySource: `${'quarantine'}/${key}`,
      }),
    );
    await this.client.send(new DeleteObjectCommand({ Bucket: 'quarantine', Key: key }));
  }

  async deleteObject(bucket: BucketName, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}
