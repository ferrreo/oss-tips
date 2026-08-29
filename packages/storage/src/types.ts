export const BUCKETS = {
  publicMedia: 'public-media',
  privateContent: 'private-content',
  quarantine: 'quarantine',
  exports: 'exports',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

export type PresignedUrl = {
  url: string;
  expiresAt: string;
  key: string;
  bucket: BucketName;
};

export type PutObjectMeta = {
  contentType: string;
  contentLength: number;
};

export type ValidationResult =
  | { ok: true; contentType: string }
  | { ok: false; reason: string };

export interface StorageClient {
  presignPut(bucket: BucketName, key: string, meta: PutObjectMeta, ttlSeconds?: number): Promise<PresignedUrl>;
  presignGet(bucket: BucketName, key: string, ttlSeconds?: number): Promise<PresignedUrl>;
  promoteFromQuarantine(key: string, targetBucket: BucketName, targetKey: string): Promise<void>;
  deleteObject(bucket: BucketName, key: string): Promise<void>;
}

export interface QuarantineValidator {
  validate(key: string, contentType: string, body: Uint8Array): Promise<ValidationResult>;
}

export interface QuarantineFlow {
  quarantinePut(key: string, meta: PutObjectMeta): Promise<PresignedUrl>;
  validateAndPromote(
    key: string,
    targetBucket: BucketName,
    body: Uint8Array,
    validator: QuarantineValidator,
  ): Promise<{ targetKey: string }>;
}
