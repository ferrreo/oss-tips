import { lockStorageObjectKeys, type Db } from '@oss-tips/db';
import { createLogger } from '@oss-tips/observability';
import {
  assertExportKey,
  assertQuarantineKey,
  BUCKETS,
  isContentAddressedKey,
  isSafeObjectKey,
  type BucketName,
  type StorageClient,
  type StorageObjectInfo,
} from '@oss-tips/storage';

export const MEDIA_RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;
/** Allow an upload completion transaction to finish before reclaiming final objects. */
export const PROMOTED_OBJECT_RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1_000;
/** Allow a browser upload or completion transaction to finish before reclaiming quarantine. */
export const QUARANTINE_OBJECT_RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1_000;
export const STORAGE_INVENTORY_BUCKETS = [
  BUCKETS.publicMedia,
  BUCKETS.privateContent,
  BUCKETS.quarantine,
  BUCKETS.exports,
] as const;

export type StorageMaintenanceStorage = Pick<StorageClient, 'deleteObject' | 'listObjects'>;

export type StorageMaintenanceDependencies = {
  db: Db;
  storage: StorageMaintenanceStorage;
  now?: () => Date;
};

export type StorageInventoryReport = {
  referencesChecked: number;
  objectsChecked: number;
  missingReferences: number;
  orphanObjects: number;
  sizeMismatches: number;
  invalidReferences: number;
};

type StoredReference = {
  bucket: BucketName;
  key: string;
  byteSize: bigint | null;
};

const log = createLogger('@oss-tips/worker');

function bucketForAsset(purpose: string, visibility: string, key: string): BucketName | null {
  if (key.startsWith('pending/')) return BUCKETS.quarantine;
  if (purpose === 'export') return BUCKETS.exports;
  if (visibility === 'public') return BUCKETS.publicMedia;
  if (visibility === 'private') return BUCKETS.privateContent;
  return null;
}

function objectRefKey(bucket: BucketName, key: string): string {
  return `${bucket}\u0000${key}`;
}

function addReference(
  references: Map<string, StoredReference>,
  bucket: BucketName | null,
  key: string,
  byteSize: bigint | null,
): boolean {
  if (!bucket || !isSafeObjectKey(key)) return false;
  references.set(objectRefKey(bucket, key), { bucket, key, byteSize });
  return true;
}

function sizeMatches(expected: bigint | null, actual: StorageObjectInfo): boolean {
  return expected === null || actual.contentLength === undefined
    ? true
    : BigInt(actual.contentLength) === expected;
}

function isQuarantineKey(key: string): boolean {
  try {
    assertQuarantineKey(key);
    return true;
  } catch {
    return false;
  }
}

function isExportKey(key: string): boolean {
  try {
    assertExportKey(key);
    return true;
  } catch {
    return false;
  }
}

function isOldObject(object: StorageObjectInfo, cutoff: Date): boolean {
  return (
    object.lastModified instanceof Date &&
    Number.isFinite(object.lastModified.getTime()) &&
    object.lastModified <= cutoff
  );
}

