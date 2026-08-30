import {
  CreateBucketCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  assertSafeContentType,
  assertUploadSize,
  DEFAULT_MAX_UPLOAD_BYTES,
  type UploadValidationOptions,
} from './content-types.js';
import {
  assertContentAddressedKey,
  assertFinalBucket,
  assertExportKey,
  assertQuarantineKey,
  assertSafeObjectKey,
} from './keys.js';
import {
  assertBucketName,
  BOOTSTRAP_BUCKETS,
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

export type S3Config = {
  /** RustFS/S3 endpoint. It is deployment configuration, never a request URL. */
  endpoint?: string | undefined;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean | undefined;
  limits?: UploadValidationOptions | undefined;
};

function assertTtl(ttlSeconds: number): void {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_TTL) {
    throw new Error(`Presigned URL TTL must be between 1 and ${MAX_TTL} seconds`);
  }
}

/** Restrict S3 endpoint configuration to a plain HTTP(S) origin. */
export function assertSafeS3Endpoint(endpoint: string): void {
  if (
    typeof endpoint !== 'string' ||
    endpoint.length > 2048 ||
    /[\u0000-\u001f\u007f]/.test(endpoint)
  )
    throw new Error('Invalid S3 endpoint');
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error('Invalid S3 endpoint');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('S3 endpoint must use HTTP or HTTPS');
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== '/' && parsed.pathname !== '')
  ) {
    throw new Error('S3 endpoint must be an origin without credentials, path, or query parameters');
  }
  const hostname = parsed.hostname.replace(/\.$/, '').toLowerCase();
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    throw new Error('S3 endpoint cannot target cloud instance metadata');
  }
}

function assertCredentials(config: S3Config): void {
  if (!config.region || !config.accessKeyId || !config.secretAccessKey)
    throw new Error('S3 credentials are required');
  if (
    [config.region, config.accessKeyId, config.secretAccessKey].some((value) =>
      /[\u0000-\u001f\u007f]/.test(value),
    )
  ) {
    throw new Error('S3 credentials cannot contain control characters');
  }
}

function assertPutMeta(meta: PutObjectMeta, limits: UploadValidationOptions): string {
  assertSafeContentType(meta.contentType);
  assertUploadSize(meta.contentType, meta.contentLength, {
    ...limits,
    ...(meta.assetKind === undefined ? {} : { assetKind: meta.assetKind }),
  });
  return meta.contentType.split(';', 1)[0]?.trim().toLowerCase() ?? meta.contentType;
}

function s3ErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { Code?: unknown; code?: unknown; name?: unknown }).Code;
  if (typeof code === 'string') return code;
  const lowerCode = (error as { code?: unknown }).code;
  if (typeof lowerCode === 'string') return lowerCode;
  const name = (error as { name?: unknown }).name;
  return typeof name === 'string' ? name : undefined;
}

function s3Status(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const metadata = (error as { $metadata?: { httpStatusCode?: unknown } }).$metadata;
  return typeof metadata?.httpStatusCode === 'number' ? metadata.httpStatusCode : undefined;
}

function isMissingBucket(error: unknown): boolean {
  return s3Status(error) === 404 || ['NotFound', 'NoSuchBucket'].includes(s3ErrorCode(error) ?? '');
}

