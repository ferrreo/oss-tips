import {
  assertSafeContentType,
  assertQuarantineKey,
  BUCKETS,
  createQuarantineFlow,
  createStorageClient,
  LocalStorageClient,
  S3StorageClient,
  safeDisplayFilename,
  type BucketName,
  type PreparedAsset,
  uploadSizeLimit,
} from '@oss-tips/storage';
import { lockStorageObjectKeys, type Db } from '@oss-tips/db';

const ASSET_KINDS = ['avatar', 'logo', 'banner', 'post_image', 'attachment'] as const;
const VISIBILITIES = ['public', 'private'] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];
export type AssetVisibility = (typeof VISIBILITIES)[number];

export const PROJECT_STORAGE_QUOTA_BYTES = {
  standard: 1n * 1024n * 1024n * 1024n,
  contributes_5_percent: 5n * 1024n * 1024n * 1024n,
} as const;

export class StorageQuotaExceededError extends Error {
  constructor() {
    super('Project storage quota exceeded');
    this.name = 'StorageQuotaExceededError';
  }
}

export type AssetUploadRequest = {
  assetKind: AssetKind;
  contentType: string;
  contentLength: number;
  filename: string;
  purpose: AssetKind;
  visibility: AssetVisibility;
};

type ParseResult = { ok: true; data: AssetUploadRequest } | { ok: false; reason: string };

function field(input: Record<string, unknown>, snake: string, camel: string): unknown {
  return input[snake] ?? input[camel];
}

export function isAssetKind(value: unknown): value is AssetKind {
  return typeof value === 'string' && (ASSET_KINDS as readonly string[]).includes(value);
}

function isVisibility(value: unknown): value is AssetVisibility {
  return typeof value === 'string' && (VISIBILITIES as readonly string[]).includes(value);
}

/** Parse upload metadata without trusting filename, MIME or target bucket. */
export function parseAssetUploadRequest(input: unknown): ParseResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, reason: 'Request body must be an object' };
  }
  const value = input as Record<string, unknown>;
  const assetKind = field(value, 'asset_kind', 'assetKind');
  if (!isAssetKind(assetKind)) return { ok: false, reason: 'asset_kind is invalid' };

  const contentType = field(value, 'content_type', 'contentType');
  if (typeof contentType !== 'string' || contentType.length > 127) {
    return { ok: false, reason: 'content_type is invalid' };
  }
  try {
    assertSafeContentType(contentType);
  } catch {
    return { ok: false, reason: 'content_type is not allowed' };
  }

  const contentLength = field(value, 'content_length', 'contentLength');
  if (
    typeof contentLength !== 'number' ||
    !Number.isSafeInteger(contentLength) ||
    contentLength < 1
  ) {
    return { ok: false, reason: 'content_length must be a positive safe integer' };
  }

  const filename = field(value, 'filename', 'fileName');
  if (filename !== undefined && typeof filename !== 'string') {
    return { ok: false, reason: 'filename is invalid' };
  }
  const visibilityValue = value.visibility;
  const visibility =
    visibilityValue === undefined
      ? assetKind === 'attachment'
        ? 'private'
        : 'public'
      : visibilityValue;
  if (!isVisibility(visibility)) return { ok: false, reason: 'visibility is invalid' };
  if (assetKind === 'attachment' && visibility !== 'private') {
    return { ok: false, reason: 'attachments must be private' };
  }
  if (['avatar', 'logo', 'banner'].includes(assetKind) && visibility !== 'public') {
    return { ok: false, reason: 'branding assets must be public' };
  }

  const purposeValue = field(value, 'purpose', 'purpose');
  const purpose = purposeValue === undefined ? assetKind : purposeValue;
  if (!isAssetKind(purpose)) return { ok: false, reason: 'purpose is invalid' };

  return {
    ok: true,
    data: {
      assetKind,
      contentType,
      contentLength,
      filename: safeDisplayFilename(typeof filename === 'string' ? filename : 'upload'),
      purpose,
      visibility,
    },
  };
}