export async function inventoryStorage(
  db: Db,
  storage: StorageMaintenanceStorage,
): Promise<StorageInventoryReport> {
  const [assets, variants, listed] = await Promise.all([
    db
      .selectFrom('object_asset')
      .select(['purpose', 'visibility', 'storage_key', 'byte_size'])
      .execute(),
    db
      .selectFrom('object_asset_variant')
      .select(['visibility', 'storage_key', 'byte_size'])
      .execute(),
    Promise.all(
      STORAGE_INVENTORY_BUCKETS.map(
        async (bucket) => [bucket, await storage.listObjects(bucket)] as const,
      ),
    ),
  ]);

  const references = new Map<string, StoredReference>();
  let invalidReferences = 0;
  for (const asset of assets) {
    if (
      !addReference(
        references,
        bucketForAsset(asset.purpose, asset.visibility, asset.storage_key),
        asset.storage_key,
        BigInt(asset.byte_size),
      )
    ) {
      invalidReferences += 1;
    }
  }
  for (const variant of variants) {
    if (
      !addReference(
        references,
        bucketForAsset('media', variant.visibility, variant.storage_key),
        variant.storage_key,
        BigInt(variant.byte_size),
      )
    ) {
      invalidReferences += 1;
    }
  }

  const objects = new Map<string, StorageObjectInfo>();
  for (const [bucket, bucketObjects] of listed) {
    for (const object of bucketObjects) objects.set(objectRefKey(bucket, object.key), object);
  }

  let missingReferences = 0;
  let sizeMismatches = 0;
  for (const [key, reference] of references) {
    const object = objects.get(key);
    if (!object) {
      missingReferences += 1;
    } else if (!sizeMatches(reference.byteSize, object)) {
      sizeMismatches += 1;
    }
  }

  let orphanObjects = 0;
  for (const key of objects.keys()) {
    if (!references.has(key)) orphanObjects += 1;
  }

  return {
    referencesChecked: references.size,
    objectsChecked: objects.size,
    missingReferences,
    orphanObjects,
    sizeMismatches,
    invalidReferences,
  };
}

export async function runStorageInventory(
  dependencies: StorageMaintenanceDependencies,
): Promise<StorageInventoryReport> {
  const report = await inventoryStorage(dependencies.db, dependencies.storage);
  if (
    report.missingReferences ||
    report.orphanObjects ||
    report.sizeMismatches ||
    report.invalidReferences
  ) {
    log.warn('storage inventory mismatch', {
      missingReferences: report.missingReferences,
      orphanObjects: report.orphanObjects,
      sizeMismatches: report.sizeMismatches,
      invalidReferences: report.invalidReferences,
    });
  }
  return report;
}

/** Remove old unreferenced final or export objects left behind by a failed metadata transaction. */
export async function cleanupOrphanedPromotedObjects(
  dependencies: StorageMaintenanceDependencies,
  recoveryWindowMs = PROMOTED_OBJECT_RECOVERY_WINDOW_MS,
): Promise<number> {
  if (!Number.isSafeInteger(recoveryWindowMs) || recoveryWindowMs < 0) {
    throw new Error('Promoted object recovery window must be a non-negative safe integer');
  }
  const now = dependencies.now?.() ?? new Date();
  const cutoff = new Date(now.getTime() - recoveryWindowMs);
  const buckets: Array<{
    bucket: BucketName;
    visibility: 'public' | 'private';
    isCandidate: (key: string) => boolean;
  }> = [
    { bucket: BUCKETS.publicMedia, visibility: 'public', isCandidate: isContentAddressedKey },
    { bucket: BUCKETS.privateContent, visibility: 'private', isCandidate: isContentAddressedKey },
    { bucket: BUCKETS.exports, visibility: 'private', isCandidate: isExportKey },
  ];
  const listed = await Promise.all(
    buckets.map(async (target) => ({
      ...target,
      objects: await dependencies.storage.listObjects(target.bucket),
    })),
  );
  let deleted = 0;

  for (const { bucket, visibility, isCandidate, objects } of listed) {
    for (const object of objects) {
      if (
        !isCandidate(object.key) ||
        !isSafeObjectKey(object.key) ||
        !isOldObject(object, cutoff)
      ) {
        continue;
      }
      const removed = await dependencies.db.transaction().execute(async (trx) => {
        await lockStorageObjectKeys(trx, [object.key]);
        const [asset, variant] = await Promise.all([
          trx
            .selectFrom('object_asset')
            .select('id')
            .where('storage_key', '=', object.key)
            .where('visibility', '=', visibility)
            .forUpdate()
            .executeTakeFirst(),
          trx
            .selectFrom('object_asset_variant')
            .select('id')
            .where('storage_key', '=', object.key)
            .where('visibility', '=', visibility)
            .forUpdate()
            .executeTakeFirst(),
        ]);
        if (asset || variant) return false;
        await dependencies.storage.deleteObject(bucket, object.key);
        return true;
      });
      if (removed) deleted += 1;
    }
  }
  return deleted;
}

