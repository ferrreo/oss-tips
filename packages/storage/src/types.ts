export const BUCKETS = {
  publicMedia: 'oss-public-media',
  privateContent: 'oss-private-content',
  quarantine: 'oss-quarantine',
  exports: 'oss-exports',
} as const;

/** Bootstrap-only bucket list; backups never enter application storage APIs. */
export const BOOTSTRAP_BUCKETS = [...Object.values(BUCKETS), 'oss-backups'] as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

const BUCKET_VALUES = new Set<string>(Object.values(BUCKETS));

export function isBucketName(value: string): value is BucketName {
  return BUCKET_VALUES.has(value);
}

export function assertBucketName(value: string): asserts value is BucketName {
  if (!isBucketName(value)) {
    throw new Error(`Unknown storage bucket: ${value}`);
  }
}

export type UploadAssetKind = 'avatar' | 'logo' | 'banner' | 'post_image' | 'attachment';

export type PresignedUrl = {
  url: string;
  expiresAt: string;
  key: string;
  bucket: BucketName;
};

export type StorageObjectStream = {
  body: ReadableStream<Uint8Array>;
  contentLength: number;
  contentType?: string;
};

export type StorageObjectInfo = {
  key: string;
  contentLength?: number;
  /** Provider/object-store timestamp used to age-gate orphan cleanup. */
  lastModified?: Date;
};

export type PutObjectMeta = {
  contentType: string;
  contentLength: number;
  /** Display metadata only. It is never used as an object key. */
  filename?: string;
  assetKind?: UploadAssetKind;
};

export type ExportObjectMeta = {
  contentType: 'text/csv' | 'application/json';
  expiresAt: Date;
};

export type ValidationResult =
  | {
      ok: true;
      contentType: string;
      body?: Uint8Array;
      width?: number;
      height?: number;
      variants?: ReadonlyArray<{
        name: string;
        contentType: string;
        body: Uint8Array;
        width: number;
        height: number;
      }>;
    }
  | { ok: false; reason: string };

export type MalwareScanResult = { clean: true } | { clean: false; reason?: string };

export interface MalwareScanner {
  scan(body: Uint8Array, contentType: string): Promise<MalwareScanResult>;
}

export type PromotedVariant = {
  name: string;
  targetKey: string;
  contentType: string;
  contentLength: number;
  width: number;
  height: number;
};

export type PreparedAsset = {
  targetKey: string;
  contentType: string;
  contentLength: number;
  width?: number;
  height?: number;
  variants: PromotedVariant[];
};

export interface StorageClient {
  presignPut(
    bucket: BucketName,
    key: string,
    meta: PutObjectMeta,
    ttlSeconds?: number,
  ): Promise<PresignedUrl>;
  presignGet(bucket: BucketName, key: string, ttlSeconds?: number): Promise<PresignedUrl>;
  listObjects(bucket: BucketName): Promise<StorageObjectInfo[]>;
  getObjectStream(bucket: BucketName, key: string): Promise<StorageObjectStream>;
  putExport(key: string, body: Uint8Array, meta: ExportObjectMeta): Promise<void>;
  promoteFromQuarantine(key: string, targetBucket: BucketName, targetKey: string): Promise<void>;
  deleteObject(bucket: BucketName, key: string): Promise<void>;
}

/** Worker hook for AV scanning and optional decode/re-encode sanitisation. */
export interface QuarantineValidator {
  validate(
    key: string,
    contentType: string,
    body: Uint8Array,
    assetKind?: UploadAssetKind,
  ): Promise<ValidationResult>;
}

export interface QuarantineFlow {
  quarantinePut(key: string, meta: PutObjectMeta): Promise<PresignedUrl>;
  validateAndPromote(
    key: string,
    targetBucket: BucketName,
    body: Uint8Array,
    validator?: QuarantineValidator,
    expected?: {
      contentType?: string;
      contentLength?: number;
      assetKind?: UploadAssetKind;
      beforePromote?: (prepared: PreparedAsset) => Promise<void>;
    },
  ): Promise<{
    targetKey: string;
    contentType: string;
    contentLength: number;
    width?: number;
    height?: number;
    variants: PromotedVariant[];
  }>;
}