export function targetBucketForVisibility(visibility: AssetVisibility): BucketName {
  return visibility === 'private' ? BUCKETS.privateContent : BUCKETS.publicMedia;
}

export function isPendingStorageKey(key: string): boolean {
  try {
    assertQuarantineKey(key);
    return true;
  } catch {
    return false;
  }
}

type AppStorage = LocalStorageClient | S3StorageClient;

let cachedStorage: AppStorage | null = null;

export function getStorage(): AppStorage {
  if (cachedStorage) return cachedStorage;
  cachedStorage = createStorageClient({
    s3Endpoint: process.env.S3_ENDPOINT,
    s3Region: process.env.S3_REGION,
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    localRoot: process.env.STORAGE_ROOT,
    nodeEnv: process.env.NODE_ENV,
  });
  return cachedStorage;
}

export function getQuarantineFlow(storage = getStorage()) {
  return createQuarantineFlow(storage);
}

export class UploadBodyTooLargeError extends Error {
  constructor() {
    super('Upload exceeds configured size limit');
    this.name = 'UploadBodyTooLargeError';
  }
}

export class UploadBodyLengthMismatchError extends Error {
  constructor() {
    super('Upload size does not match content-length');
    this.name = 'UploadBodyLengthMismatchError';
  }
}

/** Parse one Content-Length value; absent headers are valid for bounded chunked uploads. */
export function parseUploadContentLength(value: string | null): number | undefined {
  if (value === null) return undefined;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) throw new Error('Content-Length must be a non-negative integer');
  const contentLength = Number(normalized);
  if (!Number.isSafeInteger(contentLength)) {
    throw new Error('Content-Length must be a safe integer');
  }
  return contentLength;
}

/** Read request bytes without retaining more than the effective purpose limit. */
export async function readBoundedUploadBody(
  request: Request,
  maxBytes: number,
  contentLength?: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('Upload size limit must be a positive safe integer');
  }
  const reader = request.body?.getReader();
  if (!reader) {
    if (contentLength !== undefined && contentLength !== 0) {
      throw new UploadBodyLengthMismatchError();
    }
    return new Uint8Array();
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > maxBytes - total) {
        try {
          await reader.cancel();
        } catch {
          // The body is already rejected; cancellation is best effort.
        }
        throw new UploadBodyTooLargeError();
      }
      total += value.byteLength;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (contentLength !== undefined && total !== contentLength) {
    throw new UploadBodyLengthMismatchError();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function assetUploadSizeLimit(contentType: string, purpose: string): number {
  return uploadSizeLimit(contentType, {
    ...(isAssetKind(purpose) ? { assetKind: purpose } : {}),
  });
}

export async function readQuarantineObject(storage: AppStorage, key: string): Promise<Uint8Array> {
  if (!isPendingStorageKey(key)) throw new Error('Invalid quarantine key');
  if (storage instanceof LocalStorageClient) return storage.getLocal(BUCKETS.quarantine, key);
  return storage.getObject(BUCKETS.quarantine, key);
}

/** Soft-delete media only after the key is locked and all database references are gone. */
export async function softDeleteAssetIfUnreferenced(
  db: Db,
  assetId: string,
  now = new Date(),
): Promise<boolean> {
  const asset = await db
    .selectFrom('object_asset')
    .select(['id', 'storage_key', 'soft_deleted_at', 'legal_hold'])
    .where('id', '=', assetId)
    .executeTakeFirst();
  if (!asset || asset.soft_deleted_at || asset.legal_hold) return false;

  await lockStorageObjectKeys(db, [asset.storage_key]);
  const current = await db
    .selectFrom('object_asset')
    .select(['id', 'storage_key', 'soft_deleted_at', 'legal_hold'])
    .where('id', '=', asset.id)
    .forUpdate()
    .executeTakeFirst();
  if (
    !current ||
    current.storage_key !== asset.storage_key ||
    current.soft_deleted_at ||
    current.legal_hold
  ) {
    return false;
  }

  const [attachment, project] = await Promise.all([
    db
      .selectFrom('post_attachment')
      .select('id')
      .where('object_asset_id', '=', asset.id)
      .executeTakeFirst(),
    db
      .selectFrom('project')
      .select('id')
      .where((eb) =>
        eb.or([eb('logo_asset_id', '=', asset.id), eb('banner_asset_id', '=', asset.id)]),
      )
      .executeTakeFirst(),
  ]);
  if (attachment || project) return false;

  const result = await db
    .updateTable('object_asset')
    .set({ soft_deleted_at: now })
    .where('id', '=', asset.id)
    .where('soft_deleted_at', 'is', null)
    .where('legal_hold', '=', false)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) > 0;
}