/** Reclaim stale quarantine bytes and clear pending metadata that still consumes quota. */
export async function cleanupStaleQuarantineObjects(
  dependencies: StorageMaintenanceDependencies,
  recoveryWindowMs = QUARANTINE_OBJECT_RECOVERY_WINDOW_MS,
): Promise<number> {
  if (!Number.isSafeInteger(recoveryWindowMs) || recoveryWindowMs < 0) {
    throw new Error('Quarantine object recovery window must be a non-negative safe integer');
  }
  const now = dependencies.now?.() ?? new Date();
  const cutoff = new Date(now.getTime() - recoveryWindowMs);
  const objects = await dependencies.storage.listObjects(BUCKETS.quarantine);
  const listed = new Map(objects.map((object) => [object.key, object]));
  const rows = await dependencies.db
    .selectFrom('object_asset')
    .select(['storage_key', 'created_at'])
    .where('storage_key', 'like', 'pending/%')
    .where('soft_deleted_at', 'is', null)
    .execute();
  const candidates = new Set<string>();
  for (const object of objects) {
    if (isQuarantineKey(object.key) && isOldObject(object, cutoff)) candidates.add(object.key);
  }
  for (const row of rows) {
    if (!isQuarantineKey(row.storage_key)) continue;
    const object = listed.get(row.storage_key);
    if (object) {
      if (!isOldObject(object, cutoff)) continue;
    } else if (
      !(row.created_at instanceof Date) ||
      !Number.isFinite(row.created_at.getTime()) ||
      row.created_at > cutoff
    ) {
      continue;
    }
    candidates.add(row.storage_key);
  }

  let cleaned = 0;
  for (const key of candidates) {
    const removed = await dependencies.db.transaction().execute(async (trx) => {
      await lockStorageObjectKeys(trx, [key]);
      const activeRows = await trx
        .selectFrom('object_asset')
        .select(['id', 'legal_hold'])
        .where('storage_key', '=', key)
        .where('soft_deleted_at', 'is', null)
        .forUpdate()
        .execute();
      if (activeRows.some(({ legal_hold }) => legal_hold)) return false;
      const object = listed.get(key);
      if (!activeRows.length) {
        if (!object) return false;
        await dependencies.storage.deleteObject(BUCKETS.quarantine, key);
        return true;
      }
      if (object) await dependencies.storage.deleteObject(BUCKETS.quarantine, key);
      await trx
        .updateTable('object_asset')
        .set({ soft_deleted_at: now, reserved_bytes: 0n, updated_at: now })
        .where('storage_key', '=', key)
        .where('soft_deleted_at', 'is', null)
        .execute();
      return true;
    });
    if (removed) cleaned += 1;
  }
  return cleaned;
}

export async function cleanupExpiredExports(
  dependencies: StorageMaintenanceDependencies,
): Promise<number> {
  const now = dependencies.now?.() ?? new Date();
  const rows = await dependencies.db
    .selectFrom('object_asset')
    .select(['id', 'storage_key'])
    .where('purpose', '=', 'export')
    .where('expires_at', '<=', now)
    .execute();
  let deleted = 0;
  for (const row of rows) {
    assertExportKey(row.storage_key);
    await dependencies.storage.deleteObject(BUCKETS.exports, row.storage_key);
    await dependencies.db
      .deleteFrom('object_asset')
      .where('id', '=', row.id)
      .where('purpose', '=', 'export')
      .where('expires_at', '<=', now)
      .execute();
    deleted += 1;
  }
  return deleted;
}