function isExistingBucket(error: unknown): boolean {
  return (
    s3Status(error) === 409 ||
    ['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(s3ErrorCode(error) ?? '')
  );
}

export class S3StorageClient implements StorageClient {
  private readonly client: S3Client;
  private readonly limits: UploadValidationOptions;

  constructor(config: S3Config) {
    assertCredentials(config);
    if (config.endpoint) assertSafeS3Endpoint(config.endpoint);
    this.limits = {
      maxBytes: config.limits?.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES,
      ...config.limits,
    };
    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region: config.region,
      forcePathStyle: config.forcePathStyle ?? true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };
    if (config.endpoint) clientConfig.endpoint = config.endpoint;
    this.client = new S3Client(clientConfig);
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
    const contentType = assertPutMeta(meta, this.limits);
    assertTtl(ttlSeconds);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: meta.contentLength,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    return { url, expiresAt, key, bucket };
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
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(bucket === BUCKETS.privateContent ? { ResponseContentDisposition: 'attachment' } : {}),
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    return { url, expiresAt, key, bucket };
  }

  async getObjectStream(bucket: BucketName, key: string): Promise<StorageObjectStream> {
    assertBucketName(bucket);
    assertSafeObjectKey(key);
    const response = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!response.Body) throw new Error('Stored object has no body');
    if (
      response.ContentLength === undefined ||
      !Number.isSafeInteger(response.ContentLength) ||
      response.ContentLength < 1
    ) {
      throw new Error('Stored object has invalid content length');
    }
    if (response.ContentLength > (this.limits.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES)) {
      throw new Error('Stored object exceeds configured size limit');
    }
    return {
      body: response.Body.transformToWebStream(),
      contentLength: response.ContentLength,
      ...(response.ContentType === undefined ? {} : { contentType: response.ContentType }),
    };
  }

  async listObjects(bucket: BucketName): Promise<StorageObjectInfo[]> {
    assertBucketName(bucket);
    const objects: StorageObjectInfo[] = [];
    let continuationToken: string | undefined;
    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ...(continuationToken === undefined ? {} : { ContinuationToken: continuationToken }),
        }),
      );
      for (const object of response.Contents ?? []) {
        if (typeof object.Key !== 'string') continue;
        const info: StorageObjectInfo = { key: object.Key };
        if (Number.isSafeInteger(object.Size) && object.Size !== undefined && object.Size >= 0) {
          info.contentLength = object.Size;
        }
        if (object.LastModified instanceof Date && Number.isFinite(object.LastModified.getTime())) {
          info.lastModified = object.LastModified;
        }
        objects.push(info);
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken !== undefined);
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
    await this.client.send(
      new PutObjectCommand({
        Bucket: BUCKETS.exports,
        Key: key,
        Body: body,
        ContentType: meta.contentType,
        ContentLength: body.length,
        CacheControl: 'private,no-store',
        Expires: meta.expiresAt,
        Metadata: { 'expires-at': meta.expiresAt.toISOString() },
      }),
    );
  }

  /** Read a quarantined object for completion validation; quarantine has no signed GET path. */
  async getObject(bucket: BucketName, key: string): Promise<Uint8Array> {
    assertBucketName(bucket);
    assertSafeObjectKey(key);
    const metadata = await this.headObject(bucket, key);
    if (metadata.contentLength > (this.limits.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES)) {
      throw new Error('Stored object exceeds configured size limit');
    }
    const response = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!response.Body) throw new Error('Stored object has no body');
    const body = await response.Body.transformToByteArray();
    if (body.length > (this.limits.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES)) {
      throw new Error('Stored object exceeds configured size limit');
    }
    return body;
  }

  async headObject(
    bucket: BucketName,
    key: string,
  ): Promise<{
    contentLength: number;
    contentType?: string;
    metadata?: Record<string, string>;
  }> {
    assertBucketName(bucket);
    assertSafeObjectKey(key);
    const response = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (response.ContentLength === undefined)
      throw new Error('Stored object has no content length');
    return {
      contentLength: response.ContentLength,
      ...(response.ContentType === undefined ? {} : { contentType: response.ContentType }),
      ...(response.Metadata === undefined ? {} : { metadata: response.Metadata }),
    };
  }

  /** Internal completion helper used to persist sanitised bytes before promotion. */
  async putObject(
    bucket: BucketName,
    key: string,
    body: Uint8Array,
    meta: PutObjectMeta,
  ): Promise<void> {
    assertBucketName(bucket);
    if (bucket !== BUCKETS.quarantine) throw new Error('Direct writes must use quarantine');
    assertSafeObjectKey(key);
    const contentType = assertPutMeta({ ...meta, contentLength: body.length }, this.limits);
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
      }),
    );
  }

  async promoteFromQuarantine(
    key: string,
    targetBucket: BucketName,
    targetKey: string,
  ): Promise<void> {
    assertQuarantineKey(key);
    assertFinalBucket(targetBucket);
    assertContentAddressedKey(targetKey);
    const source = await this.headObject(BUCKETS.quarantine, key);
    await this.client.send(
      new CopyObjectCommand({
        Bucket: targetBucket,
        Key: targetKey,
        CopySource: `${BUCKETS.quarantine}/${encodeURIComponent(key)}`,
        MetadataDirective: 'REPLACE',
        ContentType: source.contentType ?? 'application/octet-stream',
        ...(source.metadata === undefined ? {} : { Metadata: source.metadata }),
        CacheControl:
          targetBucket === BUCKETS.publicMedia
            ? 'public,max-age=31536000,immutable'
            : 'private,no-store',
      }),
    );
    await this.client.send(new DeleteObjectCommand({ Bucket: BUCKETS.quarantine, Key: key }));
  }

  async deleteObject(bucket: BucketName, key: string): Promise<void> {
    assertBucketName(bucket);
    assertSafeObjectKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  /** Create configured buckets once; existing buckets are left untouched. */
  async ensureBuckets(): Promise<void> {
    for (const bucket of BOOTSTRAP_BUCKETS) {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
        continue;
      } catch (error) {
        if (!isMissingBucket(error)) throw error;
      }
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch (error) {
        if (!isExistingBucket(error)) throw error;
      }
    }
  }
}