/** Reserve exact post-processing bytes before object promotion. */
export async function reserveProjectStorageQuota(
  db: Db,
  projectId: string,
  assetId: string,
  prepared: PreparedAsset,
): Promise<void> {
  await db
    .transaction()
    .execute((trx) => reserveProjectStorageQuotaInTransaction(trx, projectId, assetId, prepared));
}

/** Reserve quota using caller's transaction when promotion locks object keys. */
export async function reserveProjectStorageQuotaInTransaction(
  trx: Db,
  projectId: string,
  assetId: string,
  prepared: PreparedAsset,
): Promise<void> {
  const project = await trx
    .selectFrom('project')
    .select('id')
    .where('id', '=', projectId)
    .forUpdate()
    .executeTakeFirst();
  if (!project) throw new Error('Project not found');

  const mode = await trx
    .selectFrom('project_feature_mode')
    .select('mode')
    .where('project_id', '=', projectId)
    .orderBy('effective_at', 'desc')
    .executeTakeFirst();
  const quota =
    mode?.mode === 'contributes_5_percent'
      ? PROJECT_STORAGE_QUOTA_BYTES.contributes_5_percent
      : PROJECT_STORAGE_QUOTA_BYTES.standard;

  const assets = await trx
    .selectFrom('object_asset')
    .select(['id', 'storage_key', 'byte_size', 'reserved_bytes'])
    .where('project_id', '=', projectId)
    .where('soft_deleted_at', 'is', null)
    .execute();
  const variants = await trx
    .selectFrom('object_asset_variant')
    .innerJoin('object_asset', 'object_asset.id', 'object_asset_variant.object_asset_id')
    .select(['object_asset_variant.storage_key', 'object_asset_variant.byte_size'])
    .where('object_asset_variant.project_id', '=', projectId)
    .where('object_asset.soft_deleted_at', 'is', null)
    .execute();

  const bytesByKey = new Map<string, bigint>();
  for (const asset of assets) {
    if (asset.id !== assetId) {
      bytesByKey.set(asset.storage_key, BigInt(asset.byte_size) + BigInt(asset.reserved_bytes));
    }
  }
  for (const variant of variants) {
    if (!bytesByKey.has(variant.storage_key))
      bytesByKey.set(variant.storage_key, BigInt(variant.byte_size));
  }
  bytesByKey.set(prepared.targetKey, BigInt(prepared.contentLength));
  for (const variant of prepared.variants) {
    if (!bytesByKey.has(variant.targetKey))
      bytesByKey.set(variant.targetKey, BigInt(variant.contentLength));
  }
  const used = [...bytesByKey.values()].reduce((sum, value) => sum + value, 0n);
  if (used > quota) throw new StorageQuotaExceededError();

  const variantBytes = prepared.variants.reduce(
    (sum, variant) => sum + BigInt(variant.contentLength),
    0n,
  );
  await trx
    .updateTable('object_asset')
    .set({ reserved_bytes: variantBytes })
    .where('id', '=', assetId)
    .where('project_id', '=', projectId)
    .executeTakeFirstOrThrow();
}