export async function purgeDeletedMedia(
  dependencies: StorageMaintenanceDependencies,
  recoveryWindowMs = MEDIA_RECOVERY_WINDOW_MS,
): Promise<number> {
  if (!Number.isSafeInteger(recoveryWindowMs) || recoveryWindowMs < 0) {
    throw new Error('Media recovery window must be a non-negative safe integer');
  }
  const now = dependencies.now?.() ?? new Date();
  const cutoff = new Date(now.getTime() - recoveryWindowMs);
  const rows = await dependencies.db
    .selectFrom('object_asset')
    .select(['id', 'purpose', 'visibility', 'storage_key', 'soft_deleted_at', 'legal_hold'])
    .where('purpose', '!=', 'export')
    .where('legal_hold', '=', false)
    .where('soft_deleted_at', '<=', cutoff)
    .execute();
  if (rows.length === 0) return 0;

  let purged = 0;
  for (const row of rows) {
    const staleVariantKeys = await dependencies.db
      .selectFrom('object_asset_variant')
      .select('storage_key')
      .where('object_asset_id', '=', row.id)
      .execute();
    const lockKeys = [row.storage_key, ...staleVariantKeys.map((variant) => variant.storage_key)];
    const didPurge = await dependencies.db.transaction().execute(async (trx) => {
      await lockStorageObjectKeys(trx, lockKeys);

      const current = await trx
        .selectFrom('object_asset')
        .select(['id', 'purpose', 'visibility', 'storage_key', 'soft_deleted_at', 'legal_hold'])
        .where('id', '=', row.id)
        .where('purpose', '!=', 'export')
        .where('legal_hold', '=', false)
        .where('soft_deleted_at', '<=', cutoff)
        .forUpdate()
        .executeTakeFirst();
      if (!current || current.storage_key !== row.storage_key) return false;

      const [assetRefs, variantRefs, attachments] = await Promise.all([
        trx
          .selectFrom('object_asset')
          .select(['id', 'purpose', 'visibility', 'storage_key'])
          .execute(),
        trx
          .selectFrom('object_asset_variant')
          .select(['id', 'object_asset_id', 'storage_key', 'visibility'])
          .execute(),
        trx.selectFrom('post_attachment').select('object_asset_id').execute(),
      ]);
      if (attachments.some(({ object_asset_id }) => object_asset_id === current.id)) return false;

      const currentVariants = variantRefs.filter(
        (variant) => variant.object_asset_id === current.id,
      );
      const otherKeys = new Set<string>();
      for (const ref of assetRefs) {
        if (ref.id === current.id) continue;
        const bucket = bucketForAsset(ref.purpose, ref.visibility, ref.storage_key);
        if (!bucket || !isSafeObjectKey(ref.storage_key)) {
          throw new Error('Stored asset has invalid storage reference');
        }
        otherKeys.add(objectRefKey(bucket, ref.storage_key));
      }
      for (const ref of variantRefs) {
        if (ref.object_asset_id === current.id) continue;
        const bucket = bucketForAsset('media', ref.visibility, ref.storage_key);
        if (!bucket || !isSafeObjectKey(ref.storage_key)) {
          throw new Error('Stored asset variant has invalid storage reference');
        }
        otherKeys.add(objectRefKey(bucket, ref.storage_key));
      }

      const currentBucket = bucketForAsset(
        current.purpose,
        current.visibility,
        current.storage_key,
      );
      if (!currentBucket || !isSafeObjectKey(current.storage_key)) {
        throw new Error('Deleted asset has invalid storage reference');
      }
      const currentObjects: Array<{ bucket: BucketName; key: string }> = [
        { bucket: currentBucket, key: current.storage_key },
      ];
      for (const variant of currentVariants) {
        const bucket = bucketForAsset('media', variant.visibility, variant.storage_key);
        if (!bucket || !isSafeObjectKey(variant.storage_key)) {
          throw new Error('Deleted asset variant has invalid storage reference');
        }
        currentObjects.push({ bucket, key: variant.storage_key });
      }
      const deletedKeys = new Set<string>();
      for (const object of currentObjects) {
        const key = objectRefKey(object.bucket, object.key);
        if (otherKeys.has(key) || deletedKeys.has(key)) continue;
        deletedKeys.add(key);
        await dependencies.storage.deleteObject(object.bucket, object.key);
      }
      await trx
        .deleteFrom('object_asset')
        .where('id', '=', current.id)
        .where('purpose', '!=', 'export')
        .where('legal_hold', '=', false)
        .where('soft_deleted_at', '<=', cutoff)
        .execute();
      return true;
    });
    if (didPurge) purged += 1;
  }
  return purged;
}
